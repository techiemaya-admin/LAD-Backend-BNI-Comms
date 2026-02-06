/**
 * LinkedIn Account Repository (Social Integration)
 * LAD Architecture Compliant:
 * - Tenant-scoped queries (always filter by tenant_id)
 * - Dynamic schema resolution (no hardcoded lad_dev)
 * - SQL only (no business logic)
 * - Returns raw data objects
 */

const { pool } = require('../../../shared/database/connection');
const { getSchema } = require('../../../core/utils/schemaHelper');

class LinkedInAccountRepository {
  /**
   * Create a new LinkedIn account
   * @param {Object} req - Request object (for schema resolution)
   * @param {Object} data - Account data
   * @returns {Promise<Object>} Created account
   */
  async create(req, data) {
    const schema = getSchema(req);
    const {
      tenant_id,
      user_id,
      provider = 'unipile',
      provider_account_id,
      account_name,
      session_cookies,
      access_token,
      refresh_token,
      token_expires_at,
      status = 'active',
      default_daily_limit,
      default_hourly_limit,
      metadata = {}
    } = data;

    const query = `
      INSERT INTO ${schema}.social_linkedin_accounts (
        tenant_id, user_id, provider, provider_account_id,
        account_name, session_cookies, access_token, refresh_token,
        token_expires_at, status, default_daily_limit, default_hourly_limit,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (tenant_id, provider, provider_account_id)
      DO UPDATE SET
        account_name = EXCLUDED.account_name,
        session_cookies = EXCLUDED.session_cookies,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        status = EXCLUDED.status,
        default_daily_limit = EXCLUDED.default_daily_limit,
        default_hourly_limit = EXCLUDED.default_hourly_limit,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      tenant_id, user_id, provider, provider_account_id,
      account_name, session_cookies, access_token, refresh_token,
      token_expires_at, status, default_daily_limit, default_hourly_limit,
      JSON.stringify(metadata)
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Find account by ID (tenant-scoped)
   * @param {Object} req - Request object
   * @param {string} id - Account ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<Object|null>} Account or null
   */
  async findById(req, id, tenant_id) {
    const schema = getSchema(req);
    
    const query = `
      SELECT *
      FROM ${schema}.social_linkedin_accounts
      WHERE id = $1
        AND tenant_id = $2
        AND is_deleted = false
    `;

    const result = await pool.query(query, [id, tenant_id]);
    return result.rows[0] || null;
  }

  /**
   * Find account by provider account ID (tenant-scoped)
   * @param {Object} req - Request object
   * @param {string} provider_account_id - Provider account ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<Object|null>} Account or null
   */
  async findByProviderAccountId(req, provider_account_id, tenant_id) {
    const schema = getSchema(req);
    
    const query = `
      SELECT *
      FROM ${schema}.social_linkedin_accounts
      WHERE provider_account_id = $1
        AND tenant_id = $2
        AND is_deleted = false
    `;

    const result = await pool.query(query, [provider_account_id, tenant_id]);
    return result.rows[0] || null;
  }

  /**
   * Get all accounts for a tenant
   * @param {Object} req - Request object
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<Array>} Accounts
   */
  async findByTenant(req, tenant_id) {
    const schema = getSchema(req);
    
    const query = `
      SELECT *
      FROM ${schema}.social_linkedin_accounts
      WHERE tenant_id = $1
        AND is_deleted = false
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [tenant_id]);
    return result.rows;
  }

  /**
   * Get all accounts for a user (tenant-scoped)
   * @param {Object} req - Request object
   * @param {string} user_id - User ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<Array>} Accounts
   */
  async findByUser(req, user_id, tenant_id) {
    const schema = getSchema(req);
    
    const query = `
      SELECT *
      FROM ${schema}.social_linkedin_accounts
      WHERE user_id = $1
        AND tenant_id = $2
        AND is_deleted = false
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [user_id, tenant_id]);
    return result.rows;
  }

  /**
   * Update account status
   * @param {Object} req - Request object
   * @param {string} id - Account ID
   * @param {string} tenant_id - Tenant ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated account
   */
  async updateStatus(req, id, tenant_id, status) {
    const schema = getSchema(req);
    
    const query = `
      UPDATE ${schema}.social_linkedin_accounts
      SET status = $1,
          last_verified_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
        AND tenant_id = $3
        AND is_deleted = false
      RETURNING *
    `;

    const result = await pool.query(query, [status, id, tenant_id]);
    return result.rows[0];
  }

  /**
   * Soft delete account
   * @param {Object} req - Request object
   * @param {string} id - Account ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<boolean>} Success status
   */
  async softDelete(req, id, tenant_id) {
    const schema = getSchema(req);
    
    const query = `
      UPDATE ${schema}.social_linkedin_accounts
      SET is_deleted = true,
          status = 'inactive',
          updated_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
      RETURNING id
    `;

    const result = await pool.query(query, [id, tenant_id]);
    return result.rowCount > 0;
  }

  /**
   * Update account metadata
   * @param {Object} req - Request object
   * @param {string} id - Account ID
   * @param {string} tenant_id - Tenant ID
   * @param {Object} metadata - Metadata to merge
   * @returns {Promise<Object>} Updated account
   */
  async updateMetadata(req, id, tenant_id, metadata) {
    const schema = getSchema(req);
    
    const query = `
      UPDATE ${schema}.social_linkedin_accounts
      SET metadata = metadata || $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
        AND tenant_id = $3
        AND is_deleted = false
      RETURNING *
    `;

    const result = await pool.query(query, [JSON.stringify(metadata), id, tenant_id]);
    return result.rows[0];
  }
}

module.exports = new LinkedInAccountRepository();
