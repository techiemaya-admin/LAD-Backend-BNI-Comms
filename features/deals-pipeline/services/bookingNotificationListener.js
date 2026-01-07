/**
 * Booking Notification Listener
 * 
 * Listens to PostgreSQL NOTIFY events for new follow-up bookings
 * and automatically schedules Cloud Tasks
 * 
 * This ensures Cloud Tasks are created regardless of which service
 * creates the booking (VOAG, LAD backend, etc.)
 */

const { pool } = require('../../../shared/database/connection');
const FollowUpSchedulerService = require('./followUpSchedulerService');
const logger = require('../../../core/utils/logger');

class BookingNotificationListener {
  constructor() {
    this.client = null;
    this.scheduler = new FollowUpSchedulerService(pool);
    this.isListening = false;
  }

  /**
   * Start listening for booking notifications
   */
  async start() {
    if (this.isListening) {
      logger.warn('[BookingListener] Already listening for notifications');
      return;
    }

    try {
      // Get a dedicated client for LISTEN
      this.client = await pool.connect();
      
      // Listen for booking_followup_created notifications
      await this.client.query('LISTEN booking_followup_created');
      
      this.isListening = true;
      logger.info('[BookingListener] Started listening for booking follow-up notifications');

      // Handle notifications
      this.client.on('notification', async (msg) => {
        if (msg.channel === 'booking_followup_created') {
          await this.handleBookingNotification(msg.payload);
        }
      });

      // Handle connection errors
      this.client.on('error', (err) => {
        logger.error('[BookingListener] Database connection error:', {
          error: err.message,
          stack: err.stack
        });
        this.reconnect();
      });

    } catch (error) {
      logger.error('[BookingListener] Failed to start listening:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle booking notification
   */
  async handleBookingNotification(payload) {
    try {
      const booking = JSON.parse(payload);
      
      logger.info('[BookingListener] Received booking notification:', {
        bookingId: booking.booking_id,
        bookingType: booking.booking_type,
        tenantId: booking.tenant_id
      });

      // Resolve schema from tenant
      const schema = process.env.POSTGRES_SCHEMA || 'lad_dev';

      // Schedule the Cloud Task
      const scheduleResult = await this.scheduler.scheduleFollowUpCall({
        tenantId: booking.tenant_id,
        bookingId: booking.booking_id,
        leadId: booking.lead_id,
        assignedUserId: booking.assigned_user_id,
        scheduledAt: booking.scheduled_at,
        timezone: booking.timezone,
        bookingType: booking.booking_type,
        schema: schema
      });

      if (scheduleResult.success && scheduleResult.scheduled) {
        logger.info('[BookingListener] Successfully scheduled Cloud Task:', {
          bookingId: booking.booking_id,
          taskName: scheduleResult.taskName,
          scheduleTime: scheduleResult.scheduleTime
        });
      } else {
        logger.warn('[BookingListener] Cloud Task not scheduled:', {
          bookingId: booking.booking_id,
          reason: scheduleResult.reason || scheduleResult.error
        });
      }

    } catch (error) {
      logger.error('[BookingListener] Error handling booking notification:', {
        error: error.message,
        stack: error.stack,
        payload: payload
      });
    }
  }

  /**
   * Reconnect after connection error
   */
  async reconnect() {
    logger.info('[BookingListener] Attempting to reconnect...');
    
    this.isListening = false;
    
    if (this.client) {
      try {
        this.client.release();
      } catch (err) {
        // Ignore errors during cleanup
      }
      this.client = null;
    }

    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      await this.start();
      logger.info('[BookingListener] Successfully reconnected');
    } catch (error) {
      logger.error('[BookingListener] Reconnection failed:', {
        error: error.message
      });
      // Try again
      setTimeout(() => this.reconnect(), 10000);
    }
  }

  /**
   * Stop listening and cleanup
   */
  async stop() {
    if (this.client) {
      try {
        await this.client.query('UNLISTEN booking_followup_created');
        this.client.release();
        this.client = null;
        this.isListening = false;
        logger.info('[BookingListener] Stopped listening for notifications');
      } catch (error) {
        logger.error('[BookingListener] Error stopping listener:', {
          error: error.message
        });
      }
    }
  }
}

// Singleton instance
let listenerInstance = null;

module.exports = {
  BookingNotificationListener,
  
  /**
   * Get or create singleton listener instance
   */
  getListener: () => {
    if (!listenerInstance) {
      listenerInstance = new BookingNotificationListener();
    }
    return listenerInstance;
  }
};
