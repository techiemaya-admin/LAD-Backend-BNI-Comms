/**
 * Voice Call Model
 * 
 * Business entity for voice calls (not feature-prefixed)
 * Uses tenant_id for multi-tenancy isolation
 * 
 * Table: voice_calls (NOT voice_agent_calls or call_logs_voiceagent)
 * Schema: Multi-tenant with tenant_id on every row
 */

class VoiceCallModel {
  constructor(db) {
    this.pool = db;
  }

  /**
   * Create a call log entry
   * 
   * @param {Object} params - Call parameters
   * @param {string} params.tenantId - Tenant ID for isolation
   * @param {string} params.voiceId - Voice profile ID
   * @param {number} params.agentId - Agent ID
   * @param {string} params.fromNumber - Caller number
   * @param {string} params.toNumber - Recipient number
   * @param {string} params.status - Call status (calling, ongoing, ended, declined, failed)
   * @param {string} params.addedContext - Context for the call
   * @param {string} params.leadId - Associated lead ID (from main leads table)
   * @param {string} params.initiatedBy - Who initiated the call
   * @param {string} params.recordingUrl - GCS URL for recording
   * @returns {Promise<Object>} Created call log
   */
  async createCallLog({
    tenantId,
    voiceId,
    agentId,
    fromNumber,
    toNumber,
    status = 'calling',
    addedContext,
    leadId = null,
    initiatedBy = null,
    recordingUrl = null
  }) {
    const query = `
      INSERT INTO voice_calls (
        tenant_id,
        voice_id,
        agent_id,
        from_number,
        to_number,
        status,
        added_context,
        lead_id,
        initiated_by,
        recording_url,
        started_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), NOW())
      RETURNING 
        id,
        tenant_id,
        voice_id,
        agent_id,
        from_number,
        to_number,
        status,
        started_at,
        lead_id
    `;

    const values = [
      tenantId,
      voiceId,
      agentId,
      fromNumber,
      toNumber,
      status,
      addedContext,
      leadId,
      initiatedBy,
      recordingUrl
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get call log by ID (tenant-isolated)
   * 
   * @param {string} callId - Call log ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Call log or null
   */
  async getCallById(callId, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        voice_id,
        agent_id,
        from_number,
        to_number,
        status,
        recording_url,
        added_context,
        lead_id,
        initiated_by,
        started_at,
        ended_at,
        created_at,
        updated_at
      FROM voice_calls
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [callId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Get call recording URL by ID (tenant-isolated)
   * 
   * @param {string} callId - Call log ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<string|null>} Recording URL or null
   */
  async getRecordingUrl(callId, tenantId) {
    const query = `
      SELECT recording_url
      FROM voice_calls
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [callId, tenantId]);
    return result.rows[0]?.recording_url || null;
  }

  /**
   * Update call status
   * 
   * @param {string} callId - Call log ID
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} status - New status
   * @param {Object} updates - Optional additional updates
   * @returns {Promise<Object>} Updated call log
   */
  async updateCallStatus(callId, tenantId, status, updates = {}) {
    const setClauses = ['status = $3', 'updated_at = NOW()'];
    const values = [callId, tenantId, status];
    let paramIndex = 4;

    // Add optional updates
    if (updates.endedAt) {
      setClauses.push(`ended_at = $${paramIndex}`);
      values.push(updates.endedAt);
      paramIndex++;
    }
    if (updates.recordingUrl) {
      setClauses.push(`recording_url = $${paramIndex}`);
      values.push(updates.recordingUrl);
      paramIndex++;
    }

    const query = `
      UPDATE voice_calls
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING 
        id,
        tenant_id,
        status,
        started_at,
        ended_at,
        recording_url
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get calls for a lead (tenant-isolated)
   * 
   * @param {string} leadId - Lead ID
   * @param {string} tenantId - Tenant ID for isolation
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Call logs
   */
  async getCallsForLead(leadId, tenantId, limit = 10) {
    const query = `
      SELECT 
        id,
        voice_id,
        agent_id,
        from_number,
        to_number,
        status,
        recording_url,
        started_at,
        ended_at,
        initiated_by
      FROM voice_calls
      WHERE lead_id = $1 AND tenant_id = $2
      ORDER BY started_at DESC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [leadId, tenantId, limit]);
    return result.rows;
  }

  /**
   * Get recent calls for tenant
   * 
   * @param {string} tenantId - Tenant ID
   * @param {number} limit - Max results
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Call logs
   */
  async getRecentCalls(tenantId, limit = 50, filters = {}) {
    const whereClauses = ['tenant_id = $1'];
    const values = [tenantId];
    let paramIndex = 2;

    if (filters.status) {
      whereClauses.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }
    if (filters.agentId) {
      whereClauses.push(`agent_id = $${paramIndex}`);
      values.push(filters.agentId);
      paramIndex++;
    }
    if (filters.startDate) {
      whereClauses.push(`started_at >= $${paramIndex}`);
      values.push(filters.startDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        id,
        voice_id,
        agent_id,
        from_number,
        to_number,
        status,
        recording_url,
        started_at,
        ended_at,
        lead_id,
        initiated_by
      FROM voice_calls
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY started_at DESC
      LIMIT $${paramIndex}
    `;

    values.push(limit);
    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Get call statistics for tenant
   * 
   * @param {string} tenantId - Tenant ID
   * @param {Object} dateRange - Date range filter
   * @returns {Promise<Object>} Statistics
   */
  async getCallStats(tenantId, dateRange = {}) {
    const whereClauses = ['tenant_id = $1'];
    const values = [tenantId];
    let paramIndex = 2;

    if (dateRange.startDate) {
      whereClauses.push(`started_at >= $${paramIndex}`);
      values.push(dateRange.startDate);
      paramIndex++;
    }
    if (dateRange.endDate) {
      whereClauses.push(`started_at <= $${paramIndex}`);
      values.push(dateRange.endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'ended' THEN 1 END) as completed_calls,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
        COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined_calls,
        COUNT(DISTINCT lead_id) as unique_leads,
        COUNT(DISTINCT agent_id) as agents_used
      FROM voice_calls
      WHERE ${whereClauses.join(' AND ')}
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
}

module.exports = VoiceCallModel;
