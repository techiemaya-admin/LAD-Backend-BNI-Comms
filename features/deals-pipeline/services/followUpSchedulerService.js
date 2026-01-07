/**
 * Follow-Up Scheduler Service
 * 
 * Business logic for scheduling follow-up calls using Cloud Tasks
 * Determines if booking needs scheduling, generates idempotency keys,
 * and creates Cloud Tasks for future execution
 * 
 * Multi-tenant safe - no SQL in this layer
 */

const cloudTasksClient = require('../../../shared/gcp/cloudTasksClient');
const BookingsRepository = require('../repositories/bookingsRepository');

let logger;
let getSchema;
try {
  logger = require('../../../core/utils/logger');
  ({ getSchema } = require('../../../core/utils/schemaHelper'));
} catch (e) {
  logger = {
    info: (...args) => console.log('[FollowUpScheduler INFO]', ...args),
    error: (...args) => console.error('[FollowUpScheduler ERROR]', ...args),
    warn: (...args) => console.warn('[FollowUpScheduler WARN]', ...args)
  };
  // Fallback schema helper
  getSchema = (req) => {
    if (req?.user?.schema) return req.user.schema;
    if (req?.user?.tenant_id) return `tenant_${req.user.tenant_id}`;
    return process.env.DEFAULT_SCHEMA || 'lad_dev';
  };
}

class FollowUpSchedulerService {
  constructor(db) {
    this.bookingsRepo = new BookingsRepository(db);
    this.queueName = process.env.FOLLOWUP_QUEUE_NAME || 'follow-up-calls';
    this.executionEndpoint = process.env.FOLLOWUP_EXECUTION_ENDPOINT;
  }

