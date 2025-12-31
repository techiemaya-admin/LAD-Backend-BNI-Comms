/**
 * Call Controller 1.0
 * 
 * Handles call management, call logs, and call-related operations
 * Note: Call initiation and batch calls have been moved to separate controllers
 */
require('dotenv')
const axios = require('axios');
const { VoiceCallModel, PhoneResolverModel, VoiceAgentModel } = require('../models');
const { VAPIService, CallLoggingService, RecordingService } = require('../services');
let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  const loggerAdapter = require('../utils/logger');
  logger = loggerAdapter.getLogger();
}

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

      const baseUrl = process.env.BASE_URL;
      const frontendHeader = process.env.BASE_URL_FRONTEND_HEADER;
      const frontendApiKey = process.env.BASE_URL_FRONTEND_APIKEY;

      if (!baseUrl) {
        return res.status(500).json({
          success: false,
          error: 'BASE_URL is not configured for recording signed URLs'
        });
      }

      const signingEndpoint = `${baseUrl}/recordings/calls/${id}/signed-url`;

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
      logger.error('Get call recording signed URL error:', error?.response?.data || error.message);
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
      logger.error('Resolve phones error:', error);
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
      logger.error('Update sales summary error:', error);
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

      // Role & capability based access control
      const user = req.user;
      const isAdmin = user?.role === 'admin';
      const capabilities = Array.isArray(user?.capabilities) ? user.capabilities : [];

      // If user has leads_view_assigned capability and is not admin,
      // restrict to calls initiated by this user only
      if (!isAdmin && capabilities.includes('leads_view_assigned') && user?.id) {
        filters.userId = user.id;
      }

      const calls = await this.callLoggingService.getRecentCalls(tenantId, filters);

      res.json({
        success: true,
        data: calls,
        count: calls.length
      });
    } catch (error) {
      logger.error('Get recent calls error:', error);
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
      logger.error('Get call stats error:', error);
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
      const isAdmin = user?.role === 'admin';
      const capabilities = Array.isArray(user?.capabilities) ? user.capabilities : [];

      if (!isAdmin && capabilities.includes('leads_view_assigned') && user?.id) {
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
      logger.error('Get call logs error:', error);
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

      // Check if user has access to this call log
      const user = req.user;
      const isAdmin = user?.role === 'admin';
      const capabilities = Array.isArray(user?.capabilities) ? user.capabilities : [];

      // If user is not admin and has leads_view_assigned capability,
      // verify they initiated this call
      if (!isAdmin && capabilities.includes('leads_view_assigned') && user?.id) {
        if (callLog.initiated_by_user_id !== user.id) {
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
          logger.error('Error generating signed URL for call recording:', error);
          // Don't fail the request if we can't get a signed URL
          // The client can still try to access the recording URL directly if needed
        }
      }

      return res.json({
        success: true,
        data: callLog
      });

    } catch (error) {
      logger.error('Get call log by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch call log',
        message: error.message
      });
    }
  }
}

module.exports = CallController;
