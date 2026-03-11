const { getSchema, sanitizeSchema } = require('../../../core/utils/schemaHelper');
let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  logger = console;
}

class SettingsRepository {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Get schema for tenant
   */
  getTenantSchema(tenantId, req = null) {
    // Use the schemaHelper to get the correct schema
    // Pass the request object to get proper schema context
    return getSchema(req);
  }

  /**
   * Get all voice agents for a tenant (no pagination)
   */
  async getAllVoiceAgents(tenantId, req = null) {
    const schema = this.getTenantSchema(tenantId, req);
    const query = `
      SELECT 
        va.id,
        va.tenant_id,
        va.name,
        va.gender,
        va.language,
        va.agent_instructions,
        va.system_instructions,
        va.outbound_starter_prompt,
        va.inbound_starter_prompt,
        va.voice_id,
        va.created_at,
        va.updated_at,
        vav.description as voice_description,
        vav.gender as voice_gender,
        vav.accent,
        vav.provider,
        vav.voice_sample_url,
        vav.provider_voice_id,
        vav.provider_config
      FROM ${sanitizeSchema(schema)}.voice_agents va
      LEFT JOIN ${sanitizeSchema(schema)}.voice_agent_voices vav 
        ON vav.id = va.voice_id
      WHERE va.tenant_id = $1
      ORDER BY va.updated_at DESC
    `;

    logger.debug('Executing query:', query);
    logger.debug('With tenantId:', tenantId);
    logger.debug('Using schema:', schema);

    const result = await this.pool.query(query, [tenantId]);
    
    logger.debug('Query result rows count:', result.rows.length);
    logger.debug('Query result:', JSON.stringify(result.rows, null, 2));
    
    return result.rows;
  }

