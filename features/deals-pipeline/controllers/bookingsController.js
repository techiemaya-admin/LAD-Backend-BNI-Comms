/**
 * Bookings Controller
 * 
 * Request/response handling for booking-related operations
 * Handles follow-up call execution endpoint (called by Cloud Tasks)
 * No SQL - delegates to services
 */

const FollowUpExecutionService = require('../services/followUpExecutionService');
const FollowUpSchedulerService = require('../services/followUpSchedulerService');
const BookingsRepository = require('../repositories/bookingsRepository');

let logger;
let getSchema;
try {
  logger = require('../../../core/utils/logger');
  ({ getSchema } = require('../../../core/utils/schemaHelper'));
} catch (e) {
  logger = {
    info: (...args) => console.log('[BookingsController INFO]', ...args),
    error: (...args) => console.error('[BookingsController ERROR]', ...args),
    warn: (...args) => console.warn('[BookingsController WARN]', ...args)
  };
  // Fallback schema helper
  getSchema = (req) => {
    if (req?.user?.schema) return req.user.schema;
    if (req?.user?.tenant_id) return `tenant_${req.user.tenant_id}`;
    return process.env.DEFAULT_SCHEMA || 'lad_dev';
  };
}

class BookingsController {
  constructor(db) {
    this.executionService = new FollowUpExecutionService(db);
    this.schedulerService = new FollowUpSchedulerService(db);
    this.bookingsRepo = new BookingsRepository(db);
  }

  /**
   * POST /bookings/:id/execute-followup
   * Internal endpoint called by Cloud Tasks to execute follow-up calls
   * 
   * Security: Must validate Cloud Tasks authentication
   */
  async executeFollowUpCall(req, res) {
    try {
      // Validate Cloud Tasks authentication
      const taskName = req.headers['x-cloudtasks-taskname'];
      const queueName = req.headers['x-cloudtasks-queuename'];

      if (!taskName || !queueName) {
        logger.warn('Unauthorized access attempt to follow-up execution endpoint:', {
          ip: req.ip,
          headers: req.headers
        });

        return res.status(403).json({
          success: false,
          error: 'Forbidden - not authorized (Cloud Tasks only)'
        });
      }

      logger.info('Cloud Tasks request verified:', {
        taskName,
        queueName
      });

      const { id: bookingId } = req.params;
      const {
        tenantId,
        leadId,
        assignedUserId,
        idempotencyKey
      } = req.body;

      // Validate required fields
      if (!tenantId || !bookingId || !leadId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId, bookingId, and leadId are required'
        });
      }

      // Resolve schema from tenant
      const schema = getSchema({ user: { tenant_id: tenantId } });

      logger.info('Executing follow-up call from Cloud Task:', {
        tenantId,
        bookingId,
        leadId,
        idempotencyKey
      });

      // Execute the follow-up call (idempotent)
      const result = await this.executionService.executeFollowUpCall({
        tenantId,
        bookingId,
        leadId,
        assignedUserId,
        idempotencyKey,
        schema
      });

      // Return 200 even for already-executed calls (idempotency)
      const statusCode = result.success ? 200 : 500;

      return res.status(statusCode).json(result);
    } catch (error) {
      logger.error('Execute follow-up call endpoint error:', {
        bookingId: req.params.id,
        error: error.message,
        stack: error.stack
      });

      // Return 500 for Cloud Tasks to retry
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /bookings/:id/schedule-followup
   * Schedule a follow-up call for a booking
   */
  async scheduleFollowUpCall(req, res) {
    try {
      const { id: bookingId } = req.params;
      const tenantId = req.tenantId || req.user?.tenantId;
      const schema = getSchema(req);

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant context required'
        });
      }

      // Get booking details
      const booking = await this.bookingsRepo.getBookingById(
        schema,
        bookingId,
        tenantId
      );

      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }

      // Schedule the follow-up call
      const result = await this.schedulerService.scheduleFollowUpCall({
        tenantId,
        bookingId,
        leadId: booking.lead_id,
        assignedUserId: booking.assigned_user_id,
        scheduledAt: booking.scheduled_at,
        bookingType: booking.booking_type,
        schema
      });

      return res.status(200).json(result);
    } catch (error) {
      logger.error('Schedule follow-up call endpoint error:', {
        bookingId: req.params.id,
        error: error.message
      });

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * DELETE /bookings/:id/followup
   * Cancel a scheduled follow-up call
   */
  async cancelFollowUpCall(req, res) {
    try {
      const { id: bookingId } = req.params;
      const tenantId = req.tenantId || req.user?.tenantId;
      const schema = getSchema(req);

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant context required'
        });
      }

      const result = await this.schedulerService.cancelFollowUpCall(
        schema,
        bookingId,
        tenantId
      );

      return res.status(200).json(result);
    } catch (error) {
      logger.error('Cancel follow-up call endpoint error:', {
        bookingId: req.params.id,
        error: error.message
      });

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /bookings/:id/followup-status
   * Get follow-up call execution status
   */
  async getFollowUpStatus(req, res) {
    try {
      const { id: bookingId } = req.params;
      const tenantId = req.tenantId || req.user?.tenantId;
      const schema = getSchema(req);

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant context required'
        });
      }

      const status = await this.executionService.getExecutionStatus(
        schema,
        bookingId,
        tenantId
      );

      return res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Get follow-up status endpoint error:', {
        bookingId: req.params.id,
        error: error.message
      });

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /bookings/:id/retry-followup
   * Retry a failed follow-up call
   */
  async retryFollowUpCall(req, res) {
    try {
      const { id: bookingId } = req.params;
      const tenantId = req.tenantId || req.user?.tenantId;
      const schema = getSchema(req);

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant context required'
        });
      }

      const result = await this.executionService.retryExecution(
        schema,
        bookingId,
        tenantId
      );

      return res.status(200).json(result);
    } catch (error) {
      logger.error('Retry follow-up call endpoint error:', {
        bookingId: req.params.id,
        error: error.message
      });

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = BookingsController;
