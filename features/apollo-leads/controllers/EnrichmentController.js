/**
 * Apollo Enrichment Controller
 * LAD Architecture: Handles on-demand enrichment of leads
 * 
 * Enriches leads with email and LinkedIn URL when user interacts with them
 */

const logger = require('../../../core/utils/logger');
const { getSchema } = require('../../../core/utils/schemaHelper');
const { requireTenantId } = require('../../../core/utils/tenantHelper');
const ApolloRevealService = require('../services/ApolloRevealService');
const CampaignLeadRepository = require('../../campaigns/repositories/CampaignLeadRepository');
const { pool } = require('../../../shared/database/connection');

class EnrichmentController {
  /**
   * Enrich a single lead with email and LinkedIn URL
   * Called when user clicks on email unlock or LinkedIn URL
   * 
   * POST /api/apollo/enrichment/lead/:leadId
   * Body: { personId, name }
   */
  async enrichLead(req, res) {
    try {
      const { leadId } = req.params;
      let { personId, name } = req.body;
      const tenantId = requireTenantId(null, req, 'enrichLead');
      const schema = getSchema(req);

      // If personId not provided, fetch from campaign_lead's lead_data JSONB
      if (!personId) {
        logger.info('[Enrichment] Fetching apollo_person_id from campaign_lead', { leadId });
        
        const query = `
          SELECT 
            lead_data->>'apollo_person_id' as apollo_person_id,
            lead_data->>'name' as name,
            email,
            company_name
          FROM ${schema}.campaign_leads
          WHERE id = $1 AND tenant_id = $2
        `;
        
        const result = await pool.query(query, [leadId, tenantId]);
        
        if (result.rows.length === 0) {
          logger.warn('[Enrichment] Campaign lead not found', { leadId, tenantId: tenantId.substring(0, 8) + '...' });
          return res.status(404).json({ error: 'Lead not found' });
        }

        const leadData = result.rows[0];
        personId = leadData.apollo_person_id;
        name = name || leadData.name;

        if (!personId) {
          logger.warn('[Enrichment] Lead has no apollo_person_id', { leadId, name });
          return res.status(400).json({ error: 'Lead does not have apollo_person_id for enrichment' });
        }

        logger.info('[Enrichment] Retrieved apollo_person_id from lead', {
          leadId,
          personId,
          name: name ? name.substring(0, 20) : 'Unknown'
        });
      }

      logger.info('[Enrichment] Lead enrichment requested', {
        leadId,
        personId,
        name,
        tenantId: tenantId.substring(0, 8) + '...'
      });

      // Create reveal service
      const apiKey = process.env.APOLLO_API_KEY;
      if (!apiKey) {
        logger.error('[Enrichment] Apollo API key not configured');
        return res.status(500).json({ error: 'Apollo API not configured' });
      }

      const revealService = new ApolloRevealService(apiKey, 'https://api.apollo.io/v1');

      // Call enrichment API
      const enrichResult = await revealService.revealEmail(personId, name, req, tenantId);

      // Validate enrichResult to check proper email and linkedin url is returned
      // Don't save data if email is not valid or linkedin url is not valid
      // Return error message in response if data is not valid
      const isEnrichedDataValid = validateEnrichedData(enrichResult);

      if (!isEnrichedDataValid) {
        logger.warn('[Enrichment] Enriched data validation failed', {
          leadId,
          personId,
          hasEmail: !!enrichResult.email,
          hasLinkedIn: !!enrichResult.linkedin_url
        });
        return res.status(400).json({ 
          error: 'Enrichment failed to retrieve valid email or LinkedIn URL. Please try again.',
          details: {
            hasEmail: !!enrichResult.email,
            hasLinkedIn: !!enrichResult.linkedin_url
          }
        });
      }

      if (enrichResult.email) {
        logger.info('[Enrichment] Lead enriched successfully', {
          leadId,
          personId,
          hasEmail: !!enrichResult.email,
          hasLinkedIn: !!enrichResult.linkedin_url,
          creditsUsed: enrichResult.credits_used
        });

        // Save enriched data to database
        try {
          await CampaignLeadRepository.updateEnrichedData(
            leadId,
            enrichResult.email,
            enrichResult.linkedin_url,
            tenantId,
            schema
          );

          logger.info('[Enrichment] Enriched data saved to database', {
            leadId,
            hasEmail: !!enrichResult.email,
            hasLinkedIn: !!enrichResult.linkedin_url
          });
        } catch (saveError) {
          logger.error('[Enrichment] Failed to save enriched data to database', {
            leadId,
            error: saveError.message
          });
          // Don't fail the response - enrichment API succeeded even if DB save fails
        }

        return res.json({
          success: true,
          data: {
            email: enrichResult.email,
            linkedin_url: enrichResult.linkedin_url,
            from_cache: enrichResult.from_cache,
            credits_used: enrichResult.credits_used
          }
        });
      } else {
        logger.warn('[Enrichment] Enrichment returned no email', {
          leadId,
          personId,
          error: enrichResult.error
        });

        return res.status(200).json({
          success: false,
          error: enrichResult.error || 'Unable to retrieve email for this person'
        });
      }
    } catch (error) {
      logger.error('[Enrichment] Error enriching lead', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        error: 'Failed to enrich lead',
        message: error.message
      });
    }
  }

  /**
   * Enrich multiple leads in batch
   * Called for batch enrichment of visible leads
   * 
   * POST /api/apollo/enrichment/batch
   * Body: { leads: [{ leadId, personId, name }, ...] }
   */
  async enrichLeadsBatch(req, res) {
    try {
      const { leads } = req.body;
      const tenantId = requireTenantId(null, req, 'enrichLeadsBatch');
      const schema = getSchema(req);

      if (!leads || !Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: 'leads array is required' });
      }

      logger.info('[Enrichment] Batch enrichment requested', {
        leadsCount: leads.length,
        tenantId: tenantId.substring(0, 8) + '...'
      });

      // Create reveal service
      const apiKey = process.env.APOLLO_API_KEY;
      if (!apiKey) {
        logger.error('[Enrichment] Apollo API key not configured');
        return res.status(500).json({ error: 'Apollo API not configured' });
      }

      const revealService = new ApolloRevealService(apiKey, 'https://api.apollo.io/v1');

      const results = [];
      const enrichmentDelayMs = parseInt(process.env.APOLLO_ENRICHMENT_DELAY_MS || '200', 10);

      for (const lead of leads) {
        try {
          let { leadId, personId, name } = lead;

          // If personId not provided, fetch from campaign_lead's lead_data JSONB
          if (!personId) {
            const query = `
              SELECT 
                lead_data->>'apollo_person_id' as apollo_person_id,
                lead_data->>'name' as name
              FROM ${schema}.campaign_leads
              WHERE id = $1 AND tenant_id = $2
            `;
            
            const result = await pool.query(query, [leadId, tenantId]);
            
            if (result.rows.length === 0) {
              results.push({
                leadId,
                success: false,
                error: 'Lead not found'
              });
              continue;
            }

            const leadData = result.rows[0];
            personId = leadData.apollo_person_id;
            name = name || leadData.name;

            if (!personId) {
              results.push({
                leadId,
                success: false,
                error: 'Lead does not have apollo_person_id'
              });
              continue;
            }
          }

          // Call enrichment API
          const enrichResult = await revealService.revealEmail(personId, name, req, tenantId);

          if (enrichResult.email) {
            // Save enriched data to database
            try {
              await CampaignLeadRepository.updateEnrichedData(
                leadId,
                enrichResult.email,
                enrichResult.linkedin_url,
                tenantId,
                schema
              );
            } catch (saveError) {
              logger.error('[Enrichment] Failed to save enriched data for lead in batch', {
                leadId,
                error: saveError.message
              });
              // Continue processing - don't fail entire batch
            }

            results.push({
              leadId,
              success: true,
              email: enrichResult.email,
              linkedin_url: enrichResult.linkedin_url,
              from_cache: enrichResult.from_cache,
              credits_used: enrichResult.credits_used
            });
          } else {
            results.push({
              leadId,
              success: false,
              error: enrichResult.error || 'No email available'
            });
          }

          // Rate limiting
          if (results.length < leads.length) {
            await new Promise(resolve => setTimeout(resolve, enrichmentDelayMs));
          }
        } catch (leadError) {
          results.push({
            leadId: lead.leadId,
            success: false,
            error: leadError.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info('[Enrichment] Batch enrichment completed', {
        totalRequested: leads.length,
        successCount,
        failureCount
      });

      return res.json({
        success: true,
        data: {
          total: results.length,
          succeeded: successCount,
          failed: failureCount,
          results
        }
      });
    } catch (error) {
      logger.error('[Enrichment] Error in batch enrichment', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        error: 'Failed to perform batch enrichment',
        message: error.message
      });
    }
  }
}