  /**
   * Get total count of voice agents for a tenant
   */
  async getVoiceAgentsCount(tenantId) {
    const schema = this.getTenantSchema(tenantId);
    const query = `
      SELECT COUNT(*) as total
      FROM ${sanitizeSchema(schema)}.voice_agents
      WHERE tenant_id = $1
    `;

    const result = await this.pool.query(query, [tenantId]);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Get voice agent by ID with voice details
   */
  async getVoiceAgentById(agentId, tenantId) {
    const schema = this.getTenantSchema(tenantId);
    const query = `
      SELECT 
        va.id,
        va.tenant_id,
        va.name,
        va.gender,
        va.language,
        va.agent_instructions,
        va.system_instructions,
        va.outbound_starter_prompt,
        va.inbound_starter_prompt,
        va.voice_id,
        va.created_at,
        va.updated_at,
        vav.description as voice_description,
        vav.gender as voice_gender,
        vav.accent,
        vav.provider,
        vav.voice_sample_url,
        vav.provider_voice_id,
        vav.provider_config
      FROM ${sanitizeSchema(schema)}.voice_agents va
      LEFT JOIN ${sanitizeSchema(schema)}.voice_agent_voices vav 
        ON vav.id = va.voice_id
      WHERE va.id = $1 AND va.tenant_id = $2
    `;

    const result = await this.pool.query(query, [agentId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Create a new voice agent
   */
  async createVoiceAgent(tenantId, agentData) {
    const schema = this.getTenantSchema(tenantId);
    const {
      name,
      gender,
      language,
      agent_instructions,
      system_instructions,
      outbound_starter_prompt,
      inbound_starter_prompt,
      voice_id
    } = agentData;

    const query = `
      INSERT INTO ${sanitizeSchema(schema)}.voice_agents (
        tenant_id,
        name,
        gender,
        language,
        agent_instructions,
        system_instructions,
        outbound_starter_prompt,
        inbound_starter_prompt,
        voice_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      tenantId,
      name,
      gender,
      language,
      agent_instructions,
      system_instructions,
      outbound_starter_prompt,
      inbound_starter_prompt,
      voice_id
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Update voice agent
   */
  async updateVoiceAgent(agentId, tenantId, agentData) {
    const schema = this.getTenantSchema(tenantId);
    const updateFields = [];
    const values = [agentId, tenantId];
    let paramIndex = 3;

    const allowedFields = [
      'name', 'gender', 'language', 'agent_instructions', 
      'system_instructions', 'outbound_starter_prompt', 
      'inbound_starter_prompt', 'voice_id'
    ];

    allowedFields.forEach(field => {
      if (agentData[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        values.push(agentData[field]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push(`updated_at = NOW()`);

    const query = `
      UPDATE ${sanitizeSchema(schema)}.voice_agents
      SET ${updateFields.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete voice agent
   */
  async deleteVoiceAgent(agentId, tenantId) {
    const schema = this.getTenantSchema(tenantId);
    const query = `
      DELETE FROM ${sanitizeSchema(schema)}.voice_agents
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [agentId, tenantId]);
    return result.rowCount > 0;
  }

  /**
   * Get all voice voices for a tenant
   */
  async getAllVoiceVoices(tenantId, limit = 50, offset = 0) {
    const schema = this.getTenantSchema(tenantId);
    const query = `
      SELECT *
      FROM ${sanitizeSchema(schema)}.voice_agent_voices
      WHERE tenant_id = $1
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(query, [tenantId, limit, offset]);
    return result.rows;
  }

  /**
   * Get total count of voice voices for a tenant
   */
  async getVoiceVoicesCount(tenantId) {
    const schema = this.getTenantSchema(tenantId);
    const query = `
      SELECT COUNT(*) as total
      FROM ${sanitizeSchema(schema)}.voice_agent_voices
      WHERE tenant_id = $1
    `;

    const result = await this.pool.query(query, [tenantId]);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Get voice by ID
   */
  async getVoiceById(voiceId, tenantId) {
    const schema = this.getTenantSchema(tenantId);
    const query = `
      SELECT *
      FROM ${sanitizeSchema(schema)}.voice_agent_voices
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [voiceId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Create a new voice
   */
  async createVoice(tenantId, voiceData) {
    const schema = this.getTenantSchema(tenantId);
    const {
      description,
      gender,
      accent,
      provider,
      voice_sample_url,
      provider_voice_id,
      provider_config
    } = voiceData;

    const query = `
      INSERT INTO ${sanitizeSchema(schema)}.voice_agent_voices (
        tenant_id,
        description,
        gender,
        accent,
        provider,
        voice_sample_url,
        provider_voice_id,
        provider_config,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      tenantId,
      description,
      gender,
      accent,
      provider,
      voice_sample_url,
      provider_voice_id,
      provider_config ? JSON.stringify(provider_config) : null
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Update voice
   */
  async updateVoice(voiceId, tenantId, voiceData) {
    const schema = this.getTenantSchema(tenantId);
    const updateFields = [];
    const values = [voiceId, tenantId];
    let paramIndex = 3;

    const allowedFields = [
      'description', 'gender', 'accent', 'provider', 
      'voice_sample_url', 'provider_voice_id', 'provider_config'
    ];

    allowedFields.forEach(field => {
      if (voiceData[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        values.push(field === 'provider_config' ? JSON.stringify(voiceData[field]) : voiceData[field]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push(`updated_at = NOW()`);

    const query = `
      UPDATE ${sanitizeSchema(schema)}.voice_agent_voices
      SET ${updateFields.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete voice
   */
  async deleteVoice(voiceId, tenantId) {
    const schema = this.getTenantSchema(tenantId);
    // Check if voice is being used by any agent
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM ${sanitizeSchema(schema)}.voice_agents
      WHERE voice_id = $1 AND tenant_id = $2
    `;

    const checkResult = await this.pool.query(checkQuery, [voiceId, tenantId]);
    
    if (parseInt(checkResult.rows[0].count, 10) > 0) {
      throw new Error('Cannot delete voice: it is being used by one or more agents');
    }

    const deleteQuery = `
      DELETE FROM ${sanitizeSchema(schema)}.voice_agent_voices
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(deleteQuery, [voiceId, tenantId]);
    return result.rowCount > 0;
  }

  /**
   * Get voices by provider
   */
  async getVoicesByProvider(provider, tenantId) {
    const schema = this.getTenantSchema(tenantId);
    const query = `
      SELECT *
      FROM ${sanitizeSchema(schema)}.voice_agent_voices
      WHERE provider = $1 AND tenant_id = $2
      ORDER BY description ASC
    `;

    const result = await this.pool.query(query, [provider, tenantId]);
    return result.rows;
  }

  /**
   * Get agents by voice ID
   */
  async getAgentsByVoiceId(voiceId, tenantId) {
    const schema = this.getTenantSchema(tenantId);
    const query = `
      SELECT 
        va.id,
        va.tenant_id,
        va.name,
        va.gender,
        va.language,
        va.agent_instructions,
        va.system_instructions,
        va.outbound_starter_prompt,
        va.inbound_starter_prompt,
        va.voice_id,
        va.created_at,
        va.updated_at
      FROM ${sanitizeSchema(schema)}.voice_agents va
      WHERE va.voice_id = $1 AND va.tenant_id = $2
      ORDER BY va.name ASC
    `;

    const result = await this.pool.query(query, [voiceId, tenantId]);
    return result.rows;
  }

  /**
   * Search voice agents by name or description
   */
  async searchVoiceAgents(searchTerm, tenantId, limit = 20) {
    const schema = this.getTenantSchema(tenantId);
    const query = `
      SELECT 
       * from ${sanitizeSchema(schema)}.voice_agents
       where tenant_id = $1 
    `;

    const result = await this.pool.query(query, [tenantId, `%${searchTerm}%`, limit]);
    return result.rows;
  }

  /**
   * Search voice voices by description, accent, or provider
   */
  async searchVoiceVoices(searchTerm, tenantId, limit = 20) {
    const schema = this.getTenantSchema(tenantId);
    const query = `
      SELECT *
      FROM ${sanitizeSchema(schema)}.voice_agent_voices
      WHERE tenant_id = $1 
        AND (
          description ILIKE $2 OR 
          accent ILIKE $2 OR 
          provider ILIKE $2
        )
      ORDER BY description ASC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [tenantId, `%${searchTerm}%`, limit]);
    return result.rows;
  }
}

module.exports = SettingsRepository;
