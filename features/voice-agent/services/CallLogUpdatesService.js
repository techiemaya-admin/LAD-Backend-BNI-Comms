const CallLogUpdatesRepository = require('../repositories/callLogUpdatesRepository');
const logger = require('../../../core/utils/logger');

class CallLogUpdatesService {
  constructor(options = {}) {
    this.logger = options.logger || logger;
    this.repository = options.repository || new CallLogUpdatesRepository({ logger: this.logger });

    this.tenantClients = new Map();
    this.tenantSchemas = new Map();
    this.heartbeatTimers = new Map();

    this.channelName = process.env.VOICE_CALL_LOGS_PG_CHANNEL || 'voice_call_logs_channel';

    this._started = false;
  }

  async start() {
    if (this._started) return;

    await this.repository.ensureListening([this.channelName]);
    this.repository.onNotification((msg) => {
      if (!msg?.payload) return;
      this.logger.debug('[CallLogUpdatesService] NOTIFY received', {
        channel: msg.channel
      });
      this._handleNotification(msg.channel, msg.payload).catch((error) => {
        this.logger.error('[CallLogUpdatesService] Failed to handle notification', {
          error: error.message
        });
      });
    });

    this._started = true;
  }

  addSseClient(tenantId, schema, res) {
    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    if (schema) {
      this.tenantSchemas.set(tenantId, schema);
    }

    let set = this.tenantClients.get(tenantId);
    if (!set) {
      set = new Set();
      this.tenantClients.set(tenantId, set);
    }

    set.add(res);

    if (!this.heartbeatTimers.has(tenantId)) {
      const timer = setInterval(() => {
        this._sendToTenant(tenantId, 'heartbeat', { ts: new Date().toISOString() });
      }, 25000);
      this.heartbeatTimers.set(tenantId, timer);
    }

    const cleanup = () => {
      this.removeSseClient(tenantId, res);
    };

    res.on('close', cleanup);
    res.on('error', cleanup);

    this._sendToTenant(tenantId, 'connected', { ts: new Date().toISOString() }, res);

    return cleanup;
  }

  removeSseClient(tenantId, res) {
    const set = this.tenantClients.get(tenantId);
    if (!set) return;

    set.delete(res);

    if (set.size === 0) {
      this.tenantClients.delete(tenantId);
      this.tenantSchemas.delete(tenantId);
      const timer = this.heartbeatTimers.get(tenantId);
      if (timer) {
        clearInterval(timer);
        this.heartbeatTimers.delete(tenantId);
      }
    }
  }

  _safeJsonParse(payloadText) {
    try {
      return JSON.parse(payloadText);
    } catch {
      return null;
    }
  }

  async _handleNotification(channel, payloadText) {
    if (channel !== this.channelName) return;

    const payload = this._safeJsonParse(payloadText);
    if (!payload) {
      this.logger.debug('[CallLogUpdatesService] Ignoring non-JSON payload', {
        channel
      });
      return;
    }

    const tenantId = payload?.tenant_id || payload?.tenantId;
    if (!tenantId) {
      this.logger.debug('[CallLogUpdatesService] Dropping update without tenant context', {
        channel,
        hasId: !!(payload?.id || payload?.call_log_id)
      });
      return;
    }

    const callLogId = payload.id || payload.call_log_id || payload.callLogId;
    if (!callLogId) {
      this.logger.debug('[CallLogUpdatesService] Dropping update without call_log_id', { channel, tenantId });
      return;
    }

    const schema = this.tenantSchemas.get(tenantId);
    if (!schema) {
      this.logger.debug('[CallLogUpdatesService] Dropping update without schema context', { tenantId, callLogId });
      return;
    }

    const row = await this.repository.getCallLogRowForStream(schema, tenantId, callLogId);
    if (!row) {
      this.logger.debug('[CallLogUpdatesService] Call log not found for stream', { tenantId, callLogId });
      return;
    }

    this._sendToTenant(tenantId, 'call_log_update', row);
    this.logger.debug('[CallLogUpdatesService] call_log_update sent', { tenantId, callLogId });
  }

  _formatSse(eventName, data) {
    return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  _sendToTenant(tenantId, eventName, data, singleRes = null) {
    const payload = this._formatSse(eventName, data);

    if (singleRes) {
      try {
        singleRes.write(payload);
      } catch (error) {
        this.logger.debug('[CallLogUpdatesService] SSE write failed (single)', {
          tenantId,
          error: error.message
        });
      }
      return;
    }

    const set = this.tenantClients.get(tenantId);
    if (!set || set.size === 0) return;

    for (const res of set) {
      try {
        res.write(payload);
      } catch (error) {
        this.logger.debug('[CallLogUpdatesService] SSE write failed', {
          tenantId,
          error: error.message
        });
        this.removeSseClient(tenantId, res);
      }
    }
  }
}

module.exports = CallLogUpdatesService;
