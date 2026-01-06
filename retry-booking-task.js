#!/usr/bin/env node
/**
 * Retry Cloud Task Creation for Booking
 * 
 * Usage: node retry-booking-task.js <booking-id>
 */

require('dotenv').config();
const { pool } = require('./shared/database/connection');
const FollowUpSchedulerService = require('./features/deals-pipeline/services/followUpSchedulerService');
const logger = require('./core/utils/logger');

const BOOKING_ID = process.argv[2] || '8a2abd11-b73f-4f13-b702-23c13d1c6575';
const SCHEMA = process.env.POSTGRES_SCHEMA || 'lad_dev';

async function retryBookingTask() {
  try {
    logger.info('Retrying Cloud Task creation for booking:', BOOKING_ID);
    
    // Fetch booking details
    const result = await pool.query(`
      SELECT 
        id,
        tenant_id,
        lead_id,
        assigned_user_id,
        scheduled_at,
        booking_type,
        task_status
      FROM ${SCHEMA}.lead_bookings
      WHERE id = $1
    `, [BOOKING_ID]);
    
    if (result.rows.length === 0) {
      throw new Error(`Booking not found: ${BOOKING_ID}`);
    }
    
    const booking = result.rows[0];
    logger.info('Booking details:', booking);
    
    // Check if task already exists
    if (booking.task_status === 'scheduled') {
      logger.warn('Cloud Task already scheduled for this booking');
      return;
    }
    
    // Initialize scheduler service
    const scheduler = new FollowUpSchedulerService(pool);
    
    // Schedule the Cloud Task
    const scheduleResult = await scheduler.scheduleFollowUpCall({
      tenantId: booking.tenant_id,
      bookingId: booking.id,
      leadId: booking.lead_id,
      assignedUserId: booking.assigned_user_id,
      scheduledAt: booking.scheduled_at,
      bookingType: booking.booking_type,
      schema: SCHEMA
    });
    
    logger.info('Cloud Task scheduling result:', scheduleResult);
    
    if (scheduleResult.success && scheduleResult.scheduled) {
      logger.info('✅ Successfully created Cloud Task for booking:', BOOKING_ID);
      logger.info('Task Name:', scheduleResult.taskName);
      logger.info('Scheduled For:', scheduleResult.scheduledTime);
    } else {
      logger.error('❌ Failed to create Cloud Task:', scheduleResult.error || scheduleResult.reason);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Error retrying booking task:', error);
    process.exit(1);
  }
}

retryBookingTask();
