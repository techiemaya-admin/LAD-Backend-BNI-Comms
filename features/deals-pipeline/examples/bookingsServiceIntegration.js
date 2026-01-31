/**
 * Example: Integrating Follow-Up Calls into Existing Bookings Service
 * 
 * This file demonstrates how to integrate the follow-up call system
 * into your existing bookings creation flow.
 */

const { FollowUpSchedulerService } = require('../deals-pipeline');

// Existing bookings service
class BookingsService {
  constructor(db) {
    this.db = db;
    this.followUpScheduler = new FollowUpSchedulerService(db);
  }

  /**
   * Create a new booking (existing method)
   * Enhanced with automatic follow-up call scheduling
   */
  async createBooking(req, bookingData) {
    const { 
      leadId, 
      assignedUserId, 
      scheduledAt, 
      bookingType, 
      status = 'scheduled' 
    } = bookingData;

    const tenantId = req.tenantId || req.user?.tenantId;
    const schema = this.getSchema(req);

    try {
      // 1. Create booking in database (existing logic)
      const booking = await this.createBookingInDb(
        schema,
        tenantId,
        bookingData
      );

      // 2. NEW: Schedule follow-up call if applicable
      try {
        const schedulingResult = await this.followUpScheduler.scheduleFollowUpCall({
          tenantId,
          bookingId: booking.id,
          leadId,
          assignedUserId,
          scheduledAt,
          bookingType,
          schema
        });

        if (schedulingResult.scheduled) {
          logger.info('Follow-up call scheduled:', {
            tenantId,
            bookingId: booking.id,
            taskName: schedulingResult.taskName
          });
        } else {
          logger.info('Follow-up call not required for this booking type:', {
            tenantId,
            bookingId: booking.id,
            bookingType
          });
        }
      } catch (schedulingError) {
        // Log error but don't fail booking creation
        logger.error('Failed to schedule follow-up call:', {
          tenantId,
          bookingId: booking.id,
          error: schedulingError.message
        });
        
        // Optionally: Set a flag to retry scheduling later
        // or notify admins about the failure
      }

      return {
        success: true,
        booking,
        followUpScheduled: schedulingResult?.scheduled || false
      };
    } catch (error) {
      logger.error('Booking creation failed:', {
        tenantId,
        leadId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update booking (existing method)
   * Enhanced to reschedule follow-up if scheduled_at changes
   */
  async updateBooking(req, bookingId, updates) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const schema = this.getSchema(req);

    try {
      // Get existing booking
      const existingBooking = await this.getBookingById(
        schema,
        bookingId,
        tenantId
      );

      if (!existingBooking) {
        throw new Error('Booking not found');
      }

      // Update booking
      const updatedBooking = await this.updateBookingInDb(
        schema,
        bookingId,
        tenantId,
        updates
      );

      // NEW: Reschedule follow-up if scheduled_at changed
      if (updates.scheduledAt && 
          updates.scheduledAt !== existingBooking.scheduled_at &&
          existingBooking.task_status !== 'executed') {
        
        try {
          await this.followUpScheduler.rescheduleFollowUpCall(
            schema,
            bookingId,
            tenantId,
            updates.scheduledAt
          );

          logger.info('Follow-up call rescheduled:', {
            tenantId,
            bookingId,
            newScheduledAt: updates.scheduledAt
          });
        } catch (rescheduleError) {
          logger.error('Failed to reschedule follow-up call:', {
            tenantId,
            bookingId,
            error: rescheduleError.message
          });
        }
      }

      return {
        success: true,
        booking: updatedBooking
      };
    } catch (error) {
      logger.error('Booking update failed:', {
        tenantId,
        bookingId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cancel booking (existing method)
   * Enhanced to cancel scheduled follow-up call
   */
  async cancelBooking(req, bookingId) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const schema = this.getSchema(req);

    try {
      // Cancel booking
      const booking = await this.updateBookingInDb(
        schema,
        bookingId,
        tenantId,
        { status: 'cancelled' }
      );

      // NEW: Cancel follow-up call task if scheduled
      try {
        await this.followUpScheduler.cancelFollowUpCall(
          schema,
          bookingId,
          tenantId
        );

        logger.info('Follow-up call cancelled:', {
          tenantId,
          bookingId
        });
      } catch (cancelError) {
        logger.error('Failed to cancel follow-up call:', {
          tenantId,
          bookingId,
          error: cancelError.message
        });
      }

      return {
        success: true,
        booking
      };
    } catch (error) {
      logger.error('Booking cancellation failed:', {
        tenantId,
        bookingId,
        error: error.message
      });
      throw error;
    }
  }

  // Helper methods (existing)
  async createBookingInDb(schema, tenantId, bookingData) {
    // Your existing database insert logic
    // ...
  }

  async getBookingById(schema, bookingId, tenantId) {
    // Your existing database query logic
    // ...
  }

  async updateBookingInDb(schema, bookingId, tenantId, updates) {
    // Your existing database update logic
    // ...
  }

  getSchema(req) {
    // Your existing schema resolution logic
    // ...
  }
}

module.exports = BookingsService;

/**
 * INTEGRATION CHECKLIST:
 * 
 * ✅ 1. Import FollowUpSchedulerService
 * ✅ 2. Initialize in constructor
 * ✅ 3. Call scheduleFollowUpCall after booking creation
 * ✅ 4. Handle scheduling errors gracefully (don't fail booking)
 * ✅ 5. Reschedule on update if scheduled_at changes
 * ✅ 6. Cancel on booking cancellation
 * ✅ 7. Log all operations with tenant context
 * 
 * OPTIONAL ENHANCEMENTS:
 * 
 * - Add retry queue for failed scheduling attempts
 * - Send notifications when follow-up is scheduled
 * - Track scheduling success rate metrics
 * - Implement batch scheduling for bulk operations
 */
