/**
 * Relationship Repository
 * Data Access Layer for member relationship scores
 */

const { query } = require('../../../shared/database/connection');
const logger = require('../../../core/utils/logger');
const { getSchema } = require('../../../core/utils/schemaHelper');

class RelationshipRepository {
  /**
   * Get all relationships for a member
   */
  async getMemberRelationships(tenantId, memberId, options = {}) {
    try {
      const { minScore = 0, limit = 50 } = options;
      const schema = getSchema();
      
      const result = await query(
        `SELECT 
          s.*,
          CASE 
            WHEN s.member_a_id = $2 THEN m2.name 
            ELSE m1.name 
          END as related_member_name,
          CASE 
            WHEN s.member_a_id = $2 THEN m2.id 
            ELSE m1.id 
          END as related_member_id
         FROM ${schema}.community_roi_relationship_scores s
         JOIN ${schema}.community_roi_members m1 ON s.member_a_id = m1.id
         JOIN ${schema}.community_roi_members m2 ON s.member_b_id = m2.id
         WHERE s.tenant_id = $1 
         AND (s.member_a_id = $2 OR s.member_b_id = $2)
         AND (s.one_to_one_count + s.referral_count) >= $3
         AND s.is_deleted = false
         ORDER BY (s.one_to_one_count + s.referral_count) DESC
         LIMIT $4`,
        [tenantId, memberId, minScore, limit]
      );

      return result.rows.map(row => ({
        ...row,
        score: row.one_to_one_count + row.referral_count // Simplified score for now
      }));
    } catch (error) {
      logger.error('[RelationshipRepository] Error fetching member relationships', { error: error.message, memberId });
      throw error;
    }
  }

