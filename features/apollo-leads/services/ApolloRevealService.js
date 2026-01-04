/**
 * Apollo Reveal Service
 * LAD Architecture Compliant - Email and phone reveal operations
 * 
 * Handles revealing emails and phone numbers with proper tenant scoping and caching.
 */

const axios = require('axios');
const { getSchema } = require('../../../core/utils/schemaHelper');
const { requireTenantId } = require('../../../core/utils/tenantHelper');
const { APOLLO_CONFIG, CACHE_CONFIG, CREDIT_COSTS } = require('../constants/constants');
const logger = require('../../../core/utils/logger');
const ApolloEmployeesCacheRepository = require('../repositories/ApolloEmployeesCacheRepository');

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
   * LAD Architecture: Uses tenant scoping and delegates SQL to repository
   */
  async revealEmail(personId, employeeName = null, req = null) {
    try {
      const tenantId = requireTenantId(null, req, 'revealEmail');
      const schema = getSchema(req);
      
      // STEP 1: Check employees_cache table first (0 credits)
      if (personId || employeeName) {
        let cachedEmployee;
        
        try {
          if (personId) {
            // LAD Architecture: Use repository for SQL operations
            cachedEmployee = await ApolloEmployeesCacheRepository.findByPersonId(personId, tenantId, schema);
          } else if (employeeName) {
            // LAD Architecture: Use repository for SQL operations
            cachedEmployee = await ApolloEmployeesCacheRepository.findByName(employeeName, tenantId, schema);
          }
          
          if (cachedEmployee?.employee_email && !this._isFakeEmail(cachedEmployee.employee_email)) {
            const cachedEmail = cachedEmployee.employee_email;
            logger.info('[Apollo Reveal] Real email found in cache', { from_cache: true, credits_used: 0 });
            
            return { email: cachedEmail, from_cache: true, credits_used: 0 };
          }
        } catch (cacheError) {
          logger.warn('[Apollo Reveal] Error checking cache', { error: cacheError.message });
        }
      }
      
      // STEP 2: If no cached email, call Apollo API (1 credit)
      if (!this.apiKey) {
        throw new Error('Apollo API key is not configured');
      }
      
      // Apollo API v1 endpoint for email reveal - using people/match with reveal flag
      const apolloUrl = `${this.baseURL || APOLLO_CONFIG.DEFAULT_BASE_URL}/people/match`;
      
      if (!personId) {
        return { email: null, from_cache: false, credits_used: 0, error: 'Person ID is required for email reveal' };
      }
      
      const apolloRequest = {
        id: personId,
        reveal_personal_emails: true
      };
      
      logger.debug('[Apollo Reveal] Email reveal request', { 
        url: apolloUrl, 
        body: apolloRequest,
        personId 
      });
      
      const apolloResponse = await axios.post(apolloUrl, apolloRequest, {
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      const person = apolloResponse.data?.person;
      const email = person?.email || apolloResponse.data?.email;
      if (!email || this._isFakeEmail(email)) {
        logger.warn('[Apollo Reveal] Real email not available from Apollo API');
        return { email: null, from_cache: false, credits_used: CREDIT_COSTS.EMAIL_REVEAL, error: 'Real email not available for this person' };
      }
      
      logger.info('[Apollo Reveal] Email revealed successfully from Apollo', { credits_used: CREDIT_COSTS.EMAIL_REVEAL });
      
      // STEP 3: Update cache with real email
      try {
        // LAD Architecture: Use repository for SQL operations
        await ApolloEmployeesCacheRepository.updateEmail(personId, email, tenantId, schema);
        logger.debug('[Apollo Reveal] Real email saved to employees_cache');
      } catch (cacheError) {
        logger.warn('[Apollo Reveal] Error caching email', { error: cacheError.message });
      }
      
      return { email, from_cache: false, credits_used: CREDIT_COSTS.EMAIL_REVEAL };
    } catch (error) {
      logger.error('[Apollo Reveal] Reveal email error', { 
        error: error.message, 
        stack: error.stack,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data
      });
      
      // Only charge credits if it was a server error, not a client error
      const creditsUsed = error.response?.status >= 500 ? CREDIT_COSTS.EMAIL_REVEAL : 0;
      
      return { 
        email: null, 
        from_cache: false, 
        credits_used: creditsUsed, 
        error: `${error.message}${error.response?.data ? ` - ${JSON.stringify(error.response.data)}` : ''}` 
      };
    }
  }

  /**
   * Reveal phone - checks database cache first, then calls Apollo API
   * LAD Architecture: Uses tenant scoping and delegates SQL to repository
   */
  async revealPhone(personId, employeeName = null, req = null) {
    try {
      const tenantId = requireTenantId(null, req, 'revealPhone');
      const schema = getSchema(req);
      
      // STEP 1: Check employees_cache table first (0 credits)
      if (personId || employeeName) {
        let cachedEmployee;
        
        try {
          if (personId) {
            // LAD Architecture: Use repository for SQL operations
            cachedEmployee = await ApolloEmployeesCacheRepository.findByPersonId(personId, tenantId, schema);
          } else if (employeeName) {
            // LAD Architecture: Use repository for SQL operations  
            cachedEmployee = await ApolloEmployeesCacheRepository.findByName(employeeName, tenantId, schema);
          }
          
          if (cachedEmployee?.employee_phone && cachedEmployee.employee_phone.trim() !== '') {
            const cachedPhone = cachedEmployee.employee_phone;
            logger.info('[Apollo Reveal] Real phone found in cache', { from_cache: true, credits_used: 0 });
            
            return { phone: cachedPhone, from_cache: true, credits_used: 0 };
          }
        } catch (cacheError) {
          logger.warn('[Apollo Reveal] Error checking cache', { error: cacheError.message });
        }
      }
      
      // STEP 2: If no cached phone, call Apollo API (8 credits)
      if (!this.apiKey) {
        throw new Error('Apollo API key is not configured');
      }
      
      // Apollo API v1 endpoint for phone reveal - using people/match with reveal flag
      const apolloUrl = `${this.baseURL || APOLLO_CONFIG.DEFAULT_BASE_URL}/people/match`;
      
      if (!personId) {
        return { phone: null, from_cache: false, credits_used: 0, error: 'Person ID is required for phone reveal' };
      }
      
      const apolloRequest = {
        id: personId,
        reveal_phone_number: true,
        webhook_url: process.env.APOLLO_WEBHOOK_URL
      };
      
      logger.debug('[Apollo Reveal] Phone reveal request', { 
        url: apolloUrl, 
        body: apolloRequest,
        personId 
      });
      
      // Apollo phone reveals are asynchronous - result comes via webhook
      const apolloResponse = await axios.post(apolloUrl, apolloRequest, {
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      // For phone reveals, Apollo returns success but phone comes via webhook later
      if (apolloResponse.data?.success !== false) {
        logger.info('[Apollo Reveal] Phone reveal request submitted successfully - result will come via webhook', { 
          credits_used: CREDIT_COSTS.PHONE_REVEAL 
        });
        
        return { 
          phone: null, 
          from_cache: false, 
          credits_used: CREDIT_COSTS.PHONE_REVEAL, 
          status: 'pending',
          message: 'Phone reveal request submitted. Result will be delivered via webhook.'
        };
      } else {
        logger.warn('[Apollo Reveal] Phone reveal request failed');
        return { 
          phone: null, 
          from_cache: false, 
          credits_used: 0, 
          error: 'Phone reveal request failed' 
        };
      }
    } catch (error) {
      logger.error('[Apollo Reveal] Reveal phone error', { 
        error: error.message, 
        stack: error.stack,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data
      });
      
      // Only charge credits if it was a server error, not a client error
      const creditsUsed = error.response?.status >= 500 ? CREDIT_COSTS.PHONE_REVEAL : 0;
      
      return { 
        phone: null, 
        from_cache: false, 
        credits_used: creditsUsed, 
        error: `${error.message}${error.response?.data ? ` - ${JSON.stringify(error.response.data)}` : ''}` 
      };
    }
  }
}

module.exports = ApolloRevealService;