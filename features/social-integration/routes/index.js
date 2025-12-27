/**
 * Social Integration Routes
 * 
 * Unified routes for all social media platform integrations
 * 
 * LAD Architecture Compliant:
 * - Auth middleware on protected routes
 * - Tenant context from req.user (via JWT)
 * - No hardcoded schema names
 */

const express = require('express');
const router = express.Router();
const { authenticateToken: jwtAuth } = require('../../../core/middleware/auth');
const SocialIntegrationController = require('../controllers/SocialIntegrationController');

/**
 * Initialize routes with database connection
 * 
 * @param {Object} db - Database connection pool
 * @returns {Router} Express router
 */
function initializeRoutes(db) {
  const controller = new SocialIntegrationController(db);
  
  // List available platforms (protected)
  router.get('/platforms', jwtAuth, (req, res) => controller.listPlatforms(req, res));
  
  // List all connected accounts (protected)
  router.get('/accounts', jwtAuth, (req, res) => controller.listAccounts(req, res));
  
  // Platform-specific endpoints with :platform parameter (all protected)
  
  // Connect/authenticate account
  router.post('/:platform/connect', jwtAuth, (req, res) => controller.connectAccount(req, res));
  
  // Get connection status
  router.get('/:platform/status', jwtAuth, (req, res) => controller.getStatus(req, res));
  
  // Send invitation/connection request
  router.post('/:platform/send-invitation', jwtAuth, (req, res) => controller.sendInvitation(req, res));
  
  // Batch send invitations
  router.post('/:platform/batch-send-invitations', jwtAuth, (req, res) => controller.batchSendInvitations(req, res));
  
  // Send direct message
  router.post('/:platform/send-message', jwtAuth, (req, res) => controller.sendMessage(req, res));
  
  // Look up profile
  router.get('/:platform/lookup', jwtAuth, (req, res) => controller.lookupProfile(req, res));
  
  // Get invitations status
  router.get('/:platform/invitations', jwtAuth, (req, res) => controller.getInvitationsStatus(req, res));
  
  // Get messages
  router.get('/:platform/messages', jwtAuth, (req, res) => controller.getMessages(req, res));
  
  // Get conversations
  router.get('/:platform/conversations', jwtAuth, (req, res) => controller.getConversations(req, res));
  
  // Disconnect account
  router.post('/:platform/disconnect', jwtAuth, (req, res) => controller.disconnectAccount(req, res));
  
  // Webhook endpoints (no auth - validated by signature)
  router.post('/webhook', (req, res) => controller.handleWebhook(req, res));
  router.get('/webhook/test', (req, res) => controller.testWebhook(req, res));
  
  console.log('[SocialIntegration] Routes initialized');
  
  return router;
}

module.exports = initializeRoutes;
