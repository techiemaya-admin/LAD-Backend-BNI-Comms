/**
 * Voice Agent Model
 * 1.0
 * Business entity for voice agents (AI voice assistants)
 * Uses tenant_id for multi-tenancy isolation
 * 
 * Table: voice_agents (NOT voice_agent_agents or agents_voiceagent)
 * Schema: Multi-tenant with tenant_id on every row
 */

class VoiceAgentModel {
  constructor(db) {
    // Use injected pool when provided (from controllers), fallback to shared db module
    this.db = db;
  }

  /**
   * Get all agents for a tenant
   * 
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Voice agents
   */
  async getAllAgents(schema, tenantId) {
    const query = `
      SELECT
        vac.*,
        vav.*
      FROM ${schema}.voice_agent_config_view vac
      JOIN ${schema}.voice_agent_voices vav
        ON vav.id = vac.voice_id
      WHERE vac.tenant_id = $1
    `;

    const result = await this.db.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Get agent by ID (tenant-isolated)
   * 
   * @param {string} agentId - Agent ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Voice agent or null
   */
  async getAgentById(schema, agentId, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        name,
        language,
        voice_id,
        created_at,
        updated_at
      FROM ${schema}.voice_agents
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.db.query(query, [agentId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Get agent by name (tenant-isolated)
   * 
   * @param {string} agentName - Agent name
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Voice agent or null
   */
  async getAgentByName(schema, agentName, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        name,
        language,
        voice_id,
        created_at,
        updated_at
      FROM ${schema}.voice_agents
      WHERE name = $1 AND tenant_id = $2
    `;

    const result = await this.db.query(query, [agentName, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Get voice ID for an agent (tenant-isolated)
   * 
   * @param {string} agentId - Agent ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<string|null>} Voice ID or null
   */
  async getVoiceIdByAgentId(schema, agentId, tenantId) {
    const query = `
      SELECT voice_id
      FROM ${schema}.voice_agents
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.db.query(query, [agentId, tenantId]);
    return result.rows[0]?.voice_id || null;
  }

  /**
   * Get available agents for a user
   * Uses view or joins with user permissions
   * 
   * @param {string} schema - Database schema name
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Available agents with voice details
   */
  async getAvailableAgentsForUser(schema, userId, tenantId) {
    const query = `
      SELECT
        vac.agent_id,
        vac.agent_name,
        vac.agent_language,
        vac.voice_id,
        vav.description,
        vav.voice_sample_url,
        vav.gender,
        vav.accent,
        vav.provider
      FROM ${schema}.voice_agent_config_view vac
      JOIN ${schema}.voice_agent_voices vav
        ON vav.id = vac.voice_id
      WHERE vac.tenant_id = $1
      ORDER BY vac.agent_name ASC
    `;

    // Note: If you have user-specific permissions, add a JOIN to user_agent_permissions table
    // For now, all active agents are available to all users in the tenant

    const result = await this.db.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Create a new agent (tenant-isolated)
   * 
   * @param {Object} params - Agent parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.agentName - Agent name
   * @param {string} params.agentLanguage - Language code (e.g., 'en', 'es')
   * @param {string} params.voiceId - Voice profile ID
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Created agent
   */
  async createAgent({
    schema,
    tenantId,
    agentName,
    agentLanguage = 'en',
    voiceId,
    metadata = {},
  }) {
    const query = `
      INSERT INTO ${schema}.voice_agents (
        tenant_id,
        name,
        language,
        voice_id,
        gender,
        agent_instructions,
        system_instructions,
        outbound_starter_prompt,
        inbound_starter_prompt,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, NULL, NULL, NULL, NULL, NULL, NOW(), NOW())
      RETURNING 
        id,
        tenant_id,
        name,
        language,
        voice_id,
        created_at
    `;

    const values = [
      tenantId,
      agentName,
      agentLanguage,
      voiceId
    ];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update agent (tenant-isolated)
   * 
   * @param {string} agentId - Agent ID
   * @param {string} tenantId - Tenant ID for isolation
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated agent
   */
  async updateAgent(schema, agentId, tenantId, updates) {
    const setClauses = ['updated_at = NOW()'];
    const values = [agentId, tenantId];
    let paramIndex = 3;

    if (updates.agentName !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      values.push(updates.agentName);
      paramIndex++;
    }
    if (updates.agentLanguage !== undefined) {
      setClauses.push(`language = $${paramIndex}`);
      values.push(updates.agentLanguage);
      paramIndex++;
    }
    if (updates.voiceId !== undefined) {
      setClauses.push(`voice_id = $${paramIndex}`);
      values.push(updates.voiceId);
      paramIndex++;
    }
    const query = `
      UPDATE ${schema}.voice_agents
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING 
        id,
        tenant_id,
        name,
        language,
        voice_id,
        updated_at
    `;

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete agent (soft delete - sets is_active = false)
   * 
   * @param {string} agentId - Agent ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<boolean>} Success
   */
  async deleteAgent(schema, agentId, tenantId) {
    const query = `
      DELETE FROM ${schema}.voice_agents
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.db.query(query, [agentId, tenantId]);
    return result.rowCount > 0;
  }
}

module.exports = VoiceAgentModel;
