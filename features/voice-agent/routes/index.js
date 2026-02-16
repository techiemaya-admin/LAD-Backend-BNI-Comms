/**
 * Voice Agent Routes 1.0
 * 
 * Registers all voice agent endpoints with proper middleware
 * Supports JWT authentication for user-specific endpoints
 */

const express = require('express');
const router = express.Router();
const { 
  VoiceAgentController, 
  CallController, 
  BatchCallController, 
  CallInitiationController 
} = require('../controllers');
const VAPIWebhookController = require('../controllers/VAPIWebhookController');
const { pool } = require('../../../shared/database/connection');
const { authenticateToken: jwtAuth } = require('../../../core/middleware/auth');
const { requireCredits } = require('../../../shared/middleware/credit_guard');
const { requireFeature } = require('../../../shared/middleware/feature_guard');
const { validateVoiceCallPrerequisites } = require('../middleware/voiceCallValidation');

// Initialize controllers with shared database pool
const voiceAgentController = new VoiceAgentController(pool);
const callController = new CallController(pool);
const batchCallController = new BatchCallController(pool);
const callInitiationController = new CallInitiationController(pool);
const vapiWebhookController = new VAPIWebhookController(pool);

// Tenant middleware - extracts tenant ID from request
const tenantMiddleware = (req, res, next) => {
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
};

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
// Settings Endpoints
// ============================================

/**
 * GET /settings
 * Get voice agent settings
 */
router.get(
  '/settings',
  jwtAuth,
  (req, res) => voiceAgentController.getSettings(req, res)
);

/**
 * PUT /settings
 * Update voice agent settings
 */
router.put(
  '/settings',
  jwtAuth,
  (req, res) => voiceAgentController.updateSettings(req, res)
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
 * GET /calls
 * Get call logs with filters (primary endpoint for frontend)
 */
router.get(
  '/calls',
  jwtAuth,
  (req, res) => callController.getCallLogs(req, res)
);

/**
 * POST /calls
 * Initiate a single voice call
 * Requires 1 credit for call initiation (additional credits charged based on duration)
 */
router.post(
  '/calls',
  jwtAuth,
  requireCredits('voice_call', 1),
  (req, res) => callInitiationController.initiateCall(req, res)
);

/**
 * POST /calls/batch
 * Initiate batch voice calls
 */
router.post(
  '/calls/batch',
  tenantMiddleware,
  requireCredits(1, 'voice_agent_batch'),
  (req, res) => batchCallController.batchInitiateCalls(req, res)
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

/**
 * POST /calls/update-credits
 * Recalculate and update credits for completed calls
 * Used for credit reconciliation
 */
router.post(
  '/calls/update-credits',
  jwtAuth,
  (req, res) => callController.updateCallCredits(req, res)
);

/**
 * GET /calls/:id
 * Get a single call log by ID
 */
router.get(
  '/calls/:id',
  jwtAuth,
  (req, res) => {
    // Map :id param to :call_log_id for the controller
    req.params.call_log_id = req.params.id;
    return callController.getCallLogById(req, res);
  }
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
  jwtAuth,
  (req, res) => callController.getCallLogById(req, res)
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

// ============================================
// Webhook Endpoints
// ============================================

/**
 * POST /webhook/vapi
 * Receive webhooks from VAPI for call status updates and billing
 * This endpoint processes call completion events and charges credits based on duration
 * 
 * VAPI Events:
 * - call.started: Call has been initiated
 * - call.ended: Call completed (triggers credit deduction)
 * - call.failed: Call failed (triggers credit refund)
 * 
 * No authentication required (VAPI webhook signature verification should be added)
 */
router.post(
  '/webhook/vapi',
  (req, res) => vapiWebhookController.handleVAPIWebhook(req, res)
);

// ============================================
// V2 API Endpoints
// ============================================

/**
 * POST /calls/start-call (V2)
 * Initiate a single voice call - V2 endpoint with UUID support
 * 
 * MIDDLEWARE PIPELINE (LAD Architecture Compliant):
 * 1. jwtAuth - Authenticate user & extract tenantId/userId from JWT
 * 2. requireFeature - Verify tenant has 'voice-agent' feature enabled
 * 3. validateVoiceCallPrerequisites - Check business hours, credits (3 min), rate limits
 * 4. callInitiationController.initiateCallV2 - Execute call
 * 
 * NOTE: requireCredits removed as credit check happens in validateVoiceCallPrerequisites
 * (Credits deducted after call completion based on actual duration)
 */
router.post(
  '/calls/start-call',
  jwtAuth,
  requireFeature('voice-agent'),
  validateVoiceCallPrerequisites,
  (req, res) => callInitiationController.initiateCallV2(req, res)
);

/**
 * POST /batch/trigger-batch-call (V2)
 * Initiate batch voice calls - V2 endpoint
 */
router.post(
  '/batch/trigger-batch-call',
  tenantMiddleware,
  (req, res) => batchCallController.batchInitiateCallsV2(req, res)
);

/**
 * GET /calls/job/:job_id (V2)
 * Get call log by job ID - V2 endpoint
 */
router.get(
  '/calls/job/:job_id',
  tenantMiddleware,
  (req, res) => callController.getCallLogByJobId(req, res)
);

/**
 * GET /batch/batch-status/:id (V2)
 * Get batch status - V2 endpoint
 */
router.get(
  '/batch/batch-status/:id',
  tenantMiddleware,
  (req, res) => batchCallController.getBatchStatusV2(req, res)
);

/**
 * POST /batch/batch-cancel/:id (V2)
 * Cancel batch - V2 endpoint
 */
router.post(
  '/batch/batch-cancel/:id',
  tenantMiddleware,
  (req, res) => batchCallController.cancelBatchV2(req, res)
);

module.exports = router;