/**
 * Validate enriched data - check if email and linkedin url are present
 * @param {Object} enrichResult - Enriched data from Apollo API
 * @returns {boolean} - True if both email and linkedin_url are valid
 */
function validateEnrichedData(enrichResult) {
  if (!enrichResult) {
    return false;
  }

  const hasEmail = enrichResult.email && typeof enrichResult.email === 'string' && enrichResult.email.trim() !== '';
  const hasLinkedIn = enrichResult.linkedin_url && typeof enrichResult.linkedin_url === 'string' && enrichResult.linkedin_url.includes('linkedin.com');

  return hasEmail && hasLinkedIn;
}

/**
 * Validate email format and MX records
 * @param {string} email - Email address to validate
 * @returns {Promise<boolean>} - True if email is valid
 */
async function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    logger.debug('[validateEmail] Email failed format validation', { email });
    return false;
  }

  try {
    // Check if email domain has MX records
    const { resolve } = require('dns').promises;
    const domain = email.split('@')[1];
    
    try {
      const mxRecords = await resolve(domain, 'MX');
      if (mxRecords && mxRecords.length > 0) {
        logger.debug('[validateEmail] Email passed MX record validation', { email, domain });
        return true;
      }
    } catch (mxErr) {
      logger.debug('[validateEmail] MX record check failed', { email, domain, error: mxErr.message });
      // If MX check fails but format is valid, still consider it valid
      return true;
    }

    return true;
  } catch (err) {
    logger.debug('[validateEmail] Email validation error', { 
      email, 
      error: err.message 
    });
    // Fall back to format validation only if checks fail
    return emailRegex.test(email);
  }
}

