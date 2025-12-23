/**
 * Enriched Lead Model
 * 
 * Manages enriched lead data and analysis results
 */

const { query } = require('../../../shared/database/connection');

class EnrichedLead {
  /**
   * Save enriched lead data
   */
  static async create(leadData) {
    try {
      const {
        sourceLeadId,
        companyName,
        domain,
        relevanceScore,
        websiteAnalysis,
        enrichmentData,
        topic,
        organizationId,
        userId
      } = leadData;

      const result = await query(`
        INSERT INTO enriched_leads (
          source_lead_id,
          company_name,
          domain,
          relevance_score,
          website_analysis,
          enrichment_data,
          topic,
          organization_id,
          user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        sourceLeadId,
        companyName,
        domain,
        relevanceScore,
        JSON.stringify(websiteAnalysis),
        JSON.stringify(enrichmentData),
        topic,
        organizationId,
        userId
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error creating enriched lead:', error);
      throw error;
    }
  }

  /**
   * Find enriched lead by source ID
   */
  static async findBySourceId(sourceLeadId, organizationId) {
    try {
      const result = await query(`
        SELECT * FROM enriched_leads
        WHERE source_lead_id = $1 AND organization_id = $2
      `, [sourceLeadId, organizationId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding enriched lead:', error);
      throw error;
    }
  }

  /**
   * Find enriched leads by organization
   */
  static async findByOrganization(organizationId, options = {}) {
    try {
      const { 
        minScore = 0, 
        topic = null, 
        limit = 50, 
        offset = 0 
      } = options;

      let sql = `
        SELECT * FROM enriched_leads
        WHERE organization_id = $1 AND relevance_score >= $2
      `;
      const params = [organizationId, minScore];

      if (topic) {
        sql += ` AND topic = $${params.length + 1}`;
        params.push(topic);
      }

      sql += `
        ORDER BY relevance_score DESC, created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Error finding enriched leads:', error);
      throw error;
    }
  }

  /**
   * Update relevance score
   */
  static async updateScore(id, relevanceScore) {
    try {
      const result = await query(`
        UPDATE enriched_leads
        SET 
          relevance_score = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id, relevanceScore]);

      return result.rows[0];
    } catch (error) {
      console.error('Error updating relevance score:', error);
      throw error;
    }
  }

  /**
   * Get enrichment statistics
   */
  static async getStats(organizationId) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_enriched,
          AVG(relevance_score) as avg_score,
          COUNT(CASE WHEN relevance_score >= 7 THEN 1 END) as high_quality_count,
          COUNT(DISTINCT topic) as unique_topics
        FROM enriched_leads
        WHERE organization_id = $1
      `, [organizationId]);

      return result.rows[0];
    } catch (error) {
      console.error('Error getting enrichment stats:', error);
      throw error;
    }
  }
}

module.exports = EnrichedLead;
