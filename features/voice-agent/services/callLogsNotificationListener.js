/**
 * Call Logs Notification Listener Service
 * 
 * Real-time listener for voice call logs changes using PostgreSQL NOTIFY/LISTEN
 * Automatically updates frontend when voice_call_logs table changes
 * 
 * Similar pattern to bookingNotificationListener but for call logs
 */

const { Client } = require('pg');
const logger = require('../../../core/utils/logger');
const { getSocketService } = require('../../../shared/services/socketService');

class CallLogsNotificationListener {
  constructor() {
    this.client = null;
    this.isListening = false;
    this.callbacks = new Map(); // tenant_id -> callback function
    this.reconnectTimeout = null;
    this.reconnectDelay = 5000; // 5 seconds
    this.maxReconnectAttempts = 10;
    this.reconnectAttempts = 0;
  }

  /**
   * Start listening for call logs notifications
   */
  async start() {
    if (this.isListening) {
      logger.warn('[CallLogsListener] Already listening');
      return;
    }

    try {
      // Create dedicated connection for LISTEN
      this.client = new Client({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'salesmaya_agent',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD,
        // Keep connection alive
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });

      await this.client.connect();

      // Set up error handling
      this.client.on('error', (err) => {
        logger.error('[CallLogsListener] Connection error:', {
          error: err.message,
          code: err.code
        });
        this.handleDisconnect();
      });

      this.client.on('end', () => {
        logger.warn('[CallLogsListener] Connection ended');
        this.handleDisconnect();
      });

      // Listen for call logs notifications
      await this.client.query('LISTEN call_logs_update');

      // Set up notification handler
      this.client.on('notification', (msg) => {
        this.handleNotification(msg);
      });

      this.isListening = true;
      this.reconnectAttempts = 0;
      
      logger.info('[CallLogsListener] Started listening for call logs notifications');

    } catch (error) {
      logger.error('[CallLogsListener] Failed to start:', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Stop listening for notifications
   */
  async stop() {
    if (!this.isListening) {
      return;
    }

    try {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      if (this.client) {
        await this.client.query('UNLISTEN call_logs_update').catch(() => {});
        await this.client.end().catch(() => {});
        this.client = null;
      }

      this.isListening = false;
      this.callbacks.clear();
      
      logger.info('[CallLogsListener] Stopped listening for notifications');

    } catch (error) {
      logger.error('[CallLogsListener] Error stopping:', {
        error: error.message
      });
    }
  }

  /**
   * Handle incoming notifications
   */
  async handleNotification(msg) {
    try {
      logger.debug('[CallLogsListener] Received notification:', {
        channel: msg.channel,
        payload: msg.payload
      });

      if (msg.channel !== 'call_logs_update') {
        return;
      }

      const payload = JSON.parse(msg.payload);
      const { tenant_id, operation, call_log } = payload;

      logger.info('[CallLogsListener] Processing call log update:', {
        tenant_id,
        operation,
        call_id: call_log?.id,
        status: call_log?.status
      });

      // Emit Socket.IO event for real-time frontend updates
      try {
        const socketService = getSocketService();
        socketService.emitCallLogsUpdate(tenant_id, {
          operation,
          call_log
        });
      } catch (error) {
        logger.warn('[CallLogsListener] Socket.IO emit failed:', {
          error: error.message,
          tenant_id
        });
      }

      // Broadcast to all registered callbacks for this tenant
      const callback = this.callbacks.get(tenant_id);
      if (callback) {
        try {
          await callback({
            type: 'call_log_update',
            operation,
            tenant_id,
            call_log
          });
        } catch (error) {
          logger.error('[CallLogsListener] Callback error:', {
            tenant_id,
            error: error.message
          });
        }
      } else {
        logger.debug('[CallLogsListener] No callback registered for tenant:', {
          tenant_id
        });
      }

    } catch (error) {
      logger.error('[CallLogsListener] Error handling notification:', {
        error: error.message,
        payload: msg.payload
      });
    }
  }

  /**
   * Handle connection disconnect with retry logic
   */
  handleDisconnect() {
    if (!this.isListening) {
      return; // Already stopped
    }

    this.isListening = false;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[CallLogsListener] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    logger.warn('[CallLogsListener] Attempting reconnection', {
      attempt: this.reconnectAttempts,
      delay
    });

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.start();
      } catch (error) {
        logger.error('[CallLogsListener] Reconnection failed:', {
          error: error.message
        });
        this.handleDisconnect();
      }
    }, delay);
  }

  /**
   * Register a callback for call logs updates for a specific tenant
   */
  registerCallback(tenantId, callback) {
    this.callbacks.set(tenantId, callback);
    logger.debug('[CallLogsListener] Registered callback for tenant:', {
      tenant_id: tenantId
    });
  }

  /**
   * Unregister callback for a tenant
   */
  unregisterCallback(tenantId) {
    this.callbacks.delete(tenantId);
    logger.debug('[CallLogsListener] Unregistered callback for tenant:', {
      tenant_id: tenantId
    });
  }
}

// Singleton instance
let instance = null;

function getListener() {
  if (!instance) {
    instance = new CallLogsNotificationListener();
  }
  return instance;
}

module.exports = {
  CallLogsNotificationListener,
  getListener
};