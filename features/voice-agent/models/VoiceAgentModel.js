/**
 * Voice Agent Model
 * 
 * Business entity for voice agents (AI voice assistants)
 * Uses tenant_id for multi-tenancy isolation
 * 
 * Table: voice_agents (NOT voice_agent_agents or agents_voiceagent)
 * Schema: Multi-tenant with tenant_id on every row
 */

class VoiceAgentModel {
  constructor(db) {
    this.pool = db;
  }

  /**
   * Get all agents for a tenant
   * 
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Voice agents
   */
  async getAllAgents(tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        agent_name,
        agent_language,
        voice_id,
        is_active,
        created_at,
        updated_at
      FROM voice_agents
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY agent_name ASC
    `;

    const result = await this.pool.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Get agent by ID (tenant-isolated)
   * 
   * @param {string} agentId - Agent ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Voice agent or null
   */
  async getAgentById(agentId, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        agent_name,
        agent_language,
        voice_id,
        is_active,
        metadata,
        created_at,
        updated_at
      FROM voice_agents
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [agentId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Get agent by name (tenant-isolated)
   * 
   * @param {string} agentName - Agent name
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Voice agent or null
   */
  async getAgentByName(agentName, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        agent_name,
        agent_language,
        voice_id,
        is_active,
        metadata,
        created_at,
        updated_at
      FROM voice_agents
      WHERE agent_name = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [agentName, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Get voice ID for an agent (tenant-isolated)
   * 
   * @param {string} agentId - Agent ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<string|null>} Voice ID or null
   */
  async getVoiceIdByAgentId(agentId, tenantId) {
    const query = `
      SELECT voice_id
      FROM voice_agents
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [agentId, tenantId]);
    return result.rows[0]?.voice_id || null;
  }

  /**
   * Get available agents for a user
   * Uses view or joins with user permissions
   * 
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Available agents with voice details
   */
  async getAvailableAgentsForUser(userId, tenantId) {
    const query = `
      SELECT 
        va.id as agent_id,
        va.agent_name,
        va.agent_language,
        va.voice_id,
        v.description as voice_description,
        v.voice_sample_url
      FROM voice_agents va
      LEFT JOIN voices v ON va.voice_id = v.id AND v.tenant_id = va.tenant_id
      WHERE va.tenant_id = $1 
        AND va.is_active = true
      ORDER BY va.agent_name ASC
    `;

    // Note: If you have user-specific permissions, add a JOIN to user_agent_permissions table
    // For now, all active agents are available to all users in the tenant

    const result = await this.pool.query(query, [tenantId]);
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
    tenantId,
    agentName,
    agentLanguage = 'en',
    voiceId,
    metadata = {}
  }) {
    const query = `
      INSERT INTO voice_agents (
        tenant_id,
        agent_name,
        agent_language,
        voice_id,
        is_active,
        metadata,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, true, $5, NOW(), NOW())
      RETURNING 
        id,
        tenant_id,
        agent_name,
        agent_language,
        voice_id,
        is_active,
        created_at
    `;

    const values = [
      tenantId,
      agentName,
      agentLanguage,
      voiceId,
      JSON.stringify(metadata)
    ];

    const result = await this.pool.query(query, values);
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
  async updateAgent(agentId, tenantId, updates) {
    const setClauses = ['updated_at = NOW()'];
    const values = [agentId, tenantId];
    let paramIndex = 3;

    if (updates.agentName !== undefined) {
      setClauses.push(`agent_name = $${paramIndex}`);
      values.push(updates.agentName);
      paramIndex++;
    }
    if (updates.agentLanguage !== undefined) {
      setClauses.push(`agent_language = $${paramIndex}`);
      values.push(updates.agentLanguage);
      paramIndex++;
    }
    if (updates.voiceId !== undefined) {
      setClauses.push(`voice_id = $${paramIndex}`);
      values.push(updates.voiceId);
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
      UPDATE voice_agents
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING 
        id,
        tenant_id,
        agent_name,
        agent_language,
        voice_id,
        is_active,
        metadata,
        updated_at
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete agent (soft delete - sets is_active = false)
   * 
   * @param {string} agentId - Agent ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<boolean>} Success
   */
  async deleteAgent(agentId, tenantId) {
    const query = `
      UPDATE voice_agents
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [agentId, tenantId]);
    return result.rowCount > 0;
  }
}

module.exports = VoiceAgentModel;
