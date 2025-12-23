/**
 * Call Controller
 * 
 * Handles voice call initiation, batch calling, and call management
 * Integrates with VAPI service and call logging
 */

const { VoiceCallModel, PhoneResolverModel } = require('../models');
const { VAPIService, CallLoggingService, RecordingService } = require('../services');

class CallController {
  constructor(db) {
    this.callModel = new VoiceCallModel(db);
    this.phoneResolver = new PhoneResolverModel(db);
    this.vapiService = new VAPIService();
    this.callLoggingService = new CallLoggingService(db);
    this.recordingService = new RecordingService();
  }

  /**
   * POST /calls
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
        // Route to VAPI
        const vapiResult = await this.vapiService.initiateCall({
          phoneNumber,
          leadName: leadName || 'there',
          agentId,
          addedContext,
          assistantOverrides
        });

        if (!vapiResult.success) {
          return res.status(500).json({
            success: false,
            error: 'Failed to initiate VAPI call',
            details: vapiResult.error
          });
        }

        // Log the call
        const callLog = await this.callLoggingService.createCallLog({
          tenantId,
          voiceId,
          agentId,
          fromNumber,
          toNumber: phoneNumber,
          leadId,
          initiatedBy: userId,
          addedContext,
          vapiResponse: vapiResult.data
        });

        return res.json({
          success: true,
          message: 'Call initiated via VAPI',
          data: {
            callId: callLog.id,
            vapiCallId: vapiResult.vapiCallId,
            status: vapiResult.status,
            phoneNumber,
            leadName
          }
        });
      } else {
        // Custom agent (non-VAPI) - implement custom logic here
        return res.status(501).json({
          success: false,
          error: 'Custom agent calls not yet implemented',
          message: 'Only VAPI agents (agent_id "24" or "VAPI") are currently supported'
        });
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

  /**
   * POST /calls/batch
   * Initiate batch voice calls
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

      // Check if should use VAPI
      if (!this.vapiService.shouldUseVAPI(agentId)) {
        return res.status(501).json({
          success: false,
          error: 'Only VAPI agents are supported for batch calls'
        });
      }

      // Initiate batch calls via VAPI
      const vapiResults = await this.vapiService.batchInitiateCalls({
        entries,
        globalContext,
        agentId,
        assistantOverrides
      });

      // Log successful calls
      const callLogs = await this.callLoggingService.createBatchCallLogs({
        tenantId,
        entries,
        vapiResults,
        agentId,
        voiceId,
        fromNumber,
        initiatedBy: userId
      });

      // Compile results
      const successCount = vapiResults.filter(r => r.success).length;
      const failureCount = vapiResults.length - successCount;

      res.json({
        success: true,
        message: `Batch calls initiated: ${successCount} successful, ${failureCount} failed`,
        data: {
          total: vapiResults.length,
          successful: successCount,
          failed: failureCount,
          results: vapiResults,
          callLogs: callLogs
        }
      });
    } catch (error) {
      console.error('Batch initiate calls error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate batch calls',
        message: error.message
      });
    }
  }

  /**
   * GET /calls/:id/recording-signed-url
   * Get signed URL for call recording
   */
  async getCallRecordingSignedUrl(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId || req.user?.tenantId;
      const expirationHours = parseInt(req.query.expiration_hours) || 96;

      // Get call log
      const call = await this.callModel.getCallById(id, tenantId);

      if (!call) {
        return res.status(404).json({
          success: false,
          error: 'Call not found'
        });
      }

      if (!call.recording_url) {
        return res.status(404).json({
          success: false,
          error: 'Recording not available for this call'
        });
      }

      // Get signed URL
      const result = await this.recordingService.getRecordingSignedUrl(
        id,
        expirationHours
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          call_id: id,
          signed_url: result.signedUrl,
          expires_at: result.expiresAt,
          expiration_hours: expirationHours
        }
      });
    } catch (error) {
      console.error('Get call recording signed URL error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate signed URL',
        message: error.message
      });
    }
  }

  /**
   * POST /resolve-phones
   * Resolve phone numbers from company or employee caches
   */
  async resolvePhones(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const { ids, type } = req.body;

      // Validate required fields
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'ids array is required and must not be empty'
        });
      }

      if (!type || !['company', 'employee'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'type must be either "company" or "employee"'
        });
      }

      // Resolve phones
      const results = await this.phoneResolver.resolvePhones(ids, type, tenantId);

      res.json({
        success: true,
        data: results,
        count: results.length,
        type
      });
    } catch (error) {
      console.error('Resolve phones error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resolve phone numbers',
        message: error.message
      });
    }
  }

  /**
   * POST /update-summary
   * Update sales summary for a company or employee
   */
  async updateSalesSummary(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const { id, type, sales_summary } = req.body;

      // Validate required fields
      if (!id || !type || !sales_summary) {
        return res.status(400).json({
          success: false,
          error: 'id, type, and sales_summary are required'
        });
      }

      if (!['company', 'employee'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'type must be either "company" or "employee"'
        });
      }

      let result;
      if (type === 'company') {
        result = await this.phoneResolver.updateCompanySalesSummary(
          id,
          sales_summary,
          tenantId
        );
      } else {
        result = await this.phoneResolver.updateEmployeeCompanySalesSummary(
          id,
          sales_summary,
          tenantId
        );
      }

      if (!result) {
        return res.status(404).json({
          success: false,
          error: `${type} not found`
        });
      }

      res.json({
        success: true,
        message: 'Sales summary updated',
        data: result
      });
    } catch (error) {
      console.error('Update sales summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update sales summary',
        message: error.message
      });
    }
  }

  /**
   * GET /calls/recent
   * Get recent calls for tenant
   */
  async getRecentCalls(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const { status, agent_id, start_date } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (agent_id) filters.agentId = agent_id;
      if (start_date) filters.startDate = new Date(start_date);

      const calls = await this.callLoggingService.getRecentCalls(tenantId, filters);

      res.json({
        success: true,
        data: calls,
        count: calls.length
      });
    } catch (error) {
      console.error('Get recent calls error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch calls',
        message: error.message
      });
    }
  }

  /**
   * GET /calls/stats
   * Get call statistics
   */
  async getCallStats(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const { start_date, end_date } = req.query;

      const dateRange = {};
      if (start_date) dateRange.startDate = new Date(start_date);
      if (end_date) dateRange.endDate = new Date(end_date);

      const stats = await this.callLoggingService.getCallStats(tenantId, dateRange);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get call stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch call statistics',
        message: error.message
      });
    }
  }
}

module.exports = CallController;
