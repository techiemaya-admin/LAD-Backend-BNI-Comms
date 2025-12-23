/**
 * Apollo Search Cache Model
 * 
 * Manages cached Apollo search results for performance optimization
 */

const { query } = require('../../../shared/database/connection');

class ApolloSearchCache {
  /**
   * Create or update search cache
   */
  static async upsert({ searchKey, results, organizationId, userId }) {
    try {
      const result = await query(`
        INSERT INTO apollo_search_cache (
          search_key,
          results,
          organization_id,
          user_id,
          hit_count,
          last_accessed_at
        ) VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (search_key, organization_id)
        DO UPDATE SET
          results = EXCLUDED.results,
          hit_count = apollo_search_cache.hit_count + 1,
          last_accessed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [searchKey, JSON.stringify(results), organizationId, userId]);

      return result.rows[0];
    } catch (error) {
      console.error('Error upserting search cache:', error);
      throw error;
    }
  }

  /**
   * Get cached search results
   */
  static async findByKey(searchKey, organizationId) {
    try {
      const result = await query(`
        SELECT * FROM apollo_search_cache
        WHERE search_key = $1 
          AND organization_id = $2
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `, [searchKey, organizationId]);

      if (result.rows[0]) {
        // Update access stats
        await query(`
          UPDATE apollo_search_cache
          SET 
            hit_count = hit_count + 1,
            last_accessed_at = CURRENT_TIMESTAMP
          WHERE search_key = $1 AND organization_id = $2
        `, [searchKey, organizationId]);
      }

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding cached search:', error);
      throw error;
    }
  }

  /**
   * Clear old cache entries
   */
  static async pruneOldEntries(hoursOld = 24) {
    try {
      const result = await query(`
        DELETE FROM apollo_search_cache
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${hoursOld} hours'
        RETURNING id
      `, []);

      return result.rowCount;
    } catch (error) {
      console.error('Error pruning search cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  static async getStats(organizationId = null) {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total_entries,
          SUM(hit_count) as total_hits,
          AVG(hit_count) as avg_hits_per_entry,
          MAX(last_accessed_at) as most_recent_access
        FROM apollo_search_cache
      `;
      const params = [];

      if (organizationId) {
        sql += ` WHERE organization_id = $1`;
        params.push(organizationId);
      }

      const result = await query(sql, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting cache stats:', error);
      throw error;
    }
  }
}

module.exports = ApolloSearchCache;
