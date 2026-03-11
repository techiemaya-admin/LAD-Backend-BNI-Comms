const { getSchema, sanitizeSchema } = require('../../../core/utils/schemaHelper');
let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  logger = console;
}

class BatchRepository {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Get all batches for a tenant ordered by updated_at DESC with pagination
   */
  async getBatchesByTenant(tenantId, schema, limit = 50, offset = 0) {
    const query = `
      SELECT *
      FROM ${sanitizeSchema(schema)}.voice_call_batches
      WHERE tenant_id = $1
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(query, [tenantId, limit, offset]);
    return result.rows;
  }

  /**
   * Get total count of batches for a tenant
   */
  async getBatchesCountByTenant(tenantId, schema) {
    const query = `
      SELECT COUNT(*) as total
      FROM ${sanitizeSchema(schema)}.voice_call_batches
      WHERE tenant_id = $1
    `;

    const result = await this.pool.query(query, [tenantId]);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Get call_log_ids for a specific batch with pagination
   */
  async getCallLogIdsByBatchId(batchId, tenantId, schema, limit = 50, offset = 0) {
    const query = `
      SELECT call_log_id
      FROM ${sanitizeSchema(schema)}.voice_call_batch_entries
      WHERE batch_id = $1 AND tenant_id = $2 AND is_deleted = false
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await this.pool.query(query, [batchId, tenantId, limit, offset]);
    return result.rows.map(row => row.call_log_id);
  }

  /**
   * Get total count of call log entries for a batch
   */
  async getCallLogIdsCountByBatchId(batchId, tenantId, schema) {
    const query = `
      SELECT COUNT(*) as total
      FROM ${sanitizeSchema(schema)}.voice_call_batch_entries
      WHERE batch_id = $1 AND tenant_id = $2 AND is_deleted = false
    `;

    const result = await this.pool.query(query, [batchId, tenantId]);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Get call logs by call_log_ids (same format as getCallLogs)
   */
  async getCallLogsByIds(callLogIds, tenantId, schema) {
    if (!callLogIds || callLogIds.length === 0) {
      return [];
    }

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
      FROM ${sanitizeSchema(schema)}.voice_call_logs vcl
      LEFT JOIN ${sanitizeSchema(schema)}.leads l ON l.id = vcl.lead_id AND l.tenant_id = vcl.tenant_id
      LEFT JOIN ${sanitizeSchema(schema)}.voice_agents va ON va.id = vcl.agent_id::bigint AND va.tenant_id = vcl.tenant_id
      LEFT JOIN ${sanitizeSchema(schema)}.voice_call_batch_entries vcbe ON vcbe.call_log_id = vcl.id AND vcbe.is_deleted = false
      WHERE vcl.id = ANY($1) AND vcl.tenant_id = $2
      ORDER BY vcl.started_at DESC
    `;

    const result = await this.pool.query(query, [callLogIds, tenantId]);
    return result.rows;
  }

  /**
   * Get batch statistics for a tenant
   */
  async getBatchStats(tenantId, schema) {
    const query = `
      SELECT COUNT(*) as total_calls
      FROM ${sanitizeSchema(schema)}.voice_call_batches
      WHERE tenant_id = $1
    `;

    const result = await this.pool.query(query, [tenantId]);
    return result.rows[0];
  }
}

module.exports = BatchRepository;