  /**
   * Schedule a follow-up call for a booking
   * 
   * @param {Object} params - Scheduling parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.bookingId - Booking ID
   * @param {string} params.leadId - Lead ID
   * @param {string} params.assignedUserId - Assigned user ID
   * @param {Date|string} params.scheduledAt - When to execute the call
   * @param {string} params.timezone - Timezone of the scheduled time (e.g., 'GST', 'UTC')
   * @param {string} params.bookingType - Booking type
   * @param {string} params.schema - Schema name (resolved from tenant)
   * @returns {Promise<Object>} Scheduling result
   */
  async scheduleFollowUpCall({
    tenantId,
    bookingId,
    leadId,
    assignedUserId,
    scheduledAt,
    timezone,
    bookingType,
    schema
  }) {
    // Validate required parameters
    if (!tenantId || !bookingId || !leadId || !scheduledAt) {
      throw new Error('tenantId, bookingId, leadId, and scheduledAt are required');
    }

    // Check if this booking type qualifies for follow-up calls
    if (!this.shouldScheduleFollowUp(bookingType)) {
      logger.info('Booking type does not require follow-up call:', {
        tenantId,
        bookingId,
        bookingType
      });
      
      return {
        success: true,
        scheduled: false,
        reason: 'Booking type does not require follow-up'
      };
    }

    // Check if Cloud Tasks is enabled
    if (!cloudTasksClient.isEnabled()) {
      logger.warn('Cloud Tasks not enabled - follow-up call not scheduled:', {
        tenantId,
        bookingId
      });
      
      return {
        success: false,
        scheduled: false,
        error: 'Cloud Tasks not configured'
      };
    }

    // Check if execution endpoint is configured
    if (!this.executionEndpoint) {
      throw new Error('FOLLOWUP_EXECUTION_ENDPOINT not configured');
    }

    try {
      // Generate deterministic idempotency key
      const idempotencyKey = this.generateIdempotencyKey(
        tenantId,
        bookingId,
        scheduledAt
      );

      // Parse schedule time and convert from local timezone to UTC
      let scheduleTime;
      if (scheduledAt instanceof Date) {
        // If already a Date object, assume it's already in the correct timezone
        scheduleTime = scheduledAt;
      } else {
        // Parse the time and convert from local timezone to UTC
        const localTime = new Date(scheduledAt);
        
        // Convert based on timezone
        let utcOffset = 0; // Default to UTC
        if (timezone === 'GST') {
          utcOffset = 4; // GST is UTC+4
        } else if (timezone === 'EST') {
          utcOffset = -5; // EST is UTC-5
        } else if (timezone === 'PST') {
          utcOffset = -8; // PST is UTC-8
        }
        // Add more timezone mappings as needed
        
        // Convert local time to UTC by subtracting the offset
        scheduleTime = new Date(localTime.getTime() - (utcOffset * 60 * 60 * 1000));
      }

      // If scheduled time is in the past, schedule for immediate execution
      const now = new Date();
      const effectiveScheduleTime = scheduleTime < now ? now : scheduleTime;

      logger.info('[FollowUpScheduler] Time conversion:', {
        tenantId,
        bookingId,
        originalTime: scheduledAt,
        timezone: timezone || 'UTC',
        localTime: scheduledAt instanceof Date ? scheduledAt.toISOString() : new Date(scheduledAt).toISOString(),
        utcTime: scheduleTime.toISOString(),
        effectiveTime: effectiveScheduleTime.toISOString(),
        nowUTC: now.toISOString()
      });

      // Build task payload
      const payload = {
        tenantId,
        bookingId,
        leadId,
        assignedUserId,
        idempotencyKey,
        scheduledAt: scheduleTime.toISOString()
      };

      // Build execution URL with booking ID in the path
      const executionUrl = `${this.executionEndpoint.replace(/\/execute-followup$/, '')}/${bookingId}/execute-followup`;

      // Create Cloud Task
      const taskResult = await cloudTasksClient.createScheduledHttpTask({
        queue: this.queueName,
        url: executionUrl,
        payload,
        scheduleTime: effectiveScheduleTime,
        idempotencyKey
      });

      logger.info('Follow-up call task created:', {
        tenantId,
        bookingId,
        taskName: taskResult.taskName,
        scheduleTime: effectiveScheduleTime.toISOString(),
        alreadyExists: taskResult.alreadyExists
      });

      // Update booking with task metadata
      await this.bookingsRepo.markTaskScheduled(
        schema,
        bookingId,
        tenantId,
        taskResult.taskName,
        effectiveScheduleTime,
        idempotencyKey
      );

      return {
        success: true,
        scheduled: true,
        taskName: taskResult.taskName,
        scheduleTime: effectiveScheduleTime.toISOString(),
        idempotencyKey,
        alreadyExists: taskResult.alreadyExists
      };
    } catch (error) {
      logger.error('Failed to schedule follow-up call:', {
        tenantId,
        bookingId,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Cancel a scheduled follow-up call
   * 
   * @param {string} schema - Schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelFollowUpCall(schema, bookingId, tenantId) {
    try {
      // Get booking to retrieve task name
      const booking = await this.bookingsRepo.getBookingById(
        schema,
        bookingId,
        tenantId
      );

      if (!booking) {
        throw new Error('Booking not found');
      }

      // If task is already executed, nothing to cancel
      if (booking.task_status === 'executed') {
        return {
          success: true,
          cancelled: false,
          reason: 'Task already executed'
        };
      }

      // Mark as cancelled in database
      await this.bookingsRepo.markCancelled(schema, bookingId, tenantId);

      // Attempt to delete Cloud Task if task name exists
      if (booking.task_name) {
        try {
          await cloudTasksClient.deleteTask(booking.task_name);
          logger.info('Cloud Task deleted:', {
            tenantId,
            bookingId,
            taskName: booking.task_name
          });
        } catch (error) {
          // Task might already be executing or deleted, log but don't fail
          logger.warn('Could not delete Cloud Task:', {
            tenantId,
            bookingId,
            taskName: booking.task_name,
            error: error.message
          });
        }
      }

      return {
        success: true,
        cancelled: true
      };
    } catch (error) {
      logger.error('Failed to cancel follow-up call:', {
        tenantId,
        bookingId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Determine if booking type requires follow-up call scheduling
   * 
   * @param {string} bookingType - Booking type
   * @returns {boolean} True if should schedule
   */
  shouldScheduleFollowUp(bookingType) {
    // Configure which booking types trigger follow-up calls
    const followUpTypes = [
      'follow_up',
      'follow-up',
      'auto-follow-up',
      'followup',
      'auto_follow_up',
      'auto_followup',
      'manual_followup',
      'manual_follow_up',
      'scheduled_call'
    ];

    return followUpTypes.includes(bookingType?.toLowerCase());
  }

  /**
   * Generate deterministic idempotency key
   * 
   * @param {string} tenantId - Tenant ID
   * @param {string} bookingId - Booking ID
   * @param {Date|string} scheduledAt - Scheduled time
   * @returns {string} Idempotency key
   */
  generateIdempotencyKey(tenantId, bookingId, scheduledAt) {
    const scheduleTimeStr = scheduledAt instanceof Date
      ? scheduledAt.toISOString()
      : new Date(scheduledAt).toISOString();

    // Format: followup:{tenantId}:{bookingId}:{ISO timestamp}
    return `followup:${tenantId}:${bookingId}:${scheduleTimeStr}`;
  }

  /**
   * Reschedule a follow-up call
   * 
   * @param {string} schema - Schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID
   * @param {Date|string} newScheduledAt - New schedule time
   * @returns {Promise<Object>} Rescheduling result
   */
  async rescheduleFollowUpCall(schema, bookingId, tenantId, newScheduledAt) {
    try {
      // Cancel existing task
      await this.cancelFollowUpCall(schema, bookingId, tenantId);

      // Get updated booking info
      const booking = await this.bookingsRepo.getBookingById(
        schema,
        bookingId,
        tenantId
      );

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Schedule new task
      const result = await this.scheduleFollowUpCall({
        tenantId,
        bookingId,
        leadId: booking.lead_id,
        assignedUserId: booking.assigned_user_id,
        scheduledAt: newScheduledAt,
        bookingType: booking.booking_type,
        schema
      });

      logger.info('Follow-up call rescheduled:', {
        tenantId,
        bookingId,
        newScheduleTime: newScheduledAt
      });

      return result;
    } catch (error) {
      logger.error('Failed to reschedule follow-up call:', {
        tenantId,
        bookingId,
        error: error.message
      });

      throw error;
    }
  }
}

module.exports = FollowUpSchedulerService;
