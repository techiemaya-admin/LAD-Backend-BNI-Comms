/**
 * Personal WhatsApp Service
 *
 * Business logic for personal WhatsApp account management.
 * Coordinates between Baileys bridge, database, and conversation service.
 *
 * NO SQL in this layer - use repositories for data access.
 */

const baileysBridge = require('./baileysBridgeService');
const logger = require('../../../core/utils/logger');
const axios = require('axios');

// Conversation service URL for forwarding messages
const CONVERSATION_SERVICE_URL =
  process.env.CONVERSATION_SERVICE_URL ||
  process.env.BNI_SERVICE_URL ||
  'http://localhost:8000';

/**
 * Initiate a new personal WhatsApp session (generates QR code).
 *
 * @param {string} tenantId
 * @returns {Promise<{id: string, status: string, qr_code: string, qr_expires_in: number}>}
 */
async function initiateAccount(tenantId) {
  logger.info('[PersonalWA] Initiating account', { tenantId });

  // Create Baileys session with message handler
  const { sessionId, qrCode, expiresIn } = await baileysBridge.createSession(
    tenantId,
    (messageData) => handleIncomingMessage(messageData)
  );

  return {
    id: sessionId,
    status: qrCode ? 'qr_scanning' : 'connected',
    qr_code: qrCode,
    qr_expires_in: expiresIn,
    gateway_account_id: sessionId,
  };
}

/**
 * Get account/session status.
 *
 * @param {string} tenantId
 * @param {string} accountId - The session ID
 * @returns {object|null}
 */
function getAccountStatus(tenantId, accountId) {
  const session = baileysBridge.getSession(accountId);
  if (!session) return null;

  // Verify tenant owns this session
  if (session.tenantId !== tenantId) {
    logger.warn('[PersonalWA] Tenant mismatch on status check', {
      expected: session.tenantId,
      got: tenantId,
    });
    return null;
  }

  return {
    id: session.sessionId,
    status: session.status,
    phone_number: session.phoneNumber,
    connected_at: session.connectedAt,
    gateway_account_id: session.sessionId,
  };
}

/**
 * Logout and disconnect a personal WhatsApp session.
 *
 * @param {string} tenantId
 * @param {string} accountId - The session ID
 */
async function logout(tenantId, accountId) {
  const session = baileysBridge.getSession(accountId);
  if (!session) {
    logger.warn('[PersonalWA] Session not found for logout', { accountId });
    return;
  }

  if (session.tenantId !== tenantId) {
    throw new Error('Unauthorized: tenant mismatch');
  }

  await baileysBridge.logoutSession(accountId);
  logger.info('[PersonalWA] Account logged out', { tenantId, accountId });
}

/**
 * Send a message via a personal WhatsApp session.
 *
 * Called by conversation service (Python) when it has an AI reply to send.
 *
 * @param {string} accountId - Session ID
 * @param {string} to - Phone number
 * @param {string} text - Message text
 * @returns {Promise<{gateway_message_id: string, status: string}>}
 */
async function sendOutgoingMessage(accountId, to, text) {
  const messageId = await baileysBridge.sendMessage(accountId, to, text);
  return { gateway_message_id: messageId, status: 'sent' };
}

/**
 * Handle an incoming personal WhatsApp message.
 * Forwards to the conversation service (Python FastAPI) for LLM processing.
 *
 * @param {object} messageData - From baileysBridge onMessage callback
 */
async function handleIncomingMessage(messageData) {
  const { sessionId, tenantId, contactPhone, contactName, text, externalMessageId } = messageData;

  logger.info('[PersonalWA] Forwarding message to conversation service', {
    sessionId,
    tenantId,
    from: contactPhone,
  });

  // Get the LAD_backend URL that conversation service can call back to send replies
  const ladBackendUrl =
    process.env.LAD_BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 3004}`;

  try {
    await axios.post(
      `${CONVERSATION_SERVICE_URL}/api/personal-whatsapp/webhook`,
      {
        account_id: sessionId,
        contact_phone: contactPhone,
        contact_name: contactName,
        text,
        external_message_id: externalMessageId,
        lad_backend_url: ladBackendUrl,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
        },
        timeout: 10000,
      }
    );

    logger.info('[PersonalWA] Message forwarded successfully', {
      sessionId,
      contactPhone,
    });
  } catch (err) {
    logger.error('[PersonalWA] Failed to forward message to conversation service', {
      sessionId,
      contactPhone,
      error: err.message,
      conversationServiceUrl: CONVERSATION_SERVICE_URL,
    });
  }
}

module.exports = {
  initiateAccount,
  getAccountStatus,
  logout,
  sendOutgoingMessage,
  handleIncomingMessage,
};
