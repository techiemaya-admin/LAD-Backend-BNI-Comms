/**
 * Routes entry point for FeatureRegistry
 * This file is required by the core feature loading system
 * 
 * The feature registry expects a router, not a function
 * So we initialize the router here with the database connection
 */

const { pool } = require('../../shared/database/connection');
const createVoiceAgentRouter = require('./routes/index');
const { authenticateToken: jwtAuth } = require('../../core/middleware/auth');

// Default tenant middleware (extracts tenant from JWT user)
const defaultTenantMiddleware = (req, res, next) => {
  // Tenant is already set by JWT auth middleware in req.user.tenantId
  req.tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || req.query.tenant_id;
  next();
};

// Initialize router with database connection
const router = createVoiceAgentRouter(pool, {
  jwtAuth,
  tenantMiddleware: defaultTenantMiddleware
});

module.exports = router;
