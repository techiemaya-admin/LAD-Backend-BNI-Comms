/**
 * Call Controller1.0
 * 
 * Handles call management, call logs, and call-related operations
 * Note: Call initiation and batch calls have been moved to separate controllers
 */
require('dotenv')
const axios = require('axios');
const { VoiceCallModel, PhoneResolverModel, VoiceAgentModel } = require('../models');
const { VAPIService, CallLoggingService, RecordingService } = require('../services');
const { getSchemaFromRequest } = require('../utils/schemaHelper');

class CallController {
  constructor(db) {
    this.callModel = new VoiceCallModel(db);
    this.phoneResolver = new PhoneResolverModel(db);
    this.agentModel = new VoiceAgentModel(db);
    this.vapiService = new VAPIService();
    this.callLoggingService = new CallLoggingService(db);
    this.recordingService = new RecordingService();
  }

  /**
   * GET /calls/:id/recording-signed-url
   * Get signed URL for call recording
   */
  async getCallRecordingSignedUrl(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'id is required'
        });
      }

      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant context required'
        });
      }

      const baseUrl = process.env.BASE_URL;
      const frontendHeader = process.env.BASE_URL_FRONTEND_HEADER;
      const frontendApiKey = process.env.BASE_URL_FRONTEND_APIKEY;

      if (!baseUrl) {
        return res.status(500).json({
          success: false,
          error: 'BASE_URL is not configured for recording signed URLs'
        });
      }

      // IMPORTANT:
      // The signing service expects the recording identifier (recording_url from voice_call_logs),
      // not the call_log_id. So fetch the call log first.
      const callLog = await this.callLoggingService.getCallLog(id, tenantId);
      if (!callLog) {
        return res.status(404).json({
          success: false,
          error: 'Call log not found'
        });
      }

      const user = req.user;
      if (shouldRestrictToInitiator(user)) {
        if (String(callLog.initiated_by_user_id) !== String(user.id)) {
          return res.status(403).json({
            success: false,
            error: 'You do not have permission to view this call recording'
          });
        }
      }

      const recordingUrl = callLog.recording_url;
      if (!recordingUrl) {
        return res.status(404).json({
          success: false,
          error: 'Recording not found',
          message: 'This call log does not have a recording_url yet.'
        });
      }

      const signingEndpoint = `${baseUrl}/recordings/calls/${encodeURIComponent(String(recordingUrl))}/signed-url`;

      const response = await axios.get(signingEndpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...(frontendHeader && { 'X-Frontend-ID': frontendHeader }),
          ...(frontendApiKey && { 'X-API-Key': frontendApiKey })
        }
      });

      const signedUrl =
        response?.data?.signed_url ||
        response?.data?.url ||
        response?.data;

      if (!signedUrl || typeof signedUrl !== 'string') {
        return res.status(502).json({
          success: false,
          error: 'Failed to obtain signed URL from signing service'
        });
      }

      return res.status(200).json({
        success: true,
        signed_url: signedUrl
      });
    } catch (error) {
      console.error('Get call recording signed URL error:', error?.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate signed URL'
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

      const user = req.user;

      // If user has leads_view_assigned (and is not owner/admin and has no viewAll),
      // restrict to calls initiated by this user only.
      if (shouldRestrictToInitiator(user)) {
        filters.userId = user.id;
      }

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

  /**
   * GET /calllogs
   * Get call logs with filters
   */
  async getCallLogs(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const { status, agent_id, start_date, limit } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (agent_id) filters.agentId = agent_id;
      if (start_date) filters.startDate = new Date(start_date);

      const user = req.user;
      if (shouldRestrictToInitiator(user)) {
        filters.userId = user.id;
      }

      const parsedLimit = limit ? parseInt(limit, 10) : 50;
      const calls = await this.callLoggingService.getCallLogs(tenantId, filters, parsedLimit);

      res.json({
        success: true,
        data: calls,
        count: calls.length
      });
    } catch (error) {
      console.error('Get call logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch call logs',
        message: error.message
      });
    }
  }

  /**
   * GET /calllogs/:call_log_id
   * Get a single call log by ID with signed recording URL
   */
  async getCallLogById(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const { call_log_id } = req.params;

      if (!call_log_id) {
        return res.status(400).json({
          success: false,
          error: 'call_log_id parameter is required'
        });
      }

      const callLog = await this.callLoggingService.getCallLog(call_log_id, tenantId);

      if (!callLog) {
        return res.status(404).json({
          success: false,
          error: 'Call log not found'
        });
      }

      // Check if user has access to this call log.
      // Only restrict when user has leads_view_assigned and does not have owner/admin/viewAll.
      const user = req.user;
      if (shouldRestrictToInitiator(user)) {
        if (String(callLog.initiated_by_user_id) !== String(user.id)) {
          return res.status(403).json({
            success: false,
            error: 'You do not have permission to view this call log'
          });
        }
      }

      // If there's a recording URL, get a signed URL for it
      if (callLog.recording_url) {
        try {
          const signingEndpoint = `${process.env.BASE_URL}/recordings/calls/${callLog.recording_url}/signed-url`;
          const response = await axios.get(signingEndpoint, { 
            headers: { 
              'Content-Type': 'application/json', 
              'X-Frontend-ID': process.env.BASE_URL_FRONTEND_HEADER, 
              'X-API-Key': process.env.BASE_URL_FRONTEND_APIKEY 
            } 
          });

          const signedUrl = response?.data?.signed_url || response?.data?.url || response?.data;
          
          if (signedUrl && typeof signedUrl === 'string') {
            callLog.signed_recording_url = signedUrl;
          }
        } catch (error) {
          console.error('Error generating signed URL for call recording:', error);
          // Don't fail the request if we can't get a signed URL
          // The client can still try to access the recording URL directly if needed
        }
      }

      return res.json({
        success: true,
        data: callLog
      });

    } catch (error) {
      console.error('Get call log by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch call log',
        message: error.message
      });
    }
  }

  /**
   * GET /calllogs/batch/:batch_id
   * Get call logs for a specific batch
   */
  async getBatchCallLogsByBatchId(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const { batch_id: batchId } = req.params;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant context required'
        });
      }

      if (!batchId || typeof batchId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'batch_id is required'
        });
      }

      const schema = getSchemaFromRequest(req);

      const calls = await this.callModel.getBatchCallsByBatchId(schema, tenantId, batchId);

      const results = (calls || []).map((c, idx) => ({
        // Prefer the entry's call_log_id (from voice_call_batch_entries),
        // fall back to vc.id if present
        call_log_id: c.entry_call_log_id || c.id || null,
        batch_id: c.batch_id || batchId,
        batch_entry_id: c.batch_entry_id || null,
        // Prefer batch entry phone/status/error, then fall back to call log
        to_number: c.to_phone || c.to_number || null,
        status: c.entry_status || c.call_status || c.status || 'pending',
        index: idx,
        lead_id: c.lead_id || null,
        added_context: c.added_context || null,
        room_name: c.room_name || null,
        dispatch_id: c.dispatch_id || null,
        error: c.last_error || c.error || null,
        started_at: c.started_at || null,
        ended_at: c.ended_at || null,
        // Only include full call_log object when we have a real log row
        call_log: c.id ? c : null,
      }));

      return res.json({
        success: true,
        batch_id: batchId,
        count: results.length,
        results,
      });
    } catch (error) {
      logger.error('Get batch call logs by batch_id error:', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch batch call logs',
        message: error.message,
      });
    }
  }
}

module.exports = CallController;