/**
 * Validate LinkedIn URL by checking if it's accessible
 * @param {string} linkedinUrl - LinkedIn URL to validate
 * @returns {Promise<boolean>} - True if URL is valid and accessible
 */
async function validateLinkedInUrl(linkedinUrl) {
  if (!linkedinUrl || typeof linkedinUrl !== 'string') {
    return false;
  }

  try {
    // Normalize URL
    let url = linkedinUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Check if it's a LinkedIn URL
    if (!url.includes('linkedin.com')) {
      logger.debug('[validateLinkedInUrl] Invalid LinkedIn URL', { url });
      return false;
    }

    // Use axios to validate URL accessibility (with timeout)
    const axios = require('axios');
    
    try {
      const response = await axios.head(url, {
        timeout: 10000, // 10 second timeout
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        validateStatus: function (status) {
          // Accept 2xx, 3xx, and some 4xx status codes (LinkedIn might redirect or require auth)
          return status >= 200 && status < 500;
        }
      });

      if (response.status >= 200 && response.status < 400) {
        logger.debug('[validateLinkedInUrl] LinkedIn URL is valid', { url, status: response.status });
        return true;
      }

      // 403 Forbidden is acceptable for LinkedIn (might require auth)
      if (response.status === 403) {
        logger.debug('[validateLinkedInUrl] LinkedIn URL returned 403 (likely requires auth)', { url });
        return true;
      }

      logger.debug('[validateLinkedInUrl] LinkedIn URL returned error status', { 
        url, 
        status: response.status 
      });
      return false;
    } catch (axiosErr) {
      if (axiosErr.code === 'ENOTFOUND') {
        logger.debug('[validateLinkedInUrl] URL domain not found', { url });
        return false;
      }
      
      if (axiosErr.code === 'ETIMEDOUT' || axiosErr.code === 'ECONNABORTED') {
        logger.debug('[validateLinkedInUrl] URL check timed out', { url });
        // If timeout but LinkedIn domain is correct, consider it valid
        return url.includes('linkedin.com');
      }

      logger.debug('[validateLinkedInUrl] URL validation error', { 
        url, 
        error: axiosErr.message 
      });
      // If network check fails but URL format is valid, consider it valid
      return url.includes('linkedin.com');
    }
  } catch (err) {
    logger.debug('[validateLinkedInUrl] LinkedIn URL validation error', { 
      url: linkedinUrl, 
      error: err.message 
    });
    // Fall back to format check
    return linkedinUrl.includes('linkedin.com');
  }
}

