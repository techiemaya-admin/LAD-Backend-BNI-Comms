/**
 * Apollo Reveal Service
 * LAD Architecture Compliant - Email and phone reveal operations
 * 
 * Handles revealing emails and phone numbers with proper tenant scoping and caching.
 */

const axios = require('axios');
const { getSchema } = require('../../../core/utils/schemaHelper');
const { requireTenantId } = require('../../../core/utils/tenantHelper');
const { APOLLO_CONFIG, CACHE_CONFIG, CREDIT_COSTS } = require('../../../core/config/constants');
const { pool } = require('../../../shared/database/connection');
const logger = require('../../../core/utils/logger');

class ApolloRevealService {
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  /**
   * Check if email is fake/placeholder
   * @private
   */
  _isFakeEmail(email) {
    if (!email) return true;
    const emailLower = email.toLowerCase();
    return CACHE_CONFIG.FAKE_EMAIL_PATTERNS.some(pattern => emailLower.includes(pattern));
  }

  /**
   * Reveal email - checks database cache first, then calls Apollo API
   * LAD Architecture: Uses tenant scoping and dynamic schema
   */
  async revealEmail(personId, employeeName = null, req = null) {
    let client;
    
    try {
      const tenantId = requireTenantId(null, req, 'revealEmail');
      const schema = getSchema(req);
      
      // STEP 1: Check employees_cache table first (0 credits)
      if (personId || employeeName) {
        try {
          client = await pool.connect();
          
          let cacheQuery;
          let queryParams;
          
          if (personId) {
            cacheQuery = `
              SELECT employee_email, employee_name
              FROM ${schema}.employees_cache
              WHERE apollo_person_id = $1 AND tenant_id = $2
                AND employee_email IS NOT NULL AND employee_email != ''
              LIMIT 1
            `;
            queryParams = [String(personId), tenantId];
          } else if (employeeName) {
            cacheQuery = `
              SELECT employee_email, employee_name
              FROM ${schema}.employees_cache
              WHERE employee_name = $1 AND tenant_id = $2
                AND employee_email IS NOT NULL AND employee_email != ''
              LIMIT 1
            `;
            queryParams = [employeeName, tenantId];
          }
          
          if (cacheQuery) {
            const cacheResult = await client.query(cacheQuery, queryParams);
            
            if (cacheResult.rows.length > 0) {
              const cachedEmail = cacheResult.rows[0].employee_email;
              
              if (!this._isFakeEmail(cachedEmail)) {
                logger.info('[Apollo Reveal] Real email found in cache', { from_cache: true, credits_used: 0 });
                client.release();
                return { email: cachedEmail, from_cache: true, credits_used: 0 };
              }
            }
          }
          
          client.release();
          client = null;
        } catch (dbError) {
          logger.warn('[Apollo Reveal] Cache check error', { error: dbError.message });
          if (client) client.release();
        }
      }
      
      // STEP 2: Call Apollo API to reveal email (1 credit)
      if (!personId) {
        throw new Error('Apollo person ID is required to reveal email');
      }
      if (!this.apiKey) {
        throw new Error('Apollo API key not configured');
      }
      
      logger.info('[Apollo Reveal] Calling Apollo API to reveal email', { personId });
      const apolloEndpoint = `${this.baseURL}${APOLLO_CONFIG.ENDPOINTS.PEOPLE_BULK_MATCH}`;
      
      const response = await axios.post(apolloEndpoint, {
        details: [{ id: personId }],
        reveal_personal_emails: true,
        reveal_phone_number: false
      }, {
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.apiKey }
      });

      const person = response.data?.matches?.[0];
      const email = person?.email;
      
      if (!email || this._isFakeEmail(email)) {
        logger.warn('[Apollo Reveal] Apollo returned fake/placeholder email or no email');
        return { email: null, from_cache: false, credits_used: CREDIT_COSTS.EMAIL_REVEAL, error: 'Real email not available for this person' };
      }
      
      logger.info('[Apollo Reveal] Email revealed successfully from Apollo', { credits_used: CREDIT_COSTS.EMAIL_REVEAL });
      
      // STEP 3: Update cache with real email
      // Note: personId is guaranteed to be truthy here (validated at line 93-95)
      try {
        if (!client) client = await pool.connect();
        
        await client.query(`
            UPDATE ${schema}.employees_cache
            SET employee_email = $1, updated_at = NOW()
            WHERE apollo_person_id = $2 AND tenant_id = $3
          `, [email, String(personId), tenantId]);
        
        logger.debug('[Apollo Reveal] Real email saved to employees_cache');
        client.release();
        client = null;
      } catch (cacheError) {
        logger.warn('[Apollo Reveal] Error caching email', { error: cacheError.message });
        if (client) client.release();
      }
      
      return { email, from_cache: false, credits_used: CREDIT_COSTS.EMAIL_REVEAL };
    } catch (error) {
      logger.error('[Apollo Reveal] Reveal email error', { error: error.message, stack: error.stack });
      if (client) client.release();
      
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        if (status === 404) {
          throw new Error(`Person ID not found in Apollo database. The person ID "${personId}" may be invalid or no longer exists.`);
        } else if (status === 401) {
          throw new Error('Invalid Apollo API key. Please check your APOLLO_API_KEY configuration.');
        } else if (status === 403) {
          throw new Error('Access forbidden. Your Apollo plan may not include email reveals.');
        } else if (status === 429) {
          throw new Error('Apollo API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`Apollo API error (${status}): ${errorData?.message || error.message}`);
        }
      }
      
      throw new Error(`Email reveal failed: ${error.message}`);
    }
  }

  /**
   * Reveal phone - checks database cache first, then calls Apollo API
   * LAD Architecture: Uses tenant scoping and dynamic schema
   */
  async revealPhone(personId, employeeName = null, req = null) {
    let client;
    
    try {
      const tenantId = requireTenantId(null, req, 'revealPhone');
      const schema = getSchema(req);
      
      // STEP 1: Check employees_cache table first (0 credits)
      if (personId || employeeName) {
        try {
          client = await pool.connect();
          
          let cacheQuery;
          let queryParams;
          
          if (personId) {
            cacheQuery = `
              SELECT employee_phone, employee_name
              FROM ${schema}.employees_cache
              WHERE apollo_person_id = $1 AND tenant_id = $2
                AND employee_phone IS NOT NULL AND employee_phone != ''
              LIMIT 1
            `;
            queryParams = [String(personId), tenantId];
          } else if (employeeName) {
            cacheQuery = `
              SELECT employee_phone, employee_name
              FROM ${schema}.employees_cache
              WHERE employee_name = $1 AND tenant_id = $2
                AND employee_phone IS NOT NULL AND employee_phone != ''
              LIMIT 1
            `;
            queryParams = [employeeName, tenantId];
          }
          
          if (cacheQuery) {
            const cacheResult = await client.query(cacheQuery, queryParams);
            
            if (cacheResult.rows.length > 0) {
              const cachedPhone = cacheResult.rows[0].employee_phone;
              logger.info('[Apollo Reveal] Phone found in cache', { from_cache: true, credits_used: 0 });
              client.release();
              return { phone: cachedPhone, from_cache: true, credits_used: 0 };
            }
          }
          
          client.release();
          client = null;
        } catch (dbError) {
          logger.warn('[Apollo Reveal] Cache check error', { error: dbError.message });
          if (client) client.release();
        }
      }
      
      // STEP 2: Call Apollo API to reveal phone (8 credits)
      if (!personId) {
        throw new Error('Apollo person ID is required to reveal phone');
      }
      if (!this.apiKey) {
        throw new Error('Apollo API key not configured');
      }
      
      logger.info('[Apollo Reveal] Calling Apollo API to reveal phone', { personId });
      const apolloEndpoint = `${this.baseURL}${APOLLO_CONFIG.ENDPOINTS.PEOPLE_BULK_MATCH}`;
      
      const webhookUrl = process.env.APOLLO_WEBHOOK_URL || process.env.CLOUD_RUN_WEBHOOK_URL;
      const requestBody = {
        details: [{ id: personId }],
        reveal_personal_emails: false,
        reveal_phone_number: true
      };
      
      if (webhookUrl) {
        requestBody.webhook_url = webhookUrl;
      }
      
      const response = await axios.post(apolloEndpoint, requestBody, {
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.apiKey }
      });

      const person = response.data?.matches?.[0];
      const phone = person?.phone_numbers?.[0]?.raw_number || null;
      
      if (webhookUrl) {
        logger.info('[Apollo Reveal] Phone reveal request accepted, will be delivered via webhook', { credits_used: CREDIT_COSTS.PHONE_REVEAL });
        return {
          phone: null,
          from_cache: false,
          credits_used: CREDIT_COSTS.PHONE_REVEAL,
          processing: true,
          message: 'Phone reveal request sent. Apollo will deliver the phone number via webhook in 2-5 minutes.'
        };
      }
      
      if (!phone) {
        logger.warn('[Apollo Reveal] Apollo returned no phone number and no webhook configured');
        return {
          phone: null,
          from_cache: false,
          credits_used: CREDIT_COSTS.PHONE_REVEAL,
          error: 'Phone number not available. Phone reveals require a webhook URL for asynchronous delivery.'
        };
      }
      
      logger.info('[Apollo Reveal] Phone revealed successfully from Apollo (immediate response)', { credits_used: CREDIT_COSTS.PHONE_REVEAL });
      
      // STEP 3: Update cache with real phone
      // Note: personId is guaranteed to be truthy here (validated at line 224-226)
      try {
        if (!client) client = await pool.connect();
        
        await client.query(`
            UPDATE ${schema}.employees_cache
            SET employee_phone = $1, updated_at = NOW()
            WHERE apollo_person_id = $2 AND tenant_id = $3
          `, [phone, String(personId), tenantId]);
        
        logger.debug('[Apollo Reveal] Real phone saved to employees_cache');
        client.release();
        client = null;
      } catch (cacheError) {
        logger.warn('[Apollo Reveal] Error caching phone', { error: cacheError.message });
        if (client) client.release();
      }
      
      return { phone, from_cache: false, credits_used: CREDIT_COSTS.PHONE_REVEAL };
    } catch (error) {
      logger.error('[Apollo Reveal] Reveal phone error', { error: error.message, stack: error.stack });
      if (client) client.release();
      
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        if (status === 404) {
          throw new Error(`Person ID not found in Apollo database. The person ID "${personId}" may be invalid or no longer exists.`);
        } else if (status === 401) {
          throw new Error('Invalid Apollo API key. Please check your APOLLO_API_KEY configuration.');
        } else if (status === 403) {
          throw new Error('Access forbidden. Your Apollo plan may not include phone reveals.');
        } else if (status === 429) {
          throw new Error('Apollo API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`Apollo API error (${status}): ${errorData?.message || error.message}`);
        }
      }
      
      throw new Error(`Phone reveal failed: ${error.message}`);
    }
  }
}

module.exports = ApolloRevealService;

