/**
 * AI Message Data Service
 * Business logic for fetching and processing AI message data for campaigns
 * LAD Architecture: Service layer - calls Repository, contains business logic
 */

const AIMessageRepository = require('../repositories/AIMessageRepository');
const { getSchema } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');

class AIMessageDataService {
  /**
   * Fetch message_data from ai_messages for a conversation
   * @param {string} conversationId - UUID of the conversation
   * @param {string} tenantId - Tenant UUID (from JWT)
   * @returns {Promise<Object|null>} The message_data JSONB object
   */
  static async fetchMessageDataByConversation(conversationId, tenantId) {
    // Validate tenant context
    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    if (!conversationId) {
      throw new Error('Conversation ID required');
    }

    const schema = getSchema();
    
    try {
      const messageRow = await AIMessageRepository.findMessageDataByConversation(
        conversationId,
        tenantId,
        schema
      );

      if (!messageRow) {
        logger.warn('[AIMessageDataService] No message_data found for conversation', {
          conversationId,
          tenantId
        });
        return null;
      }

      // Validate tenant ownership
      if (messageRow.tenant_id !== tenantId) {
        logger.error('[AIMessageDataService] Tenant mismatch - security violation', {
          conversationId,
          requestedTenantId: tenantId,
          actualTenantId: messageRow.tenant_id
        });
        throw new Error('Unauthorized access to conversation');
      }

      const messageData = messageRow.message_data;
      
      logger.info('[AIMessageDataService] Fetched message_data from ai_messages', {
        conversationId,
        tenantId,
        messageId: messageRow.id,
        hasTimestamp: !!messageData.timestamp,
        hasCampaignDays: !!(messageData.collectedAnswers?.campaign_days),
        hasWorkingDays: !!(messageData.collectedAnswers?.working_days)
      });

      return messageData;
    } catch (error) {
      logger.error('[AIMessageDataService] Error fetching message_data', {
        error: error.message,
        conversationId,
        tenantId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Fetch all message_data entries for a conversation (for debugging)
   * @param {string} conversationId - UUID of the conversation
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Array>} Array of message_data objects
   */
  static async fetchAllMessageDataByConversation(conversationId, tenantId) {
    // Validate tenant context
    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    if (!conversationId) {
      throw new Error('Conversation ID required');
    }

    const schema = getSchema();
    
    try {
      const messageRows = await AIMessageRepository.findAllMessageDataByConversation(
        conversationId,
        tenantId,
        schema
      );

      return messageRows.map(row => ({
        id: row.id,
        role: row.role,
        messageData: row.message_data,
        createdAt: row.created_at,
        tenantId: row.tenant_id
      }));
    } catch (error) {
      logger.error('[AIMessageDataService] Error fetching all message_data', {
        error: error.message,
        conversationId,
        tenantId,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = AIMessageDataService;
