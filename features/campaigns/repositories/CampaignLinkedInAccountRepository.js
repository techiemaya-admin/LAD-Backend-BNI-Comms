/**
 * Campaign LinkedIn Account Repository
 * LAD Architecture Compliant:
 * - Tenant-scoped queries
 * - Dynamic schema resolution
 * - SQL only (no business logic)
 * - Handles campaign-account mapping with rate limits
 */

const { pool } = require('../../../shared/database/connection');
const { getSchema } = require('../../../core/utils/schemaHelper');

class CampaignLinkedInAccountRepository {
  /**
   * Attach LinkedIn account to campaign
   * @param {Object} req - Request object
   * @param {Object} data - Mapping data
   * @returns {Promise<Object>} Created mapping
   */
  async create(req, data) {
    const schema = getSchema(req);
    const {
      tenant_id,
      campaign_id,
      linkedin_account_id,
      daily_limit,
      hourly_limit,
      is_primary = false,
      priority = 0,
      metadata = {}
    } = data;

    const query = `
      INSERT INTO ${schema}.campaign_linkedin_accounts (
        tenant_id, campaign_id, linkedin_account_id,
        daily_limit, hourly_limit, is_primary, priority, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id, campaign_id, linkedin_account_id)
      DO UPDATE SET
        daily_limit = EXCLUDED.daily_limit,
        hourly_limit = EXCLUDED.hourly_limit,
        is_primary = EXCLUDED.is_primary,
        priority = EXCLUDED.priority,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      tenant_id, campaign_id, linkedin_account_id,
      daily_limit, hourly_limit, is_primary, priority,
      JSON.stringify(metadata)
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get all accounts for a campaign
   * @param {Object} req - Request object
   * @param {string} campaign_id - Campaign ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<Array>} Account mappings with account details
   */
  async findByCampaign(req, campaign_id, tenant_id) {
    const schema = getSchema(req);
    
    const query = `
      SELECT 
        cla.*,
        sla.provider,
        sla.provider_account_id,
        sla.account_name,
        sla.status as account_status,
        sla.user_id as account_owner_id
      FROM ${schema}.campaign_linkedin_accounts cla
      JOIN ${schema}.social_linkedin_accounts sla
        ON sla.id = cla.linkedin_account_id
        AND sla.tenant_id = cla.tenant_id
        AND sla.is_deleted = false
      WHERE cla.campaign_id = $1
        AND cla.tenant_id = $2
        AND cla.is_deleted = false
      ORDER BY cla.priority DESC, cla.created_at ASC
    `;

    const result = await pool.query(query, [campaign_id, tenant_id]);
    return result.rows;
  }

  /**
   * Get primary account for campaign
   * @param {Object} req - Request object
   * @param {string} campaign_id - Campaign ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<Object|null>} Primary account mapping
   */
  async findPrimaryByCampaign(req, campaign_id, tenant_id) {
    const schema = getSchema(req);
    
    const query = `
      SELECT 
        cla.*,
        sla.provider,
        sla.provider_account_id,
        sla.account_name,
        sla.status as account_status
      FROM ${schema}.campaign_linkedin_accounts cla
      JOIN ${schema}.social_linkedin_accounts sla
        ON sla.id = cla.linkedin_account_id
        AND sla.tenant_id = cla.tenant_id
        AND sla.is_deleted = false
      WHERE cla.campaign_id = $1
        AND cla.tenant_id = $2
        AND cla.is_primary = true
        AND cla.is_deleted = false
      LIMIT 1
    `;

    const result = await pool.query(query, [campaign_id, tenant_id]);
    return result.rows[0] || null;
  }

  /**
   * Get available account (under daily limit)
   * @param {Object} req - Request object
   * @param {string} campaign_id - Campaign ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<Object|null>} Available account
   */
  async findAvailableAccount(req, campaign_id, tenant_id) {
    const schema = getSchema(req);
    
    const query = `
      SELECT 
        cla.*,
        sla.provider,
        sla.provider_account_id,
        sla.account_name,
        sla.status as account_status
      FROM ${schema}.campaign_linkedin_accounts cla
      JOIN ${schema}.social_linkedin_accounts sla
        ON sla.id = cla.linkedin_account_id
        AND sla.tenant_id = cla.tenant_id
        AND sla.is_deleted = false
        AND sla.status = 'active'
      WHERE cla.campaign_id = $1
        AND cla.tenant_id = $2
        AND cla.is_deleted = false
        AND (
          cla.last_reset_date IS NULL
          OR cla.last_reset_date < CURRENT_DATE
          OR cla.actions_today < cla.daily_limit
        )
      ORDER BY cla.priority DESC, cla.actions_today ASC
      LIMIT 1
    `;

    const result = await pool.query(query, [campaign_id, tenant_id]);
    return result.rows[0] || null;
  }

  /**
   * Increment action counter
   * @param {Object} req - Request object
   * @param {string} id - Mapping ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<Object>} Updated mapping
   */
  async incrementActions(req, id, tenant_id) {
    const schema = getSchema(req);
    
    const query = `
      UPDATE ${schema}.campaign_linkedin_accounts
      SET 
        actions_today = CASE
          WHEN last_reset_date IS NULL OR last_reset_date < CURRENT_DATE
          THEN 1
          ELSE actions_today + 1
        END,
        last_reset_date = CURRENT_DATE,
        updated_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
        AND is_deleted = false
      RETURNING *
    `;

    const result = await pool.query(query, [id, tenant_id]);
    return result.rows[0];
  }

  /**
   * Reset daily counters (run via cron)
   * @param {Object} req - Request object
   * @param {string} tenant_id - Tenant ID (optional, reset all if null)
   * @returns {Promise<number>} Number of records reset
   */
  async resetDailyCounters(req, tenant_id = null) {
    const schema = getSchema(req);
    
    let query, values;
    
    if (tenant_id) {
      query = `
        UPDATE ${schema}.campaign_linkedin_accounts
        SET actions_today = 0,
            last_reset_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE tenant_id = $1
          AND (last_reset_date IS NULL OR last_reset_date < CURRENT_DATE)
          AND is_deleted = false
      `;
      values = [tenant_id];
    } else {
      query = `
        UPDATE ${schema}.campaign_linkedin_accounts
        SET actions_today = 0,
            last_reset_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE (last_reset_date IS NULL OR last_reset_date < CURRENT_DATE)
          AND is_deleted = false
      `;
      values = [];
    }

    const result = await pool.query(query, values);
    return result.rowCount;
  }

  /**
   * Remove account from campaign
   * @param {Object} req - Request object
   * @param {string} id - Mapping ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<boolean>} Success status
   */
  async softDelete(req, id, tenant_id) {
    const schema = getSchema(req);
    
    const query = `
      UPDATE ${schema}.campaign_linkedin_accounts
      SET is_deleted = true,
          updated_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
      RETURNING id
    `;

    const result = await pool.query(query, [id, tenant_id]);
    return result.rowCount > 0;
  }

  /**
   * Get campaigns using a LinkedIn account
   * @param {Object} req - Request object
   * @param {string} linkedin_account_id - LinkedIn account ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<Array>} Campaign mappings
   */
  async findByLinkedInAccount(req, linkedin_account_id, tenant_id) {
    const schema = getSchema(req);
    
    const query = `
      SELECT 
        cla.*,
        c.name as campaign_name,
        c.status as campaign_status
      FROM ${schema}.campaign_linkedin_accounts cla
      JOIN ${schema}.campaigns c
        ON c.id = cla.campaign_id
        AND c.tenant_id = cla.tenant_id
      WHERE cla.linkedin_account_id = $1
        AND cla.tenant_id = $2
        AND cla.is_deleted = false
      ORDER BY cla.created_at DESC
    `;

    const result = await pool.query(query, [linkedin_account_id, tenant_id]);
    return result.rows;
  }
}

module.exports = new CampaignLinkedInAccountRepository();
