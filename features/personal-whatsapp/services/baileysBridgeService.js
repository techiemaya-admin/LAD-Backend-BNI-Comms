/**
 * Baileys Bridge Service
 *
 * Manages personal WhatsApp sessions using Baileys (WhatsApp Web protocol).
 * Each session corresponds to one personal WhatsApp account.
 *
 * Responsibilities:
 * - Generate QR codes for new sessions
 * - Track active sessions in memory
 * - Forward incoming messages to conversation service
 * - Send outgoing messages via Baileys sockets
 * - Handle session lifecycle (connect, disconnect, reconnect, logout)
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const logger = require('../../../core/utils/logger');

// In-memory session store: sessionId -> { socket, status, qrCode, phoneNumber, tenantId, connectedAt, onMessage, authDir }
const sessions = new Map();

// Session auth data directory
const AUTH_DIR = process.env.BAILEYS_AUTH_DIR || path.join(process.cwd(), '.baileys-sessions');

/**
 * Ensure auth directory exists
 */
function ensureAuthDir(sessionId) {
  const sessionDir = path.join(AUTH_DIR, sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  return sessionDir;
}

/**
 * Generate a unique session ID for a new account
 */
function generateSessionId(tenantId) {
  return `session_${tenantId}_${Date.now()}`;
}

/**
 * Connect (or reconnect) a Baileys socket for a given session.
 * This is the core function that handles:
 * - Initial QR code generation
 * - 515 stream restart after pairing
 * - Session restore from saved credentials
 */
async function connectSocket(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const { authDir, tenantId, onMessage } = session;

  // Load saved auth state (credentials persist across reconnects)
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  // Close existing socket if any
  if (session.socket) {
    try {
      session.socket.ev.removeAllListeners();
      session.socket.end();
    } catch (_) {}
  }

  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['LAD Platform', 'Chrome', '4.0.0'],
    generateHighQualityLinkPreview: false,
  });

  session.socket = socket;

  // Connection update handler
  socket.ev.on('connection.update', async (update) => {
    const { qr, connection, lastDisconnect } = update;

    // QR code generated — only relevant for initial pairing
    if (qr) {
      session.qrCode = qr;
      session.status = 'qr_scanning';

      logger.info('[BaileysBridge] QR code generated', { sessionId, tenantId });

      // Resolve the createSession promise if waiting
      if (session._resolveQR) {
        session._resolveQR({ sessionId, qrCode: qr, expiresIn: 240 });
        session._resolveQR = null;
      }
    }

    // Successfully connected
    if (connection === 'open') {
      if (session._qrTimeout) {
        clearTimeout(session._qrTimeout);
        session._qrTimeout = null;
      }

      const phoneNumber = socket.user?.id?.split(':')[0] || socket.user?.id || null;
      session.status = 'connected';
      session.phoneNumber = phoneNumber;
      session.connectedAt = new Date().toISOString();
      session.qrCode = null;

      logger.info('[BaileysBridge] Session connected', {
        sessionId,
        tenantId,
        phoneNumber,
      });

      // Resolve if the initial createSession promise is still pending
      if (session._resolveQR) {
        session._resolveQR({ sessionId, qrCode: null, expiresIn: 0 });
        session._resolveQR = null;
      }
    }

    // Connection closed — decide whether to reconnect or give up
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode
        : (lastDisconnect?.error?.output?.statusCode || null);

      const loggedOut = statusCode === DisconnectReason.loggedOut;

      logger.info('[BaileysBridge] Connection closed', {
        sessionId,
        statusCode,
        loggedOut,
      });

      if (loggedOut) {
        // User explicitly logged out — clean up
        session.status = 'disconnected';
        return;
      }

      // Status 515 = "Stream Errored (restart required)" — normal after QR pairing
      // Status 408 = "Connection timed out" — can also happen during pairing
      // DisconnectReason.restartRequired = 515
      const shouldReconnect =
        statusCode === DisconnectReason.restartRequired ||
        statusCode === 515 ||
        statusCode === DisconnectReason.connectionClosed ||
        statusCode === DisconnectReason.connectionReplaced ||
        statusCode === DisconnectReason.timedOut;

      if (shouldReconnect) {
        logger.info('[BaileysBridge] Reconnecting session', {
          sessionId,
          statusCode,
          reason: 'restart required after pairing or transient error',
        });

        session.status = 'reconnecting';

        // Small delay before reconnecting
        setTimeout(() => {
          connectSocket(sessionId).catch((err) => {
            logger.error('[BaileysBridge] Reconnect failed', {
              sessionId,
              error: err.message,
            });
            session.status = 'error';
          });
        }, 1500);
      } else {
        // Unexpected disconnect — mark as error
        session.status = 'error';

        // Reject createSession promise if still pending
        if (session._resolveQR) {
          session._resolveQR = null;
        }
        if (session._rejectQR) {
          session._rejectQR(new Error(`Connection closed with status: ${statusCode}`));
          session._rejectQR = null;
        }
      }
    }
  });

  // Persist credentials on update (critical for 515 reconnect)
  socket.ev.on('creds.update', saveCreds);

  // Listen for incoming messages
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') continue;
      if (msg.key.fromMe) continue;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';

      if (!text) continue;

      const contactPhone = msg.key.remoteJid.split('@')[0];
      const contactName = msg.pushName || '';

      logger.info('[BaileysBridge] Incoming message', {
        sessionId,
        tenantId,
        from: contactPhone,
        textLength: text.length,
      });

      if (onMessage) {
        try {
          await onMessage({
            sessionId,
            tenantId,
            contactPhone,
            contactName,
            text,
            externalMessageId: msg.key.id,
            timestamp: msg.messageTimestamp,
          });
        } catch (err) {
          logger.error('[BaileysBridge] onMessage callback error', {
            sessionId,
            error: err.message,
          });
        }
      }
    }
  });
}

