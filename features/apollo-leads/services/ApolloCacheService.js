/**
 * Apollo Cache Service
 * Handles database cache operations for Apollo leads
 * LAD Architecture Compliant
 */

const { pool } = require('../../../shared/database/connection');
const { searchEmployeesFromApollo } = require('./ApolloApiService');
const { saveEmployeesToCache, formatApolloEmployees } = require('./ApolloCacheSaveService');
const { getSchema } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');

/**
 * Search employees from database cache (employees_cache table)
 * Falls back to Apollo API if no results found in database
 * 
 * @param {Object} searchParams - Search parameters
 * @param {Object} req - Express request object (for tenant context and schema)
 * @returns {Promise<Object>} { success, employees, count }
 */
async function searchEmployeesFromDb(searchParams, req = null) {
  const {
    organization_locations = [],
    person_titles = [],
    organization_industries = [],
    per_page = 100,
    page = 1
  } = searchParams;

  let client;
  
  try {
    // LAD Architecture: Extract tenant context from request
    const tenantId = req?.user?.tenant_id || req?.tenant?.id || req?.headers?.['x-tenant-id'];
    if (!tenantId && process.env.NODE_ENV === 'production') {
      throw new Error('Tenant context required');
    }
    
    // LAD Architecture: Get dynamic schema (no hardcoded lad_dev)
    const schema = getSchema(req);
    
    logger.info('[Apollo Cache] Employee search request received', {
      tenantId: tenantId ? tenantId.substring(0, 8) + '...' : 'default',
      schema
    });
    
    // Ensure per_page is at least 1
    const limitedPerPage = Math.max(per_page, 1);
    
    logger.debug('[Apollo Cache] Search parameters', {
      person_titles,
      organization_locations,
      organization_industries,
      page,
      per_page: limitedPerPage
    });
    
    // Require at least one search criteria
    const hasPersonTitles = person_titles && person_titles.length > 0;
    const hasIndustries = organization_industries && organization_industries.length > 0;
    const hasLocations = organization_locations && organization_locations.length > 0;
    
    if (!hasPersonTitles && !hasIndustries && !hasLocations) {
      logger.warn('[Apollo Cache] No search criteria provided');
      throw new Error('At least one search criteria is required (person_titles, organization_industries, or organization_locations)');
    }
    
    // Get database connection
    client = await pool.connect();
    logger.debug('[Apollo Cache] Database connection established');
    
    // Build query to search employees_cache
    // LAD Architecture: Use dynamic schema and tenant scoping
    // NOTE: When using SELECT DISTINCT, ORDER BY columns must be in SELECT list (created_at is included)
    let dbQuery = `
      SELECT DISTINCT
        ec.apollo_person_id as id,
        ec.employee_name as name,
        ec.employee_title as title,
        ec.employee_email as email,
        ec.employee_phone as phone,
        ec.employee_linkedin_url as linkedin_url,
        ec.employee_photo_url as photo_url,
        ec.employee_headline as headline,
        ec.employee_city as city,
        ec.employee_state as state,
        ec.employee_country as country,
        ec.company_id,
        ec.company_name,
        ec.company_domain,
        ec.employee_data->'organization'->>'linkedin_url' as company_linkedin_url,
        ec.employee_data->'organization'->>'website_url' as company_website_url,
        ec.employee_data->'organization'->>'website' as company_website_url_alt,
        ec.created_at,
        ec.employee_data
      FROM ${schema}.employees_cache ec
      WHERE ec.is_deleted = false
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    // LAD Architecture: CRITICAL - Add tenant scoping to prevent data leakage
    if (tenantId) {
      dbQuery += ` AND ec.tenant_id = $${paramIndex}`;
      queryParams.push(tenantId);
      paramIndex++;
    }
    
    // Filter by job titles (case-insensitive, partial match)
    if (person_titles.length > 0) {
      const titleConditions = person_titles.map(title => {
        const titlePattern = `%${title.toLowerCase()}%`;
        queryParams.push(titlePattern);
        const titleParam = paramIndex++;
        queryParams.push(titlePattern);
        const dataTitleParam = paramIndex++;
        return `(LOWER(ec.employee_title) LIKE $${titleParam} OR LOWER(ec.employee_data->>'title') LIKE $${dataTitleParam})`;
      });
      dbQuery += ` AND (${titleConditions.join(' OR ')})`;
    }
    
    // Filter by organization locations
    if (organization_locations && organization_locations.length > 0) {
      const locationConditions = organization_locations.map(location => {
        queryParams.push(`%${location.toLowerCase()}%`);
        const cityParam = paramIndex++;
        queryParams.push(`%${location.toLowerCase()}%`);
        const stateParam = paramIndex++;
        queryParams.push(`%${location.toLowerCase()}%`);
        const countryParam = paramIndex++;
        queryParams.push(`%${location.toLowerCase()}%`);
        const orgLocationParam = paramIndex++;
        
        return `(
              LOWER(COALESCE(ec.employee_city, '')) LIKE $${cityParam}
              OR LOWER(COALESCE(ec.employee_state, '')) LIKE $${stateParam}
              OR LOWER(COALESCE(ec.employee_country, '')) LIKE $${countryParam}
              OR LOWER(COALESCE(ec.employee_data->'organization'->>'location', '')) LIKE $${orgLocationParam}
        )`;
      });
      dbQuery += ` AND (${locationConditions.join(' OR ')})`;
    }
    
    // Filter by industry/company keywords
    if (organization_industries && organization_industries.length > 0) {
      const industryConditions = organization_industries.map(industry => {
        const industryPattern = `%${industry.toLowerCase()}%`;
        
        queryParams.push(industryPattern);
        const orgIndustryParam = paramIndex++;
        queryParams.push(industryPattern);
        const companyNameParam = paramIndex++;
        queryParams.push(industryPattern);
        const orgNameParam = paramIndex++;
        queryParams.push(industryPattern);
        const orgKeywordsParam = paramIndex++;
        queryParams.push(industryPattern);
        const orgDescParam = paramIndex++;
        
        return `(
              LOWER(COALESCE(ec.employee_data->'organization'->>'industry', '')) LIKE $${orgIndustryParam}
              OR LOWER(ec.company_name) LIKE $${companyNameParam}
              OR LOWER(COALESCE(ec.employee_data->'organization'->>'name', '')) LIKE $${orgNameParam}
              OR LOWER(COALESCE(ec.employee_data->'organization'->>'keywords', '')) LIKE $${orgKeywordsParam}
              OR LOWER(COALESCE(ec.employee_data->'organization'->>'description', '')) LIKE $${orgDescParam}
            )`;
      });
      dbQuery += ` AND (${industryConditions.join(' OR ')})`;
    }
    
    // Add pagination
    const offset = (page - 1) * limitedPerPage;
    dbQuery += ` ORDER BY ec.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limitedPerPage);
    queryParams.push(offset);
    
    logger.debug('[Apollo Cache] Executing database query');
    const queryStartTime = Date.now();
    const dbResult = await client.query(dbQuery, queryParams);
    const queryDuration = Date.now() - queryStartTime;
    
    logger.info('[Apollo Cache] Query executed', {
      duration: `${queryDuration}ms`,
      resultsCount: dbResult.rows.length
    });
    
    let employees = [];
    
    // STEP 1: If database has results, use them
    if (dbResult.rows.length > 0) {
      logger.info('[Apollo Cache] Found employees in database cache', { count: dbResult.rows.length });
      employees = dbResult.rows.map(row => {
        let employeeData = {};
        try {
          employeeData = row.employee_data ? 
            (typeof row.employee_data === 'string' ? JSON.parse(row.employee_data) : row.employee_data) 
            : {};
        } catch (e) {
          logger.warn('[Apollo Cache] Error parsing employee_data', { error: e.message });
        }
        
        return {
          id: row.id,
          name: row.name,
          title: row.title,
          email: row.email,
          phone: row.phone,
          linkedin_url: row.linkedin_url,
          photo_url: row.photo_url,
          headline: row.headline,
          city: row.city,
          state: row.state,
          country: row.country,
          company_id: row.company_id,
          company_name: row.company_name,
          company_domain: row.company_domain,
          company_linkedin_url: row.company_linkedin_url,
          company_website_url: row.company_website_url || row.company_website_url_alt,
          organization: employeeData.organization || {},
          employee_data: employeeData
        };
      });
    } else {
      // STEP 2: If database has 0 results, call Apollo API
      logger.info('[Apollo Cache] No employees found in database cache, calling Apollo API');
      
      client.release();
      
      try {
        const apolloResult = await searchEmployeesFromApollo({
          organization_locations: organization_locations,
          person_titles: person_titles,
          organization_industries: organization_industries,
          per_page: 100, // Always request 100 from Apollo
          page: page || 1
        });
        
        if (apolloResult && apolloResult.success && apolloResult.employees && apolloResult.employees.length > 0) {
          const apolloEmployees = apolloResult.employees;
          logger.info('[Apollo Cache] Found employees from Apollo API', { count: apolloEmployees.length });
          
          // Format Apollo employees
          employees = formatApolloEmployees(apolloEmployees);
          
          // STEP 3: Save Apollo results to database cache for future use
          // LAD Architecture: Pass req for tenant context
          try {
            await saveEmployeesToCache(employees, req);
            logger.info('[Apollo Cache] Saved employees to cache', { count: employees.length });
          } catch (saveError) {
            logger.error('[Apollo Cache] Error saving to cache', { error: saveError.message });
            // Continue - we still return the Apollo results even if cache save fails
          }
          
          // Limit response to requested per_page (we saved all 100 to DB, but return only what was requested)
          if (employees.length > limitedPerPage) {
            logger.debug('[Apollo Cache] Limiting response', {
              requested: limitedPerPage,
              total: employees.length
            });
            employees = employees.slice(0, limitedPerPage);
          }
        } else {
          logger.warn('[Apollo Cache] Apollo API returned no employees or invalid response', {
            hasResult: !!apolloResult,
            hasSuccess: apolloResult?.success,
            hasEmployees: !!apolloResult?.employees,
            employeesLength: apolloResult?.employees?.length || 0
          });
        }
      } catch (apolloError) {
        logger.error('[Apollo Cache] Error calling Apollo API', {
          message: apolloError.message,
          status: apolloError.response?.status,
          stack: apolloError.stack
        });
        // Continue - return empty array if Apollo fails
      }
    }
    
    logger.info('[Apollo Cache] Returning employees', { count: employees.length });
    
    return {
      success: true,
      employees: employees,
      count: employees.length
    };
    
  } catch (error) {
    logger.error('[Apollo Cache] Error in searchEmployeesFromDb', {
      message: error.message,
      stack: error.stack
    });
    
    if (client) {
      client.release();
    }
    
    throw error;
  }
}

module.exports = {
  searchEmployeesFromDb
};