  /**
   * Get top contributors for a tenant
   */
  async getTopContributors(tenantId, limit = 5) {
    try {
      const schema = getSchema();
      const result = await query(
        `SELECT 
          m.id,
          m.name,
          COALESCE(SUM(s.one_to_one_count + s.referral_count), 0) as total_contribution
         FROM ${schema}.community_roi_members m
         LEFT JOIN ${schema}.community_roi_relationship_scores s ON (m.id = s.member_a_id OR m.id = s.member_b_id)
         WHERE m.tenant_id = $1 AND m.is_deleted = false
         GROUP BY m.id, m.name
         ORDER BY total_contribution DESC
         LIMIT $2`,
        [tenantId, limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('[RelationshipRepository] Error fetching top contributors', { error: error.message, tenantId });
      throw error;
    }
  }

  /**
   * Get dashboard leaderboards (Excel KPIs)
   * Returns top 10 for: Unique Referrals, Unique Meetings, Total TYFCB
   */
  async getDashboardLeaderboards(tenantId) {
    try {
      const schema = getSchema();
      
      // 1. Top 10 Referrals (Unique Recipients)
      const topReferralsQuery = `
        SELECT 
          m.id,
          m.name,
          m.company_name,
          COUNT(DISTINCT r.referred_to_id) as value
        FROM ${schema}.community_roi_members m
        JOIN ${schema}.community_roi_referrals r ON m.id = r.referred_by_id
        WHERE m.tenant_id = $1 AND m.is_deleted = false AND r.is_deleted = false
        GROUP BY m.id, m.name, m.company_name
        ORDER BY value DESC, m.name ASC
        LIMIT 10
      `;

      // 2. Top 10 One-to-Ones (Unique Partners)
      const uniqueMeetingsQuery = `
        WITH pairs AS (
          SELECT member_a_id as m1, member_b_id as m2 FROM ${schema}.community_roi_interactions WHERE tenant_id = $1 AND is_deleted = false
          UNION
          SELECT member_b_id as m1, member_a_id as m2 FROM ${schema}.community_roi_interactions WHERE tenant_id = $1 AND is_deleted = false
        )
        SELECT 
          m.id,
          m.name,
          m.company_name,
          COUNT(DISTINCT p.m2) as value
        FROM ${schema}.community_roi_members m
        JOIN pairs p ON m.id = p.m1
        WHERE m.tenant_id = $1 AND m.is_deleted = false
        GROUP BY m.id, m.name, m.company_name
        ORDER BY value DESC, m.name ASC
        LIMIT 10
      `;

      // 3. Top 10 TYFCB Total (AED)
      const topTyfcbQuery = `
        SELECT 
          id,
          name,
          company_name,
          (total_business_inside_aed + total_business_outside_aed) as value,
          total_business_inside_aed as inside,
          total_business_outside_aed as outside
        FROM ${schema}.community_roi_members
        WHERE tenant_id = $1 AND is_deleted = false
        ORDER BY value DESC, name ASC
        LIMIT 10
      `;

      const [topReferrals, topMeetings, topTyfcb] = await Promise.all([
        query(topReferralsQuery, [tenantId]),
        query(uniqueMeetingsQuery, [tenantId]),
        query(topTyfcbQuery, [tenantId])
      ]);

      return {
        topReferrals: topReferrals.rows,
        topMeetings: topMeetings.rows,
        topTyfcb: topTyfcb.rows
      };
    } catch (error) {
      logger.error('[RelationshipRepository] Error fetching dashboard leaderboards', { error: error.message, tenantId });
      throw error;
    }
  }

  /**
   * Get member contribution report with combination matrix
   * Returns unique meetings, unique referrals, combination breakdown, and avg monthly engagement
   */
  async getMemberContributionReport(tenantId, memberId) {
    try {
      const schema = getSchema();
      
      // Query to get unique meetings count (unique partners met)
      const uniqueMeetingsQuery = `
        SELECT COUNT(DISTINCT 
          CASE 
            WHEN rs.member_a_id = $2 THEN rs.member_b_id 
            ELSE rs.member_a_id 
          END
        ) as unique_meetings
        FROM ${schema}.community_roi_relationship_scores rs
        WHERE rs.tenant_id = $1 
          AND (rs.member_a_id = $2 OR rs.member_b_id = $2)
          AND rs.one_to_one_count > 0
          AND rs.is_deleted = false
      `;

      // Query to get unique referrals count (unique people referred)
      const uniqueReferralsQuery = `
        SELECT COUNT(DISTINCT referred_to_id) as unique_referrals
        FROM ${schema}.community_roi_referrals
        WHERE tenant_id = $1 
          AND referred_by_id = $2
          AND is_deleted = false
      `;

      // Query to get combination matrix (breakdown by type)
      const combinationMatrixQuery = `
        SELECT 
          COUNT(CASE WHEN one_to_one_count > 0 AND referral_count = 0 THEN 1 END) as meeting_only_count,
          COUNT(CASE WHEN referral_count > 0 AND one_to_one_count = 0 THEN 1 END) as referral_only_count,
          COUNT(CASE WHEN one_to_one_count > 0 AND referral_count > 0 THEN 1 END) as both_count
        FROM ${schema}.community_roi_relationship_scores rs
        WHERE rs.tenant_id = $1 
          AND (rs.member_a_id = $2 OR rs.member_b_id = $2)
          AND (rs.one_to_one_count > 0 OR rs.referral_count > 0)
          AND rs.is_deleted = false
      `;

      // Query to get monthly engagement data (last 12 months)
      const monthlyEngagementQuery = `
        WITH monthly_data AS (
          -- Meetings
          SELECT 
            meeting_month as month,
            COUNT(DISTINCT 
              CASE 
                WHEN member_a_id = $2 THEN member_b_id 
                ELSE member_a_id 
              END
            ) as unique_partners
          FROM ${schema}.community_roi_interactions
          WHERE tenant_id = $1 
            AND (member_a_id = $2 OR member_b_id = $2)
            AND is_deleted = false
            AND meeting_month >= TO_CHAR(CURRENT_DATE - INTERVAL '12 months', 'YYYY-MM')
          GROUP BY meeting_month
          
          UNION ALL
          
          -- Referrals
          SELECT 
            referral_month as month,
            COUNT(DISTINCT referred_to_id) as unique_partners
          FROM ${schema}.community_roi_referrals
          WHERE tenant_id = $1 
            AND referred_by_id = $2
            AND is_deleted = false
            AND referral_month >= TO_CHAR(CURRENT_DATE - INTERVAL '12 months', 'YYYY-MM')
          GROUP BY referral_month
        )
        SELECT 
          COALESCE(AVG(unique_partners), 0) as avg_monthly_unique_engagements,
          COUNT(DISTINCT month) as active_months
        FROM monthly_data
      `;

      const [uniqueMeetingsResult, uniqueReferralsResult, combinationMatrixResult, monthlyEngagementResult] = await Promise.all([
        query(uniqueMeetingsQuery, [tenantId, memberId]),
        query(uniqueReferralsQuery, [tenantId, memberId]),
        query(combinationMatrixQuery, [tenantId, memberId]),
        query(monthlyEngagementQuery, [tenantId, memberId])
      ]);

      const uniqueMeetings = parseInt(uniqueMeetingsResult.rows[0]?.unique_meetings || 0);
      const uniqueReferrals = parseInt(uniqueReferralsResult.rows[0]?.unique_referrals || 0);
      const combinationMatrix = combinationMatrixResult.rows[0] || {};
      const monthlyEngagement = monthlyEngagementResult.rows[0] || {};

      return {
        uniqueMeetings,
        uniqueReferrals,
        combinationMatrix: {
          meetingOnly: {
            count: parseInt(combinationMatrix.meeting_only_count || 0),
            color: '#EF4444',
            label: 'Meeting Only'
          },
          referralOnly: {
            count: parseInt(combinationMatrix.referral_only_count || 0),
            color: '#EAB308',
            label: 'Referral Only'
          },
          both: {
            count: parseInt(combinationMatrix.both_count || 0),
            color: '#10B981',
            label: 'Both Meetings & Referrals'
          }
        },
        avgMonthlyUniqueEngagements: parseFloat(monthlyEngagement.avg_monthly_unique_engagements || 0).toFixed(1),
        activeMonths: parseInt(monthlyEngagement.active_months || 0)
      };
    } catch (error) {
      logger.error('[RelationshipRepository] Error fetching member contribution report', { 
        error: error.message, 
        tenantId, 
        memberId 
      });
      throw error;
    }
  }
}

module.exports = new RelationshipRepository();
