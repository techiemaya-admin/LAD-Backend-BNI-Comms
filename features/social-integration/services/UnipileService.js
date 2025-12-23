/**
 * UnipileService - Base Service for Unipile API Integration
 * 
 * Provides unified interface for multi-platform social media integration
 * Supports: LinkedIn, Instagram, WhatsApp, Facebook
 * 
 * Ported and enhanced from sts-service/src/services/unipileService.js
 */

const axios = require('axios');

class UnipileService {
  constructor() {
    this.dsn = process.env.UNIPILE_DSN;
    this.token = process.env.UNIPILE_TOKEN;
    
    if (!this.isConfigured()) {
      console.warn('[UnipileService] ⚠️ WARNING: UNIPILE_DSN or UNIPILE_TOKEN not configured');
      console.warn('[UnipileService] Unipile features will be disabled');
    } else {
      console.log('[UnipileService] ✅ Configured successfully');
      console.log('[UnipileService] DSN:', this.dsn);
    }
  }
  
  /**
   * Get normalized base URL for Unipile API
   * Ensures URL has /api/v1 path
   */
  getBaseUrl() {
    if (!this.dsn) {
      throw new Error('UNIPILE_DSN not configured');
    }
    
    let baseUrl = this.dsn;
    
    // Remove trailing slashes
    baseUrl = baseUrl.replace(/\/+$/, '');
    
    // Add /api/v1 path if not present
    if (!baseUrl.includes('/api/v1')) {
      baseUrl = `${baseUrl}/api/v1`;
    }
    
    return baseUrl;
  }
  
  /**
   * Check if Unipile is properly configured
   */
  isConfigured() {
    return !!(this.dsn && this.token);
  }
  
