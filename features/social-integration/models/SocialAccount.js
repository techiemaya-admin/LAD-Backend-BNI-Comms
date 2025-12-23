/**
 * Social Account Model
 * 
 * Manages connected social media accounts
 */

const { query } = require('../../../shared/database/connection');

class SocialAccount {
  /**
   * Create or update social account
   */
  static async upsert(accountData) {
    try {
      const {
        platform,
        accountId,
        username,
        accessToken,
        refreshToken,
        tokenExpiresAt,
        profileData,
        organizationId,
        userId
      } = accountData;

      const result = await query(`
        INSERT INTO social_accounts (
          platform,
          account_id,
          username,
          access_token,
          refresh_token,
          token_expires_at,
          profile_data,
          organization_id,
          user_id,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        ON CONFLICT (platform, account_id, organization_id)
        DO UPDATE SET
          username = EXCLUDED.username,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_expires_at = EXCLUDED.token_expires_at,
          profile_data = EXCLUDED.profile_data,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        platform,
        accountId,
        username,
        accessToken,
        refreshToken,
        tokenExpiresAt,
        JSON.stringify(profileData),
        organizationId,
        userId
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error upserting social account:', error);
      throw error;
    }
  }

  /**
   * Find account by platform and account ID
   */
  static async findByPlatformAndAccountId(platform, accountId, organizationId) {
    try {
      const result = await query(`
        SELECT * FROM social_accounts
        WHERE platform = $1 
          AND account_id = $2 
          AND organization_id = $3
          AND is_active = true
      `, [platform, accountId, organizationId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding social account:', error);
      throw error;
    }
  }

  /**
   * Find all accounts for organization
   */
  static async findByOrganization(organizationId, platform = null) {
    try {
      let sql = `
        SELECT * FROM social_accounts
        WHERE organization_id = $1 AND is_active = true
      `;
      const params = [organizationId];

      if (platform) {
        sql += ` AND platform = $2`;
        params.push(platform);
      }

      sql += ` ORDER BY created_at DESC`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Error finding social accounts:', error);
      throw error;
    }
  }

  /**
   * Update tokens
   */
  static async updateTokens(id, accessToken, refreshToken, tokenExpiresAt) {
    try {
      const result = await query(`
        UPDATE social_accounts
        SET 
          access_token = $2,
          refresh_token = $3,
          token_expires_at = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id, accessToken, refreshToken, tokenExpiresAt]);

      return result.rows[0];
    } catch (error) {
      console.error('Error updating tokens:', error);
      throw error;
    }
  }

  /**
   * Deactivate account
   */
  static async deactivate(id) {
    try {
      const result = await query(`
        UPDATE social_accounts
        SET 
          is_active = false,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id]);

      return result.rows[0];
    } catch (error) {
      console.error('Error deactivating account:', error);
      throw error;
    }
  }

  /**
   * Get accounts needing token refresh
   */
  static async findExpiredTokens() {
    try {
      const result = await query(`
        SELECT * FROM social_accounts
        WHERE is_active = true
          AND token_expires_at < CURRENT_TIMESTAMP + INTERVAL '1 hour'
        ORDER BY token_expires_at ASC
      `, []);

      return result.rows;
    } catch (error) {
      console.error('Error finding expired tokens:', error);
      throw error;
    }
  }
}

module.exports = SocialAccount;
