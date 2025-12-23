/**
 * Platform Validator Utility
 * 
 * Validates platform names, URLs, and configurations
 */

const manifest = require('../manifest');

class PlatformValidator {
  /**
   * Check if a platform is supported
   * 
   * @param {string} platform - Platform name (linkedin, instagram, whatsapp, facebook)
   * @returns {boolean} True if supported
   */
  static isPlatformSupported(platform) {
    if (!platform) return false;
    const normalizedPlatform = platform.toLowerCase();
    return !!manifest.platforms[normalizedPlatform];
  }
  
  /**
   * Check if a platform is enabled
   * 
   * @param {string} platform - Platform name
   * @returns {boolean} True if enabled
   */
  static isPlatformEnabled(platform) {
    if (!this.isPlatformSupported(platform)) return false;
    const normalizedPlatform = platform.toLowerCase();
    return manifest.platforms[normalizedPlatform].enabled;
  }
  
  /**
   * Get platform configuration
   * 
   * @param {string} platform - Platform name
   * @returns {Object|null} Platform config or null if not found
   */
  static getPlatformConfig(platform) {
    if (!platform) return null;
    const normalizedPlatform = platform.toLowerCase();
    return manifest.platforms[normalizedPlatform] || null;
  }
  
  /**
   * Get provider name for Unipile API
   * 
   * @param {string} platform - Platform name
   * @returns {string} Provider name (LINKEDIN, INSTAGRAM, etc.)
   */
  static getProviderName(platform) {
    const config = this.getPlatformConfig(platform);
    if (!config) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    return config.provider;
  }
  
  /**
   * Validate platform supports a specific feature
   * 
   * @param {string} platform - Platform name
   * @param {string} feature - Feature name (connect, messaging, etc.)
   * @returns {boolean} True if feature is supported
   */
  static supportsFeature(platform, feature) {
    const config = this.getPlatformConfig(platform);
    if (!config) return false;
    return config.features.includes(feature);
  }
  
  /**
   * Get cost for a platform action
   * 
   * @param {string} platform - Platform name
   * @param {string} action - Action name (connect, invitation, message, etc.)
   * @returns {number} Credit cost
   */
  static getActionCost(platform, action) {
    const config = this.getPlatformConfig(platform);
    if (!config) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    const cost = config.costPerAction[action];
    if (cost === undefined) {
      throw new Error(`Unknown action: ${action} for platform: ${platform}`);
    }
    
    return cost;
  }
  
  /**
   * List all enabled platforms
   * 
   * @returns {Array<string>} Array of enabled platform names
   */
  static getEnabledPlatforms() {
    return Object.keys(manifest.platforms).filter(platform => 
      manifest.platforms[platform].enabled
    );
  }
  
  /**
   * Validate request payload for a platform action
   * 
   * @param {string} platform - Platform name
   * @param {string} action - Action name
   * @param {Object} payload - Request payload
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  static validateActionPayload(platform, action, payload) {
    const errors = [];
    
    // Check platform exists and is enabled
    if (!this.isPlatformSupported(platform)) {
      errors.push(`Unsupported platform: ${platform}`);
      return { valid: false, errors };
    }
    
    if (!this.isPlatformEnabled(platform)) {
      errors.push(`Platform ${platform} is currently disabled`);
      return { valid: false, errors };
    }
    
    // Check feature is supported
    if (!this.supportsFeature(platform, action)) {
      errors.push(`Action ${action} not supported for platform ${platform}`);
      return { valid: false, errors };
    }
    
    // Validate payload based on action
    switch (action) {
      case 'send-invitation':
        if (!payload.profile && !payload.profileUrl && !payload.publicIdentifier) {
          errors.push('profile, profileUrl, or publicIdentifier is required');
        }
        if (!payload.accountId) {
          errors.push('accountId is required');
        }
        break;
      
      case 'send-message':
        if (!payload.message) {
          errors.push('message is required');
        }
        if (!payload.providerId && !payload.phoneNumber) {
          errors.push('providerId or phoneNumber is required');
        }
        if (!payload.accountId) {
          errors.push('accountId is required');
        }
        break;
      
      case 'lookup':
        if (!payload.profileUrl && !payload.publicIdentifier && !payload.phoneNumber) {
          errors.push('profileUrl, publicIdentifier, or phoneNumber is required');
        }
        if (!payload.accountId) {
          errors.push('accountId is required');
        }
        break;
      
      case 'connect':
        // Connect usually doesn't need validation beyond platform check
        break;
      
      default:
        errors.push(`Unknown action: ${action}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = PlatformValidator;