  /**
   * Get authentication headers for Unipile API
   */
  getAuthHeaders() {
    if (!this.token) {
      throw new Error('UNIPILE_TOKEN not configured');
    }
    
    return {
      'X-API-KEY': this.token,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Look up provider ID from profile URL or public identifier
   * 
   * @param {string} profileUrlOrSlug - Profile URL or public identifier
   * @param {string} accountId - Unipile account ID (required)
   * @param {string} provider - Platform provider (LINKEDIN, INSTAGRAM, FACEBOOK, WHATSAPP)
   * @returns {Promise<Object>} Profile information with provider_id
   */
  async lookupProfile(profileUrlOrSlug, accountId, provider = 'LINKEDIN') {
    if (!this.isConfigured()) {
      throw new Error('Unipile is not configured');
    }
    
    if (!accountId) {
      throw new Error('Account ID is required');
    }
    
    try {
      // Extract public identifier from URL
      let publicIdentifier = this.extractPublicIdentifier(profileUrlOrSlug, provider);
      
      console.log(`[UnipileService] Looking up ${provider} profile: ${publicIdentifier}`);
      console.log(`[UnipileService] Account ID: ${accountId}`);
      
      const baseUrl = this.getBaseUrl();
      const headers = this.getAuthHeaders();
      
      // Call Unipile API: GET /users/{provider_public_id}?account_id={account_id}
      const response = await axios.get(
        `${baseUrl}/users/${publicIdentifier}`,
        {
          headers: headers,
          params: {
            account_id: accountId
          },
          timeout: 15000
        }
      );
      
      console.log(`[UnipileService] Lookup successful`);
      
      // Handle response structure
      const responseData = response.data?.data || response.data;
      
      // Validate profile match
      const returnedPublicId = responseData?.public_identifier;
      if (returnedPublicId && returnedPublicId.toLowerCase() !== publicIdentifier.toLowerCase()) {
        console.warn(`[UnipileService] ⚠️ Profile mismatch:`);
        console.warn(`[UnipileService]   Requested: ${publicIdentifier}`);
        console.warn(`[UnipileService]   Returned: ${returnedPublicId}`);
      }
      
      // Extract provider_id
      const providerId = responseData?.provider_id || 
                        response.data?.provider_id || 
                        responseData?.id || 
                        responseData?.urn_id;
      
      if (!providerId) {
        throw new Error('No provider_id found in lookup response');
      }
      
      const profileName = responseData?.name || 
                         `${responseData?.first_name || ''} ${responseData?.last_name || ''}`.trim() ||
                         response.data?.name ||
                         'Unknown';
      
      return {
        providerId: providerId,
        profileName: profileName,
        publicIdentifier: returnedPublicId || publicIdentifier,
        requestedIdentifier: publicIdentifier,
        profileMatch: returnedPublicId ? 
                     returnedPublicId.toLowerCase() === publicIdentifier.toLowerCase() : 
                     true,
        rawResponse: responseData
      };
      
    } catch (error) {
      console.error(`[UnipileService] Profile lookup failed:`, error.message);
      if (error.response) {
        console.error(`[UnipileService] Status: ${error.response.status}`);
        console.error(`[UnipileService] Data:`, error.response.data);
      }
      throw error;
    }
  }
  
  /**
   * Send invitation/connection request
   * 
   * @param {Object} profile - Profile information
   * @param {string} accountId - Unipile account ID
   * @param {string} provider - Platform provider
   * @param {string} customMessage - Optional custom message
   * @returns {Promise<Object>} Invitation result
   */
  async sendInvitation(profile, accountId, provider = 'LINKEDIN', customMessage = null) {
    if (!this.isConfigured()) {
      throw new Error('Unipile is not configured');
    }
    
    if (!accountId) {
      throw new Error('Account ID is required');
    }
    
    try {
      // Step 1: Lookup provider_id
      const profileUrl = profile.profile_url || profile.url || profile.publicIdentifier;
      if (!profileUrl) {
        throw new Error('Profile URL or public identifier is required');
      }
      
      console.log(`[UnipileService] Sending ${provider} invitation to: ${profile.name || 'Unknown'}`);
      
      const lookupResult = await this.lookupProfile(profileUrl, accountId, provider);
      const encodedProviderId = lookupResult.providerId;
      
      console.log(`[UnipileService] Found provider_id: ${encodedProviderId}`);
      
      // Step 2: Send invitation
      const baseUrl = this.getBaseUrl();
      const headers = this.getAuthHeaders();
      
      const payload = {
        provider: provider,
        account_id: accountId,
        provider_id: encodedProviderId
      };
      
      if (customMessage) {
        payload.message = customMessage;
      }
      
      console.log(`[UnipileService] Sending invitation...`);
      
      const response = await axios.post(
        `${baseUrl}/users/invite`,
        payload,
        {
          headers: headers,
          timeout: 30000
        }
      );
      
      console.log(`[UnipileService] ✅ Invitation sent successfully`);
      
      return {
        success: true,
        data: response.data,
        profile: {
          name: profile.name || lookupResult.profileName,
          url: profileUrl,
          provider_id: encodedProviderId
        }
      };
      
    } catch (error) {
      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        // 409: Already sent
        if (status === 409) {
          console.warn(`[UnipileService] ⚠️ Invitation already sent (409)`);
          return {
            success: true,
            alreadySent: true,
            data: errorData,
            profile: { name: profile.name }
          };
        }
        
        // 422: Validation errors, rate limiting, already invited recently
        if (status === 422) {
          const errorType = errorData?.type || '';
          const errorDetail = errorData?.detail || errorData?.message || '';
          
          console.error(`[UnipileService] ❌ 422 Error: ${errorDetail}`);
          
          // Already invited recently is actually success
          if (errorType.includes('already_invited') || 
              errorDetail.includes('already') || 
              errorDetail.includes('recently')) {
            return {
              success: true,
              alreadySent: true,
              data: errorData,
              profile: { name: profile.name }
            };
          }
          
          return {
            success: false,
            error: errorDetail || 'Invitation failed (422)',
            errorType: errorType,
            details: errorData,
            profile: { name: profile.name }
          };
        }
        
        // 400: Bad request
        if (status === 400) {
          const detail = errorData?.detail || '';
          console.error(`[UnipileService] ❌ 400 Error: ${detail}`);
          
          return {
            success: false,
            error: detail || 'Invalid request',
            profile: { name: profile.name }
          };
        }
      }
      
      console.error(`[UnipileService] Invitation failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Send direct message
   * 
   * @param {string} providerId - Provider ID of recipient
   * @param {string} message - Message content
   * @param {string} accountId - Unipile account ID
   * @param {string} provider - Platform provider
   * @returns {Promise<Object>} Message result
   */
  async sendMessage(providerId, message, accountId, provider = 'LINKEDIN') {
    if (!this.isConfigured()) {
      throw new Error('Unipile is not configured');
    }
    
    if (!accountId) {
      throw new Error('Account ID is required');
    }
    
    try {
      const baseUrl = this.getBaseUrl();
      const headers = this.getAuthHeaders();
      
      const payload = {
        provider: provider,
        account_id: accountId,
        provider_id: providerId,
        message: message
      };
      
      console.log(`[UnipileService] Sending ${provider} message...`);
      
      const response = await axios.post(
        `${baseUrl}/messages/send`,
        payload,
        {
          headers: headers,
          timeout: 30000
        }
      );
      
      console.log(`[UnipileService] ✅ Message sent successfully`);
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error(`[UnipileService] Message send failed:`, error.message);
      if (error.response) {
        console.error(`[UnipileService] Status: ${error.response.status}`);
        console.error(`[UnipileService] Data:`, error.response.data);
      }
      throw error;
    }
  }
  
  /**
   * Extract public identifier from profile URL based on provider
   * 
   * @param {string} urlOrSlug - Profile URL or public identifier
   * @param {string} provider - Platform provider
   * @returns {string} Public identifier
   */
  extractPublicIdentifier(urlOrSlug, provider) {
    // If it's already a clean identifier (no protocol), return as-is
    if (!urlOrSlug.startsWith('http')) {
      return urlOrSlug;
    }
    
    let match;
    
    switch (provider) {
      case 'LINKEDIN':
        match = urlOrSlug.match(/linkedin\.com\/in\/([^\/\?]+)/);
        if (!match) {
          throw new Error(`Invalid LinkedIn URL format: ${urlOrSlug}`);
        }
        return match[1];
      
      case 'INSTAGRAM':
        match = urlOrSlug.match(/instagram\.com\/([^\/\?]+)/);
        if (!match) {
          throw new Error(`Invalid Instagram URL format: ${urlOrSlug}`);
        }
        return match[1];
      
      case 'FACEBOOK':
        match = urlOrSlug.match(/facebook\.com\/([^\/\?]+)/);
        if (!match) {
          throw new Error(`Invalid Facebook URL format: ${urlOrSlug}`);
        }
        return match[1];
      
      case 'TWITTER':
      case 'X':
        match = urlOrSlug.match(/(?:twitter|x)\.com\/([^\/\?]+)/);
        if (!match) {
          throw new Error(`Invalid Twitter/X URL format: ${urlOrSlug}`);
        }
        return match[1];
      
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
  
  /**
   * Get account information
   * 
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Account information
   */
  async getAccountInfo(accountId) {
    if (!this.isConfigured()) {
      throw new Error('Unipile is not configured');
    }
    
    try {
      const baseUrl = this.getBaseUrl();
      const headers = this.getAuthHeaders();
      
      const response = await axios.get(
        `${baseUrl}/accounts/${accountId}`,
        {
          headers: headers,
          timeout: 15000
        }
      );
      
      return response.data?.data || response.data;
      
    } catch (error) {
      console.error(`[UnipileService] Get account info failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * List all accounts for the authenticated user
   * 
   * @returns {Promise<Array>} List of accounts
   */
  async listAccounts() {
    if (!this.isConfigured()) {
      throw new Error('Unipile is not configured');
    }
    
    try {
      const baseUrl = this.getBaseUrl();
      const headers = this.getAuthHeaders();
      
      const response = await axios.get(
        `${baseUrl}/accounts`,
        {
          headers: headers,
          timeout: 15000
        }
      );
      
      return response.data?.data || response.data || [];
      
    } catch (error) {
      console.error(`[UnipileService] List accounts failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Disconnect an account
   * 
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Disconnect result
   */
  async disconnectAccount(accountId) {
    if (!this.isConfigured()) {
      throw new Error('Unipile is not configured');
    }
    
    try {
      const baseUrl = this.getBaseUrl();
      const headers = this.getAuthHeaders();
      
      const response = await axios.delete(
        `${baseUrl}/accounts/${accountId}`,
        {
          headers: headers,
          timeout: 15000
        }
      );
      
      console.log(`[UnipileService] ✅ Account disconnected: ${accountId}`);
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error(`[UnipileService] Disconnect failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get status of sent invitations
   * Useful for checking connection acceptance status
   * 
   * @param {string} accountId - Unipile account ID
   * @param {Object} filters - Optional filters (status, date range, etc.)
   * @returns {Promise<Object>} Invitations with their status
   */
  async getInvitationsStatus(accountId, filters = {}) {
    if (!this.isConfigured()) {
      throw new Error('Unipile is not configured');
    }
    
    try {
      const baseUrl = this.getBaseUrl();
      const headers = this.getAuthHeaders();
      
      const params = {
        account_id: accountId,
        ...filters
      };
      
      console.log(`[UnipileService] Fetching invitations status for account: ${accountId}`);
      
      const response = await axios.get(
        `${baseUrl}/users/invitations`,
        {
          headers: headers,
          params: params,
          timeout: 30000
        }
      );
      
      const invitations = response.data?.data || response.data || [];
      
      return {
        success: true,
        invitations: invitations,
        total: invitations.length
      };
      
    } catch (error) {
      console.error(`[UnipileService] Get invitations status failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get messages for an account
   * 
   * @param {string} accountId - Unipile account ID
   * @param {Object} filters - Optional filters (conversation_id, since, etc.)
   * @returns {Promise<Object>} Messages
   */
  async getMessages(accountId, filters = {}) {
    if (!this.isConfigured()) {
      throw new Error('Unipile is not configured');
    }
    
    try {
      const baseUrl = this.getBaseUrl();
      const headers = this.getAuthHeaders();
      
      const params = {
        account_id: accountId,
        ...filters
      };
      
      console.log(`[UnipileService] Fetching messages for account: ${accountId}`);
      
      const response = await axios.get(
        `${baseUrl}/messages`,
        {
          headers: headers,
          params: params,
          timeout: 30000
        }
      );
      
      const messages = response.data?.data || response.data || [];
      
      return {
        success: true,
        messages: messages,
        total: messages.length
      };
      
    } catch (error) {
      console.error(`[UnipileService] Get messages failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get conversations for an account
   * 
   * @param {string} accountId - Unipile account ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Conversations
   */
  async getConversations(accountId, filters = {}) {
    if (!this.isConfigured()) {
      throw new Error('Unipile is not configured');
    }
    
    try {
      const baseUrl = this.getBaseUrl();
      const headers = this.getAuthHeaders();
      
      const params = {
        account_id: accountId,
        ...filters
      };
      
      console.log(`[UnipileService] Fetching conversations for account: ${accountId}`);
      
      const response = await axios.get(
        `${baseUrl}/conversations`,
        {
          headers: headers,
          params: params,
          timeout: 30000
        }
      );
      
      const conversations = response.data?.data || response.data || [];
      
      return {
        success: true,
        conversations: conversations,
        total: conversations.length
      };
      
    } catch (error) {
      console.error(`[UnipileService] Get conversations failed:`, error.message);
      throw error;
    }
  }
}

module.exports = UnipileService;
