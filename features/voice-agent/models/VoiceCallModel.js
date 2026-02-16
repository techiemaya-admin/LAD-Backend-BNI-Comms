/**
 * Voice Call Model
 * 1.0
 * Business entity for voice calls (not feature-prefixed)
 * Uses tenant_id for multi-tenancy isolation
 * 
 * Table: voice_call_logs (NOT voice_agent_calls or call_logs_voiceagent)
 * Schema: Multi-tenant with tenant_id on every row
 */

const logger = require('../../../core/utils/logger');

class VoiceCallModel {
  constructor(db) {
    this.pool = db;
  }

  /**
   * Create a call log entry
   * 
   * @param {Object} params - Call parameters
   * @param {string} params.tenantId - Tenant ID for isolation
   * @param {number} params.agentId - Agent ID
   * @param {string} params.fromNumberId - From number ID (UUID)
   * @param {string} params.toCountryCode - Country code (e.g., '+1')
   * @param {string} params.toBaseNumber - Base phone number
   * @param {string} params.status - Call status (calling, ongoing, ended, declined, failed)
   * @param {string} params.leadId - Associated lead ID (from main leads table)
   * @param {string} params.initiatedByUserId - User ID who initiated the call
   * @param {string} params.recordingUrl - Recording URL
   * @param {string} params.direction - Call direction (inbound/outbound)
   * @returns {Promise<Object>} Created call log
   */
  async createCallLog({
    schema,
    tenantId,
    agentId,
    fromNumberId = null,
    toCountryCode,
    toBaseNumber,
    status = 'calling',
    leadId = null,
    initiatedByUserId = null,
    recordingUrl = null,
    direction = 'outbound',
    metadata = null
  }) {
    const query = `
      INSERT INTO ${schema}.voice_call_logs (
        tenant_id,
        agent_id,
        from_number_id,
        to_country_code,
        to_base_number,
        status,
        lead_id,
        initiated_by_user_id,
        recording_url,
        direction,
        metadata,
        started_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())
      RETURNING 
        id,
        tenant_id,
        agent_id,
        from_number_id,
        to_country_code,
        to_base_number,
        status,
        started_at,
        lead_id,
        metadata
    `;

    const values = [
      tenantId,
      agentId,
      fromNumberId,
      toCountryCode,
      toBaseNumber,
      status,
      leadId,
      initiatedByUserId,
      recordingUrl,
      direction,
      metadata ? JSON.stringify(metadata) : null
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get call log by ID (tenant-isolated)
   * 
   * @param {string} schema - Schema name
   * @param {string} callId - Call log ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Call log or null
   */
  async getCallById(schema, callId, tenantId) {
    // First, get transcripts separately to avoid truncation in large row
    const transcriptsQuery = `
      SELECT transcripts
      FROM ${schema}.voice_call_logs
      WHERE id = $1 AND tenant_id = $2
    `;
    
    const transcriptsResult = await this.pool.query(transcriptsQuery, [callId, tenantId]);
    const transcripts = transcriptsResult.rows[0]?.transcripts;
    
    logger.debug('[VoiceCallModel] Transcripts query returned segments', { 
      callId, 
      segmentCount: transcripts?.segments?.length || 0 
    });
    
    // Then get the rest of the data
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
        vcl.created_at,
        vcl.updated_at,
        vcl.direction,
        vcl.metadata,
        l.first_name AS lead_first_name,
        l.last_name AS lead_last_name,
        vca.analysis
      FROM ${schema}.voice_call_logs vcl
      LEFT JOIN ${schema}.leads l ON l.id = vcl.lead_id
      LEFT JOIN ${schema}.voice_agents va ON va.id = vcl.agent_id AND va.tenant_id = vcl.tenant_id
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'id', vca_row.id,
          'call_log_id', vca_row.call_log_id,
          'summary', COALESCE(NULLIF(vca_row.summary, ''), vca_row.raw_analysis->'sentiment_full'->>'sentiment_description', vca_row.sentiment),
          'sentiment', vca_row.sentiment,
          'disposition', COALESCE(vca_row.raw_analysis->'disposition_full'->>'disposition', ''),
          'recommendations', COALESCE(vca_row.recommendations, vca_row.recommended_action, vca_row.raw_analysis->'disposition_full'->>'recommended_action', ''),
          'key_points', vca_row.key_points,
          'lead_extraction', vca_row.lead_extraction,
          'prospect_questions', vca_row.prospect_questions,
          'prospect_concerns', vca_row.prospect_concerns,
          'key_phrases', vca_row.key_phrases,
          'raw_analysis', vca_row.raw_analysis,
          'analysis_cost', vca_row.analysis_cost,
          'created_at', vca_row.created_at
        ) AS analysis
        FROM ${schema}.voice_call_analysis vca_row
        WHERE vca_row.call_log_id = vcl.id
        ORDER BY vca_row.created_at DESC NULLS LAST
        LIMIT 1
      ) vca ON TRUE
      WHERE vcl.id = $1 AND vcl.tenant_id = $2
    `;

    const result = await this.pool.query(query, [callId, tenantId]);
    const row = result.rows[0];
    
    if (!row) return null;
    
    // Add transcripts from separate query
    row.transcripts = transcripts;
    
    return row;
  }

  /**
   * Get call recording URL by ID (tenant-isolated)
   * 
   * @param {string} schema - Schema name
   * @param {string} callId - Call log ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<string|null>} Recording URL or null
   */
  async getRecordingUrl(schema, callId, tenantId) {
    const query = `
      SELECT recording_url
      FROM ${schema}.voice_call_logs
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [callId, tenantId]);
    return result.rows[0]?.recording_url || null;
  }

  /**
   * Update call status
   * 
   * @param {string} schema - Schema name
   * @param {string} callId - Call log ID
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} status - New status
   * @param {Object} updates - Optional additional updates
   * @returns {Promise<Object>} Updated call log
   */
  async updateCallStatus(schema, callId, tenantId, status, updates = {}) {
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
      UPDATE ${schema}.voice_call_logs
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
  async getCallsForLead(schema, leadId, tenantId, limit = 10) {
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
      FROM ${schema}.voice_call_logs
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
    return this.getCallLogs(tenantId, filters, limit);
  }

  async getCallLogs(schema, tenantId, filters = {}, limit = 50, offset = 0) {
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
    if (filters.fromDate) {
      whereClauses.push(`started_at >= $${paramIndex}`);
      values.push(filters.fromDate);
      paramIndex++;
    }
    if (filters.toDate) {
      whereClauses.push(`started_at <= $${paramIndex}`);
      values.push(filters.toDate);
      paramIndex++;
    }
    if (filters.userId) {
      whereClauses.push(`initiated_by_user_id = $${paramIndex}`);
      values.push(filters.userId);
      paramIndex++;
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
        vca.analysis,
        vcbe.batch_id
      FROM ${schema}.voice_call_logs vcl
      LEFT JOIN ${schema}.leads l ON l.id = vcl.lead_id
      LEFT JOIN ${schema}.voice_agents va ON va.id = vcl.agent_id AND va.tenant_id = vcl.tenant_id
      LEFT JOIN ${schema}.voice_call_batch_entries vcbe ON vcbe.call_log_id = vcl.id AND vcbe.is_deleted = false
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'id', vca_row.id,
          'call_log_id', vca_row.call_log_id,
          'summary', COALESCE(NULLIF(vca_row.summary, ''), vca_row.raw_analysis->'sentiment_full'->>'sentiment_description', vca_row.sentiment),
          'sentiment', vca_row.sentiment,
          'disposition', COALESCE(vca_row.raw_analysis->'disposition_full'->>'disposition', ''),
          'recommendations', COALESCE(vca_row.recommendations, vca_row.recommended_action, vca_row.raw_analysis->'disposition_full'->>'recommended_action', ''),
          'key_points', vca_row.key_points,
          'lead_extraction', vca_row.lead_extraction,
          'prospect_questions', vca_row.prospect_questions,
          'prospect_concerns', vca_row.prospect_concerns,
          'key_phrases', vca_row.key_phrases,
          'raw_analysis', vca_row.raw_analysis,
          'analysis_cost', vca_row.analysis_cost,
          'created_at', vca_row.created_at
        ) AS analysis
        FROM ${schema}.voice_call_analysis vca_row
        WHERE vca_row.call_log_id = vcl.id
        ORDER BY vca_row.created_at DESC NULLS LAST
        LIMIT 1
      ) vca ON TRUE
      WHERE ${whereClauses.map(c => `vcl.${c}`).join(' AND ')}
      ORDER BY vcl.started_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);
    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Get total count of call logs for pagination
   * 
   * @param {string} schema - Schema name
   * @param {string} tenantId - Tenant ID
   * @param {Object} filters - Filters (same as getCallLogs)
   * @returns {Promise<number>} Total count
   */
  async getCallLogsCount(schema, tenantId, filters = {}) {
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
    if (filters.fromDate) {
      whereClauses.push(`started_at >= $${paramIndex}`);
      values.push(filters.fromDate);
      paramIndex++;
    }
    if (filters.toDate) {
      whereClauses.push(`started_at <= $${paramIndex}`);
      values.push(filters.toDate);
      paramIndex++;
    }
    if (filters.userId) {
      whereClauses.push(`initiated_by_user_id = $${paramIndex}`);
      values.push(filters.userId);
      paramIndex++;
    }

    const query = `
      SELECT COUNT(*) as total
      FROM ${schema}.voice_call_logs vcl
      WHERE ${whereClauses.map(c => `vcl.${c}`).join(' AND ')}
    `;

    const result = await this.pool.query(query, values);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Get call statistics for tenant
   * 
   * @param {string} tenantId - Tenant ID
   * @param {Object} dateRange - Date range filter
   * @returns {Promise<Object>} Statistics
   */
  async getCallStats(schema, tenantId, dateRange = {}) {
    const whereClauses = ['vcl.tenant_id = $1'];
    const values = [tenantId];
    let paramIndex = 2;

    if (dateRange.startDate) {
      whereClauses.push(`vcl.started_at >= $${paramIndex}`);
      values.push(dateRange.startDate);
      paramIndex++;
    }
    if (dateRange.endDate) {
      whereClauses.push(`vcl.started_at <= $${paramIndex}`);
      values.push(dateRange.endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN LOWER(vcl.status) IN ('ended', 'completed') THEN 1 END) as completed_calls,
        COUNT(CASE WHEN LOWER(vcl.status) = 'failed' THEN 1 END) as failed_calls,
        COUNT(CASE WHEN LOWER(vcl.status) IN ('ongoing', 'in_progress', 'calling') THEN 1 END) as ongoing,
        COUNT(CASE WHEN LOWER(vcl.status) IN ('queue', 'queued', 'pending') THEN 1 END) as queue,
        COUNT(CASE 
          WHEN LOWER(vca.raw_analysis->'lead_score_full'->>'lead_category') LIKE '%hot%' 
          THEN 1 
        END) as hot_leads,
        COUNT(CASE 
          WHEN LOWER(vca.raw_analysis->'lead_score_full'->>'lead_category') LIKE '%warm%' 
          THEN 1 
        END) as warm_leads,
        COUNT(CASE 
          WHEN LOWER(vca.raw_analysis->'lead_score_full'->>'lead_category') LIKE '%cold%' 
          THEN 1 
        END) as cold_leads
      FROM ${schema}.voice_call_logs vcl
      LEFT JOIN ${schema}.voice_call_analysis vca ON vca.call_log_id = vcl.id
      WHERE ${whereClauses.join(' AND ')}
    `;

    const result = await this.pool.query(query, values);
    const stats = result.rows[0];
    
    // Convert string numbers to integers
    return {
      total_calls: parseInt(stats.total_calls, 10) || 0,
      completed_calls: parseInt(stats.completed_calls, 10) || 0,
      failed_calls: parseInt(stats.failed_calls, 10) || 0,
      ongoing: parseInt(stats.ongoing, 10) || 0,
      queue: parseInt(stats.queue, 10) || 0,
      hot_leads: parseInt(stats.hot_leads, 10) || 0,
      warm_leads: parseInt(stats.warm_leads, 10) || 0,
      cold_leads: parseInt(stats.cold_leads, 10) || 0
    };
  }

  /**
   * Get completed/ended calls for credit reconciliation
   * Tenant-isolated query
   * 
   * @param {string} schema - Schema name
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Array of call logs with id, duration_seconds, credits_charged, metadata, lead_id
   */
  async getCompletedCallsForTenant(schema, tenantId) {
    const query = `
      SELECT 
        id,
        duration_seconds,
        credits_charged,
        metadata,
        lead_id,
        status,
        started_at,
        ended_at
      FROM ${schema}.voice_call_logs
      WHERE tenant_id = $1 
        AND LOWER(status) IN ('ended', 'completed')
        AND duration_seconds IS NOT NULL
        AND duration_seconds > 0
      ORDER BY ended_at DESC
    `;

    const result = await this.pool.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Update credits charged for a specific call
   * Tenant-isolated update
   * 
   * @param {string} schema - Schema name
   * @param {string} callId - Call log ID
   * @param {string} tenantId - Tenant ID for isolation
   * @param {number} newCredits - New credits amount
   * @param {Object} metadataUpdate - Optional metadata updates
   * @returns {Promise<Object>} Updated call log
   */
  async updateCallCredits(schema, callId, tenantId, newCredits, metadataUpdate = null) {
    let query;
    let values;

    if (metadataUpdate) {
      query = `
        UPDATE ${schema}.voice_call_logs
        SET 
          credits_charged = $1,
          metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
          updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4
        RETURNING id, duration_seconds, credits_charged, metadata
      `;
      values = [newCredits, JSON.stringify(metadataUpdate), callId, tenantId];
    } else {
      query = `
        UPDATE ${schema}.voice_call_logs
        SET 
          credits_charged = $1,
          updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3
        RETURNING id, duration_seconds, credits_charged, metadata
      `;
      values = [newCredits, callId, tenantId];
    }

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
}

module.exports = VoiceCallModel;