/**
 * Create a new Baileys session and return a QR code string.
 *
 * @param {string} tenantId - The tenant requesting the session
 * @param {Function} onMessage - Callback for incoming messages
 * @returns {Promise<{sessionId: string, qrCode: string, expiresIn: number}>}
 */
async function createSession(tenantId, onMessage) {
  const sessionId = generateSessionId(tenantId);
  const authDir = ensureAuthDir(sessionId);

  logger.info('[BaileysBridge] Creating session', { sessionId, tenantId });

  return new Promise((resolve, reject) => {
    // Store session with promise callbacks so connectSocket can resolve/reject
    sessions.set(sessionId, {
      socket: null,
      status: 'connecting',
      qrCode: null,
      phoneNumber: null,
      tenantId,
      connectedAt: null,
      onMessage,
      authDir,
      _resolveQR: resolve,
      _rejectQR: reject,
      _qrTimeout: null,
    });

    // Set QR expiry timeout (4 minutes)
    const session = sessions.get(sessionId);
    session._qrTimeout = setTimeout(() => {
      const sess = sessions.get(sessionId);
      if (sess && (sess.status === 'qr_scanning' || sess.status === 'connecting')) {
        logger.info('[BaileysBridge] QR expired', { sessionId });
        sess.status = 'expired';
        cleanupSession(sessionId);
      }
    }, 240000);

    // Start the connection
    connectSocket(sessionId).catch((err) => {
      logger.error('[BaileysBridge] Initial connection failed', {
        sessionId,
        error: err.message,
      });
      const sess = sessions.get(sessionId);
      if (sess && sess._rejectQR) {
        sess._rejectQR(err);
        sess._rejectQR = null;
      }
    });
  });
}

/**
 * Get session status
 */
function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  return {
    sessionId,
    status: session.status,
    phoneNumber: session.phoneNumber,
    tenantId: session.tenantId,
    connectedAt: session.connectedAt,
    qrCode: session.qrCode,
  };
}

/**
 * Send a text message via an active session
 */
async function sendMessage(sessionId, to, text) {
  const session = sessions.get(sessionId);
  if (!session || !session.socket) {
    throw new Error(`No active session: ${sessionId}`);
  }
  if (session.status !== 'connected') {
    throw new Error(`Session not connected: ${sessionId} (status: ${session.status})`);
  }

  const jid = to.includes('@') ? to : `${to.replace(/^\+/, '')}@s.whatsapp.net`;

  const result = await session.socket.sendMessage(jid, { text });
  logger.info('[BaileysBridge] Message sent', {
    sessionId,
    to: jid,
    messageId: result.key.id,
  });

  return result.key.id;
}

/**
 * Logout and cleanup a session
 */
async function logoutSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    if (session.socket) {
      await session.socket.logout();
    }
  } catch (err) {
    logger.warn('[BaileysBridge] Logout error (may be already disconnected)', {
      sessionId,
      error: err.message,
    });
  }

  cleanupSession(sessionId);
  logger.info('[BaileysBridge] Session logged out', { sessionId });
}

/**
 * Remove session from memory and optionally delete auth files
 */
function cleanupSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session?.socket) {
    try {
      session.socket.ev.removeAllListeners();
      session.socket.end();
    } catch (_) {}
  }
  sessions.delete(sessionId);

  const authDir = path.join(AUTH_DIR, sessionId);
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
  }
}

/**
 * Get all sessions for a tenant
 */
function getSessionsByTenant(tenantId) {
  const result = [];
  for (const [sessionId, session] of sessions) {
    if (session.tenantId === tenantId) {
      result.push({
        sessionId,
        status: session.status,
        phoneNumber: session.phoneNumber,
        connectedAt: session.connectedAt,
      });
    }
  }
  return result;
}

module.exports = {
  createSession,
  getSession,
  sendMessage,
  logoutSession,
  cleanupSession,
  getSessionsByTenant,
};
