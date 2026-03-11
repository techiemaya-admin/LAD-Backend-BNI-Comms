/**
 * Website Analysis Cache Model
 * 
 * Caches website scraping and analysis results
 */

const { query } = require('../../../shared/database/connection');

class WebsiteAnalysisCache {
  /**
   * Create or update cache entry
   */
  static async upsert({ domain, analysisData, relevanceScore, topic }) {
    try {
      const result = await query(`
        INSERT INTO website_analysis_cache (
          domain,
          analysis_data,
          relevance_score,
          topic,
          hit_count,
          last_accessed_at
        ) VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (domain, topic)
        DO UPDATE SET
          analysis_data = EXCLUDED.analysis_data,
          relevance_score = EXCLUDED.relevance_score,
          hit_count = website_analysis_cache.hit_count + 1,
          last_accessed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [domain, JSON.stringify(analysisData), relevanceScore, topic]);

      return result.rows[0];
    } catch (error) {
      console.error('Error upserting website cache:', error);
      throw error;
    }
  }

  /**
   * Get cached analysis
   */
  static async findByDomain(domain, topic) {
    try {
      const result = await query(`
        SELECT * FROM website_analysis_cache
        WHERE domain = $1 
          AND topic = $2
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
      `, [domain, topic]);

      if (result.rows[0]) {
        // Update access stats
        await query(`
          UPDATE website_analysis_cache
          SET 
            hit_count = hit_count + 1,
            last_accessed_at = CURRENT_TIMESTAMP
          WHERE domain = $1 AND topic = $2
        `, [domain, topic]);
      }

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding cached analysis:', error);
      throw error;
    }
  }

  /**
   * Prune old entries
   */
  static async pruneOldEntries(daysOld = 7) {
    try {
      const result = await query(`
        DELETE FROM website_analysis_cache
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
        RETURNING id
      `, []);

      return result.rowCount;
    } catch (error) {
      console.error('Error pruning website cache:', error);
      throw error;
    }
  }
}

module.exports = WebsiteAnalysisCache;
