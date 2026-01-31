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
   */
  async initiateCallV2(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const userId = req.user?.id;

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
        initiated_by,   // UUID string (V2 change)
        agent_id,
        lead_name,
        lead_id,        // UUID string (V2 change)
        knowledge_base_store_ids
      } = req.body;

      // Validate required fields
      if (!to_number) {
        return res.status(400).json({
          success: false,
          error: 'to_number is required'
        });
      }

      if (!voice_id) {
        return res.status(400).json({
          success: false,
          error: 'voice_id is required'
        });
      }

      // Validate E.164 format for phone number
      const e164Regex = /^\+[1-9]\d{1,14}$/;
      if (!e164Regex.test(to_number)) {
        return res.status(400).json({
          success: false,
          error: 'to_number must be in E.164 format (e.g., +1234567890)'
        });
      }

      // Build payload for downstream service (maintaining V1 internal structure for now)
      const callPayload = {
        to_number,
        agent_id: agent_id || 'default',
        from_number: from_number || null,
        lead_name: lead_name || null,
        lead_id: lead_id || null, // Now supports UUID string
        voice_id,
        added_context: added_context || null,
        llm_provider: llm_provider || null,
        llm_model: llm_model || null,
        initiated_by: initiated_by || null, // Now supports UUID string
        knowledge_base_store_ids: knowledge_base_store_ids || null,
        tenant_id: tenantId,
        user_id: userId
      };

      logger.info('[CallInitiationController] V2 payload prepared', { callPayload });

      // Use existing VAPI service or forward to external service
      if (this.vapiService.shouldUseVAPI(agent_id)) {
        const result = await this.vapiService.initiateCall(callPayload);
        return res.json({
          success: true,
          result,
          message: 'Call initiated successfully via VAPI'
        });
      } else {
        // Forward to external voice agent service
        const baseUrl = process.env.BASE_URL;
        if (!baseUrl) {
          return res.status(500).json({
            success: false,
            error: 'External voice agent service not configured'
          });
        }

        const headers = {
          'Content-Type': 'application/json',
          'X-Frontend-ID': process.env.BASE_URL_FRONTEND_HEADER || 'dev',
          'X-API-Key': process.env.BASE_URL_FRONTEND_APIKEY || ''
        };

        const response = await axios.post(`${baseUrl}/calls/start-call`, callPayload, { headers });
        
        return res.json({
          success: true,
          result: response.data,
          message: 'Call initiated successfully via external service'
        });
      }

    } catch (error) {
      logger.error('[CallInitiationController] V2 initiateCall failed', { 
        error: error.message, 
        stack: error.stack,
        body: req.body 
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to initiate call',
        message: error.message
      });
    }
  }
}

module.exports = CallInitiationController;
