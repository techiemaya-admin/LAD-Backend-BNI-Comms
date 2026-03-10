const { query } = require('../../../shared/database/connection');
const { getSchema } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Relationship Scores Service
 * Manages calculation and updates of relationship scores between members
 * 
 * LAD Architecture: Service Layer
 * - Business logic for relationship scoring
 * - Orchestrates complex SQL operations
 * - Tenant-scoped operations
 */
class RelationshipScoresService {
  /**
   * Update relationship scores for all member pairs
   * Calculates combination types (M, R, MR) and color codes
   */
  async updateRelationshipScores(tenantId) {
    const schema = getSchema();
    
    logger.info(`[RelationshipScoresService] Starting relationship scores update for tenant: ${tenantId}`);
    
    try {
      // Read SQL script
      const sqlPath = path.join(__dirname, '../scripts/update_relationship_scores.sql');
      let sql = fs.readFileSync(sqlPath, 'utf8');
      
      // Replace schema placeholder
      sql = sql.replace(/\$\{schema\}/g, schema);
      
      // Execute the update script by splitting and running each statement
      const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
      let summary = null;
      
      for (const statement of statements) {
        const result = await query(statement.trim(), [tenantId]);
        // Last statement should return the summary
        if (result.rows && result.rows.length > 0 && result.rows[0].combination_type !== undefined) {
          summary = result.rows;
        }
      }
      
      logger.info(`[RelationshipScoresService] Relationship scores updated successfully`, {
        tenantId,
        summary
      });
      
      return {
        success: true,
        summary,
        message: 'Relationship scores updated successfully'
      };
      
    } catch (error) {
      logger.error(`[RelationshipScoresService] Error updating relationship scores`, {
        tenantId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Get relationship scores heatmap data
   * Returns matrix of member pairs with their scores and color codes
   */
  async getRelationshipHeatmap(tenantId) {
    const schema = getSchema();
    
    logger.info(`[RelationshipScoresService] Fetching relationship heatmap for tenant: ${tenantId}`);
    
    try {
      // Build directly from interactions + referrals, generating TWO rows per pair
      // (one for each direction) to show accurate directional data in heatmap
      const sqlQuery = `
        WITH all_interactions AS (
          -- Get all interactions in their original direction
          SELECT
            i.member_a_id,
            i.member_b_id,
            SUM(i.meeting_count) AS meeting_count
          FROM ${schema}.community_roi_interactions i
          WHERE i.tenant_id = $1 AND i.is_deleted = false
          GROUP BY i.member_a_id, i.member_b_id
        ),
        all_referrals AS (
          -- Get all referrals in their original direction
          SELECT
            r.referred_by_id AS from_id,
            r.referred_to_id AS to_id,
            SUM(r.referral_count) AS referral_count
          FROM ${schema}.community_roi_referrals r
          WHERE r.tenant_id = $1 AND r.is_deleted = false
          GROUP BY r.referred_by_id, r.referred_to_id
        ),
        all_pairs AS (
          -- Combine interactions and referrals, keep original direction
          SELECT
            COALESCE(ai.member_a_id, ar.from_id) AS from_id,
            COALESCE(ai.member_b_id, ar.to_id) AS to_id,
            COALESCE(ai.meeting_count, 0) AS meeting_count,
            COALESCE(ar.referral_count, 0) AS referral_count
          FROM all_interactions ai
          FULL OUTER JOIN all_referrals ar
            ON ai.member_a_id = ar.from_id
            AND ai.member_b_id = ar.to_id
        )
        SELECT
          p.from_id AS member_a_id,
          p.to_id AS member_b_id,
          p.meeting_count,
          p.referral_count,
          -- Resolve display name for from_id: extract name before parentheses → email → company_name → short ID
          CASE
            WHEN mfrom.name IS NOT NULL AND mfrom.name <> '' AND mfrom.name NOT LIKE '__EMPTY%'
            THEN TRIM(SPLIT_PART(mfrom.name, '(', 1))
            WHEN mfrom.email IS NOT NULL AND mfrom.email <> ''
            THEN mfrom.email
            WHEN mfrom.company_name IS NOT NULL AND mfrom.company_name <> ''
            THEN mfrom.company_name
            ELSE 'Member-' || LEFT(mfrom.id::text, 8)
          END AS member_a_name,
          -- Resolve display name for to_id
          CASE
            WHEN mto.name IS NOT NULL AND mto.name <> '' AND mto.name NOT LIKE '__EMPTY%'
            THEN TRIM(SPLIT_PART(mto.name, '(', 1))
            WHEN mto.email IS NOT NULL AND mto.email <> ''
            THEN mto.email
            WHEN mto.company_name IS NOT NULL AND mto.company_name <> ''
            THEN mto.company_name
            ELSE 'Member-' || LEFT(mto.id::text, 8)
          END AS member_b_name
        FROM all_pairs p
        JOIN ${schema}.community_roi_members mfrom
          ON p.from_id = mfrom.id AND mfrom.tenant_id = $1 AND mfrom.is_deleted = false
        JOIN ${schema}.community_roi_members mto
          ON p.to_id = mto.id AND mto.tenant_id = $1 AND mto.is_deleted = false
        WHERE mfrom.name IS NOT NULL AND mfrom.name <> '' AND mfrom.name NOT LIKE '__EMPTY%'
          AND mto.name IS NOT NULL AND mto.name <> '' AND mto.name NOT LIKE '__EMPTY%'
        ORDER BY member_a_name, member_b_name
      `;
      
      const result = await query(sqlQuery, [tenantId]);
      
      // Derive combination_type and color_code from raw counts
      const mappedData = result.rows.map(row => {
        let combinationType = null;
        let colorCode = '#9CA3AF'; // fallback gray

        // For directional heatmap: each row represents A→B direction
        // meeting_count is per pair (not directional)
        // referral_count is FROM member_a TO member_b (directional)
        const hasMeetings = Number(row.meeting_count) > 0;
        const hasReferrals = Number(row.referral_count) > 0;
        const hasBoth     = hasMeetings && hasReferrals;

        if (hasBoth) {
          combinationType = 'MR';
          colorCode = '#10B981'; // Green
        } else if (hasMeetings) {
          combinationType = 'M';
          colorCode = '#EF4444'; // Red
        } else if (hasReferrals) {
          combinationType = 'R';
          colorCode = '#EAB308'; // Yellow
        }
        
        return {
          member_a_id: row.member_a_id,
          member_b_id: row.member_b_id,
          member_a_name: row.member_a_name,
          member_b_name: row.member_b_name,
          meeting_count: Number(row.meeting_count),
          referral_count: Number(row.referral_count),  // Directional: A→B
          combination_type: combinationType,
          color_code: colorCode
        };
      });
      
      logger.info(`[RelationshipScoresService] Fetched ${mappedData.length} relationship pairs`);
      
      return {
        success: true,
        data: mappedData,
        metadata: {
          totalPairs: mappedData.length,
          colorLegend: {
            M: { color: '#EF4444', label: 'Meeting Only', description: 'One-to-one meetings' },
            R: { color: '#EAB308', label: 'Referral Only', description: 'Referrals given' },
            MR: { color: '#10B981', label: 'Meeting + Referral', description: 'Both meetings and referrals' }
          }
        }
      };
      
    } catch (error) {
      logger.error(`[RelationshipScoresService] Error fetching heatmap data`, {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new RelationshipScoresService();
