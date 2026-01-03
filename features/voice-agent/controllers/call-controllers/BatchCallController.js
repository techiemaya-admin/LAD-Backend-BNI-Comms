const axios = require('axios');
const { VAPIService } = require('../../services');
let logger;
try {
  logger = require('../../../../core/utils/logger');
} catch (e) {
  const loggerAdapter = require('../../utils/logger');
  logger = loggerAdapter.getLogger();
}

class BatchCallController {
  constructor(db) {
    this.vapiService = new VAPIService();
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
      if (this.vapiService.shouldUseVAPI(agentId)) {
        // Initiate batch calls via VAPI
        const vapiResults = await this.vapiService.batchInitiateCalls({
          entries,
          globalContext,
          agentId,
          assistantOverrides,
          tenantId,
          userId
        });

        return res.json({
          success: true,
          message: 'Batch calls initiated via VAPI',
          data: vapiResults
        });
      } else {
        // Legacy batch call handling
        const baseUrl = process.env.BASE_URL;
        const frontendHeader = req.headers['x-frontend-id'];
        const frontendApiKey = process.env.FRONTEND_API_KEY;

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
          logger.error('Error forwarding batch call data to remote API:', forwardError.message);
          
          return res.status(502).json({
            success: false,
            error: 'Failed to forward batch calls to remote API',
            details: forwardError.response?.data || forwardError.message
          });
        }
      }
    } catch (error) {
      logger.error('Batch initiate calls error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate batch calls',
        message: error.message
      });
    }
  }

  /**
   * V2: Initiate batch voice calls with UUID support
   * POST /batch/trigger-batch-call
   */
  async batchInitiateCallsV2(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const userId = req.user?.id;

      logger.info('[BatchCallController] V2 batchInitiateCalls called', {
        tenantId,
        userId,
        body: req.body
      });

      // V2 API payload structure
      const {
        voice_id,
        from_number,
        added_context,
        initiated_by,   // UUID string (V2 change)
        agent_id,
        llm_provider,
        llm_model,
        knowledge_base_store_ids,
        entries         // Array of batch entries
      } = req.body;

      // Validate required fields
      if (!voice_id) {
        return res.status(400).json({
          success: false,
          error: 'voice_id is required'
        });
      }

      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'entries array is required and must not be empty'
        });
      }

      // Validate each entry
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry.to_number) {
          return res.status(400).json({
            success: false,
            error: `Entry ${i}: to_number is required`
          });
        }

        // Validate E.164 format
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        if (!e164Regex.test(entry.to_number)) {
          return res.status(400).json({
            success: false,
            error: `Entry ${i}: to_number must be in E.164 format`
          });
        }
      }

      // Build payload for downstream service
      const batchPayload = {
        voice_id,
        from_number: from_number || null,
        added_context: added_context || null,
        initiated_by: initiated_by || null, // Now supports UUID string
        agent_id: agent_id || 'default',
        llm_provider: llm_provider || null,
        llm_model: llm_model || null,
        knowledge_base_store_ids: knowledge_base_store_ids || null,
        entries: entries.map(entry => ({
          to_number: entry.to_number,
          lead_name: entry.lead_name || null,
          added_context: entry.added_context || null,
          lead_id: entry.lead_id || null, // Now supports UUID string
          knowledge_base_store_ids: entry.knowledge_base_store_ids || null
        })),
        tenant_id: tenantId,
        user_id: userId
      };

      logger.info('[BatchCallController] V2 payload prepared', { 
        batchPayload: { ...batchPayload, entries: `${entries.length} entries` } 
      });

      // Use existing VAPI service or forward to external service
      if (this.vapiService.shouldUseVAPI(agent_id)) {
        const result = await this.vapiService.batchInitiateCalls(batchPayload);
        return res.json({
          success: true,
          result,
          message: 'Batch calls initiated successfully via VAPI'
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

        const response = await axios.post(`${baseUrl}/batch/trigger-batch-call`, batchPayload, { headers });
        
        return res.json({
          success: true,
          result: response.data,
          message: 'Batch calls initiated successfully via external service'
        });
      }

    } catch (error) {
      logger.error('[BatchCallController] V2 batchInitiateCalls failed', { 
        error: error.message, 
        stack: error.stack,
        body: req.body 
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to initiate batch calls',
        message: error.message
      });
    }
  }

  /**
   * V2: Get batch status
   * GET /batch/batch-status/:id
   */
  async getBatchStatusV2(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId || req.user?.tenantId;

      logger.info('[BatchCallController] V2 getBatchStatus called', { id, tenantId });

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Batch ID is required'
        });
      }

      // Forward to external service
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

      const response = await axios.get(`${baseUrl}/batch/batch-status/${id}`, { headers });
      
      return res.json({
        success: true,
        batch: response.data,
        message: 'Batch status retrieved successfully'
      });

    } catch (error) {
      logger.error('[BatchCallController] V2 getBatchStatus failed', { 
        error: error.message, 
        batchId: req.params.id 
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to get batch status',
        message: error.message
      });
    }
  }

  /**
   * V2: Cancel batch
   * POST /batch/batch-cancel/:id
   */
  async cancelBatchV2(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId || req.user?.tenantId;

      logger.info('[BatchCallController] V2 cancelBatch called', { id, tenantId });

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Batch ID is required'
        });
      }

      // Forward to external service
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

      const response = await axios.post(`${baseUrl}/batch/batch-cancel/${id}`, {}, { headers });
      
      return res.json({
        success: true,
        result: response.data,
        message: 'Batch cancelled successfully'
      });

    } catch (error) {
      logger.error('[BatchCallController] V2 cancelBatch failed', { 
        error: error.message, 
        batchId: req.params.id 
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel batch',
        message: error.message
      });
    }
  }
}

module.exports = BatchCallController;
