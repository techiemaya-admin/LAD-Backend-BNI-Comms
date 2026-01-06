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
    try {
      const listener = getListener();
      await listener.start();
      logger.info('Booking notification listener started');
    } catch (error) {
      logger.error('Failed to start booking listener (non-fatal):', {
        error: error.message
      });
    }
    
    logger.info('Server successfully started', {
      port: PORT,
      url: `http://localhost:${PORT}`,
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
  
  process.exit(0);
});

// Start the server
startServer();
