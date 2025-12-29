/**
 * Apollo Cache Save Service
 * Handles saving Apollo results to database cache
 * LAD Architecture Compliant
 */

/**
 * Apollo Cache Save Service
 * LAD Architecture Compliant - Business logic only, calls repository for SQL
 * 
 * Handles saving Apollo results to database cache.
 */

const { getSchema } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');
const ApolloEmployeesCacheRepository = require('../repositories/ApolloEmployeesCacheRepository');

/**
 * Save Apollo employees to database cache
 * LAD Architecture: Business logic only - delegates SQL to repository
 * @param {Array} employees - Array of employee objects
 * @param {Object} req - Express request object (for tenant context)
 */
async function saveEmployeesToCache(employees, req = null) {
  let savedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  
  try {
    // LAD Architecture: Require tenant context (throws error if missing in production)
    const { requireTenantId } = require('../../../core/utils/tenantHelper');
    const effectiveTenantId = requireTenantId(null, req, 'saveEmployeesToCache');
    
    // LAD Architecture: Get dynamic schema (no hardcoded lad_dev)
    const schema = getSchema(req);
    
    for (const emp of employees) {
      try {
        const apolloPersonId = String(emp.id || emp.person_id || '');
        if (!apolloPersonId || apolloPersonId === '') {
          logger.warn('[Apollo Cache Save] Skipping employee with no apollo_person_id', { name: emp.name });
          errorCount++;
          continue;
        }
        
        // LAD Architecture: Delegate SQL to repository
        const result = await ApolloEmployeesCacheRepository.upsertEmployee({
          apolloPersonId,
          name: emp.name || null,
          title: emp.title || null,
          email: emp.email || null,
          phone: emp.phone || null,
          linkedin_url: emp.linkedin_url || null,
          photo_url: emp.photo_url || null,
          headline: emp.headline || null,
          city: emp.city || null,
          state: emp.state || null,
          country: emp.country || null,
          company_id: emp.company_id || null,
          company_name: emp.company_name || null,
          company_domain: emp.company_domain || null,
          data_source: 'apollo_io',
          employee_data: emp.employee_data || emp || {}
        }, schema, effectiveTenantId);
        
        if (result.command === 'INSERT') {
          savedCount++;
        } else {
          updatedCount++;
        }
      } catch (saveError) {
        errorCount++;
        logger.warn('[Apollo Cache Save] Failed to save employee', {
          id: emp.id || emp.name,
          error: saveError.message
        });
        if (saveError.code === '23505') {
          // Unique constraint violation - this is okay, it means the record already exists
          logger.debug('[Apollo Cache Save] Record already exists, skipping');
        }
      }
    }
    
    logger.info('[Apollo Cache Save] Save operation completed', {
      saved: savedCount,
      updated: updatedCount,
      errors: errorCount,
      total: employees.length
    });
    
    return { savedCount, updatedCount, errorCount };
  } catch (saveError) {
    logger.error('[Apollo Cache Save] Error saving to cache', {
      message: saveError.message,
      stack: saveError.stack
    });
    throw saveError;
  }
}

/**
 * Format Apollo employees for database storage
 */
function formatApolloEmployees(apolloEmployees) {
  return apolloEmployees.map(emp => ({
    id: emp.id || emp.person_id,
    name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
    title: emp.title || emp.job_title,
    email: emp.email || emp.work_email,
    phone: emp.phone_number || emp.phone,
    linkedin_url: emp.linkedin_url || emp.linkedin,
    photo_url: emp.photo_url || emp.photo,
    headline: emp.headline || emp.job_title,
    city: emp.city,
    state: emp.state,
    country: emp.country,
    company_id: emp.organization?.id || emp.company_id,
    company_name: emp.organization?.name || emp.company_name,
    company_domain: emp.organization?.domain || emp.company_domain,
    company_linkedin_url: emp.organization?.linkedin_url || emp.organization?.linkedin,
    company_website_url: emp.organization?.website_url || emp.organization?.website,
    employee_data: emp
  }));
}

module.exports = {
  saveEmployeesToCache,
  formatApolloEmployees
};

