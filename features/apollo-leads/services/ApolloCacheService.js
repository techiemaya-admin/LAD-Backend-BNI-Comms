/**
 * Apollo Cache Service
 * Handles database cache operations for Apollo leads
 * LAD Architecture Compliant
 */

const { searchEmployeesFromApollo } = require('./ApolloApiService');
const { saveEmployeesToCache, formatApolloEmployees } = require('./ApolloCacheSaveService');
const { getSchema } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');
const ApolloEmployeesCacheRepository = require('../repositories/ApolloEmployeesCacheRepository');

/**
 * Filter out excluded IDs from employees list
 * @param {Array} employees - List of employees
 * @param {Array} excludeIds - List of IDs to exclude
 * @returns {Array} Filtered employees
 */
function filterExcludedEmployees(employees, excludeIds) {
  if (!excludeIds || excludeIds.length === 0) return employees;
  
  const excludeSet = new Set(excludeIds);
  return employees.filter(emp => {
    const empId = emp.id || emp.apollo_person_id;
    return empId && !excludeSet.has(empId);
  });
}

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
    page = 1,
    exclude_ids = []  // IDs to exclude (already used leads)
  } = searchParams;

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
    
    logger.debug('[Apollo Cache] Database connection established');
    
    const queryStartTime = Date.now();
    
    // LAD Architecture: Use repository for SQL operations
    const dbRows = await ApolloEmployeesCacheRepository.searchEmployees({
      person_titles,
      organization_locations,
      organization_industries,
      per_page: limitedPerPage,
      page,
      exclude_ids  // Pass exclude list to repository
    }, schema, tenantId);
    
    const queryDuration = Date.now() - queryStartTime;
    
    logger.info('[Apollo Cache] Query executed', {
      duration: `${queryDuration}ms`,
      resultsCount: dbRows.length,
      excludedCount: exclude_ids.length
    });
    
    let employees = [];
    
    // STEP 1: If database has ENOUGH results (>= requested), use them
    if (dbRows.length >= limitedPerPage) {
      logger.info('[Apollo Cache] Found sufficient employees in database cache', { count: dbRows.length, requested: limitedPerPage });
      employees = dbRows.map(row => {
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
      // STEP 2: If database has INSUFFICIENT results (< requested), call Apollo API
      // First, map any DB results we do have
      const dbEmployees = dbRows.map(row => {
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
      
      const neededFromApollo = limitedPerPage - dbEmployees.length;
      logger.info('[Apollo Cache] Database has insufficient employees, calling Apollo API', { 
        dbCount: dbEmployees.length, 
        requested: limitedPerPage, 
        neededFromApollo,
        tenantId: tenantId ? tenantId.substring(0, 8) + '...' : 'none'
      });
      
      try {
        const apolloResult = await searchEmployeesFromApollo({
          organization_locations: organization_locations,
          person_titles: person_titles,
          organization_industries: organization_industries,
          per_page: 100, // Always request 100 from Apollo
          page: page || 1
        }, tenantId);  // Pass tenantId for company search caching
        
        if (apolloResult && apolloResult.success && apolloResult.employees && apolloResult.employees.length > 0) {
          let apolloEmployees = apolloResult.employees;
          logger.info('[Apollo Cache] Found employees from Apollo API', { count: apolloEmployees.length });
          
          // Format Apollo employees
          let formattedApolloEmployees = formatApolloEmployees(apolloEmployees);
          
          // Filter out excluded IDs from Apollo results
          formattedApolloEmployees = filterExcludedEmployees(formattedApolloEmployees, exclude_ids);
          logger.info('[Apollo Cache] After filtering excluded IDs from Apollo', { count: formattedApolloEmployees.length });
          
          // STEP 3: Save Apollo results to database cache for future use
          // LAD Architecture: Pass req for tenant context
          try {
            await saveEmployeesToCache(formattedApolloEmployees, req);
            logger.info('[Apollo Cache] Saved employees to cache', { count: formattedApolloEmployees.length });
          } catch (saveError) {
            logger.error('[Apollo Cache] Error saving to cache', { error: saveError.message });
            // Continue - we still return the Apollo results even if cache save fails
          }
          
          // STEP 4: Combine DB employees with Apollo employees
          // Take what we need from Apollo to fill up to limitedPerPage
          const apolloToTake = formattedApolloEmployees.slice(0, neededFromApollo);
          employees = [...dbEmployees, ...apolloToTake].slice(0, limitedPerPage);
          
          logger.info('[Apollo Cache] Combined DB and Apollo results', {
            dbCount: dbEmployees.length,
            apolloCount: apolloToTake.length,
            totalCount: employees.length
          });
        } else {
          // No Apollo results, just use DB results
          employees = dbEmployees;
          logger.warn('[Apollo Cache] Apollo API returned no employees, using DB results only', {
            hasResult: !!apolloResult,
            hasSuccess: apolloResult?.success,
            hasEmployees: !!apolloResult?.employees,
            employeesLength: apolloResult?.employees?.length || 0,
            dbCount: dbEmployees.length
          });
        }
      } catch (apolloError) {
        // Apollo failed, just use DB results
        employees = dbEmployees;
        logger.error('[Apollo Cache] Error calling Apollo API, using DB results only', {
          message: apolloError.message,
          status: apolloError.response?.status,
          dbCount: dbEmployees.length
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
    
    throw error;
  }
}

module.exports = {
  searchEmployeesFromDb
};

