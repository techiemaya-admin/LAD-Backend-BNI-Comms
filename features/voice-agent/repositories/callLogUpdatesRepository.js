const { pool } = require('../../../shared/database/connection');
const logger = require('../../../core/utils/logger');

class CallLogUpdatesRepository {
  constructor(options = {}) {
    this.pool = options.pool || pool;
    this.logger = options.logger || logger;

    this.client = null;
    this.listening = false;
    this.channels = new Set();
    this.handlers = new Set();
  }

  _sanitizeChannelName(channelName) {
    return String(channelName || '').replace(/[^a-zA-Z0-9_]/g, '');
  }

  onNotification(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async ensureListening(channels = []) {
    for (const ch of channels) {
      const sanitized = this._sanitizeChannelName(ch);
      if (sanitized) this.channels.add(sanitized);
    }

    if (this.listening) return;

    this.client = await this.pool.connect();

    this.client.on('notification', (msg) => {
      for (const handler of this.handlers) {
        try {
          handler(msg);
        } catch (error) {
          this.logger.error('[CallLogUpdatesRepository] Notification handler error', {
            error: error.message
          });
        }
      }
    });

    this.client.on('error', (err) => {
      this.logger.error('[CallLogUpdatesRepository] LISTEN client error', {
        error: err.message,
        code: err.code
      });
      this.listening = false;
    });

    for (const ch of this.channels) {
      await this.client.query(`LISTEN ${ch}`);
    }

    this.listening = true;
    this.logger.info('[CallLogUpdatesRepository] Listening for call log updates', {
      channels: Array.from(this.channels)
    });
  }

  async getCallLogRowForStream(schema, tenantId, callLogId) {
    const query = `
      SELECT 
        vcl.id AS call_log_id,
        vcl.tenant_id,
        vcl.initiated_by_user_id,
        vcl.lead_id,
        vcl.to_country_code,
        vcl.to_base_number,
        vcl.from_number_id,
        vcl.agent_id,
        va.name AS agent_name,
        vcl.status,
        vcl.started_at,
        vcl.ended_at,
        vcl.duration_seconds,
        vcl.recording_url,
        vcl.cost,
        vcl.currency,
        vcl.campaign_id,
        vcl.campaign_lead_id,
        vcl.campaign_step_id,
        vcl.direction,
        vcl.metadata,
        l.first_name AS lead_first_name,
        l.last_name AS lead_last_name,
        l.tags AS lead_tags,
        vcbe.batch_id
      FROM ${schema}.voice_call_logs vcl
      LEFT JOIN ${schema}.leads l ON l.id = vcl.lead_id AND l.tenant_id = vcl.tenant_id
      LEFT JOIN ${schema}.voice_agents va ON va.id = vcl.agent_id::bigint AND va.tenant_id = vcl.tenant_id
      LEFT JOIN ${schema}.voice_call_batch_entries vcbe ON vcbe.call_log_id = vcl.id AND vcbe.is_deleted = false
      WHERE vcl.id = $1 AND vcl.tenant_id = $2
      LIMIT 1
    `;

    const result = await this.pool.query(query, [callLogId, tenantId]);
    return result.rows[0] || null;
  }
}

module.exports = CallLogUpdatesRepository;
