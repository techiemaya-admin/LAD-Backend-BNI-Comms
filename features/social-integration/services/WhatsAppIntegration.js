/**
 * WhatsApp Integration Service
 * 
 * Extends UnipileService for WhatsApp-specific functionality
 */

const UnipileService = require('./UnipileService');

class WhatsAppIntegration extends UnipileService {
  constructor() {
    super();
    this.provider = 'WHATSAPP';
    this.platformName = 'WhatsApp';
  }
  
  /**
   * Send WhatsApp message
   * 
   * @param {string} phoneNumber - Phone number with country code (e.g., +1234567890)
   * @param {string} message - Message content
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Message result
   */
  async sendWhatsAppMessage(phoneNumber, message, accountId) {
    // WhatsApp uses phone number as provider_id
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    return this.sendMessage(normalizedPhone, message, accountId, this.provider);
  }
  
  /**
   * Look up WhatsApp contact
   * 
   * @param {string} phoneNumber - Phone number with country code
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Contact information
   */
  async lookupWhatsAppContact(phoneNumber, accountId) {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    return this.lookupProfile(normalizedPhone, accountId, this.provider);
  }
  
  /**
   * Normalize phone number to E.164 format
   * 
   * @param {string} phoneNumber - Phone number (various formats)
   * @returns {string} Normalized phone number
   */
  normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }
    
    // Remove all non-digit characters except leading +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }
  
  /**
   * Validate phone number
   * 
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} True if valid
   */
  isValidPhoneNumber(phoneNumber) {
    if (!phoneNumber) return false;
    
    // Basic validation: should have 10-15 digits with optional + prefix
    const regex = /^\+?\d{10,15}$/;
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    return regex.test(cleaned);
  }
  
  /**
   * Send WhatsApp media message
   * 
   * @param {string} phoneNumber - Phone number with country code
   * @param {string} mediaUrl - URL of media to send
   * @param {string} caption - Optional caption
   * @param {string} accountId - Unipile account ID
   * @returns {Promise<Object>} Message result
   */
  async sendWhatsAppMedia(phoneNumber, mediaUrl, caption, accountId) {
    if (!this.isConfigured()) {
      throw new Error('Unipile is not configured');
    }
    
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      const baseUrl = this.getBaseUrl();
      const headers = this.getAuthHeaders();
      
      const payload = {
        provider: this.provider,
        account_id: accountId,
        provider_id: normalizedPhone,
        media_url: mediaUrl,
        caption: caption || ''
      };
      
      console.log(`[WhatsAppIntegration] Sending media message to ${normalizedPhone}`);
      
      const response = await axios.post(
        `${baseUrl}/messages/send-media`,
        payload,
        {
          headers: headers,
          timeout: 30000
        }
      );
      
      console.log(`[WhatsAppIntegration] ✅ Media message sent`);
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error(`[WhatsAppIntegration] Media send failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Batch send WhatsApp messages
   * 
   * @param {Array<Object>} contacts - Array of {phoneNumber, message}
   * @param {string} accountId - Unipile account ID
   * @param {number} delayMs - Delay between messages (default: 3000ms)
   * @returns {Promise<Object>} Batch results
   */
  async batchSendMessages(contacts, accountId, delayMs = 3000) {
    console.log(`[WhatsAppIntegration] Batch sending ${contacts.length} messages`);
    
    const results = {
      total: contacts.length,
      successful: 0,
      failed: 0,
      results: []
    };
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        console.log(`[WhatsAppIntegration] Sending ${i + 1}/${contacts.length} to ${contact.phoneNumber}`);
        
        await this.sendWhatsAppMessage(contact.phoneNumber, contact.message, accountId);
        
        results.successful++;
        results.results.push({
          phoneNumber: contact.phoneNumber,
          success: true
        });
        
        // Delay between messages
        if (i < contacts.length - 1 && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
      } catch (error) {
        console.error(`[WhatsAppIntegration] Failed for ${contact.phoneNumber}:`, error.message);
        
        results.failed++;
        results.results.push({
          phoneNumber: contact.phoneNumber,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`[WhatsAppIntegration] Batch complete: ${results.successful} successful, ${results.failed} failed`);
    
    return results;
  }
}

module.exports = WhatsAppIntegration;
