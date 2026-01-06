const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./utils/logger');
const { pool } = require('../shared/database/connection');

/**
 * Initialize Socket.IO server and Postgres LISTEN for calllogs_channel
 * @param {http.Server} server
 */
async function initSocket(server) {
  try {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://lad-frontend-3nddlneyya-uc.a.run.app',
      'https://lad-frontend-741719885039.us-central1.run.app',
      'https://lad-frontend-develop-741719885039.us-central1.run.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    const io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
          logger.warn('[Socket] Blocked origin', { origin });
          return callback(new Error('Not allowed by CORS'));
        },
        credentials: true
      }
    });

    // Authenticate sockets and assign tenant rooms
    io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token || (socket.handshake.headers && (socket.handshake.headers.authorization || '').split(' ')[1]) || socket.handshake.query?.token;
        if (!token) {
          logger.warn('[Socket] Missing token on handshake', { id: socket.id });
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

        // Normalize tenant id from token (support multiple possible claims)
        const tenantId = decoded.tenantId || decoded.tenant_id || decoded.clientId || decoded.client_id || decoded.organizationId || decoded.orgId || decoded.org_id;
        if (!tenantId) {
          logger.warn('[Socket] Token missing tenant context', { user: decoded });
          return next(new Error('Tenant context required'));
        }

        socket.user = decoded;
        socket.tenantId = tenantId;
        // Join tenant-specific room
        socket.join(`tenant:${tenantId}`);

        return next();
      } catch (err) {
        logger.warn('[Socket] Auth failed during handshake', { error: err.message });
        return next(new Error('Authentication error'));
      }
    });

    io.on('connection', (socket) => {
      logger.info('[Socket] Client connected', { id: socket.id, tenant: socket.tenantId });

      socket.on('hello', (data) => {
        logger.debug('[Socket] hello', { id: socket.id, data });
      });

      socket.on('disconnect', (reason) => {
        logger.info('[Socket] Client disconnected', { id: socket.id, reason });
      });
    });

    // Setup dedicated client for LISTEN/NOTIFY
    const client = await pool.connect();

    client.on('notification', (msg) => {
      try {
        logger.info('[Socket] Received DB notification', { channel: msg.channel, payload: msg.payload });

        // Expect payload to be JSON with tenant_id and resource id
        let payload = null;
        try { payload = JSON.parse(msg.payload); } catch (e) { payload = { raw: msg.payload }; }

        const tenantId = payload && (payload.tenant_id || payload.tenantId || payload.client_id || payload.clientId);
        if (!tenantId) {
          // If tenant not present, log and skip broadcasting to avoid cross-tenant leaks
          logger.warn('[Socket] Notification missing tenant_id, skipping emit', { payload });
          return;
        }

        // Emit only to the tenant room
        io.to(`tenant:${tenantId}`).emit('calllogs:update', { channel: msg.channel, payload });
      } catch (err) {
        logger.error('[Socket] Error emitting notification', { error: err.message });
      }
    });

    client.on('error', (err) => {
      logger.error('[Socket] Postgres client error', { error: err.message });
    });

    client.on('end', () => {
      logger.warn('[Socket] Postgres listener client ended connection');
    });

    // Start listening on the channel
    await client.query('LISTEN calllogs_channel');
    logger.info('[Socket] Listening for Postgres notifications on calllogs_channel');

    return io;
  } catch (error) {
    logger.error('[Socket] Failed to initialize Socket.IO', { error: error.message });
    throw error;
  }
}

module.exports = {
  initSocket
};
