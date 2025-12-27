/**
 * VAPI Service1.0
 * 
 * Integrates with VAPI API for AI-powered voice calls
 * Handles call initiation, assistant configuration, and dynamic greetings
 * 
 * VAPI API: https://api.vapi.ai/call
 */

const axios = require('axios');

class VAPIService {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.VAPI_API_KEY;
    this.assistantId = config.assistantId || process.env.VAPI_ASSISTANT_ID;
    this.phoneNumberId = config.phoneNumberId || process.env.VAPI_PHONE_NUMBER_ID;
    this.apiUrl = 'https://api.vapi.ai/call';
    
    if (!this.apiKey) {
      throw new Error('VAPI API key is required');
    }
  }

  /**
   * Initialize call via VAPI API
   * 
   * @param {Object} params - Call parameters
   * @param {string} params.phoneNumber - Recipient phone number
   * @param {string} params.leadName - Lead name for personalization
   * @param {string} params.agentId - Agent ID (if "24" or "VAPI", use VAPI)
   * @param {string} params.addedContext - Additional context for the call
   * @param {Object} params.assistantOverrides - Assistant configuration overrides
   * @returns {Promise<Object>} VAPI call response
   */
  async initiateCall({
    phoneNumber,
    leadName,
    agentId,
    addedContext = '',
    assistantOverrides = {}
  }) {
    // Check if should route to VAPI
    if (!this.shouldUseVAPI(agentId)) {
      throw new Error('Agent is not configured for VAPI routing');
    }

    // Generate greeting based on time of day
    const greeting = this.generateGreeting();

    // Build first message with lead name
    const firstMessage = this.buildFirstMessage(leadName, greeting, addedContext);

    // Build VAPI request payload
    const payload = {
      phoneNumberId: this.phoneNumberId,
      customer: {
        number: phoneNumber
      },
      assistantId: this.assistantId,
      assistantOverrides: {
        firstMessage,
        ...assistantOverrides
      }
    };

    try {
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        vapiCallId: response.data.id,
        status: response.data.status,
        data: response.data
      };
    } catch (error) {
      console.error('VAPI API Error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        errorDetails: error.response?.data
      };
    }
  }

  /**
   * Batch initiate calls via VAPI
   * 
   * @param {Array<Object>} entries - Array of call entries
   * @param {string} entries[].phoneNumber - Recipient phone number
   * @param {string} entries[].leadName - Lead name
   * @param {string} entries[].added_context - Entry-specific context
   * @param {string} globalContext - Global context for all calls
   * @param {string} agentId - Agent ID
   * @param {Object} assistantOverrides - Global assistant overrides
   * @returns {Promise<Array>} Array of call results
   */
  async batchInitiateCalls({
    entries,
    globalContext = '',
    agentId,
    assistantOverrides = {}
  }) {
    const results = [];

    // Process calls sequentially to avoid rate limiting
    for (const entry of entries) {
      // Context priority: entry.added_context > entry.summary > globalContext
      const contextToUse = entry.added_context || entry.summary || globalContext;

      try {
        const result = await this.initiateCall({
          phoneNumber: entry.phoneNumber,
          leadName: entry.leadName || entry.name,
          agentId,
          addedContext: contextToUse,
          assistantOverrides
        });

        results.push({
          phoneNumber: entry.phoneNumber,
          leadName: entry.leadName || entry.name,
          success: result.success,
          vapiCallId: result.vapiCallId,
          error: result.error
        });

        // Add delay between calls to respect rate limits (500ms)
        await this.delay(500);
      } catch (error) {
        results.push({
          phoneNumber: entry.phoneNumber,
          leadName: entry.leadName || entry.name,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Check if agent should route to VAPI
   * 
   * @param {string} agentId - Agent ID
   * @returns {boolean} Should use VAPI
   */
  shouldUseVAPI(agentId) {
    // VAPI routing: agent_id === "24" or "VAPI"
    return agentId === '24' || agentId === 'VAPI' || agentId === 24;
  }

  /**
   * Generate time-based greeting
   * Based on current hour (morning/afternoon/evening)
   * 
   * @returns {string} Greeting text
   */
  generateGreeting() {
    const hour = new Date().getHours();

    if (hour >= 0 && hour < 12) {
      return 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon';
    } else {
      return 'Good evening';
    }
  }

  /**
   * Build first message with lead name and context
   * 
   * Template: "Hi {lead_name}. {greeting}. This is Nithya from Pluto Travels..."
   * 
   * @param {string} leadName - Lead name
   * @param {string} greeting - Time-based greeting
   * @param {string} addedContext - Additional context
   * @returns {string} First message
   */
  buildFirstMessage(leadName, greeting, addedContext = '') {
    let message = `Hi ${leadName}. ${greeting}. This is Nithya from Pluto Travels.`;

    // Append context if provided
    if (addedContext) {
      message += ` ${addedContext}`;
    }

    return message;
  }

  /**
   * Get call status from VAPI
   * 
   * @param {string} vapiCallId - VAPI call ID
   * @returns {Promise<Object>} Call status
   */
  async getCallStatus(vapiCallId) {
    try {
      const response = await axios.get(`${this.apiUrl}/${vapiCallId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return {
        success: true,
        status: response.data.status,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Update call (if supported by VAPI API)
   * 
   * @param {string} vapiCallId - VAPI call ID
   * @param {Object} updates - Update payload
   * @returns {Promise<Object>} Update result
   */
  async updateCall(vapiCallId, updates) {
    try {
      const response = await axios.patch(
        `${this.apiUrl}/${vapiCallId}`,
        updates,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * End call via VAPI API
   * 
   * @param {string} vapiCallId - VAPI call ID
   * @returns {Promise<Object>} End call result
   */
  async endCall(vapiCallId) {
    try {
      const response = await axios.delete(`${this.apiUrl}/${vapiCallId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Build assistant overrides with custom configuration
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.firstMessage - Custom first message
   * @param {string} options.systemPrompt - System prompt override
   * @param {Object} options.metadata - Metadata to attach
   * @returns {Object} Assistant overrides
   */
  buildAssistantOverrides({
    firstMessage = null,
    systemPrompt = null,
    metadata = {}
  } = {}) {
    const overrides = {};

    if (firstMessage) {
      overrides.firstMessage = firstMessage;
    }

    if (systemPrompt) {
      overrides.systemPrompt = systemPrompt;
    }

    if (Object.keys(metadata).length > 0) {
      overrides.metadata = metadata;
    }

    return overrides;
  }

  /**
   * Validate phone number format
   * 
   * @param {string} phoneNumber - Phone number
   * @returns {boolean} Is valid
   */
  isValidPhoneNumber(phoneNumber) {
    if (!phoneNumber) return false;
    
    // Remove common formatting characters
    const cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
    
    // Check if it's a valid international number (e.g., +1234567890)
    const internationalPattern = /^\+\d{10,15}$/;
    
    // Check if it's a valid US number (10 digits)
    const usPattern = /^\d{10}$/;
    
    return internationalPattern.test(cleaned) || usPattern.test(cleaned);
  }

  /**
   * Format phone number for VAPI
   * Ensures E.164 format (+[country code][number])
   * 
   * @param {string} phoneNumber - Phone number
   * @param {string} defaultCountryCode - Default country code (e.g., '+1')
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phoneNumber, defaultCountryCode = '+1') {
    if (!phoneNumber) return null;

    // Remove all non-digit characters except '+'
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // If already has '+', return as is
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    // If starts with country code without '+', add it
    if (cleaned.length > 10) {
      return `+${cleaned}`;
    }

    // Otherwise, add default country code
    return `${defaultCountryCode}${cleaned}`;
  }

  /**
   * Delay helper for rate limiting
   * 
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Delay promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate VAPI configuration
   * 
   * @returns {Object} Validation result
   */
  validateConfig() {
    const errors = [];

    if (!this.apiKey) {
      errors.push('VAPI API key is missing');
    }
    if (!this.assistantId) {
      errors.push('VAPI Assistant ID is missing');
    }
    if (!this.phoneNumberId) {
      errors.push('VAPI Phone Number ID is missing');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get VAPI configuration info
   * 
   * @returns {Object} Configuration info (without sensitive data)
   */
  getConfigInfo() {
    return {
      hasApiKey: !!this.apiKey,
      assistantId: this.assistantId || 'not configured',
      phoneNumberId: this.phoneNumberId || 'not configured',
      apiUrl: this.apiUrl
    };
  }
}

module.exports = VAPIService;
