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
 * IMPORTANT: Session status is checked BOTH in memory AND in Baileys auth directory.
 * If session is not in memory, we check if credentials are saved to disk (meaning it was connected).
 * This prevents the QR from showing "disconnected" after a page refresh.
 *
 * @param {string} tenantId
 * @param {string} accountId - The session ID
 * @returns {object|null}
 */
function getAccountStatus(tenantId, accountId) {
  // First, check if session is in memory
  const session = baileysBridge.getSession(accountId);
  if (session) {
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

  // Session not in memory — check if credentials are saved (persisted from previous connection)
  // This handles page refresh: session was connected, page refreshed, session out of memory,
  // but Baileys can restore from saved credentials
  const path = require('path');
  const fs = require('fs');
  const AUTH_DIR = process.env.BAILEYS_AUTH_DIR || path.join(process.cwd(), '.baileys-sessions');
  const sessionAuthDir = path.join(AUTH_DIR, accountId);

  if (fs.existsSync(sessionAuthDir)) {
    const filesInDir = fs.readdirSync(sessionAuthDir);
    if (filesInDir.length > 0) {
      logger.info('[PersonalWA] Session credentials exist on disk, returning persisted status', {
        sessionId: accountId,
        tenantId,
        credentialFiles: filesInDir.length,
      });

      // Credentials exist — this session was connected before
      // Return status as "connected" so frontend knows to use it
      return {
        id: accountId,
        status: 'connected',
        phone_number: null,
        connected_at: null,
        gateway_account_id: accountId,
      };
    }
  }

  // No session in memory and no saved credentials
  return null;
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
 * List all active personal WhatsApp sessions for a tenant.
 * Used by frontend to find existing connected sessions after page refresh.
 *
 * @param {string} tenantId
 * @returns {Array<{id, status, phone_number, connected_at, gateway_account_id}>}
 */
function listAccountsByTenant(tenantId) {
  const sessions = baileysBridge.getSessionsByTenant(tenantId);
  return sessions.map(session => ({
    id: session.sessionId,
    status: session.status,
    phone_number: session.phoneNumber,
    connected_at: session.connectedAt,
    gateway_account_id: session.sessionId,
  }));
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
  listAccountsByTenant,
  logout,
  sendOutgoingMessage,
  handleIncomingMessage,
};
