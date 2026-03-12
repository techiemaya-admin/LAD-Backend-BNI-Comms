/**
 * Personal WhatsApp Controller
 *
 * Request/response handling only - no business logic.
 * Delegates to personalWhatsappService for all operations.
 */

const personalWhatsappService = require('../services/personalWhatsappService');
const logger = require('../../../core/utils/logger');

/**
 * POST /accounts
 * Create a personal WhatsApp account (initiates QR code generation).
 */
async function createAccount(req, res) {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const result = await personalWhatsappService.initiateAccount(tenantId);
    return res.status(201).json(result);
  } catch (error) {
    logger.error('[PersonalWA:Controller] Error creating account', {
      error: error.message,
    });
    return res.status(500).json({ error: 'Failed to generate QR code' });
  }
}

/**
 * GET /accounts/:id
 * Get account/session status (used for polling QR scan status).
 */
async function getAccountStatus(req, res) {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const result = personalWhatsappService.getAccountStatus(tenantId, id);
    if (!result) {
      return res.status(404).json({ error: 'Account not found' });
    }

    return res.json(result);
  } catch (error) {
    logger.error('[PersonalWA:Controller] Error getting status', {
      error: error.message,
    });
    return res.status(500).json({ error: 'Failed to get account status' });
  }
}

/**
 * GET /accounts
 * List all active personal WhatsApp sessions for the tenant.
 * Used by frontend to find active connected session after page refresh.
 */
async function listAccounts(req, res) {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const accounts = personalWhatsappService.listAccountsByTenant(tenantId);
    return res.json({
      success: true,
      accounts: accounts,
      totalConnected: accounts.filter(a => a.status === 'connected').length,
    });
  } catch (error) {
    logger.error('[PersonalWA:Controller] Error listing accounts', {
      error: error.message,
    });
    return res.status(500).json({ error: 'Failed to list accounts' });
  }
}

/**
 * POST /logout
 * Disconnect and logout a personal WhatsApp session.
 */
async function logoutAccount(req, res) {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const { account_id } = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }
    if (!account_id) {
      return res.status(400).json({ error: 'account_id is required' });
    }

    await personalWhatsappService.logout(tenantId, account_id);
    return res.json({ status: 'logged_out', account_id });
  } catch (error) {
    logger.error('[PersonalWA:Controller] Error logging out', {
      error: error.message,
    });
    return res.status(500).json({ error: 'Failed to logout' });
  }
}

/**
 * POST /send
 * Send a message via personal WhatsApp (called by conversation service).
 */
async function sendMessage(req, res) {
  try {
    const { account_id, to, text } = req.body;

    if (!account_id || !to || !text) {
      return res.status(400).json({ error: 'account_id, to, and text are required' });
    }

    const result = await personalWhatsappService.sendOutgoingMessage(account_id, to, text);
    return res.json(result);
  } catch (error) {
    logger.error('[PersonalWA:Controller] Error sending message', {
      error: error.message,
    });
    return res.status(500).json({ error: 'Failed to send message' });
  }
}

module.exports = {
  createAccount,
  getAccountStatus,
  listAccounts,
  logoutAccount,
  sendMessage,
};
