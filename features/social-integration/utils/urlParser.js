/**
 * URL Parser Utility
 * 
 * Extracts identifiers from social media profile URLs
 */

class UrlParser {
  /**
   * Extract LinkedIn public identifier from URL
   * 
   * @param {string} url - LinkedIn profile URL
   * @returns {string|null} Public identifier or null
   */
  static extractLinkedInIdentifier(url) {
    if (!url) return null;
    
    // If it's not a URL, assume it's already an identifier
    if (!url.includes('linkedin.com')) {
      return url;
    }
    
    const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Extract Instagram username from URL
   * 
   * @param {string} url - Instagram profile URL
   * @returns {string|null} Username or null
   */
  static extractInstagramUsername(url) {
    if (!url) return null;
    
    // If it's not a URL, assume it's already a username
    if (!url.includes('instagram.com')) {
      return url.replace(/^@/, ''); // Remove @ if present
    }
    
    const match = url.match(/instagram\.com\/([^\/\?]+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Extract Facebook username/ID from URL
   * 
   * @param {string} url - Facebook profile URL
   * @returns {string|null} Username/ID or null
   */
  static extractFacebookIdentifier(url) {
    if (!url) return null;
    
    // If it's not a URL, assume it's already an identifier
    if (!url.includes('facebook.com') && !url.includes('fb.com')) {
      return url;
    }
    
    const match = url.match(/(?:facebook|fb)\.com\/([^\/\?]+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Extract Twitter/X username from URL
   * 
   * @param {string} url - Twitter/X profile URL
   * @returns {string|null} Username or null
   */
  static extractTwitterUsername(url) {
    if (!url) return null;
    
    // If it's not a URL, assume it's already a username
    if (!url.includes('twitter.com') && !url.includes('x.com')) {
      return url.replace(/^@/, ''); // Remove @ if present
    }
    
    const match = url.match(/(?:twitter|x)\.com\/([^\/\?]+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Normalize phone number to E.164 format
   * 
   * @param {string} phoneNumber - Phone number in various formats
   * @returns {string|null} Normalized phone number or null
   */
  static normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Remove all non-digit characters except leading +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    // Basic validation: should have 10-15 digits
    if (cleaned.length < 11 || cleaned.length > 16) {
      return null;
    }
    
    return cleaned;
  }
  
  /**
   * Detect platform from URL
   * 
   * @param {string} url - Social media profile URL
   * @returns {string|null} Platform name (linkedin, instagram, facebook, twitter) or null
   */
  static detectPlatform(url) {
    if (!url) return null;
    
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('linkedin.com')) return 'linkedin';
    if (lowerUrl.includes('instagram.com')) return 'instagram';
    if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) return 'facebook';
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
    if (lowerUrl.includes('whatsapp')) return 'whatsapp';
    
    return null;
  }
  
  /**
   * Build profile URL from identifier
   * 
   * @param {string} identifier - Username or public identifier
   * @param {string} platform - Platform name
   * @returns {string} Full profile URL
   */
  static buildProfileUrl(identifier, platform) {
    if (!identifier || !platform) {
      throw new Error('Identifier and platform are required');
    }
    
    // Remove @ if present in identifier
    const cleanIdentifier = identifier.replace(/^@/, '');
    
    switch (platform.toLowerCase()) {
      case 'linkedin':
        return `https://www.linkedin.com/in/${cleanIdentifier}`;
      
      case 'instagram':
        return `https://www.instagram.com/${cleanIdentifier}`;
      
      case 'facebook':
        return `https://www.facebook.com/${cleanIdentifier}`;
      
      case 'twitter':
      case 'x':
        return `https://www.twitter.com/${cleanIdentifier}`;
      
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
  
  /**
   * Validate URL format for a specific platform
   * 
   * @param {string} url - Profile URL
   * @param {string} platform - Platform name
   * @returns {boolean} True if valid
   */
  static isValidUrl(url, platform) {
    if (!url || !platform) return false;
    
    const patterns = {
      linkedin: /^https?:\/\/(www\.)?linkedin\.com\/in\/[^\/\?]+\/?$/,
      instagram: /^https?:\/\/(www\.)?instagram\.com\/[^\/\?]+\/?$/,
      facebook: /^https?:\/\/(www\.)?(facebook|fb)\.com\/[^\/\?]+\/?$/,
      twitter: /^https?:\/\/(www\.)?(twitter|x)\.com\/[^\/\?]+\/?$/,
    };
    
    const pattern = patterns[platform.toLowerCase()];
    if (!pattern) return false;
    
    return pattern.test(url);
  }
  
  /**
   * Extract all identifiers from a profile object
   * 
   * @param {Object} profile - Profile object with various URL fields
   * @returns {Object} Extracted identifiers by platform
   */
  static extractAllIdentifiers(profile) {
    const identifiers = {};
    
    // Check common field names
    const urlFields = [
      'linkedin_url', 'linkedinUrl', 'linkedin',
      'instagram_url', 'instagramUrl', 'instagram',
      'facebook_url', 'facebookUrl', 'facebook',
      'twitter_url', 'twitterUrl', 'twitter',
      'profile_url', 'url'
    ];
    
    for (const field of urlFields) {
      const value = profile[field];
      if (!value) continue;
      
      const platform = this.detectPlatform(value);
      if (!platform) continue;
      
      let identifier = null;
      
      switch (platform) {
        case 'linkedin':
          identifier = this.extractLinkedInIdentifier(value);
          break;
        case 'instagram':
          identifier = this.extractInstagramUsername(value);
          break;
        case 'facebook':
          identifier = this.extractFacebookIdentifier(value);
          break;
        case 'twitter':
          identifier = this.extractTwitterUsername(value);
          break;
      }
      
      if (identifier && !identifiers[platform]) {
        identifiers[platform] = identifier;
      }
    }
    
    return identifiers;
  }
}

module.exports = UrlParser;
