/**
 * Social Activity Model
 * 
 * Tracks social media activities (invitations, messages, etc.)
 */

const { query } = require('../../../shared/database/connection');

class SocialActivity {
  /**
   * Log activity
   */
  static async create(activityData) {
    try {
      const {
        accountId,
        platform,
        activityType, // 'invitation', 'message', 'connection', 'profile_lookup'
        targetProfileId,
        targetProfileName,
        content,
        status, // 'pending', 'sent', 'delivered', 'failed', 'accepted', 'rejected'
        metadata,
        organizationId,
        userId
      } = activityData;

      const result = await query(`
        INSERT INTO social_activities (
          account_id,
          platform,
          activity_type,
          target_profile_id,
          target_profile_name,
          content,
          status,
          metadata,
          organization_id,
          user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        accountId,
        platform,
        activityType,
        targetProfileId,
        targetProfileName,
        content,
        status,
        JSON.stringify(metadata),
        organizationId,
        userId
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error creating social activity:', error);
      throw error;
    }
  }

  /**
   * Update activity status
   */
  static async updateStatus(id, status, metadata = null) {
    try {
      let sql = `
        UPDATE social_activities
        SET 
          status = $2,
          updated_at = CURRENT_TIMESTAMP
      `;
      const params = [id, status];

      if (metadata) {
        sql += `, metadata = $3`;
        params.push(JSON.stringify(metadata));
      }

      sql += ` WHERE id = $1 RETURNING *`;

      const result = await query(sql, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating activity status:', error);
      throw error;
    }
  }

  /**
   * Find activities by account
   */
  static async findByAccount(accountId, options = {}) {
    try {
      const {
        activityType = null,
        status = null,
        limit = 50,
        offset = 0
      } = options;

      let sql = `
        SELECT * FROM social_activities
        WHERE account_id = $1
      `;
      const params = [accountId];

      if (activityType) {
        sql += ` AND activity_type = $${params.length + 1}`;
        params.push(activityType);
      }

      if (status) {
        sql += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      sql += `
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Error finding activities:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics
   */
  static async getStats(organizationId, platform = null) {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total_activities,
          COUNT(CASE WHEN activity_type = 'invitation' THEN 1 END) as invitations_sent,
          COUNT(CASE WHEN activity_type = 'message' THEN 1 END) as messages_sent,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as connections_made,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_activities
        FROM social_activities
        WHERE organization_id = $1
      `;
      const params = [organizationId];

      if (platform) {
        sql += ` AND platform = $2`;
        params.push(platform);
      }

      const result = await query(sql, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting activity stats:', error);
      throw error;
    }
  }
}

module.exports = SocialActivity;
