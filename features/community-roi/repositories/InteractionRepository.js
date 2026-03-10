/**
 * Interaction Repository
 * Data Access Layer for meetings and referrals
 */

const { query } = require('../../../shared/database/connection');
const logger = require('../../../core/utils/logger');
const { getSchema } = require('../../../core/utils/schemaHelper');

class InteractionRepository {
  /**
   * Get interaction summary for a tenant (Network Stats)
   */
  async getNetworkStats(tenantId) {
    try {
      const schema = getSchema();
      const stats = await query(
        `SELECT 
          (SELECT COUNT(*) FROM ${schema}.community_roi_members WHERE tenant_id = $1 AND is_deleted = false) as total_members,
          (SELECT COALESCE(SUM(meeting_count), 0) FROM ${schema}.community_roi_interactions WHERE tenant_id = $1 AND is_deleted = false) as total_meetings,
          (SELECT COALESCE(SUM(referral_count), 0) FROM ${schema}.community_roi_referrals WHERE tenant_id = $1 AND is_deleted = false) as total_referrals,
          (SELECT COALESCE(AVG(one_to_one_count + referral_count), 0) FROM ${schema}.community_roi_relationship_scores WHERE tenant_id = $1 AND is_deleted = false) as avg_engagement`,
        [tenantId]
      );

      return {
        total_members: parseInt(stats.rows[0].total_members),
        total_interactions: parseInt(stats.rows[0].total_meetings),
        total_referrals: parseInt(stats.rows[0].total_referrals),
        average_relationship_strength: parseFloat(stats.rows[0].avg_engagement),
        total_business_aed: 0 // Placeholder
      };
    } catch (error) {
      logger.error('[InteractionRepository] Error fetching network stats', { error: error.message, tenantId });
      throw error;
    }
  }

  /**
   * Get member referrals
   */
  async getMemberReferrals(tenantId, memberId) {
    try {
      const schema = getSchema();
      const result = await query(
        `SELECT r.*, m.name as referred_to_name
         FROM ${schema}.community_roi_referrals r
         JOIN ${schema}.community_roi_members m ON r.referred_to_id = m.id
         WHERE r.tenant_id = $1 AND r.referred_by_id = $2 AND r.is_deleted = false
         ORDER BY r.created_at DESC`,
        [tenantId, memberId]
      );
      return result.rows;
    } catch (error) {
      logger.error('[InteractionRepository] Error fetching member referrals', { error: error.message, memberId });
      throw error;
    }
  }

  /**
   * Get history for outreach analysis
   */
  async getMemberActivityHistory(tenantId, memberId) {
    try {
      const schema = getSchema();
      const result = await query(
        `SELECT 
          created_at::date as date,
          COUNT(*) as count,
          'meeting' as type
         FROM ${schema}.community_roi_interactions
         WHERE tenant_id = $1 AND (member_a_id = $2 OR member_b_id = $2)
         AND is_deleted = false
         GROUP BY date
         UNION ALL
         SELECT 
          created_at::date as date,
          COUNT(*) as count,
          'referral' as type
         FROM ${schema}.community_roi_referrals
         WHERE tenant_id = $1 AND referred_by_id = $2
         AND is_deleted = false
         GROUP BY date
         ORDER BY date ASC`,
        [tenantId, memberId]
      );
      return result.rows;
    } catch (error) {
      logger.error('[InteractionRepository] Error fetching activity history', { error: error.message, memberId });
      throw error;
    }
  }

  /**
   * Get recent activity feed for a member
   */
  async getRecentActivity(tenantId, memberId, limit = 10) {
    try {
      const schema = getSchema();
      const result = await query(
        `SELECT 
          i.id,
          i.created_at,
          'meeting' as type,
          CASE 
            WHEN i.member_a_id = $2::uuid THEN m2.name
            WHEN i.member_b_id = $2::uuid THEN m3.name
            ELSE 'Unknown'
          END as related_member_name,
          i.meeting_count as details,
          i.metadata
         FROM ${schema}.community_roi_interactions i
         LEFT JOIN ${schema}.community_roi_members m2 ON i.member_b_id = m2.id AND i.tenant_id = m2.tenant_id
         LEFT JOIN ${schema}.community_roi_members m3 ON i.member_a_id = m3.id AND i.tenant_id = m3.tenant_id
         WHERE i.tenant_id = $1::uuid AND (i.member_a_id = $2::uuid OR i.member_b_id = $2::uuid) AND i.is_deleted = false
         
         UNION ALL
         
         SELECT 
          r.id,
          r.created_at,
          'referral' as type,
          m4.name as related_member_name,
          r.referral_count::text as details,
          r.metadata
         FROM ${schema}.community_roi_referrals r
         LEFT JOIN ${schema}.community_roi_members m4 ON r.referred_to_id = m4.id AND r.tenant_id = m4.tenant_id
         WHERE r.tenant_id = $1::uuid AND r.referred_by_id = $2::uuid AND r.is_deleted = false
         
         ORDER BY created_at DESC
         LIMIT $3`,
        [tenantId, memberId, limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('[InteractionRepository] Error fetching recent activity', { error: error.message, memberId });
      throw error;
    }
  }

  /**
   * Log a new meeting
   */
  async logMeeting(tenantId, data) {
    try {
      const schema = getSchema();
      const result = await query(
        `INSERT INTO ${schema}.community_roi_interactions 
         (tenant_id, member_a_id, member_b_id, metadata, created_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::jsonb, NOW())
         RETURNING *`,
        [tenantId, data.memberAId, data.memberBId, data.metadata || {}]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('[InteractionRepository] Error logging meeting', { error: error.message, tenantId });
      throw error;
    }
  }

  /**
   * Check if a meeting is unique (first time these two members meet)
   */
  async isUniqueMeeting(tenantId, memberAId, memberBId) {
    try {
      const schema = getSchema();
      const result = await query(
        `SELECT COUNT(*) FROM ${schema}.community_roi_interactions
         WHERE tenant_id = $1::uuid AND 
         ((member_a_id = $2::uuid AND member_b_id = $3::uuid) OR 
          (member_a_id = $3::uuid AND member_b_id = $2::uuid))
         AND is_deleted = false`,
        [tenantId, memberAId, memberBId]
      );
      return parseInt(result.rows[0].count) === 0;
    } catch (error) {
      logger.error('[InteractionRepository] Error checking meeting uniqueness', { error: error.message });
      throw error;
    }
  }

  /**
   * Log a new referral
   */
  async logReferral(tenantId, data) {
    try {
      const schema = getSchema();
      const result = await query(
        `INSERT INTO ${schema}.community_roi_referrals 
         (tenant_id, referred_by_id, referred_to_id, referral_type, status, created_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, NOW())
         RETURNING *`,
        [tenantId, data.referredById, data.referredToId, data.referralType, data.status || 'pending']
      );
      return result.rows[0];
    } catch (error) {
      logger.error('[InteractionRepository] Error logging referral', { error: error.message, tenantId });
      throw error;
    }
  }
}

module.exports = new InteractionRepository();
