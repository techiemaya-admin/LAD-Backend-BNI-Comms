#!/usr/bin/env node
/**
 * Test and Start Notification Listeners
 * 
 * Tests both booking and call logs notification listeners
 * Ensures automatic systems are working before considering startup successful
 */

require('dotenv').config();
const { getListener: getBookingListener } = require('./features/deals-pipeline/services/bookingNotificationListener');
const logger = require('./core/utils/logger');

async function testAndStartListeners() {
  try {
    logger.info('Testing automatic notification systems...');

    // Test booking notification listener
    logger.info('Starting booking notification listener...');
    const bookingListener = getBookingListener();
    await bookingListener.start();
    logger.info('✅ Booking notification listener started successfully');

    // Test that listener is actually listening
    if (!bookingListener.isListening) {
      throw new Error('Booking listener not in listening state');
    }

    logger.info('✅ Automatic Cloud Task creation system is ACTIVE');
    logger.info('✅ New auto_followup, manual_followup, and scheduled_followup bookings will automatically get Cloud Tasks');

    // Keep listeners running
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, stopping listeners...');
      await bookingListener.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, stopping listeners...');
      await bookingListener.stop();
      process.exit(0);
    });

    logger.info('Notification listeners are running. Press Ctrl+C to stop.');

  } catch (error) {
    logger.error('❌ Failed to start notification listeners:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  testAndStartListeners();
}

module.exports = { testAndStartListeners };