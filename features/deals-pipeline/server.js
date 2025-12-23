/**
 * Development Server for Deals Pipeline Feature
 * Standalone server for isolated development and testing
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Mock auth if not already loaded
if (!global.jwtAuthMock) {
  const authMock = require('../mocks/auth.mock');
  global.jwtAuthMock = authMock.jwtAuth;
}

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware - CORS configuration for development (allow all localhost)
app.use(cors({
  origin: (origin, callback) => {
    // Allow any localhost origin in development
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Development login endpoint (no auth required)
const authMock = require('../mocks/auth.mock');
app.post('/api/auth/dev-login', (req, res) => {
  const token = authMock.generateMockToken();
  res.json({
    success: true,
    token,
    user: {
      userId: 'mock-user-123',
      email: 'developer@example.com',
      role: 'admin'
    },
    message: 'Development login successful'
  });
});

// Apply mock auth middleware for all other API routes
app.use('/api', authMock.jwtAuth);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'deals-pipeline',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount deals-pipeline routes
const dealsPipelineRouter = require('./features/deals-pipeline/routes');
app.use('/api/deals-pipeline', dealsPipelineRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path,
    message: 'The requested endpoint does not exist'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Deals Pipeline Development Server');
  console.log('=====================================');
  console.log(`📡 Server running at: http://localhost:${PORT}`);
  console.log(`📋 API Base Path: http://localhost:${PORT}/api/deals-pipeline`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('Available Endpoints:');
  console.log('  - GET  /api/deals-pipeline/leads');
  console.log('  - GET  /api/deals-pipeline/stages');
  console.log('  - GET  /api/deals-pipeline/pipeline/board');
  console.log('  - GET  /api/deals-pipeline/reference/statuses');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
