const axios = require('axios');
const { VAPIService } = require('../../services');
const { VoiceAgentModel } = require('../../models');
let logger;
try {
  logger = require('../../../../core/utils/logger');
} catch (e) {
  const loggerAdapter = require('../../utils/logger');
  logger = loggerAdapter.getLogger();
}

class CallInitiationController {
  constructor(db) {
    this.vapiService = new VAPIService();
    this.db = db;
    this.agentModel = new VoiceAgentModel(db);
  }

  /** 1.0
   * Initiate a single voice call
   */
  async initiateCall(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const userId = req.user?.id;

      // LAD Standard: API/HTTP uses snake_case, convert to camelCase for internal use
      const {
        // API/HTTP layer: snake_case (from frontend)
        to_number,
        agent_id,
        from_number,
        lead_name,
        lead_id,
        voice_id,
        added_context,
        assistant_overrides = {}
      } = req.body;

      // Convert to camelCase for internal JavaScript use
      const phoneNumber = to_number;
      const agentId = agent_id;
      const fromNumber = from_number;
      const leadName = lead_name;
      const leadId = lead_id;
      const voiceId = voice_id;
      const addedContext = added_context;
      const assistantOverrides = assistant_overrides;

      // Validate required fields
      if (!phoneNumber || !agentId) {
        return res.status(400).json({
          success: false,
          error: 'to_number and agent_id are required'
        });
      }

      // Check if should use VAPI (internal JS uses camelCase)
      if (this.vapiService.shouldUseVAPI(agentId)) {
        // Use VAPI for the call (internal JS uses camelCase)
        const result = await this.vapiService.initiateCall({
          phoneNumber,
          leadName,
          leadId,
          agentId,
          voiceId,
          fromNumber,
          addedContext,
          assistantOverrides,
          tenantId,
          userId
        });

        // Check if VAPI call was successful
        if (!result.success) {
          // If VAPI is temporarily disabled, log and fall through to legacy
          if (result.temporaryDisabled) {
            logger.warn('[CallInitiationController] VAPI temporarily disabled, using legacy fallback', { agentId, phoneNumber });
            // Don't return, fall through to legacy handling below
          } else {
            // For other VAPI failures, return error
            return res.status(500).json({
              success: false,
              error: 'VAPI call initiation failed',
              message: result.error,
              details: result.errorDetails
            });
          }
        } else {
          // VAPI call succeeded
          return res.json({
            success: true,
            message: 'Call initiated via VAPI',
            data: result
          });
        }
      }
      
      // Legacy call handling (also used as fallback when VAPI is disabled)
      const baseUrl = process.env.BASE_URL;
      const frontendHeader = process.env.BASE_URL_FRONTEND_HEADER || req.headers['x-frontend-id'];
      const frontendApiKey = process.env.BASE_URL_FRONTEND_APIKEY || process.env.FRONTEND_API_KEY;

      logger.info('Call forwarding configuration', {
        baseUrl: baseUrl || 'NOT_SET',
        hasHeader: !!frontendHeader,
        hasApiKey: !!frontendApiKey,
        agentId,
        phoneNumber: phoneNumber?.substring(0, 4) + '***' // Partial phone for privacy
      });

      if (!baseUrl) {
        return res.status(500).json({
          success: false,
          error: 'BASE_URL is not configured for call forwarding'
        });
      }

      // Build payload for remote API (LAD Standard: API/HTTP uses snake_case)
      const callPayload = {
        to_number: phoneNumber,
        added_context: addedContext || '',
        initiated_by: userId,
        agent_id: parseInt(agentId, 10),
        lead_name: leadName || null,
        voice_id: "default"
      };

      // Only add from_number if provided
      if (fromNumber) {
        callPayload.from_number = fromNumber;
      }

      try {
        logger.info('Forwarding call to remote API', {
          url: `${baseUrl}/calls`,
          payload: callPayload,
          agentId: callPayload.agent_id,
          leadId: callPayload.lead_id
        });

        const response = await axios.post(`${baseUrl}/calls`, callPayload, {
          headers: {
            'Content-Type': 'application/json',
            ...(frontendHeader && { 'X-Frontend-ID': frontendHeader }),
            ...(frontendApiKey && { 'X-API-Key': frontendApiKey })
          },
          timeout: 30000 // 30 second timeout for call forwarding
        });

        return res.json({
          success: true,
          message: 'Call forwarded to remote API',
          data: {
            remoteResponse: response.data,
            call: callPayload
          }
        });
      } catch (forwardError) {
        logger.error('Error forwarding call data to remote API', {
          error: forwardError.message,
          status: forwardError.response?.status,
          responseData: forwardError.response?.data,
          fullDetails: JSON.stringify(forwardError.response?.data, null, 2)
        });

        return res.status(502).json({
          success: false,
          error: 'Failed to forward call to remote API',
          details: forwardError.response?.data || forwardError.message
        });
      }
    } catch (error) {
      logger.error('Initiate call error', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: 'Failed to initiate call',
        message: error.message
      });
    }
  }

  /**
   * V2: Initiate a single voice call with UUID support
   * POST /calls/start-call
   * Directly uses backend voice calling service (no VAPI)
   * 
   * PREREQUISITES (validated by middleware):
   * 1. ✅ Authentication (JWT token via authenticateToken middleware)
   * 2. ✅ Feature Access (voice-agent feature via requireFeature middleware)
   * 3. ✅ Business Hours (configurable hours via validateVoiceCallPrerequisites)
   * 4. ✅ Credit Availability (minimum 3 credits via validateVoiceCallPrerequisites)
   * 5. ✅ Rate Limiting (calls per hour/day via validateVoiceCallPrerequisites)
   * 
   * USAGE IN ROUTES:
   * router.post('/calls/start-call',
   *   authenticateToken,                      // Step 1: Extract tenantId/userId from JWT
   *   requireFeature('voice-agent'),          // Step 2: Check feature access
   *   validateVoiceCallPrerequisites,         // Step 3-5: Business hours + Credits + Rate limit
   *   CallInitiationController.initiateCallV2 // Step 6: Execute call
   * );
   */
  async initiateCallV2(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      // Extract user ID from JWT - field name is userId, not id
      const userId = req.user?.userId || req.user?.id;

      logger.info('[CallInitiationController] V2 initiateCall called', {
        tenantId,
        userId,
        body: req.body
      });

      // V2 API payload structure
      const {
        voice_id,
        to_number,
        from_number,
        added_context,
        llm_provider,
        llm_model,
        initiated_by,
        agent_id,
        lead_name,
        lead_id,
        knowledge_base_store_ids
      } = req.body;

      // Validate required fields
      if (!to_number) {
        logger.warn('[CallInitiationController] Missing to_number', { body: req.body });
        return res.status(400).json({
          success: false,
          error: 'to_number is required',
          details: 'Phone number to call is required in the request body'
        });
      }

      if (!voice_id) {
        logger.warn('[CallInitiationController] Missing voice_id', { body: req.body });
        return res.status(400).json({
          success: false,
          error: 'voice_id is required',
          details: 'Voice ID/type is required in the request body'
        });
      }

      // Validate E.164 format for phone number
      const e164Regex = /^\+[1-9]\d{1,14}$/;
      if (!e164Regex.test(to_number)) {
        logger.warn('[CallInitiationController] Invalid phone number format', { 
          to_number,
          expectedFormat: '+[1-9]XXXXXXXXXX (E.164)'
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format',
          details: `to_number must be in E.164 format (e.g., +1234567890). Received: ${to_number}`
        });
      }

      // Build payload for voice service
      // Use authenticated user ID from backend, not frontend-provided value
      const callPayload = {
        to_number,
        agent_id: agent_id || 'default',
        from_number: from_number || null,
        lead_name: lead_name || null,
        lead_id: lead_id || null,
        voice_id,
        added_context: added_context || null,
        llm_provider: llm_provider || null,
        llm_model: llm_model || null,
        initiated_by: userId || initiated_by || null, // Prefer authenticated user ID
        knowledge_base_store_ids: knowledge_base_store_ids || null,
        tenant_id: tenantId,
        user_id: userId
      };

      logger.info('[CallInitiationController] Initiating call via voice service', {
        agentId: agent_id,
        tenantId: tenantId,
        toNumber: to_number?.substring(0, 4) + '***'
      });

      // Call voice service
      const baseUrl = process.env.BASE_URL;
      const frontendHeader = process.env.BASE_URL_FRONTEND_HEADER || req.headers['x-frontend-id'];
      const frontendApiKey = process.env.BASE_URL_FRONTEND_APIKEY || process.env.FRONTEND_API_KEY;

      if (!baseUrl) {
        return res.status(500).json({
          success: false,
          error: 'BASE_URL is not configured for voice calling'
        });
      }

      try {
        const callUrl = `${baseUrl}/calls/start-call`;
        
        // Get JWT token from request headers to forward to voice service
        const authHeader = req.headers.authorization || req.headers['x-access-token'] || '';
        
        logger.info('Calling voice service', {
          url: callUrl,
          agentId: agent_id,
          toNumber: to_number?.substring(0, 4) + '***',
          hasApiKey: !!frontendApiKey,
          hasAuthToken: !!authHeader
        });

        const response = await axios.post(callUrl, callPayload, {
          headers: {
            'Content-Type': 'application/json',
            ...(frontendHeader && { 'X-Frontend-ID': frontendHeader }),
            ...(frontendApiKey && { 'X-API-Key': frontendApiKey }),
            ...(authHeader && { 'Authorization': authHeader })
          },
          timeout: 30000
        });

        logger.info('Voice service call successful', {
          agentId: agent_id,
          responseData: response.data
        });

        return res.json({
          success: true,
          message: 'Call initiated successfully',
          data: response.data
        });
      } catch (voiceServiceError) {
        logger.error('Voice service call failed', {
          error: voiceServiceError.message,
          status: voiceServiceError.response?.status,
          responseData: voiceServiceError.response?.data,
          baseUrl: baseUrl,
          endpoint: `${baseUrl}/calls/start-call`,
          agentId: agent_id
        });

        return res.status(voiceServiceError.response?.status || 502).json({
          success: false,
          error: 'Failed to initiate call with voice service',
          details: voiceServiceError.response?.data || voiceServiceError.message
        });
      }

    } catch (error) {
      logger.error('[CallInitiationController] V2 initiateCall failed', { 
        error: error.message, 
        stack: error.stack,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        body: req.body 
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to initiate call',
        message: error.message,
        details: error.response?.data?.error || error.response?.data?.message || 'Unknown error'
      });
    }
  }
}

module.exports = CallInitiationController;
