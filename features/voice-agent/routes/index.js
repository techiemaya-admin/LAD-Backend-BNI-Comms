/**
 * Voice Agent Routes1.0
 * 
 * Registers all voice agent endpoints with proper middleware
 * Supports JWT authentication for user-specific endpoints
 */

const express = require('express');
const { 
  VoiceAgentController, 
  CallController, 
  BatchCallController, 
  CallInitiationController 
} = require('../controllers');

/**
 * Create voice agent router
 * 
 * @param {Object} db - Database pool
 * @param {Object} options - Configuration options
 * @param {Function} options.jwtAuth - JWT authentication middleware
 * @param {Function} options.tenantMiddleware - Tenant extraction middleware
 * @returns {express.Router} Configured router
 */
function createVoiceAgentRouter(db, options = {}) {
  const router = express.Router();
  
  // Initialize controllers
  const voiceAgentController = new VoiceAgentController(db);
  const callController = new CallController(db);
  const batchCallController = new BatchCallController(db);
  const callInitiationController = new CallInitiationController(db);

  // Middleware
  const jwtAuth = options.jwtAuth || defaultJwtAuth;
  const tenantMiddleware = options.tenantMiddleware || defaultTenantMiddleware;

  // ============================================
  // JWT-Protected Endpoints (User-Specific)
  // ============================================

  /**
   * GET /user/available-agents
   * Get available agents for authenticated user
   */
  router.get(
    '/user/available-agents',
    jwtAuth,
    (req, res) => voiceAgentController.getUserAvailableAgents(req, res)
  );

  /**
   * GET /user/available-numbers
   * Get available phone numbers for authenticated user
   */
  router.get(
    '/user/available-numbers',
    jwtAuth,
    (req, res) => voiceAgentController.getUserAvailableNumbers(req, res)
  );

  /**
   * GET /voices/:id/sample-signed-url
   * Get signed URL for voice sample
   */
  router.get(
    '/voices/:id/sample-signed-url',
    jwtAuth,
    (req, res) => voiceAgentController.getVoiceSampleSignedUrl(req, res)
  );

  /**
   * GET /agents/:agentId/sample-signed-url
   * Get signed URL for agent's voice sample
   */
  router.get(
    '/agents/:agentId/sample-signed-url',
    jwtAuth,
    (req, res) => voiceAgentController.getAgentVoiceSampleSignedUrl(req, res)
  );

  // ============================================
  // Public/Tenant Endpoints
  // ============================================

  /**
   * GET /test
   * Health check / test endpoint
   */
  router.get('/test', (req, res) => voiceAgentController.test(req, res));

  /**
   * GET /all
   * Get all agents for tenant
   */
  router.get(
    '/all',
    tenantMiddleware,
    (req, res) => voiceAgentController.getAllAgents(req, res)
  );

  /**
   * GET /agent/:name
   * Get agent by name
   */
  router.get(
    '/agent/:name',
    tenantMiddleware,
    (req, res) => voiceAgentController.getAgentByName(req, res)
  );

  /**
   * GET /voices
   * Get all voice profiles
   */
  router.get(
    '/voices',
    tenantMiddleware,
    (req, res) => voiceAgentController.getAllVoices(req, res)
  );

  /**
   * GET / (legacy)
   * Get all voices (legacy endpoint)
   */
  router.get(
    '/',
    tenantMiddleware,
    (req, res) => voiceAgentController.getAllVoices(req, res)
  );

  /**
   * GET /numbers
   * Get all phone numbers
   */
  router.get(
    '/numbers',
    tenantMiddleware,
    (req, res) => voiceAgentController.getAllPhoneNumbers(req, res)
  );

  // ============================================
  // Call Endpoints
  // ============================================

  /**
   * POST /calls
   * Initiate a single voice call
   */
  router.post(
    '/calls',
    jwtAuth,
    tenantMiddleware,
    (req, res) => callInitiationController.initiateCall(req, res)
  );

  /**
   * POST /calls/batch
   * Initiate batch voice calls
   */
  router.post(
    '/calls/batch',
    tenantMiddleware,
    (req, res) => batchCallController.batchInitiateCalls(req, res)
  );

  /**
   * GET /calllogs
   * Get call logs (for testing / general listing)
   */
  router.get(
    '/calllogs',
    tenantMiddleware,
    (req, res) => callController.getCallLogs(req, res)
  );

  /**
   * GET /calllogs/:call_log_id
   * Get a single call log by ID
   */
  router.get(
    '/calllogs/:call_log_id',
    tenantMiddleware,
    (req, res) => callController.getCallLogById(req, res)
  );

  /**
   * GET /calllogs/batch/:batch_id
   * Get call logs for a specific batch
   */
  router.get(
    '/calllogs/batch/:batch_id',
    tenantMiddleware,
    (req, res) => callController.getBatchCallLogsByBatchId(req, res)
  );

  /**
   * POST /calls/batch
   * Initiate batch voice calls
   */
  router.post(
    '/calls/batch',
    tenantMiddleware,
    (req, res) => callController.batchInitiateCalls(req, res)
  );

  /**
   * GET /calls/:id/recording-signed-url
   * Get signed URL for call recording
   */
  router.get(
    '/calls/:id/recording-signed-url',
    tenantMiddleware,
    (req, res) => callController.getCallRecordingSignedUrl(req, res)
  );

  /**
   * GET /calls/recent
   * Get recent calls with filters
   */
  router.get(
    '/calls/recent',
    tenantMiddleware,
    (req, res) => callController.getRecentCalls(req, res)
  );

  /**
   * GET /calls/stats
   * Get call statistics
   */
  router.get(
    '/calls/stats',
    tenantMiddleware,
    (req, res) => callController.getCallStats(req, res)
  );

  // ============================================
  // Phone Resolution & Sales Summary
  // ============================================

  /**
   * POST /resolve-phones
   * Resolve phone numbers from company/employee caches
   */
  router.post(
    '/resolve-phones',
    tenantMiddleware,
    (req, res) => callController.resolvePhones(req, res)
  );

  /**
   * POST /update-summary
   * Update sales summary for company or employee
   */
  router.post(
    '/update-summary',
    tenantMiddleware,
    (req, res) => callController.updateSalesSummary(req, res)
  );

  return router;
}

/**
 * Default JWT authentication middleware
 * This should be replaced with your actual JWT middleware
 */
function defaultJwtAuth(req, res, next) {
  // TODO: Replace with actual JWT authentication
  // Example:
  // const token = req.headers.authorization?.replace('Bearer ', '');
  // const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // req.user = { id: decoded.userId, tenantId: decoded.tenantId };
  
  // JWT auth is provided by the caller, so this should not be reached
  // But if it is, we'll check if user is already set (by upstream middleware)
  
  // For now, check if user is already set (by upstream middleware)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please provide a valid JWT token'
    });
  }
  
  next();
}

/**
 * Default tenant middleware
 * Extracts tenant ID from request
 */
function defaultTenantMiddleware(req, res, next) {
  // Try to get tenantId from various sources
  req.tenantId = req.tenantId || 
                 req.user?.tenantId || 
                 req.headers['x-tenant-id'] ||
                 req.query.tenant_id;

  if (!req.tenantId) {
    return res.status(400).json({
      success: false,
      error: 'Tenant ID required',
      message: 'Please provide tenant_id in headers or query params'
    });
  }

  next();
}

module.exports = createVoiceAgentRouter;
