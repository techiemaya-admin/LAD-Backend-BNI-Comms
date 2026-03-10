/**
 * whatsappRoutes.js
 * Route definitions for WhatsApp features: agent chat, broadcasting, forwarding
 * Integrated into /api/omni-conversations route group
 */

const express = require('express');
const router = express.Router({ mergeParams: true });

/**
 * Initialize routes with controller and middleware
 * @param {WhatsAppController} whatsappController
 * @param {Function} authMiddleware
 * @param {Function} tenantMiddleware
 */
function initializeWhatsAppRoutes(whatsappController, authMiddleware, tenantMiddleware) {
  // Apply middleware to all routes
  router.use(authMiddleware);
  router.use(tenantMiddleware);

  /**
   * AGENT CHAT ROUTES
   */

  // Create or get existing agent chat with contact
  router.post('/agent-chats', (req, res) =>
    whatsappController.createAgentChat(req, res),
  );

  // Send message in agent chat
  router.post('/agent-chats/:chatId/messages', (req, res) =>
    whatsappController.sendAgentMessage(req, res),
  );

  // Get agent chat history
  router.get('/agent-chats/:chatId/messages', (req, res) =>
    whatsappController.getAgentChatHistory(req, res),
  );

  /**
   * BROADCAST ROUTES
   */

  // Create broadcast campaign
  router.post('/broadcasts', (req, res) =>
    whatsappController.createBroadcast(req, res),
  );

  // List broadcast campaigns with pagination
  router.get('/broadcasts', (req, res) =>
    whatsappController.listBroadcasts(req, res),
  );

  // Get broadcast campaign details
  router.get('/broadcasts/:broadcastId', (req, res) =>
    whatsappController.getBroadcastDetails(req, res),
  );

  // Execute broadcast campaign
  router.post('/broadcasts/:broadcastId/execute', (req, res) =>
    whatsappController.executeBroadcast(req, res),
  );

  /**
   * FORWARDING ROUTES
   */

  // Create forwarding rule
  router.post('/forwarding-rules', (req, res) =>
    whatsappController.createForwardingRule(req, res),
  );

  // Sync member group contacts
  router.post('/forwarding-rules/:ruleId/sync', (req, res) =>
    whatsappController.syncMemberGroupContacts(req, res),
  );

  // Get forwarding records (audit log)
  router.get('/forwarding-records', (req, res) =>
    whatsappController.getForwardingRecords(req, res),
  );

  return router;
}

module.exports = initializeWhatsAppRoutes;
