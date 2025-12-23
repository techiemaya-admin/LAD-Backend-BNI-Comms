/**
 * Phone Number Model
 * 
 * Business entity for phone numbers used in voice calls
 * Uses tenant_id for multi-tenancy isolation
 * 
 * Table: phone_numbers (NOT voice_agent_numbers or numbers_voiceagent)
 * Schema: Multi-tenant with tenant_id on every row
 */

class PhoneNumberModel {
  constructor(db) {
    this.pool = db;
  }

  /**
   * Get all phone numbers for a tenant
   * 
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Phone numbers
   */
  async getAllPhoneNumbers(tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        phone_number,
        provider,
        number_type,
        capabilities,
        is_active,
        created_at,
        updated_at
      FROM phone_numbers
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY phone_number ASC
    `;

    const result = await this.pool.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Get phone number by ID (tenant-isolated)
   * 
   * @param {string} numberId - Phone number ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Phone number or null
   */
  async getPhoneNumberById(numberId, tenantId) {
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
      FROM phone_numbers
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [numberId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Get phone number by actual number (tenant-isolated)
   * 
   * @param {string} phoneNumber - Phone number string
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Phone number record or null
   */
  async getByPhoneNumber(phoneNumber, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        phone_number,
        provider,
        number_type,
        capabilities,
        is_active
      FROM phone_numbers
      WHERE phone_number = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [phoneNumber, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Get available numbers for a user
   * 
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Available phone numbers
   */
  async getAvailableNumbersForUser(userId, tenantId) {
    const query = `
      SELECT 
        id,
        phone_number,
        provider,
        number_type,
        capabilities
      FROM phone_numbers
      WHERE tenant_id = $1 
        AND is_active = true
      ORDER BY phone_number ASC
    `;

    // Note: If you have user-specific number permissions, add a JOIN to user_number_permissions table
    // For now, all active numbers are available to all users in the tenant

    const result = await this.pool.query(query, [tenantId]);
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
    tenantId,
    phoneNumber,
    provider = 'custom',
    numberType = 'local',
    capabilities = ['voice'],
    metadata = {}
  }) {
    const query = `
      INSERT INTO phone_numbers (
        tenant_id,
        phone_number,
        provider,
        number_type,
        capabilities,
        is_active,
        metadata,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, true, $6, NOW(), NOW())
      RETURNING 
        id,
        tenant_id,
        phone_number,
        provider,
        number_type,
        capabilities,
        created_at
    `;

    const values = [
      tenantId,
      phoneNumber,
      provider,
      numberType,
      JSON.stringify(capabilities),
      JSON.stringify(metadata)
    ];

    const result = await this.pool.query(query, values);
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
  async updatePhoneNumber(numberId, tenantId, updates) {
    const setClauses = ['updated_at = NOW()'];
    const values = [numberId, tenantId];
    let paramIndex = 3;

    if (updates.phoneNumber !== undefined) {
      setClauses.push(`phone_number = $${paramIndex}`);
      values.push(updates.phoneNumber);
      paramIndex++;
    }
    if (updates.provider !== undefined) {
      setClauses.push(`provider = $${paramIndex}`);
      values.push(updates.provider);
      paramIndex++;
    }
    if (updates.numberType !== undefined) {
      setClauses.push(`number_type = $${paramIndex}`);
      values.push(updates.numberType);
      paramIndex++;
    }
    if (updates.capabilities !== undefined) {
      setClauses.push(`capabilities = $${paramIndex}`);
      values.push(JSON.stringify(updates.capabilities));
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
      UPDATE phone_numbers
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING 
        id,
        tenant_id,
        phone_number,
        provider,
        number_type,
        capabilities,
        is_active,
        updated_at
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete phone number (soft delete - sets is_active = false)
   * 
   * @param {string} numberId - Phone number ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<boolean>} Success
   */
  async deletePhoneNumber(numberId, tenantId) {
    const query = `
      UPDATE phone_numbers
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [numberId, tenantId]);
    return result.rowCount > 0;
  }

  /**
   * Get phone numbers by capability (tenant-isolated)
   * 
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} capability - Capability to filter by (e.g., 'voice', 'sms')
   * @returns {Promise<Array>} Matching phone numbers
   */
  async getPhoneNumbersByCapability(tenantId, capability) {
    const query = `
      SELECT 
        id,
        phone_number,
        provider,
        number_type,
        capabilities
      FROM phone_numbers
      WHERE tenant_id = $1 
        AND is_active = true
        AND capabilities ? $2
      ORDER BY phone_number ASC
    `;

    const result = await this.pool.query(query, [tenantId, capability]);
    return result.rows;
  }

  /**
   * Get default outbound number for tenant
   * 
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Default phone number or null
   */
  async getDefaultOutboundNumber(tenantId) {
    const query = `
      SELECT 
        id,
        phone_number,
        provider,
        capabilities
      FROM phone_numbers
      WHERE tenant_id = $1 
        AND is_active = true
        AND capabilities ? 'voice'
      ORDER BY 
        CASE WHEN metadata->>'is_default' = 'true' THEN 0 ELSE 1 END,
        created_at ASC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [tenantId]);
    return result.rows[0] || null;
  }
}

module.exports = PhoneNumberModel;
