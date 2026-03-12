/**
 * Analytics Repository
 * Data Access Layer - SQL queries for analytics calculations
 * 
 * LAD Architecture: Repository Layer
 * - Contains ONLY SQL queries
 * - No business logic
 * - No transformations
 * - Tenant-scoped queries enforced
 */

const { query } = require('../../../shared/database/connection');
const logger = require('../../../core/utils/logger');
const { getSchema } = require('../../../core/utils/schemaHelper');

class AnalyticsRepository {
  /**
   * Get network statistics for a tenant
   * @param {string} tenantId - Tenant ID (UUID)
   * @returns {Promise<Object>} Network stats (total members, interactions, referrals, avg connections)
   */
  async getNetworkStats(tenantId) {
    try {
      const schema = getSchema();
      
      // Get member count
      const membersResult = await query(
        `SELECT COUNT(*) as total_members FROM ${schema}.community_roi_members
         WHERE tenant_id = $1::uuid AND is_deleted = false`,
        [tenantId]
      );

      // Get interactions count
      const interactionsResult = await query(
        `SELECT COUNT(*) as total_interactions FROM ${schema}.community_roi_interactions
         WHERE tenant_id = $1::uuid AND is_deleted = false`,
        [tenantId]
      );

      // Get referrals count
      const referralsResult = await query(
        `SELECT COUNT(*) as total_referrals FROM ${schema}.community_roi_referrals
         WHERE tenant_id = $1::uuid AND is_deleted = false`,
        [tenantId]
      );

      // Get average connections per member
      const avgConnectionsResult = await query(
        `SELECT AVG(connection_count) as avg_connections
         FROM (
           SELECT COUNT(DISTINCT member_b_id) as connection_count
           FROM ${schema}.community_roi_interactions
           WHERE tenant_id = $1::uuid AND is_deleted = false
           GROUP BY member_a_id
         ) subquery`,
        [tenantId]
      );

      const totalMembers = parseInt(membersResult.rows[0]?.total_members || 0);
      const totalInteractions = parseInt(interactionsResult.rows[0]?.total_interactions || 0);
      const totalReferrals = parseInt(referralsResult.rows[0]?.total_referrals || 0);
      const avgConnections = parseFloat(avgConnectionsResult.rows[0]?.avg_connections || 0);

      return {
        totalMembers,
        totalInteractions,
        totalReferrals,
        avgConnections,
        totalCombined: totalInteractions + totalReferrals
      };
    } catch (error) {
      logger.error('[AnalyticsRepository] Error calculating network stats', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get member engagement scores
   * @param {string} tenantId - Tenant ID (UUID)
   * @returns {Promise<Array>} Array of member engagement scores
   */
  async getMemberEngagementScores(tenantId) {
    try {
      const schema = getSchema();
      
      const result = await query(
        `SELECT 
          m.id,
          m.name,
          COALESCE(m.total_one_to_ones, 0) as meetings_count,
          (
            SELECT COUNT(DISTINCT member_b_id)
            FROM ${schema}.community_roi_interactions i
            WHERE i.member_a_id = m.id AND i.tenant_id = $1::uuid AND i.is_deleted = false
          ) as unique_connections,
          LEAST(100, COALESCE(m.total_one_to_ones, 0) * 10) as engagement_score
         FROM ${schema}.community_roi_members m
         WHERE m.tenant_id = $1::uuid AND m.is_deleted = false
         ORDER BY engagement_score DESC`,
        [tenantId]
      );

      return result.rows;
    } catch (error) {
      logger.error('[AnalyticsRepository] Error fetching member engagement scores', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get relationship strength metrics
   * @param {string} tenantId - Tenant ID (UUID)
   * @returns {Promise<Object>} Relationship metrics (avg strength, max, min)
   */
  async getRelationshipMetrics(tenantId) {
    try {
      const schema = getSchema();
      
      // Calculate interaction-based strength scores
      const result = await query(
        `SELECT
          AVG(strength_score) as avg_strength,
          MAX(strength_score) as max_strength,
          MIN(strength_score) as min_strength,
          COUNT(*) as pair_count
         FROM (
           SELECT
             LEAST(100, COUNT(*) * 10) as strength_score
           FROM ${schema}.community_roi_interactions
           WHERE tenant_id = $1::uuid AND is_deleted = false
           GROUP BY member_a_id, member_b_id
         ) pair_metrics`,
        [tenantId]
      );

      const pairCount = parseInt(result.rows[0]?.pair_count || 0);
      
      return {
        avgStrength: Math.round(parseFloat(result.rows[0]?.avg_strength || 0)),
        maxStrength: parseInt(result.rows[0]?.max_strength || 0),
        minStrength: parseInt(result.rows[0]?.min_strength || 0),
        pairCount
      };
    } catch (error) {
      logger.error('[AnalyticsRepository] Error calculating relationship metrics', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get network density (percentage of possible connections that exist)
   * @param {string} tenantId - Tenant ID (UUID)
   * @returns {Promise<number>} Network density as percentage (0-100)
   */
  async getNetworkDensity(tenantId) {
    try {
      const schema = getSchema();
      
      // Get total members
      const totalMembersResult = await query(
        `SELECT COUNT(*) as total FROM ${schema}.community_roi_members
         WHERE tenant_id = $1::uuid AND is_deleted = false`,
        [tenantId]
      );

      const totalMembers = parseInt(totalMembersResult.rows[0]?.total || 0);
      const maxPossiblePairs = totalMembers > 1 ? (totalMembers * (totalMembers - 1)) / 2 : 0;

      // Get unique pairs by counting distinct member pairs
      const uniquePairsResult = await query(
        `SELECT COUNT(*) as pair_count FROM (
          SELECT DISTINCT 
            LEAST(member_a_id, member_b_id) as m1,
            GREATEST(member_a_id, member_b_id) as m2
          FROM ${schema}.community_roi_interactions
          WHERE tenant_id = $1::uuid AND is_deleted = false
         ) as unique_pairs`,
        [tenantId]
      );

      const uniquePairs = parseInt(uniquePairsResult.rows[0]?.pair_count || 0);
      const density = maxPossiblePairs > 0 ? (uniquePairs / maxPossiblePairs) * 100 : 0;

      return {
        density: Math.round(density * 10) / 10,
        actualPairs: uniquePairs,
        maxPossiblePairs,
        memberCount: totalMembers
      };
    } catch (error) {
      logger.error('[AnalyticsRepository] Error calculating network density', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get business value metrics
   * @param {string} tenantId - Tenant ID (UUID)
   * @returns {Promise<Object>} Business value stats
   */
  async getBusinessValueMetrics(tenantId) {
    try {
      const schema = getSchema();
      
      // Sum referral values (from metadata if available)
      const result = await query(
        `SELECT
          COUNT(*) as total_referrals,
          SUM(CAST(metadata->>'value' AS NUMERIC)) as total_value,
          AVG(CAST(metadata->>'value' AS NUMERIC)) as avg_value
         FROM ${schema}.community_roi_referrals
         WHERE tenant_id = $1::uuid AND is_deleted = false`,
        [tenantId]
      );

      return {
        totalReferrals: parseInt(result.rows[0]?.total_referrals || 0),
        totalBusinessValue: parseFloat(result.rows[0]?.total_value || 0),
        avgReferralValue: parseFloat(result.rows[0]?.avg_value || 0)
      };
    } catch (error) {
      logger.error('[AnalyticsRepository] Error calculating business value', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get top connectors (members with most connections)
   * @param {string} tenantId - Tenant ID (UUID)
   * @param {number} limit - Number of results to return (default 10)
   * @returns {Promise<Array>} Top connector members with connection counts
   */
  async getTopConnectors(tenantId, limit = 10) {
    try {
      const schema = getSchema();
      
      const result = await query(
        `SELECT
          m.id,
          m.name,
          COUNT(DISTINCT i.member_b_id) as connection_count,
          SUM(CAST(i.metadata->>'meetingCount' AS INTEGER)) as total_meetings
         FROM ${schema}.community_roi_members m
         LEFT JOIN ${schema}.community_roi_interactions i 
           ON m.id = i.member_a_id AND i.tenant_id = $1::uuid AND i.is_deleted = false
         WHERE m.tenant_id = $1::uuid AND m.is_deleted = false
         GROUP BY m.id, m.name
         ORDER BY connection_count DESC, total_meetings DESC
         LIMIT $2`,
        [tenantId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('[AnalyticsRepository] Error fetching top connectors', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get referral sources (who made the most referrals)
   * @param {string} tenantId - Tenant ID (UUID)
   * @param {number} limit - Number of results to return (default 10)
   * @returns {Promise<Array>} Top referrers with referral counts
   */
  async getTopReferrers(tenantId, limit = 10) {
    try {
      const schema = getSchema();
      
      const result = await query(
        `SELECT
          m.id,
          m.name,
          COUNT(r.id) as referral_count,
          COUNT(DISTINCT r.referred_to_id) as unique_referred_to
         FROM ${schema}.community_roi_members m
         LEFT JOIN ${schema}.community_roi_referrals r 
           ON m.id = r.referred_by_id AND r.tenant_id = $1::uuid AND r.is_deleted = false
         WHERE m.tenant_id = $1::uuid AND m.is_deleted = false
         GROUP BY m.id, m.name
         ORDER BY referral_count DESC
         LIMIT $2`,
        [tenantId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('[AnalyticsRepository] Error fetching top referrers', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get contribution report statistics
   * @param {string} tenantId - Tenant ID (UUID)
   * @returns {Promise<Object>} Contribution stats (unique meetings, referrals, impact, etc)
   */
  async getContributionStats(tenantId) {
    try {
      const schema = getSchema();

      // Get unique members who had meetings
      const uniqueMeetingsResult = await query(
        `SELECT COUNT(DISTINCT member_a_id) as unique_meetings
         FROM ${schema}.community_roi_interactions
         WHERE tenant_id = $1::uuid AND is_deleted = false`,
        [tenantId]
      );

      // Get unique members who made referrals
      const uniqueReferralsResult = await query(
        `SELECT COUNT(DISTINCT member_a_id) as unique_referrals
         FROM ${schema}.community_roi_referrals
         WHERE tenant_id = $1::uuid AND is_deleted = false`,
        [tenantId]
      );

      const uniqueMeetings = parseInt(uniqueMeetingsResult.rows[0]?.unique_meetings || 0);
      const uniqueReferrals = parseInt(uniqueReferralsResult.rows[0]?.unique_referrals || 0);

      return {
        uniqueMeetings,
        uniqueReferrals,
        impactGenerated: 0, // Mock data - can be populated from revenue tables
        avgMonthlyEngagements: 0 // Mock data - can be calculated if needed
      };
    } catch (error) {
      logger.error('[AnalyticsRepository] Error calculating contribution stats', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }
}

module.exports = new AnalyticsRepository();
