/**
 * Apollo Company Model
 * 
 * Manages Apollo company data and enrichment
 */

const { query } = require('../../../shared/database/connection');

class ApolloCompany {
  /**
   * Save or update company data
   */
  static async upsert(companyData) {
    try {
      const {
        apolloId,
        name,
        domain,
        industry,
        employeeCount,
        revenue,
        location,
        phone,
        website,
        enrichedData,
        organizationId,
        userId
      } = companyData;

      const result = await query(`
        INSERT INTO apollo_companies (
          apollo_id,
          name,
          domain,
          industry,
          employee_count,
          revenue,
          location,
          phone,
          website,
          enriched_data,
          organization_id,
          user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (apollo_id, organization_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          domain = EXCLUDED.domain,
          industry = EXCLUDED.industry,
          employee_count = EXCLUDED.employee_count,
          revenue = EXCLUDED.revenue,
          location = EXCLUDED.location,
          phone = EXCLUDED.phone,
          website = EXCLUDED.website,
          enriched_data = EXCLUDED.enriched_data,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        apolloId,
        name,
        domain,
        industry,
        employeeCount,
        revenue,
        location,
        phone,
        website,
        JSON.stringify(enrichedData),
        organizationId,
        userId
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error upserting company:', error);
      throw error;
    }
  }

  /**
   * Find company by Apollo ID
   */
  static async findByApolloId(apolloId, organizationId) {
    try {
      const result = await query(`
        SELECT * FROM apollo_companies
        WHERE apollo_id = $1 AND organization_id = $2
      `, [apolloId, organizationId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding company:', error);
      throw error;
    }
  }

  /**
   * Find companies by organization
   */
  static async findByOrganization(organizationId, options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;

      const result = await query(`
        SELECT * FROM apollo_companies
        WHERE organization_id = $1
        ORDER BY updated_at DESC
        LIMIT $2 OFFSET $3
      `, [organizationId, limit, offset]);

      return result.rows;
    } catch (error) {
      console.error('Error finding companies:', error);
      throw error;
    }
  }
}

module.exports = ApolloCompany;
