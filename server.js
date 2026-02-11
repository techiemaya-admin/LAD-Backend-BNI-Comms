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
    
    // Check critical environment variables
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'your-secret-key-change-in-production') {
      logger.warn('⚠️  JWT_SECRET is not properly configured. Using development default.');
      logger.warn('    For production, ensure JWT_SECRET is set via Google Cloud Secret Manager');
    } else {
      logger.info('✓ JWT_SECRET is configured');
    }
    
    logger.info('Server configuration', {
      environment: process.env.NODE_ENV || 'development',
      database: process.env.POSTGRES_HOST,
      schema: process.env.POSTGRES_SCHEMA || 'lad_dev',
      jwtConfigured: !!jwtSecret && jwtSecret !== 'your-secret-key-change-in-production'
    });
    
    const app = new CoreApplication();
    await app.start(PORT);
    
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
    
    // Start booking notification listener for Cloud Task scheduling (non-blocking)
    logger.info('Starting booking notification listener (background task)...');
    const listener = getListener();
    listener.start().then(() => {
      logger.info('✅ Booking notification listener started successfully');
    }).catch(error => {
      logger.warn('⚠️  Booking notification listener failed to start', {
        error: error.message,
        note: 'Automatic Cloud Task creation may be temporarily disabled'
      });
    });
    
    // Start call logs notification listener for real-time updates (non-blocking)
    logger.info('Starting call logs notification listener (background task)...');
    const callLogsListener = getCallLogsListener();
    callLogsListener.start().then(() => {
      logger.info('✅ Call logs notification listener started successfully');
      logger.info('✅ Automatic Cloud Task creation system is ACTIVE');
    }).catch(error => {
      logger.warn('⚠️  Call logs notification listener failed to start', {
        error: error.message,
        note: 'Real-time call log updates may be temporarily disabled'
      });
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
