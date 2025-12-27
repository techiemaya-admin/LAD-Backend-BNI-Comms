const axios = require('axios');
const { VAPIService } = require('../../services');

class CallInitiationController {
  constructor(db) {
    this.vapiService = new VAPIService();
    this.db = db;
  }

  /** 1.0
   * Initiate a single voice call
   */
  async initiateCall(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const userId = req.user?.id;

      const {
        phoneNumber,
        leadName,
        leadId,
        agentId,
        voiceId,
        fromNumber,
        addedContext,
        assistantOverrides = {}
      } = req.body;

      // Validate required fields
      if (!phoneNumber || !agentId) {
        return res.status(400).json({
          success: false,
          error: 'phoneNumber and agentId are required'
        });
      }

      // Check if should use VAPI
      if (this.vapiService.shouldUseVAPI(agentId)) {
        // Use VAPI for the call
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
        const frontendHeader = req.headers['x-frontend-id'];
        const frontendApiKey = process.env.FRONTEND_API_KEY;

        if (!baseUrl) {
          return res.status(500).json({
            success: false,
            error: 'BASE_URL is not configured for call forwarding'
          });
        }

        const callPayload = {
          voice_id: voiceId || null,
          from_number: fromNumber || null,
          to_number: phoneNumber,
          added_context: addedContext,
          initiated_by: userId,
          agent_id: parseInt(agentId, 10),
          lead_name: leadName,
          lead_id: leadId
        };

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
          console.error('Error forwarding call data to remote API:', forwardError.message);
          if (forwardError.response) {
            console.error('Response status:', forwardError.response.status);
            console.error('Response data:', forwardError.response.data);
          }

          return res.status(502).json({
            success: false,
            error: 'Failed to forward call to remote API',
            details: forwardError.response?.data || forwardError.message
          });
        }
      }
    } catch (error) {
      console.error('Initiate call error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate call',
        message: error.message
      });
    }
  }
}

module.exports = CallInitiationController;