/**
 * Validate employees array - verify email and LinkedIn URL
 * @param {Array} employees - Array of employee objects
 * @returns {Promise<Array>} - Array of valid employees with validation flags
 */
async function validateEmployees(employees) {
  if (!Array.isArray(employees) || employees.length === 0) {
    logger.warn('[validateEmployees] Empty or invalid employees array');
    return [];
  }

  const validEmployees = [];
  const invalidEmployees = [];

  logger.info('[validateEmployees] Starting employee validation', {
    totalcount: employees.length
  });

  for (const employee of employees) {
    let isEmailValid = false;
    let isLinkedInValid = false;
    const employeeName = employee.name || employee.employee_name || 'Unknown';

    try {
      // Extract email
      const email = employee.email || employee.work_email;
      
      // Validate email
      if (email) {
        isEmailValid = await validateEmail(email);
        logger.debug('[validateEmployees] Email validation result', {
          name: employeeName,
          email,
          isValid: isEmailValid
        });
      }

      // Extract LinkedIn URL
      let linkedinUrl = employee.linkedin_url || employee.linkedin || employee.profile_url || employee.public_profile_url;
      if (!linkedinUrl && employee.employee_data) {
        const employeeDataObj = typeof employee.employee_data === 'string' 
          ? JSON.parse(employee.employee_data) 
          : employee.employee_data;
        linkedinUrl = employeeDataObj.linkedin_url || employeeDataObj.linkedin || employeeDataObj.profile_url;
      }

      // Validate LinkedIn URL
      if (linkedinUrl) {
        isLinkedInValid = await validateLinkedInUrl(linkedinUrl);
        logger.debug('[validateEmployees] LinkedIn URL validation result', {
          name: employeeName,
          url: linkedinUrl,
          isValid: isLinkedInValid
        });
      }

      // Employee is valid if at least one of email or LinkedIn is valid
      if (isEmailValid || isLinkedInValid) {
        // Add validation flags to employee object for tracking
        employee._isEmailValid = isEmailValid;
        employee._isLinkedInValid = isLinkedInValid;
        validEmployees.push(employee);
        
        logger.info('[validateEmployees] Employee passed validation', {
          name: employeeName,
          email: email || 'N/A',
          linkedinUrl: linkedinUrl || 'N/A',
          emailValid: isEmailValid,
          linkedinValid: isLinkedInValid
        });
      } else {
        invalidEmployees.push({
          name: employeeName,
          email: email || 'N/A',
          linkedinUrl: linkedinUrl || 'N/A',
          reason: 'Both email and LinkedIn URL validation failed'
        });
        
        logger.warn('[validateEmployees] Employee failed validation', {
          name: employeeName,
          email: email || 'N/A',
          linkedinUrl: linkedinUrl || 'N/A',
          reason: 'No valid email or LinkedIn URL'
        });
      }
    } catch (err) {
      invalidEmployees.push({
        name: employeeName,
        reason: err.message
      });
      
      logger.error('[validateEmployees] Employee validation error', {
        name: employeeName,
        error: err.message,
        stack: err.stack
      });
    }
  }

  logger.info('[validateEmployees] Validation complete', {
    totalEmployees: employees.length,
    validEmployees: validEmployees.length,
    invalidEmployees: invalidEmployees.length,
    validationRate: validEmployees.length > 0 ? ((validEmployees.length / employees.length) * 100).toFixed(2) + '%' : '0%'
  });

  if (invalidEmployees.length > 0) {
    logger.warn('[validateEmployees] Invalid employees summary', {
      count: invalidEmployees.length,
      employees: invalidEmployees.slice(0, 20)  // Show first 20 for debugging
    });
  }

  return validEmployees;
}

module.exports = new EnrichmentController();
