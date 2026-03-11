/**
 * LinkedIn Integration Service
 * 
 * Extends UnipileService for LinkedIn-specific functionality
 */

const UnipileService = require('./UnipileService');

class LinkedInIntegration extends UnipileService {
  constructor() {
    super();
    this.provider = 'LINKEDIN';
    this.platformName = 'LinkedIn';
  }
  
  /**
   * Send LinkedIn connection request
   * 
   * @param {Object} profile - Profile with linkedin_url or public_identifier
   * @param {string} accountId - Unipile account ID
   * @param {string} customMessage - Optional connection message
   * @returns {Promise<Object>} Connection result
   */
  async sendConnectionRequest(profile, accountId, customMessage = null) {
    return this.sendInvitation(profile, accountId, this.provider, customMessage);
  }
  
  /**
   * Look up LinkedIn profile
   * 
   * @param {string} linkedinUrlOrSlug - LinkedIn profile URL or public identifier
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Profile information
   */
  async lookupLinkedInProfile(linkedinUrlOrSlug, accountId) {
    return this.lookupProfile(linkedinUrlOrSlug, accountId, this.provider);
  }
  
  /**
   * Validate LinkedIn URL
   * 
   * @param {string} url - LinkedIn profile URL
   * @returns {boolean} True if valid
   */
  isValidLinkedInUrl(url) {
    if (!url) return false;
    
    // Accept both full URLs and public identifiers
    if (!url.includes('linkedin.com')) {
      // Assume it's a public identifier
      return /^[a-zA-Z0-9-]+$/.test(url);
    }
    
    // Validate full URL format
    const regex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[^\/\?]+\/?$/;
    return regex.test(url);
  }
  
  /**
   * Normalize LinkedIn URL
   * 
   * @param {string} urlOrSlug - LinkedIn URL or slug
   * @returns {string} Normalized URL
   */
  normalizeLinkedInUrl(urlOrSlug) {
    if (!urlOrSlug) {
      throw new Error('LinkedIn URL or slug is required');
    }
    
    // If it's already a full URL, normalize it
    if (urlOrSlug.startsWith('http')) {
      return urlOrSlug
        .replace(/\/$/, '')           // Remove trailing slash
        .replace(/^http:\/\//, 'https://'); // Ensure https
    }
    
    // If it's just a slug, build the full URL
    return `https://www.linkedin.com/in/${urlOrSlug}`;
  }
  
  /**
   * Send LinkedIn message
   * 
   * @param {string} providerId - LinkedIn provider ID
   * @param {string} message - Message content
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Message result
   */
  async sendLinkedInMessage(providerId, message, accountId) {
    return this.sendMessage(providerId, message, accountId, this.provider);
  }
  
  /**
   * Batch send connection requests
   * 
   * @param {Array<Object>} profiles - Array of profile objects
   * @param {string} accountId - Unipile account ID
   * @param {string} customMessage - Optional connection message
   * @param {number} delayMs - Delay between requests (default: 2000ms)
   * @returns {Promise<Object>} Batch results
   */
  async batchSendConnectionRequests(profiles, accountId, customMessage = null, delayMs = 2000) {
    console.log(`[LinkedInIntegration] Batch sending ${profiles.length} connection requests`);
    
    const results = {
      total: profiles.length,
      successful: 0,
      failed: 0,
      alreadySent: 0,
      results: []
    };
    
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      
      try {
        console.log(`[LinkedInIntegration] Processing ${i + 1}/${profiles.length}: ${profile.name || 'Unknown'}`);
        
        const result = await this.sendConnectionRequest(profile, accountId, customMessage);
        
        if (result.success) {
          if (result.alreadySent) {
            results.alreadySent++;
          } else {
            results.successful++;
          }
        } else {
          results.failed++;
        }
        
        results.results.push({
          profile: profile.name || profile.publicIdentifier || 'Unknown',
          success: result.success,
          alreadySent: result.alreadySent || false,
          error: result.error || null
        });
        
        // Delay between requests to avoid rate limiting
        if (i < profiles.length - 1 && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
      } catch (error) {
        console.error(`[LinkedInIntegration] Failed for ${profile.name || 'Unknown'}:`, error.message);
        
        results.failed++;
        results.results.push({
          profile: profile.name || profile.publicIdentifier || 'Unknown',
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`[LinkedInIntegration] Batch complete: ${results.successful} successful, ${results.failed} failed, ${results.alreadySent} already sent`);
    
    return results;
  }

  /**
   * Connect LinkedIn account with credentials (email/password)
   * Uses Unipile service for authentication
   * 
   * @param {Object} params - Connection parameters
   * @param {string} params.email - LinkedIn email
   * @param {string} params.password - LinkedIn password  
   * @param {string} params.userId - User ID
   * @returns {Promise<Object>} Connection result
   */
  async connectWithCredentials({ email, password, userId }) {
    if (!this.isConfigured()) {
      throw new Error('Unipile service not configured');
    }

    console.log(`[LinkedInIntegration] Connecting account with credentials for user: ${userId}`);

    try {
      // This would typically use the Unipile SDK or direct API call
      // For now, return a mock response that follows the expected pattern
      const mockAccountId = `unipile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // In a real implementation, this would:
      // 1. Call Unipile's connectLinkedin API with credentials
      // 2. Handle checkpoint/2FA responses
      // 3. Store account info in database
      // 4. Return proper account details
      
      return {
        accountId: mockAccountId,
        profileUrl: `https://www.linkedin.com/in/${email.split('@')[0]}`,
        profileName: email.split('@')[0],
        connected: true,
        method: 'credentials',
        checkpoint_required: false
      };
      
    } catch (error) {
      console.error(`[LinkedInIntegration] Credentials connection failed:`, error);
      throw new Error(`LinkedIn connection failed: ${error.message}`);
    }
  }

  /**
   * Connect LinkedIn account with cookies (li_at, li_a)
   * Uses Unipile service for authentication
   * 
   * @param {Object} params - Connection parameters
   * @param {string} params.li_at - LinkedIn li_at cookie
   * @param {string} params.li_a - LinkedIn li_a cookie (optional)
   * @param {string} params.user_agent - User agent string
   * @param {string} params.userId - User ID
   * @returns {Promise<Object>} Connection result
   */
  async connectWithCookies({ li_at, li_a, user_agent, userId }) {
    if (!this.isConfigured()) {
      throw new Error('Unipile service not configured');
    }

    console.log(`[LinkedInIntegration] Connecting account with cookies for user: ${userId}`);

    if (!li_at) {
      throw new Error('li_at cookie is required');
    }

    try {
      // This would typically use the Unipile SDK or direct API call
      // For now, return a mock response that follows the expected pattern
      const mockAccountId = `unipile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // In a real implementation, this would:
      // 1. Call Unipile's accounts API with cookie authentication
      // 2. Handle checkpoint/2FA responses
      // 3. Store account info in database
      // 4. Return proper account details
      
      return {
        accountId: mockAccountId,
        profileUrl: 'https://www.linkedin.com/in/connected-user',
        profileName: 'Connected User',
        connected: true,
        method: 'cookies',
        checkpoint_required: false
      };
      
    } catch (error) {
      console.error(`[LinkedInIntegration] Cookie connection failed:`, error);
      throw new Error(`LinkedIn connection failed: ${error.message}`);
    }
  }

  /**
   * Check if Unipile service is configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return !!(this.dsn && this.token);
  }
}

module.exports = LinkedInIntegration;
