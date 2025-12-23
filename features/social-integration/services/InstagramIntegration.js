/**
 * Instagram Integration Service
 * 
 * Extends UnipileService for Instagram-specific functionality
 */

const UnipileService = require('./UnipileService');

class InstagramIntegration extends UnipileService {
  constructor() {
    super();
    this.provider = 'INSTAGRAM';
    this.platformName = 'Instagram';
  }
  
  /**
   * Send Instagram follow request
   * 
   * @param {Object} profile - Profile with instagram_url or username
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Follow result
   */
  async sendFollowRequest(profile, accountId) {
    // Instagram uses the same invitation endpoint as LinkedIn
    return this.sendInvitation(profile, accountId, this.provider);
  }
  
  /**
   * Look up Instagram profile
   * 
   * @param {string} instagramUrlOrUsername - Instagram profile URL or username
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Profile information
   */
  async lookupInstagramProfile(instagramUrlOrUsername, accountId) {
    return this.lookupProfile(instagramUrlOrUsername, accountId, this.provider);
  }
  
  /**
   * Send Instagram direct message
   * 
   * @param {string} providerId - Instagram provider ID
   * @param {string} message - Message content
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Message result
   */
  async sendInstagramMessage(providerId, message, accountId) {
    return this.sendMessage(providerId, message, accountId, this.provider);
  }
  
  /**
   * Validate Instagram URL
   * 
   * @param {string} url - Instagram profile URL
   * @returns {boolean} True if valid
   */
  isValidInstagramUrl(url) {
    if (!url) return false;
    
    // Accept both full URLs and usernames
    if (!url.includes('instagram.com')) {
      // Assume it's a username
      return /^[a-zA-Z0-9._]+$/.test(url);
    }
    
    // Validate full URL format
    const regex = /^https?:\/\/(www\.)?instagram\.com\/[^\/\?]+\/?$/;
    return regex.test(url);
  }
  
  /**
   * Normalize Instagram URL
   * 
   * @param {string} urlOrUsername - Instagram URL or username
   * @returns {string} Normalized URL
   */
  normalizeInstagramUrl(urlOrUsername) {
    if (!urlOrUsername) {
      throw new Error('Instagram URL or username is required');
    }
    
    // If it's already a full URL, normalize it
    if (urlOrUsername.startsWith('http')) {
      return urlOrUsername
        .replace(/\/$/, '')           // Remove trailing slash
        .replace(/^http:\/\//, 'https://'); // Ensure https
    }
    
    // If it's just a username, build the full URL
    // Remove @ if present
    const username = urlOrUsername.replace(/^@/, '');
    return `https://www.instagram.com/${username}`;
  }
}

module.exports = InstagramIntegration;
