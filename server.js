#!/usr/bin/env node
/**
 * LAD Backend Server
 * Production-grade SaaS platform with feature-based architecture
 * Version: 1.0.1
 */

require('dotenv').config();
const CoreApplication = require('./core/app');
const logger = require('./core/utils/logger');
const { getListener } = require('./features/deals-pipeline/services/bookingNotificationListener');
const { getListener: getCallLogsListener } = require('./features/voice-agent/services/callLogsNotificationListener');

const PORT = process.env.PORT || 3004;

async function startServer() {
  try {
    logger.info('Starting LAD Backend Server');
    logger.info('Server configuration', {
      environment: process.env.NODE_ENV || 'development',
      database: process.env.POSTGRES_HOST,
      schema: process.env.POSTGRES_SCHEMA || 'lad_dev'
    });
    
    const app = new CoreApplication();
    await app.start(PORT);
    
    // Start booking notification listener for Cloud Task scheduling
    // This is CRITICAL - if it fails, the automatic system won't work
    logger.info('Starting booking notification listener...');
    const listener = getListener();
    await listener.start();
    
    // Verify listener is actually working
    if (!listener.isListening) {
      throw new Error('Booking notification listener failed to start - automatic Cloud Task creation disabled');
    }
    
    logger.info('✅ Booking notification listener started successfully');
    
    // Start call logs notification listener for real-time updates
    logger.info('Starting call logs notification listener...');
    const callLogsListener = getCallLogsListener();
    await callLogsListener.start();
    
    // Verify call logs listener is working
    if (!callLogsListener.isListening) {
      throw new Error('Call logs notification listener failed to start - real-time updates disabled');
    }
    
    logger.info('✅ Call logs notification listener started successfully');
    logger.info('✅ Automatic Cloud Task creation system is ACTIVE');
    
    logger.info('Server successfully started', {
      port: PORT,
      url: process.env.BACKEND_URL || process.env.BASE_URL || `http://localhost:${PORT}`,
      endpoints: [
        'POST /api/auth/login',
        'POST /api/auth/register', 
        'GET /api/features',
        'GET /api/users/:id',
        'GET /api/billing/plans',
        'GET /api/apollo-leads/* (with feature flag)'
      ]
    });
    
  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop the booking listener
  try {
    const listener = getListener();
    await listener.stop();
  } catch (error) {
    logger.error('Error stopping booking listener:', { error: error.message });
  }
  
  // Stop the call logs listener
  try {
    const callLogsListener = getCallLogsListener();
    await callLogsListener.stop();
  } catch (error) {
    logger.error('Error stopping call logs listener:', { error: error.message });
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Stop the booking listener
  try {
    const listener = getListener();
    await listener.stop();
  } catch (error) {
    logger.error('Error stopping booking listener:', { error: error.message });
  }
  
  // Stop the call logs listener
  try {
    const callLogsListener = getCallLogsListener();
    await callLogsListener.stop();
  } catch (error) {
    logger.error('Error stopping call logs listener:', { error: error.message });
  }
  
  process.exit(0);
});

// Start the server
startServer();
