// const { VAPIService } = require('../../services');
const axios = require('axios');

class BatchCallController {
  constructor(db) {
    // VAPI disabled: keep code commented for future re-enable.
    // this.vapiService = new VAPIService();
    this.db = db;
  }

  /**
   * Initiate batch voice calls1.0
   */
  async batchInitiateCalls(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const userId = req.user?.id;

      const {
        entries, // Array of {phoneNumber, leadName, leadId, added_context, summary}
        agentId,
        voiceId,
        fromNumber,
        added_context: globalContext, // Global context for all calls
        assistantOverrides = {}
      } = req.body;

      // Validate required fields
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'entries array is required and must not be empty'
        });
      }

      if (!agentId) {
        return res.status(400).json({
          success: false,
          error: 'agentId is required'
        });
      }

      // VAPI agents use VAPI batch API; others forward to legacy BASE_URL /calls/batch
      // VAPI disabled: always use legacy forwarding for now.
      //
      // if (this.vapiService.shouldUseVAPI(agentId)) {
      //   const vapiResults = await this.vapiService.batchInitiateCalls({
      //     entries,
      //     globalContext,
      //     agentId,
      //     assistantOverrides,
      //     tenantId,
      //     userId
      //   });
      //
      //   return res.json({
      //     success: true,
      //     message: 'Batch calls initiated via VAPI',
      //     data: vapiResults
      //   });
      // } else {
        // Legacy batch call handling
        const baseUrl = process.env.BASE_URL;
        const frontendHeader = process.env.BASE_URL_FRONTEND_HEADER || req.headers['x-frontend-id'];
        const frontendApiKey = process.env.BASE_URL_FRONTEND_APIKEY;

        if (!baseUrl) {
          return res.status(500).json({
            success: false,
            error: 'BASE_URL is not configured for batch call forwarding'
          });
        }

        const batchPayload = {
          entries,
          agent_id: agentId,
          voice_id: voiceId,
          from_number: fromNumber,
          added_context: globalContext,
          initiated_by: userId
        };

        try {
          const response = await axios.post(`${baseUrl}/calls/batch`, batchPayload, {
            headers: {
              'Content-Type': 'application/json',
              ...(frontendHeader && { 'X-Frontend-ID': frontendHeader }),
              ...(frontendApiKey && { 'X-API-Key': frontendApiKey })
            }
          });

          return res.json({
            success: true,
            message: 'Batch calls forwarded to remote API',
            data: response.data
          });
        } catch (forwardError) {
          console.error('Error forwarding batch call data to remote API:', forwardError.message);
          
          return res.status(502).json({
            success: false,
            error: 'Failed to forward batch calls to remote API',
            details: forwardError.response?.data || forwardError.message
          });
        }
      // }
    } catch (error) {
      console.error('Batch initiate calls error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate batch calls',
        message: error.message
      });
    }
  }
}

module.exports = BatchCallController;
