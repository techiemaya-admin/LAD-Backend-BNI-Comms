/**
 * Recording Service
 * 
 * Handles call recording management and signed URL generation
 * Integrates with GCS (Google Cloud Storage) for recording storage
 */

const axios = require('axios');

class RecordingService {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.BASE_URL;
    this.signingEndpoint = config.signingEndpoint || process.env.SIGNING_ENDPOINT_URL;
    this.defaultExpirationHours = 96; // 4 days
  }

  /**
   * Get signed URL for a call recording
   * 
   * Routes to external signing service (BASE_URL/recordings/calls/:id/signed-url)
   * 
   * @param {string} callId - Call log ID
   * @param {number} expirationHours - URL expiration in hours
   * @returns {Promise<Object>} Signed URL result
   */
  async getRecordingSignedUrl(callId, expirationHours = null) {
    const hours = expirationHours || this.defaultExpirationHours;
    
    try {
      const url = `${this.baseUrl}/recordings/calls/${callId}/signed-url`;
      const response = await axios.get(url, {
        params: {
          expiration_hours: hours
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        signedUrl: response.data.signed_url || response.data.url,
        expiresAt: response.data.expires_at,
        expirationHours: hours
      };
    } catch (error) {
      console.error('Recording signed URL error:', error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get signed URL for voice sample
   * 
   * Routes to signing service for voice profile samples
   * 
   * @param {string} gsUrl - GCS URL (gs://bucket/path)
   * @param {number} expirationHours - URL expiration in hours
   * @returns {Promise<Object>} Signed URL result
   */
  async getVoiceSampleSignedUrl(gsUrl, expirationHours = null) {
    const hours = expirationHours || this.defaultExpirationHours;
    
    try {
      const url = `${this.signingEndpoint || this.baseUrl}/recordings/signed-url`;
      const response = await axios.post(
        url,
        {
          gs_url: gsUrl,
          expiration_hours: hours
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        signedUrl: response.data.signed_url || response.data.url,
        expiresAt: response.data.expires_at,
        originalUrl: gsUrl
      };
    } catch (error) {
      console.error('Voice sample signed URL error:', error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get agent voice sample signed URL
   * 
   * @param {string} voiceId - Voice ID
   * @param {string} voiceSampleUrl - GCS URL of voice sample
   * @param {number} expirationHours - URL expiration in hours
   * @returns {Promise<Object>} Signed URL result
   */
  async getAgentVoiceSampleSignedUrl(voiceId, voiceSampleUrl, expirationHours = null) {
    if (!voiceSampleUrl) {
      return {
        success: false,
        error: 'Voice sample URL not found'
      };
    }

    return this.getVoiceSampleSignedUrl(voiceSampleUrl, expirationHours);
  }

  /**
   * Validate GCS URL format
   * 
   * @param {string} url - URL to validate
   * @returns {boolean} Is valid GCS URL
   */
  isValidGCSUrl(url) {
    if (!url) return false;
    return url.startsWith('gs://');
  }

  /**
   * Parse GCS URL into bucket and path
   * 
   * @param {string} gsUrl - GCS URL (gs://bucket/path)
   * @returns {Object} Parsed components
   */
  parseGCSUrl(gsUrl) {
    if (!this.isValidGCSUrl(gsUrl)) {
      return null;
    }

    const parts = gsUrl.replace('gs://', '').split('/');
    const bucket = parts[0];
    const path = parts.slice(1).join('/');

    return { bucket, path };
  }

  /**
   * Validate service configuration
   * 
   * @returns {Object} Validation result
   */
  validateConfig() {
    const errors = [];

    if (!this.baseUrl) {
      errors.push('BASE_URL is missing for recording service');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration info
   * 
   * @returns {Object} Configuration info
   */
  getConfigInfo() {
    return {
      hasBaseUrl: !!this.baseUrl,
      signingEndpoint: this.signingEndpoint || 'using BASE_URL',
      defaultExpirationHours: this.defaultExpirationHours
    };
  }
}

module.exports = RecordingService;
