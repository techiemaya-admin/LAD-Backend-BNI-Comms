/**
 * conversationsRoutes.js
 * Route definitions for conversations feature
 */

const express = require('express');
const ConversationsController = require('../controllers/conversationsController');

function createConversationsRoutes(conversationsService) {
  const router = express.Router();
  const controller = new ConversationsController(conversationsService);

  /**
   * GET /threads
   * Get paginated conversation threads with optional filters
   * Query params: leadId, channel, status, campaignId, q, limit, offset
   */
  router.get('/threads', (req, res, next) => {
    controller.getThreads(req, res, next);
  });

  /**
   * GET /threads/:threadId
   * Get single conversation thread with messages and participants
   * Query params: limit, offset, before
   */
  router.get('/threads/:threadId', (req, res, next) => {
    controller.getThread(req, res, next);
  });

  /**
   * POST /threads/:threadId/messages
   * Create outbound message in conversation
   * Body: { content, contentHtml?, channel, messageType?, metadata? }
   */
  router.post('/threads/:threadId/messages', (req, res, next) => {
    controller.sendMessage(req, res, next);
  });

  /**
   * PUT /threads/:threadId/status
   * Update conversation status
   * Body: { status }
   */
  router.put('/threads/:threadId/status', (req, res, next) => {
    controller.updateStatus(req, res, next);
  });

  /**
   * POST /threads/:threadId/participants
   * Add participant to conversation
   * Body: { participantType, participantId, participantEmail? }
   */
  router.post('/threads/:threadId/participants', (req, res, next) => {
    controller.addParticipant(req, res, next);
  });

  /**
   * POST /webhooks/:channel/:provider
   * Ingest webhook message from external provider
   * Body: { raw provider payload }
   */
  router.post('/webhooks/:channel/:provider', (req, res, next) => {
    controller.ingestWebhook(req, res, next);
  });

  return router;
}

module.exports = createConversationsRoutes;
