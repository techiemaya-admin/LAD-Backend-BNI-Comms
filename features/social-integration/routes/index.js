/**
 * Social Integration Routes
 * 
 * Unified routes for all social media platform integrations
 */

const express = require('express');
const router = express.Router();
const SocialIntegrationController = require('./controllers/SocialIntegrationController');

/**
 * Initialize routes with database connection
 * 
 * @param {Object} db - Database connection pool
 * @returns {Router} Express router
 */
function initializeRoutes(db) {
  const controller = new SocialIntegrationController(db);
  
  // List available platforms
  router.get('/platforms', (req, res) => controller.listPlatforms(req, res));
  
  // List all connected accounts
  router.get('/accounts', (req, res) => controller.listAccounts(req, res));
  
  // Platform-specific endpoints with :platform parameter
  
  // Connect/authenticate account
  router.post('/:platform/connect', (req, res) => controller.connectAccount(req, res));
  
  // Get connection status
  router.get('/:platform/status', (req, res) => controller.getStatus(req, res));
  
  // Send invitation/connection request
  router.post('/:platform/send-invitation', (req, res) => controller.sendInvitation(req, res));
  
  // Batch send invitations
  router.post('/:platform/batch-send-invitations', (req, res) => controller.batchSendInvitations(req, res));
  
  // Send direct message
  router.post('/:platform/send-message', (req, res) => controller.sendMessage(req, res));
  
  // Look up profile
  router.get('/:platform/lookup', (req, res) => controller.lookupProfile(req, res));
  
  // Get invitations status
  router.get('/:platform/invitations', (req, res) => controller.getInvitationsStatus(req, res));
  
  // Get messages
  router.get('/:platform/messages', (req, res) => controller.getMessages(req, res));
  
  // Get conversations
  router.get('/:platform/conversations', (req, res) => controller.getConversations(req, res));
  
  // Disconnect account
  router.post('/:platform/disconnect', (req, res) => controller.disconnectAccount(req, res));
  
  // Webhook endpoints (no auth required)
  router.post('/webhook', (req, res) => controller.handleWebhook(req, res));
  router.get('/webhook/test', (req, res) => controller.testWebhook(req, res));
  
  console.log('[SocialIntegration] Routes initialized');
  
  return router;
}

module.exports = initializeRoutes;
