/**
 * Voice Model
 * 1.0
 * Business entity for voice profiles (voice samples for TTS)
 * Uses tenant_id for multi-tenancy isolation
 * 
 * Table: voices (NOT voice_agent_voices or voices_voiceagent)
 * Schema: Multi-tenant with tenant_id on every row
 */

class VoiceModel {
  constructor(db) {
    // Prefer injected db pool; fall back to shared db module
    this.db = db;
  }

  /**
   * Get all voices for a tenant
   * 
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Voice profiles
   */
  async getAllVoices(schema, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        voice_name,
        description,
        voice_sample_url,
        provider,
        language,
        gender,
        is_active,
        created_at,
        updated_at
      FROM ${schema}.voices
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY voice_name ASC
    `;

    const result = await this.db.query(query, [tenantId]);
    return result.rows;
  }


  
  /**
   * Get voice by ID (tenant-isolated)
   * 
   * @param {string} voiceId - Voice ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Voice profile or null
   */
  async getVoiceById(schema, voiceId, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        voice_name,
        description,
        voice_sample_url,
        provider,
        language,
        gender,
        is_active,
        metadata,
        created_at,
        updated_at
      FROM ${schema}.voices
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.db.query(query, [voiceId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Get voice sample URL (tenant-isolated)
   * 
   * @param {string} voiceId - Voice ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<string|null>} Voice sample URL (gs:// format) or null
   */
  async getVoiceSampleUrl(schema, voiceId, tenantId) {
    const query = `
      SELECT voice_sample_url
      FROM ${schema}.voices
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.db.query(query, [voiceId, tenantId]);
    return result.rows[0]?.voice_sample_url || null;
  }

  /**
   * Create a new voice profile (tenant-isolated)
   * 
   * @param {Object} params - Voice parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.voiceName - Voice name
   * @param {string} params.description - Voice description
   * @param {string} params.voiceSampleUrl - GCS URL for sample
   * @param {string} params.provider - Provider (e.g., 'elevenlabs', 'google', 'azure')
   * @param {string} params.language - Language code
   * @param {string} params.gender - Gender ('male', 'female', 'neutral')
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Created voice profile
   */
  async createVoice({
    schema,
    tenantId,
    voiceName,
    description,
    voiceSampleUrl,
    provider = 'custom',
    language = 'en',
    gender = 'neutral',
    metadata = {},
  }) {
    const query = `
      INSERT INTO ${schema}.voices (
        tenant_id,
        voice_name,
        description,
        voice_sample_url,
        provider,
        language,
        gender,
        is_active,
        metadata,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, NOW(), NOW())
      RETURNING 
        id,
        tenant_id,
        voice_name,
        description,
        voice_sample_url,
        provider,
        language,
        gender,
        created_at
    `;

    const values = [
      tenantId,
      voiceName,
      description,
      voiceSampleUrl,
      provider,
      language,
      gender,
      JSON.stringify(metadata)
    ];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update voice profile (tenant-isolated)
   * 
   * @param {string} voiceId - Voice ID
   * @param {string} tenantId - Tenant ID for isolation
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated voice profile
   */
  async updateVoice(schema, voiceId, tenantId, updates) {
    const setClauses = ['updated_at = NOW()'];
    const values = [voiceId, tenantId];
    let paramIndex = 3;

    if (updates.voiceName !== undefined) {
      setClauses.push(`voice_name = $${paramIndex}`);
      values.push(updates.voiceName);
      paramIndex++;
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      values.push(updates.description);
      paramIndex++;
    }
    if (updates.voiceSampleUrl !== undefined) {
      setClauses.push(`voice_sample_url = $${paramIndex}`);
      values.push(updates.voiceSampleUrl);
      paramIndex++;
    }
    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex}`);
      values.push(updates.isActive);
      paramIndex++;
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(updates.metadata));
      paramIndex++;
    }

    const query = `
      UPDATE ${schema}.voices
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING 
        id,
        tenant_id,
        voice_name,
        description,
        voice_sample_url,
        provider,
        language,
        gender,
        is_active,
        updated_at
    `;

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete voice (soft delete - sets is_active = false)
   * 
   * @param {string} voiceId - Voice ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<boolean>} Success
   */
  async deleteVoice(schema, voiceId, tenantId) {
    const query = `
      UPDATE ${schema}.voices
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [voiceId, tenantId]);
    return result.rowCount > 0;
  }

  /**
   * Search voices by criteria (tenant-isolated)
   * 
   * @param {string} tenantId - Tenant ID for isolation
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Matching voices
   */
  async searchVoices(schema, tenantId, criteria = {}) {
    const whereClauses = ['tenant_id = $1', 'is_active = true'];
    const values = [tenantId];
    let paramIndex = 2;

    if (criteria.language) {
      whereClauses.push(`language = $${paramIndex}`);
      values.push(criteria.language);
      paramIndex++;
    }
    if (criteria.gender) {
      whereClauses.push(`gender = $${paramIndex}`);
      values.push(criteria.gender);
      paramIndex++;
    }
    if (criteria.provider) {
      whereClauses.push(`provider = $${paramIndex}`);
      values.push(criteria.provider);
      paramIndex++;
    }

    const query = `
      SELECT 
        id,
        tenant_id,
        voice_name,
        description,
        voice_sample_url,
        provider,
        language,
        gender,
        created_at
      FROM ${schema}.voice_agent_voices
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY voice_name ASC
    `;

    const result = await this.pool.query(query, values);
    return result.rows;
  }
}

module.exports = VoiceModel;
