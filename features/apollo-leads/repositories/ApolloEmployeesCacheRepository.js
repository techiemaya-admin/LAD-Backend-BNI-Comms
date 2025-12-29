/**
 * Apollo Employees Cache Repository
 * LAD Architecture: SQL queries only - no business logic
 * 
 * Handles all database operations for Apollo employees cache.
 * This repository contains ONLY SQL queries.
 */

const { pool } = require('../../../shared/database/connection');

class ApolloEmployeesCacheRepository {
  /**
   * Upsert employee to cache
   * LAD Architecture: SQL only, uses dynamic schema and tenant_id
   */
  async upsertEmployee(employeeData, schema, tenantId) {
    const query = `
      INSERT INTO ${schema}.employees_cache (
        tenant_id, apollo_person_id, employee_name, employee_title, employee_email,
        employee_phone, employee_linkedin_url, employee_photo_url,
        employee_headline, employee_city, employee_state, employee_country,
        company_id, company_name, company_domain, data_source, employee_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (tenant_id, company_id, apollo_person_id) DO UPDATE SET
        employee_name = EXCLUDED.employee_name,
        employee_title = EXCLUDED.employee_title,
        employee_email = COALESCE(EXCLUDED.employee_email, employees_cache.employee_email),
        employee_phone = COALESCE(EXCLUDED.employee_phone, employees_cache.employee_phone),
        employee_linkedin_url = COALESCE(EXCLUDED.employee_linkedin_url, employees_cache.employee_linkedin_url),
        employee_photo_url = COALESCE(EXCLUDED.employee_photo_url, employees_cache.employee_photo_url),
        employee_headline = COALESCE(EXCLUDED.employee_headline, employees_cache.employee_headline),
        employee_city = COALESCE(EXCLUDED.employee_city, employees_cache.employee_city),
        employee_state = COALESCE(EXCLUDED.employee_state, employees_cache.employee_state),
        employee_country = COALESCE(EXCLUDED.employee_country, employees_cache.employee_country),
        company_name = COALESCE(EXCLUDED.company_name, employees_cache.company_name),
        company_domain = COALESCE(EXCLUDED.company_domain, employees_cache.company_domain),
        employee_data = EXCLUDED.employee_data,
        updated_at = NOW()
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      tenantId,
      employeeData.apolloPersonId,
      employeeData.name || null,
      employeeData.title || null,
      employeeData.email || null,
      employeeData.phone || null,
      employeeData.linkedin_url || null,
      employeeData.photo_url || null,
      employeeData.headline || null,
      employeeData.city || null,
      employeeData.state || null,
      employeeData.country || null,
      employeeData.company_id || null,
      employeeData.company_name || null,
      employeeData.company_domain || null,
      employeeData.data_source || 'apollo_io',
      JSON.stringify(employeeData.employee_data || employeeData || {})
    ]);

    return {
      command: result.command,
      row: result.rows[0]
    };
  }
}

module.exports = new ApolloEmployeesCacheRepository();

