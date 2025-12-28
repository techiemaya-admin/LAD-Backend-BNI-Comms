/**
 * Phone Number Model
 * 1.0
 * Business entity for phone numbers used in voice calls
 * Uses tenant_id for multi-tenancy isolation
 * 
 * Table: phone_numbers (NOT voice_agent_numbers or numbers_voiceagent)
 * Schema: Multi-tenant with tenant_id on every row
 */

class PhoneNumberModel {
  constructor(db) {
    // Prefer injected db pool; fall back to shared db module
    this.db = db;
  }

  /**
   * Get all phone numbers for a tenant
   * 
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Phone numbers
   */
  async getAllPhoneNumbers(schema, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        country_code,
        base_number,
        provider,
        status,
        rules,
        default_agent_id,
        created_at,
        updated_at,
        CONCAT('+', country_code, base_number) as phone_number
      FROM ${schema}.voice_agent_numbers
      WHERE tenant_id = $1 ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Get phone number by ID (tenant-isolated)
   * 
   * @param {string} numberId - Phone number ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Phone number or null
   */
  async getPhoneNumberById(schema, numberId, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        phone_number,
        provider,
        number_type,
        capabilities,
        is_active,
        metadata,
        created_at,
        updated_at
      FROM ${schema}.voice_agent_numbers
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.db.query(query, [numberId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Get phone number by actual number (tenant-isolated)
   * 
   * @param {string} phoneNumber - Phone number string
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Phone number record or null
   */
  async getByPhoneNumber(schema, { countryCode, baseNumber }, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        country_code,
        base_number,
        provider,
        status,
        rules,
        default_agent_id,
        created_at,
        updated_at,
        CONCAT('+', country_code, base_number) as phone_number
      FROM ${schema}.voice_agent_numbers
      WHERE country_code = $1 AND base_number = $2 AND tenant_id = $3
    `;

    const result = await this.db.query(query, [countryCode, baseNumber, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Get available numbers for a user
   * 
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Available phone numbers
   */
  async getAvailableNumbersForUser(schema, userId, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        country_code,
        base_number,
        provider,
        status,
        rules,
        default_agent_id,
        created_at,
        updated_at,
        CONCAT('+', country_code, base_number) as phone_number,
        status as type,
        default_agent_id as assignedAgentId
      FROM ${schema}.voice_agent_numbers
      WHERE tenant_id = $1 
        AND status = 'active'
      ORDER BY created_at DESC
    `;

    // Note: If you have user-specific number permissions, add a JOIN to user_number_permissions table
    // For now, all active numbers are available to all users in the tenant

    const result = await this.db.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Create a new phone number (tenant-isolated)
   * 
   * @param {Object} params - Phone number parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.phoneNumber - Phone number
   * @param {string} params.provider - Provider (e.g., 'twilio', 'vapi', 'vonage')
   * @param {string} params.numberType - Type (e.g., 'local', 'toll-free', 'mobile')
   * @param {Array} params.capabilities - Capabilities (e.g., ['voice', 'sms'])
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Created phone number
   */
  async createPhoneNumber({
    schema,
    tenantId,
    phoneNumber,
    provider = 'custom',
    status = 'active',
    rules = {},
    defaultAgentId = null
  }) {
    const query = `
      INSERT INTO ${schema}.voice_agent_numbers (
        tenant_id,
        country_code,
        base_number,
        provider,
        status,
        rules,
        default_agent_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING 
        id,
        tenant_id,
        country_code,
        base_number,
        provider,
        status,
        rules,
        default_agent_id,
        created_at,
        CONCAT('+', country_code, base_number) as phone_number
    `;

    const values = [
      tenantId,
      phoneNumber.countryCode,
      phoneNumber.baseNumber,
      provider,
      status,
      JSON.stringify(rules),
      defaultAgentId
    ];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update phone number (tenant-isolated)
   * 
   * @param {string} numberId - Phone number ID
   * @param {string} tenantId - Tenant ID for isolation
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated phone number
   */
  async updatePhoneNumber(schema, numberId, tenantId, updates) {
    const setClauses = ['updated_at = NOW()'];
    const values = [numberId, tenantId];
    let paramIndex = 3;

    if (updates.phoneNumber !== undefined && updates.phoneNumber.countryCode && updates.phoneNumber.baseNumber) {
      setClauses.push(`country_code = $${paramIndex}`);
      values.push(updates.phoneNumber.countryCode);
      paramIndex++;
      setClauses.push(`base_number = $${paramIndex}`);
      values.push(updates.phoneNumber.baseNumber);
      paramIndex++;
    }
    if (updates.provider !== undefined) {
      setClauses.push(`provider = $${paramIndex}`);
      values.push(updates.provider);
      paramIndex++;
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }
    if (updates.rules !== undefined) {
      setClauses.push(`rules = $${paramIndex}`);
      values.push(JSON.stringify(updates.rules));
      paramIndex++;
    }
    if (updates.defaultAgentId !== undefined) {
      setClauses.push(`default_agent_id = $${paramIndex}`);
      values.push(updates.defaultAgentId);
      paramIndex++;
    }

    const query = `
      UPDATE ${schema}.voice_agent_numbers
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING 
        id,
        tenant_id,
        country_code,
        base_number,
        provider,
        status,
        rules,
        default_agent_id,
        updated_at,
        CONCAT('+', country_code, base_number) as phone_number
    `;

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete phone number (soft delete - sets is_active = false)
   * 
   * @param {string} numberId - Phone number ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<boolean>} Success
   */
  async deletePhoneNumber(schema, numberId, tenantId) {
    const query = `
      UPDATE ${schema}.voice_agent_numbers
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.db.query(query, [numberId, tenantId]);
    return result.rowCount > 0;
  }

  /**
   * Get phone numbers by capability (tenant-isolated)
   * 
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} capability - Capability to filter by (e.g., 'voice', 'sms')
   * @returns {Promise<Array>} Matching phone numbers
   */
  async getPhoneNumbersByCapability(schema, tenantId, capability) {
    const query = `
      SELECT 
        id,
        country_code,
        base_number,
        provider,
        status,
        rules,
        CONCAT('+', country_code, base_number) as phone_number
      FROM ${schema}.voice_agent_numbers
      WHERE tenant_id = $1 
        AND status = 'active'
        AND (rules ? $2 OR rules = '{}'::jsonb)
      ORDER BY country_code, base_number ASC
    `;

    const result = await this.db.query(query, [tenantId, capability]);
    return result.rows;
  }

  /**
   * Get default outbound number for tenant
   * 
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Default phone number or null
   */
  async getDefaultOutboundNumber(schema, tenantId) {
    const query = `
      SELECT 
        id,
        country_code,
        base_number,
        provider,
        status,
        rules,
        CONCAT('+', country_code, base_number) as phone_number
      FROM ${schema}.voice_agent_numbers
      WHERE tenant_id = $1 
        AND status = 'active'
        AND (rules ? 'voice' OR rules = '{}'::jsonb)
      ORDER BY created_at ASC
      LIMIT 1
    `;

    const result = await this.db.query(query, [tenantId]);
    return result.rows[0] || null;
  }
}

module.exports = PhoneNumberModel;
