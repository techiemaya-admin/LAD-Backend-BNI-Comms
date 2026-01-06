#!/usr/bin/env node
/**
 * Test both notification listeners
 */

require('dotenv').config();
const { getListener } = require('./features/deals-pipeline/services/bookingNotificationListener');
const { getListener: getCallLogsListener } = require('./features/voice-agent/services/callLogsNotificationListener');
const logger = require('./core/utils/logger');

async function testListeners() {
  try {
    logger.info('Testing both notification listeners...');
    
    // Test booking listener
    logger.info('Starting booking notification listener...');
    const listener = getListener();
    await listener.start();
    
    if (!listener.isListening) {
      throw new Error('Booking notification listener failed to start');
    }
    logger.info('✅ Booking notification listener started successfully');
    
    // Test call logs listener
    logger.info('Starting call logs notification listener...');
    const callLogsListener = getCallLogsListener();
    await callLogsListener.start();
    
    if (!callLogsListener.isListening) {
      throw new Error('Call logs notification listener failed to start');
    }
    logger.info('✅ Call logs notification listener started successfully');
    
    logger.info('🎉 Both notification systems are working correctly!');
    logger.info('📊 Status:', {
      bookingListener: listener.isListening,
      callLogsListener: callLogsListener.isListening
    });
    
    // Cleanup
    setTimeout(async () => {
      await listener.stop();
      await callLogsListener.stop();
      logger.info('✅ Test completed - both listeners stopped');
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testListeners();