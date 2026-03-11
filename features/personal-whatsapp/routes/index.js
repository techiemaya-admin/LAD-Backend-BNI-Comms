/**
 * Personal WhatsApp Routes
 *
 * Endpoints:
 * POST   /accounts     - Create account (generate QR)
 * GET    /accounts/:id - Get account status (poll QR scan)
 * POST   /logout       - Disconnect account
 * POST   /send         - Send message via personal WhatsApp
 * GET    /health       - Health check
 */

const express = require('express');
const controller = require('../controllers/personalWhatsappController');

const router = express.Router();

// Account management
router.post('/accounts', controller.createAccount);
router.get('/accounts/:id', controller.getAccountStatus);

// Actions
router.post('/logout', controller.logoutAccount);
router.post('/send', controller.sendMessage);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Personal WhatsApp feature is operational',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
