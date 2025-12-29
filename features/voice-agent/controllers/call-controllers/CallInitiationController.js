const axios = require('axios');
const { VAPIService } = require('../../services');
const { VoiceAgentModel } = require('../../models');
const { getSchema } = require('../../../../core/utils/schemaHelper');
const logger = require('../../../../core/utils/logger');

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

        return res.json({
          success: true,
          message: 'Call initiated via VAPI',
          data: result
        });
      } else {
        // Legacy call handling
        const baseUrl = process.env.BASE_URL;
        const frontendHeader = process.env.BASE_URL_FRONTEND_HEADER || req.headers['x-frontend-id'];
        const frontendApiKey = process.env.BASE_URL_FRONTEND_APIKEY || process.env.FRONTEND_API_KEY;

        if (!baseUrl) {
          return res.status(500).json({
            success: false,
            error: 'BASE_URL is not configured for call forwarding'
          });
        }

        // Get voice_id from agent if not provided (internal JS uses camelCase)
        let resolvedVoiceId = voiceId;
        if (!resolvedVoiceId && agentId) {
          try {
            const schema = getSchema(req);
            const agent = await this.agentModel.getAgentById(schema, agentId, tenantId);
            if (agent && agent.voice_id) {
              resolvedVoiceId = agent.voice_id;
            }
          } catch (error) {
            logger.warn('Failed to get voice_id from agent', { error: error.message, agentId });
          }
        }

        // Build payload for remote API (LAD Standard: API/HTTP uses snake_case)
        const callPayload = {
          to_number: phoneNumber,
          added_context: addedContext || '',
          initiated_by: userId,
          agent_id: parseInt(agentId, 10),
          lead_name: leadName || null,
          lead_id: leadId || null
        };

        // Only add voice_id if we have a valid value
        if (resolvedVoiceId) {
          callPayload.voice_id = resolvedVoiceId;
        }

        // Only add from_number if provided
        if (fromNumber) {
          callPayload.from_number = fromNumber;
        }

        try {
          const response = await axios.post(`${baseUrl}/calls`, callPayload, {
            headers: {
              'Content-Type': 'application/json',
              ...(frontendHeader && { 'X-Frontend-ID': frontendHeader }),
              ...(frontendApiKey && { 'X-API-Key': frontendApiKey })
            }
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
            responseData: forwardError.response?.data
          });

          return res.status(502).json({
            success: false,
            error: 'Failed to forward call to remote API',
            details: forwardError.response?.data || forwardError.message
          });
        }
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
}

module.exports = CallInitiationController;
