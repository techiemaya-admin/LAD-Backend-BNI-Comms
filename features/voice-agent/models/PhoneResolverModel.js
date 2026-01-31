/**
 * Phone Resolver Model1.0
 * 
 * Resolves phone numbers from external sources (company/employee caches)
 * Uses tenant_id for multi-tenancy isolation
 * 
 * This is a feature-specific model that doesn't represent a single table
 * but provides cross-table phone resolution functionality
 */

class PhoneResolverModel {
  constructor(db) {
    this.pool = db;
  }

  /**
   * Resolve phones for companies or employees
   * Based on sts-service/src/models/voiceagent.pg.js::resolvePhones
   * 
   * @param {Array<string>} ids - Array of IDs to resolve
   * @param {string} type - Type: 'company' or 'employee'
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Resolved phone data
   */
  async resolvePhones(ids, type, tenantId) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    if (type === 'company') {
      return this._resolveCompanyPhones(ids, tenantId);
    } else if (type === 'employee') {
      return this._resolveEmployeePhones(ids, tenantId);
    } else {
      throw new Error(`Invalid type: ${type}. Must be 'company' or 'employee'`);
    }
  }

  /**
   * Resolve company phones from company_search_cache
   * 
   * @private
   * @param {Array<string>} ids - Company IDs
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Resolved company data
   */
  async _resolveCompanyPhones(ids, tenantId) {
    // Build CASE statements for matching multiple ID formats
    const caseConditions = ids.map((id, idx) => `
      WHEN 
        cache.apollo_organization_id = $${idx + 2}
        OR cache.company_data->>'id' = $${idx + 2}
        OR cache.id::text = $${idx + 2}
      THEN $${idx + 2}
    `).join('\n      ');

    const query = `
      SELECT 
        CASE
          ${caseConditions}
        END as requested_id,
        cache.id as cache_row_id,
        COALESCE(
          cache.phone,
          cache.company_data->>'phone',
          cache.company_data->>'primary_phone'
        ) as phone,
        COALESCE(
          cache.name,
          cache.company_data->>'name',
          cache.company_data->>'organization_name'
        ) as name,
        CASE 
          WHEN cache.sales_summary LIKE '##%' THEN cache.sales_summary
          ELSE NULL
        END as sales_summary,
        'company_search_cache' as source,
        cache.company_data as raw_data
      FROM company_search_cache cache
      WHERE cache.tenant_id = $1
        AND (
          cache.apollo_organization_id = ANY($${ids.length + 2})
          OR cache.company_data->>'id' = ANY($${ids.length + 2})
          OR cache.id::text = ANY($${ids.length + 2})
        )
    `;

    const values = [tenantId, ...ids, ids];
    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Resolve employee phones from employees_cache
   * 
   * @private
   * @param {Array<string>} ids - Employee IDs
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Resolved employee data
   */
  async _resolveEmployeePhones(ids, tenantId) {
    // Build CASE statements for matching multiple ID formats
    const caseConditions = ids.map((id, idx) => `
      WHEN 
        cache.company_id = $${idx + 2}
        OR cache.apollo_person_id = $${idx + 2}
        OR cache.employee_data_id = $${idx + 2}
        OR cache.id::text = $${idx + 2}
      THEN $${idx + 2}
    `).join('\n      ');

    const query = `
      SELECT 
        CASE
          ${caseConditions}
        END as requested_id,
        cache.id as cache_row_id,
        COALESCE(
          cache.phone,
          cache.employee_data->>'phone',
          cache.employee_data->>'mobile_phone',
          cache.employee_data->>'direct_phone'
        ) as phone,
        COALESCE(
          cache.name,
          cache.employee_data->>'name',
          cache.employee_data->>'full_name',
          CONCAT(
            cache.employee_data->>'first_name',
            ' ',
            cache.employee_data->>'last_name'
          )
        ) as name,
        CASE 
          WHEN cache.sales_summary LIKE '##%' THEN cache.sales_summary
          ELSE NULL
        END as sales_summary,
        'employees_cache' as source,
        cache.employee_data as raw_data
      FROM employees_cache cache
      WHERE cache.tenant_id = $1
        AND (
          cache.company_id = ANY($${ids.length + 2})
          OR cache.apollo_person_id = ANY($${ids.length + 2})
          OR cache.employee_data_id = ANY($${ids.length + 2})
          OR cache.id::text = ANY($${ids.length + 2})
        )
    `;

    const values = [tenantId, ...ids, ids];
    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Update sales summary for a company
   * 
   * @param {string} companyId - Company ID (apollo_organization_id or cache row id)
   * @param {string} salesSummary - Sales summary text
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object>} Updated record
   */
  async updateCompanySalesSummary(companyId, salesSummary, tenantId) {
    const query = `
      UPDATE company_search_cache
      SET 
        sales_summary = $3,
        updated_at = NOW()
      WHERE tenant_id = $1
        AND (
          apollo_organization_id = $2
          OR id::text = $2
        )
      RETURNING 
        id,
        apollo_organization_id,
        name,
        sales_summary
    `;

    const result = await this.pool.query(query, [tenantId, companyId, salesSummary]);
    return result.rows[0] || null;
  }

  /**
   * Update sales summary for an employee's company
   * 
   * @param {string} employeeId - Employee ID (apollo_person_id or cache row id)
   * @param {string} salesSummary - Sales summary text
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object>} Updated record
   */
  async updateEmployeeCompanySalesSummary(employeeId, salesSummary, tenantId) {
    // First, get the company_id for this employee
    const getCompanyQuery = `
      SELECT company_id
      FROM employees_cache
      WHERE tenant_id = $1
        AND (
          apollo_person_id = $2
          OR id::text = $2
        )
      LIMIT 1
    `;

    const companyResult = await this.pool.query(getCompanyQuery, [tenantId, employeeId]);
    
    if (!companyResult.rows[0]?.company_id) {
      return null;
    }

    const companyId = companyResult.rows[0].company_id;

    // Now update the company's sales summary
    const updateQuery = `
      UPDATE company_search_cache
      SET 
        sales_summary = $3,
        updated_at = NOW()
      WHERE tenant_id = $1
        AND (
          apollo_organization_id = $2
          OR id::text = $2
        )
      RETURNING 
        id,
        apollo_organization_id,
        name,
        sales_summary
    `;

    const result = await this.pool.query(updateQuery, [tenantId, companyId, salesSummary]);
    return result.rows[0] || null;
  }

  /**
   * Get company details by ID (for context)
   * 
   * @param {string} companyId - Company ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Company details
   */
  async getCompanyById(companyId, tenantId) {
    const query = `
      SELECT 
        id,
        apollo_organization_id,
        name,
        phone,
        sales_summary,
        company_data
      FROM company_search_cache
      WHERE tenant_id = $1
        AND (
          apollo_organization_id = $2
          OR id::text = $2
        )
      LIMIT 1
    `;

    const result = await this.pool.query(query, [tenantId, companyId]);
    return result.rows[0] || null;
  }

  /**
   * Get employee details by ID (for context)
   * 
   * @param {string} employeeId - Employee ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Employee details
   */
  async getEmployeeById(employeeId, tenantId) {
    const query = `
      SELECT 
        id,
        apollo_person_id,
        company_id,
        name,
        phone,
        sales_summary,
        employee_data
      FROM employees_cache
      WHERE tenant_id = $1
        AND (
          apollo_person_id = $2
          OR id::text = $2
        )
      LIMIT 1
    `;

    const result = await this.pool.query(query, [tenantId, employeeId]);
    return result.rows[0] || null;
  }

  /**
   * Batch resolve phones with minimal queries
   * Optimized for batch calling scenarios
   * 
   * @param {Array<Object>} entries - Array of {id, type} objects
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object>} Map of id -> resolved data
   */
  async batchResolvePhones(entries, tenantId) {
    const companyIds = entries.filter(e => e.type === 'company').map(e => e.id);
    const employeeIds = entries.filter(e => e.type === 'employee').map(e => e.id);

    const results = {};

    // Resolve companies
    if (companyIds.length > 0) {
      const companyData = await this._resolveCompanyPhones(companyIds, tenantId);
      companyData.forEach(data => {
        results[data.requested_id] = data;
      });
    }

    // Resolve employees
    if (employeeIds.length > 0) {
      const employeeData = await this._resolveEmployeePhones(employeeIds, tenantId);
      employeeData.forEach(data => {
        results[data.requested_id] = data;
      });
    }

    return results;
  }
}

module.exports = PhoneResolverModel;
