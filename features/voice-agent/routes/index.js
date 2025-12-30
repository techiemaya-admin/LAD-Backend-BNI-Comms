/**
 * Voice Agent Routes
 * LAD Architecture Compliant - Express routes for voice agent management
 */

const express = require('express');
const router = express.Router();
const { 
  VoiceAgentController, 
  CallController, 
  BatchCallController, 
  CallInitiationController 
} = require('../controllers');
const { authenticateToken: jwtAuth } = require('../../../core/middleware/auth');
const { pool } = require('../../../shared/database/connection');

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
  (req, res) => {
    const controller = new VoiceAgentController(pool);
    controller.getUserAvailableAgents(req, res);
  }
);

  /**
   * GET /user/available-numbers
   * Get available phone numbers for authenticated user
   */
  router.get(
    '/user/available-numbers',
    jwtAuth,
    (req, res) => {
      const controller = new VoiceAgentController(pool);
      controller.getUserAvailableNumbers(req, res);
    }
  );

  /**
   * GET /voices/:id/sample-signed-url
   * Get signed URL for voice sample
   */
  router.get(
    '/voices/:id/sample-signed-url',
    jwtAuth,
    (req, res) => {
      const controller = new VoiceAgentController(pool);
      controller.getVoiceSampleSignedUrl(req, res);
    }
  );

  /**
   * GET /agents/:agentId/sample-signed-url
   * Get signed URL for agent's voice sample
   */
  router.get(
    '/agents/:agentId/sample-signed-url',
    jwtAuth,
    (req, res) => {
      const controller = new VoiceAgentController(pool);
      controller.getAgentVoiceSampleSignedUrl(req, res);
    }
  );

  // ============================================
  // Public/Tenant Endpoints
  // ============================================

  /**
   * GET /test
   * Health check / test endpoint
   */
  router.get('/test', (req, res) => {
    const controller = new VoiceAgentController(pool);
    controller.test(req, res);
  });

  /**
   * GET /all
   * Get all agents for tenant
   */
  router.get(
    '/all',
    jwtAuth,
    (req, res) => {
      const controller = new VoiceAgentController(pool);
      controller.getAllAgents(req, res);
    }
  );

  /**
   * GET /agent/:name
   * Get agent by name
   */
  router.get(
    '/agent/:name',
    jwtAuth,
    (req, res) => {
      const controller = new VoiceAgentController(pool);
      controller.getAgentByName(req, res);
    }
  );

  /**
   * GET /voices
   * Get all voice profiles
   */
  router.get(
    '/voices',
    jwtAuth,
    (req, res) => {
      const controller = new VoiceAgentController(pool);
      controller.getAllVoices(req, res);
    }
  );

  /**
   * GET / (legacy)
   * Get all voices (legacy endpoint)
   */
  router.get(
    '/',
    jwtAuth,
    (req, res) => {
      const controller = new VoiceAgentController(pool);
      controller.getAllVoices(req, res);
    }
  );

  /**
   * GET /numbers
   * Get all phone numbers
   */
  router.get(
    '/numbers',
    jwtAuth,
    (req, res) => {
      const controller = new VoiceAgentController(pool);
      controller.getAllPhoneNumbers(req, res);
    }
  );

  // ============================================
  // Call Endpoints
  // ============================================

  /**
   * GET /calls
   * Get call logs with optional filters
   */
  router.get(
    '/calls',
    jwtAuth,
    (req, res) => {
      const controller = new CallController(pool);
      controller.getCallLogs(req, res);
    }
  );

  /**
   * POST /calls
   * Initiate a single voice call
   */
  router.post(
    '/calls',
    jwtAuth,
    (req, res) => {
      const controller = new CallInitiationController(pool);
      controller.initiateCall(req, res);
    }
  );

  /**
   * POST /calls/batch
   * Initiate batch voice calls
   */
  router.post(
    '/calls/batch',
    jwtAuth,
    (req, res) => {
      const controller = new BatchCallController(pool);
      controller.batchInitiateCalls(req, res);
    }
  );

  /**
   * GET /calllogs
   * Get call logs (for testing / general listing)
   */
  router.get(
    '/calllogs',
    jwtAuth,
    (req, res) => {
      const controller = new CallController(pool);
      controller.getCallLogs(req, res);
    }
  );

  /**
   * GET /calllogs/:call_log_id
   * Get a single call log by ID
   */
  router.get(
    '/calllogs/:call_log_id',
    jwtAuth,
    (req, res) => {
      const controller = new CallController(pool);
      controller.getCallLogById(req, res);
    }
  );

  /**
   * GET /calllogs/batch/:batch_id
   * Get call logs for a specific batch
   */
  router.get(
    '/calllogs/batch/:batch_id',
    jwtAuth,
    (req, res) => {
      const controller = new CallController(pool);
      controller.getBatchCallLogsByBatchId(req, res);
    }
  );

  /**
   * POST /calls/batch
   * Initiate batch voice calls
   */
  router.post(
    '/calls/batch',
    jwtAuth,
    (req, res) => {
      const controller = new CallController(pool);
      controller.batchInitiateCalls(req, res);
    }
  );

  /**
   * GET /calls/:id/recording-signed-url
   * Get signed URL for call recording
   */
  router.get(
    '/calls/:id/recording-signed-url',
    jwtAuth,
    (req, res) => {
      const controller = new CallController(pool);
      controller.getCallRecordingSignedUrl(req, res);
    }
  );

  /**
   * GET /calls/recent
   * Get recent calls with filters
   */
  router.get(
    '/calls/recent',
    jwtAuth,
    (req, res) => {
      const controller = new CallController(pool);
      controller.getRecentCalls(req, res);
    }
  );

  /**
   * GET /calls/stats
   * Get call statistics
   */
  router.get(
    '/calls/stats',
    jwtAuth,
    (req, res) => {
      const controller = new CallController(pool);
      controller.getCallStats(req, res);
    }
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
    jwtAuth,
    (req, res) => {
      const controller = new CallController(pool);
      controller.resolvePhones(req, res);
    }
  );

  /**
   * POST /update-summary
   * Update sales summary for company or employee
   */
  router.post(
    '/update-summary',
    jwtAuth,
    (req, res) => {
      const controller = new CallController(pool);
      controller.updateSalesSummary(req, res);
    }
  );

module.exports = router;
