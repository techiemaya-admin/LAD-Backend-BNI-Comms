#!/usr/bin/env node
/**
 * LAD Backend Server
 * Production-grade SaaS platform with feature-based architecture
 * Version: 1.0.1
 */

require('dotenv').config();
const CoreApplication = require('./core/app');

const PORT = process.env.PORT || 3004;

async function startServer() {
  try {
    console.log('🚀 Starting LAD Backend Server...');
    console.log('📊 Environment:', process.env.NODE_ENV || 'development');
    console.log('🗄️  Database:', process.env.POSTGRES_HOST);
    console.log('📁 Schema:', process.env.POSTGRES_SCHEMA || 'lad_LAD');
    
    const app = new CoreApplication();
    await app.start(PORT);
    
    console.log(`✅ Server successfully started on port ${PORT}`);
    console.log(`🌐 Backend URL: http://localhost:${PORT}`);
    console.log('');
    console.log('Available endpoints:');
    console.log(`  - POST   /api/auth/login`);
    console.log(`  - POST   /api/auth/register`);
    console.log(`  - GET    /api/features`);
    console.log(`  - GET    /api/users/:id`);
    console.log(`  - GET    /api/billing/plans`);
    console.log(`  - GET    /api/apollo-leads/* (with feature flag)`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();
