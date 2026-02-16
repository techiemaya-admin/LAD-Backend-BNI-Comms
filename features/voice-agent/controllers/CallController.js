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
const { getSchema } = require('../../../core/utils/schemaHelper');
const { deductCredits } = require('../../../shared/middleware/credit_guard');
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
        stats
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
   * GET /calls
   * Get call logs with filters and pagination
   */
  async getCallLogs(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const { status, agent_id, start_date, from_date, to_date, page, limit } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (agent_id) filters.agentId = agent_id;
      if (start_date) filters.startDate = new Date(start_date);
      if (from_date) filters.fromDate = new Date(from_date);
      if (to_date) filters.toDate = new Date(to_date);

      const user = req.user;
      const isAdmin = user?.role === 'admin';
      const capabilities = Array.isArray(user?.capabilities) ? user.capabilities : [];

      if (!isAdmin && capabilities.includes('leads_view_assigned') && user?.id) {
        filters.userId = user.id;
      }

      // Pagination parameters
      const currentPage = page ? parseInt(page, 10) : 1;
      const pageSize = limit ? parseInt(limit, 10) : 50;
      const offset = (currentPage - 1) * pageSize;

      // Get total count and paginated results
      const { calls, total } = await this.callLoggingService.getCallLogs(
        tenantId, 
        filters, 
        pageSize, 
        offset
      );

      const totalPages = Math.ceil(total / pageSize);

      res.json({
        success: true,
        logs: calls,
        count: calls.length,
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: total,
          totalPages: totalPages,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1
        }
      });
    } catch (error) {
      logger.error('Get call logs error:', error);
      // Return empty array if tables don't exist yet
      res.json({
        success: true,
        logs: [],
        data: [],
        count: 0,
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        },
        warning: 'Voice agent tables not yet migrated'
      });
    }
  }

  /**
   * GET /call/:call_log_id
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

      logger.info(`[CallController] Call log fetched for ${call_log_id}`);
      logger.info(`[CallController] Transcripts segments in DB result: ${callLog.transcripts?.segments?.length || 0}`);
      logger.info(`[CallController] Full transcripts object keys: ${callLog.transcripts ? Object.keys(callLog.transcripts).join(', ') : 'none'}`);
      
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

      logger.info(`[CallController] Sending response for call ${call_log_id}: transcripts segments=${callLog.transcripts?.segments?.length || 0}`);

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

  /**
   * V2: GET /calls/job/:job_id
   * Get call log by job ID
   */
  async getCallLogByJobId(req, res) {
    try {
      const { job_id } = req.params;
      const tenantId = req.tenantId || req.user?.tenantId;

      logger.info('[CallController] V2 getCallLogByJobId called', { job_id, tenantId });

      if (!job_id) {
        return res.status(400).json({
          success: false,
          error: 'job_id is required'
        });
      }

      // Try to get from local database first
      const localLog = await this.callModel.getCallLogById(job_id);
      
      if (localLog) {
        return res.json({
          success: true,
          log: localLog
        });
      }

      // If not found locally, forward to external service
      const baseUrl = process.env.BASE_URL;
      if (!baseUrl) {
        return res.status(404).json({
          success: false,
          error: 'Call log not found'
        });
      }

      const headers = {
        'Content-Type': 'application/json',
        'X-Frontend-ID': process.env.BASE_URL_FRONTEND_HEADER || 'dev',
        'X-API-Key': process.env.BASE_URL_FRONTEND_APIKEY || ''
      };

      try {
        const response = await axios.get(`${baseUrl}/calls/job/${job_id}`, { headers });
        
        return res.json({
          success: true,
          log: response.data
        });
      } catch (axiosError) {
        if (axiosError.response?.status === 404) {
          return res.status(404).json({
            success: false,
            error: 'Call log not found'
          });
        }
        throw axiosError;
      }

    } catch (error) {
      logger.error('[CallController] V2 getCallLogByJobId failed', { 
        error: error.message, 
        job_id: req.params.job_id 
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch call log',
        message: error.message
      });
    }
  }

  /**
   * Update/Recalculate credits for completed calls
   * 
   * This endpoint recalculates credits for all completed/ended calls based on their duration.
   * Formula: Math.ceil(duration_seconds / 60) * 3 credits per minute
   * 
   * Use case: Credit reconciliation after calls complete
   * 
   * @route POST /api/voiceagents/calls/update-credits
   * @access Protected (requires authentication)
   */
  async updateCallCredits(req, res) {
    try {
      const tenantId = req.user?.tenantId;
      const schema = getSchema(req);

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant context required'
        });
      }

      logger.info('[CallController] Starting credit reconciliation', { tenantId, schema });

      // Get all completed calls for this tenant
      const completedCalls = await this.callModel.getCompletedCallsForTenant(schema, tenantId);

      logger.info('[CallController] Found completed calls', { 
        tenantId, 
        count: completedCalls.length 
      });

      if (completedCalls.length === 0) {
        return res.json({
          success: true,
          message: 'No completed calls found to update',
          stats: {
            total_calls_checked: 0,
            calls_updated: 0,
            credits_recalculated: 0,
            discrepancies_found: 0
          }
        });
      }

      // Recalculate credits for each call
      const CREDITS_PER_MINUTE = 3;
      const updatedCalls = [];
      let totalCreditsRecalculated = 0;
      let totalCreditsAdjusted = 0; // Net adjustment to billing wallet
      let discrepanciesFound = 0;

      for (const call of completedCalls) {
        // Calculate correct credits: Math.ceil(duration_seconds / 60) * 3
        const durationMinutes = Math.ceil(call.duration_seconds / 60);
        const correctCredits = durationMinutes * CREDITS_PER_MINUTE;
        const currentCredits = parseFloat(call.credits_charged) || 0;

        // Check if there's a discrepancy
        if (correctCredits !== currentCredits) {
          discrepanciesFound++;
          const creditDifference = correctCredits - currentCredits;
          
          logger.info('[CallController] Credit discrepancy found', {
            call_id: call.id,
            duration_seconds: call.duration_seconds,
            current_credits: currentCredits,
            correct_credits: correctCredits,
            difference: creditDifference
          });

          try {
            // Update the call with correct credits
            const metadataUpdate = {
              credit_recalculation: {
                performed_at: new Date().toISOString(),
                old_credits: currentCredits,
                new_credits: correctCredits,
                duration_seconds: call.duration_seconds,
                duration_minutes: durationMinutes,
                difference: creditDifference
              }
            };

            await this.callModel.updateCallCredits(
              schema,
              call.id,
              tenantId,
              correctCredits,
              metadataUpdate
            );

            // Use Credit Guard for billing wallet and ledger updates
            // If creditDifference > 0: we undercharged, need to deduct MORE
            // If creditDifference < 0: we overcharged, need to REFUND (negative deduction)
            const usageType = creditDifference > 0 
              ? 'call_credit_reconciliation_charge'
              : 'call_credit_reconciliation_refund';

            await deductCredits(
              tenantId,
              'voice-agent',
              usageType,
              creditDifference, // Positive = debit, Negative = credit
              null, // No req object for background reconciliation
              {
                callId: call.id,
                leadId: call.lead_id,
                stepType: 'credit_adjustment',
                reconciliation: true,
                old_credits: currentCredits,
                new_credits: correctCredits,
                duration_seconds: call.duration_seconds,
                duration_minutes: durationMinutes
              }
            );

            logger.info('[CallController] Billing updated via Credit Guard', {
              call_id: call.id,
              tenant_id: tenantId,
              credit_adjustment: creditDifference,
              usage_type: usageType
            });

            updatedCalls.push({
              call_id: call.id,
              old_credits: currentCredits,
              new_credits: correctCredits,
              duration_seconds: call.duration_seconds,
              duration_minutes: durationMinutes,
              credit_adjustment: creditDifference,
              billing_updated: true
            });

            totalCreditsRecalculated += correctCredits;
            totalCreditsAdjusted += creditDifference;

          } catch (updateError) {
            logger.error('[CallController] Update failed for call', {
              call_id: call.id,
              error: updateError.message
            });
            // Continue with next call even if one fails
          }
        }
      }

      logger.info('[CallController] Credit reconciliation completed', {
        tenantId,
        total_calls_checked: completedCalls.length,
        calls_updated: updatedCalls.length,
        credits_recalculated: totalCreditsRecalculated,
        credits_adjusted: totalCreditsAdjusted,
        discrepancies_found: discrepanciesFound
      });

      return res.json({
        success: true,
        message: `Successfully recalculated credits for ${updatedCalls.length} calls`,
        stats: {
          total_calls_checked: completedCalls.length,
          calls_updated: updatedCalls.length,
          credits_recalculated: totalCreditsRecalculated,
          credits_adjusted: totalCreditsAdjusted,
          discrepancies_found: discrepanciesFound
        },
        billing: {
          wallet_debits: totalCreditsAdjusted > 0 ? totalCreditsAdjusted : 0,
          wallet_credits: totalCreditsAdjusted < 0 ? Math.abs(totalCreditsAdjusted) : 0,
          net_adjustment: totalCreditsAdjusted
        },
        updated_calls: updatedCalls.slice(0, 10) // Return first 10 for review
      });

    } catch (error) {
      logger.error('[CallController] Update call credits failed', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to update call credits',
        message: error.message
      });
    }
  }
}

module.exports = CallController;
