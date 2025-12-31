/**
 * Phone Number Model
 * 1.0
 * Business entity for phone numbers used in voice calls
 * Uses tenant_id for multi-tenancy isolation
 * 
 * Table: voice_agent_numbers
 * Schema: Multi-tenant with tenant_id on every row
 */

class PhoneNumberModel {
  constructor(db) {
    // Prefer injected db pool; fall back to shared db module
    this.db = db;
  }

  _getPhoneNumberSelectFragment() {
    // Derive fields expected by the frontend SDK from the actual table schema.
    // - number_type/capabilities/metadata are stored inside rules JSONB (if present)
    // - is_active is derived from status
    return {
      select: `
        id,
        tenant_id,
        country_code,
        base_number::text as base_number,
        provider,
        COALESCE(rules->>'number_type', rules->>'type') as number_type,
        rules->'capabilities' as capabilities,
        CASE WHEN status IS NULL OR status = 'active' THEN true ELSE false END as is_active,
        rules as metadata,
        default_agent_id,
        status,
        rules,
        created_at,
        updated_at
      `
    };
  }

  /**
   * Get all phone numbers for a tenant
   * 
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Phone numbers
   */
  async getAllPhoneNumbers(schema, tenantId) {
    const { select } = this._getPhoneNumberSelectFragment();
    const query = `
      SELECT ${select}
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
    const { select } = this._getPhoneNumberSelectFragment();
    const query = `
      SELECT ${select}
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
    const { select } = this._getPhoneNumberSelectFragment();
    const query = `
      SELECT ${select}
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
    const { select } = this._getPhoneNumberSelectFragment();
    const query = `
      SELECT ${select}
      FROM ${schema}.voice_agent_numbers
      WHERE tenant_id = $1 
        AND (status IS NULL OR status = 'active')
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
    numberType = 'local',
    capabilities = ['voice'],
    metadata = {}
  }) {
    const { select } = this._getPhoneNumberSelectFragment();

    const rules = {
      ...(metadata || {}),
      ...(numberType !== undefined ? { number_type: numberType } : {}),
      ...(capabilities !== undefined ? { capabilities } : {})
    };

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
      ) VALUES ($1, $2, $3, $4, 'active', $5, NULL, NOW(), NOW())
      RETURNING ${select}
    `;

    const values = [tenantId, phoneNumber.countryCode, phoneNumber.baseNumber, provider, JSON.stringify(rules)];

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
    const { select } = this._getPhoneNumberSelectFragment();
    const setClauses = ['updated_at = NOW()'];
    const values = [numberId, tenantId];
    let paramIndex = 3;

    const phoneNumberUpdate = updates.phoneNumber;
    if (phoneNumberUpdate && typeof phoneNumberUpdate === 'object') {
      if (phoneNumberUpdate.countryCode !== undefined) {
        setClauses.push(`country_code = $${paramIndex}`);
        values.push(phoneNumberUpdate.countryCode);
        paramIndex++;
      }
      if (phoneNumberUpdate.baseNumber !== undefined) {
        setClauses.push(`base_number = $${paramIndex}`);
        values.push(phoneNumberUpdate.baseNumber);
        paramIndex++;
      }
    }

    if (updates.countryCode !== undefined) {
      setClauses.push(`country_code = $${paramIndex}`);
      values.push(updates.countryCode);
      paramIndex++;
    }
    if (updates.baseNumber !== undefined) {
      setClauses.push(`base_number = $${paramIndex}`);
      values.push(updates.baseNumber);
      paramIndex++;
    }

    if (updates.provider !== undefined) {
      setClauses.push(`provider = $${paramIndex}`);
      values.push(updates.provider);
      paramIndex++;
    }

    const rulesPatch = {};
    if (updates.numberType !== undefined) rulesPatch.number_type = updates.numberType;
    if (updates.capabilities !== undefined) rulesPatch.capabilities = updates.capabilities;
    if (updates.metadata !== undefined && updates.metadata !== null && typeof updates.metadata === 'object') {
      Object.assign(rulesPatch, updates.metadata);
    }

    if (Object.keys(rulesPatch).length > 0) {
      setClauses.push(`rules = COALESCE(rules, '{}'::jsonb) || $${paramIndex}::jsonb`);
      values.push(JSON.stringify(rulesPatch));
      paramIndex++;
    }

    if (updates.isActive !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(updates.isActive ? 'active' : 'inactive');
      paramIndex++;
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(updates.status);
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
      RETURNING ${select}
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
    const { select } = this._getPhoneNumberSelectFragment();
    const query = `
      SELECT ${select}
      FROM ${schema}.voice_agent_numbers
      WHERE tenant_id = $1 
        AND (status IS NULL OR status = 'active')
        AND (rules->'capabilities') ? $2
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
    const { select } = this._getPhoneNumberSelectFragment();
    const query = `
      SELECT ${select}
      FROM ${schema}.voice_agent_numbers
      WHERE tenant_id = $1 
        AND (status IS NULL OR status = 'active')
        AND ((rules->'capabilities') ? 'voice')
      ORDER BY 
        CASE WHEN rules->>'is_default' = 'true' THEN 0 ELSE 1 END,
        created_at ASC
      LIMIT 1
    `;

    const result = await this.db.query(query, [tenantId]);
    return result.rows[0] || null;
  }
}

module.exports = PhoneNumberModel;
