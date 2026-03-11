/**
 * Facebook Integration Service
 * 
 * Extends UnipileService for Facebook-specific functionality
 */

const UnipileService = require('./UnipileService');

class FacebookIntegration extends UnipileService {
  constructor() {
    super();
    this.provider = 'FACEBOOK';
    this.platformName = 'Facebook';
  }
  
  /**
   * Send Facebook friend request
   * 
   * @param {Object} profile - Profile with facebook_url or username
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Friend request result
   */
  async sendFriendRequest(profile, accountId) {
    return this.sendInvitation(profile, accountId, this.provider);
  }
  
  /**
   * Look up Facebook profile
   * 
   * @param {string} facebookUrlOrUsername - Facebook profile URL or username
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Profile information
   */
  async lookupFacebookProfile(facebookUrlOrUsername, accountId) {
    return this.lookupProfile(facebookUrlOrUsername, accountId, this.provider);
  }
  
  /**
   * Send Facebook message
   * 
   * @param {string} providerId - Facebook provider ID
   * @param {string} message - Message content
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Message result
   */
  async sendFacebookMessage(providerId, message, accountId) {
    return this.sendMessage(providerId, message, accountId, this.provider);
  }
  
  /**
   * Validate Facebook URL
   * 
   * @param {string} url - Facebook profile URL
   * @returns {boolean} True if valid
   */
  isValidFacebookUrl(url) {
    if (!url) return false;
    
    // Accept both full URLs and usernames
    if (!url.includes('facebook.com') && !url.includes('fb.com')) {
      // Assume it's a username
      return /^[a-zA-Z0-9.]+$/.test(url);
    }
    
    // Validate full URL format
    const regex = /^https?:\/\/(www\.)?(facebook|fb)\.com\/[^\/\?]+\/?$/;
    return regex.test(url);
  }
  
  /**
   * Normalize Facebook URL
   * 
   * @param {string} urlOrUsername - Facebook URL or username
   * @returns {string} Normalized URL
   */
  normalizeFacebookUrl(urlOrUsername) {
    if (!urlOrUsername) {
      throw new Error('Facebook URL or username is required');
    }
    
    // If it's already a full URL, normalize it
    if (urlOrUsername.startsWith('http')) {
      return urlOrUsername
        .replace(/\/$/, '')           // Remove trailing slash
        .replace(/^http:\/\//, 'https://')  // Ensure https
        .replace('fb.com', 'facebook.com'); // Normalize domain
    }
    
    // If it's just a username, build the full URL
    return `https://www.facebook.com/${urlOrUsername}`;
  }
  
  /**
   * Batch send friend requests
   * 
   * @param {Array<Object>} profiles - Array of profile objects
   * @param {string} accountId - Unipile account ID
   * @param {number} delayMs - Delay between requests (default: 2000ms)
   * @returns {Promise<Object>} Batch results
   */
  async batchSendFriendRequests(profiles, accountId, delayMs = 2000) {
    console.log(`[FacebookIntegration] Batch sending ${profiles.length} friend requests`);
    
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
        console.log(`[FacebookIntegration] Processing ${i + 1}/${profiles.length}: ${profile.name || 'Unknown'}`);
        
        const result = await this.sendFriendRequest(profile, accountId);
        
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
          profile: profile.name || profile.username || 'Unknown',
          success: result.success,
          alreadySent: result.alreadySent || false,
          error: result.error || null
        });
        
        // Delay between requests
        if (i < profiles.length - 1 && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
      } catch (error) {
        console.error(`[FacebookIntegration] Failed for ${profile.name || 'Unknown'}:`, error.message);
        
        results.failed++;
        results.results.push({
          profile: profile.name || profile.username || 'Unknown',
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`[FacebookIntegration] Batch complete: ${results.successful} successful, ${results.failed} failed, ${results.alreadySent} already sent`);
    
    return results;
  }
}

module.exports = FacebookIntegration;
