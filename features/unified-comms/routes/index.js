/**
 * routes/index.js
 * Route registration for conversations feature
 */

const createConversationsRoutes = require('./conversationsRoutes');

function registerConversationsRoutes(app, conversationsService, authMiddleware) {
  // Create routes with service dependency
  const conversationsRoutes = createConversationsRoutes(conversationsService);

  // Register routes with auth middleware
  app.use('/api/omni-conversations', authMiddleware, conversationsRoutes);

  // Webhook endpoint (public, but validates signature)
  app.post('/api/omni-conversations/webhooks/:channel/:provider', (req, res, next) => {
    const conversationsController = require('../controllers/conversationsController');
    const controller = new conversationsController(conversationsService);
    controller.ingestWebhook(req, res, next);
  });
}

module.exports = registerConversationsRoutes;
