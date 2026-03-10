/**
 * conversationMessagesRepository.js
 * Data access layer for conversation messages
 * All SQL queries for conversation_messages table with tenant isolation
 */

const logger = require('@shared/logger');

class ConversationMessagesRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get paginated messages for a conversation
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation ID
   * @param {object} options - Options (limit, offset, before)
   * @returns {Promise<Array>} List of messages
   */
  async getMessages(tenantId, conversationId, options = {}) {
    try {
      const { limit = 20, offset = 0, beforeTimestamp } = options;

      let query = `
        SELECT
          id,
          tenant_id,
          conversation_id,
          sender_type,
          sender_id,
          channel,
          message_type,
          content,
          content_html,
          raw_payload,
          provider_message_id,
          ai_generated,
          metadata,
          created_at
        FROM conversation_messages
        WHERE tenant_id = $1 AND conversation_id = $2 AND is_deleted = false
      `;

      const params = [tenantId, conversationId];
      let paramIndex = 3;

      if (beforeTimestamp) {
        query += ` AND created_at < $${paramIndex}`;
        params.push(beforeTimestamp);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      return result.rows.reverse(); // Return in chronological order
    } catch (error) {
      logger.error('Error fetching conversation messages', {
        tenantId,
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get single message by ID
   * @param {string} tenantId - Tenant ID
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>} Message object
   */
  async getMessageById(tenantId, messageId) {
    try {
      const query = `
        SELECT
          id,
          tenant_id,
          conversation_id,
          sender_type,
          sender_id,
          channel,
          message_type,
          content,
          content_html,
          raw_payload,
          provider_message_id,
          ai_generated,
          metadata,
          created_at
        FROM conversation_messages
        WHERE id = $1 AND tenant_id = $2 AND is_deleted = false
      `;

      const result = await this.db.query(query, [messageId, tenantId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching message by ID', {
        tenantId,
        messageId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create a new message
   * @param {string} tenantId - Tenant ID
   * @param {object} data - Message data
   * @returns {Promise<Object>} Created message
   */
  async createMessage(tenantId, data) {
    try {
      const {
        conversationId,
        senderType,
        senderId,
        channel,
        messageType,
        content,
        contentHtml,
        rawPayload = {},
        providerMessageId,
        aiGenerated = false,
        metadata = {},
      } = data;

      const query = `
        INSERT INTO conversation_messages (
          tenant_id,
          conversation_id,
          sender_type,
          sender_id,
          channel,
          message_type,
          content,
          content_html,
          raw_payload,
          provider_message_id,
          ai_generated,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING
          id,
          tenant_id,
          conversation_id,
          sender_type,
          sender_id,
          channel,
          message_type,
          content,
          content_html,
          raw_payload,
          provider_message_id,
          ai_generated,
          metadata,
          created_at
      `;

      const result = await this.db.query(query, [
        tenantId,
        conversationId,
        senderType,
        senderId || null,
        channel,
        messageType,
        content,
        contentHtml || null,
        JSON.stringify(rawPayload),
        providerMessageId || null,
        aiGenerated,
        JSON.stringify(metadata),
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating conversation message', {
        tenantId,
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find message by provider message ID
   * @param {string} tenantId - Tenant ID
   * @param {string} channel - Channel type
   * @param {string} providerMessageId - Provider message ID
   * @returns {Promise<Object>} Message object or null
   */
  async findByProviderMessageId(tenantId, channel, providerMessageId) {
    try {
      const query = `
        SELECT
          id,
          tenant_id,
          conversation_id,
          sender_type,
          sender_id,
          channel,
          message_type,
          content,
          content_html,
          raw_payload,
          provider_message_id,
          ai_generated,
          metadata,
          created_at
        FROM conversation_messages
        WHERE tenant_id = $1 AND channel = $2 AND provider_message_id = $3 AND is_deleted = false
        LIMIT 1
      `;

      const result = await this.db.query(query, [tenantId, channel, providerMessageId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding message by provider ID', {
        tenantId,
        channel,
        providerMessageId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get AI messages for a conversation
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation ID
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} List of AI messages
   */
  async getAIMessages(tenantId, conversationId, limit = 10) {
    try {
      const query = `
        SELECT
          id,
          tenant_id,
          conversation_id,
          sender_type,
          sender_id,
          channel,
          message_type,
          content,
          content_html,
          raw_payload,
          ai_generated,
          metadata,
          created_at
        FROM conversation_messages
        WHERE tenant_id = $1 AND conversation_id = $2 AND ai_generated = true AND is_deleted = false
        ORDER BY created_at DESC
        LIMIT $3
      `;

      const result = await this.db.query(query, [tenantId, conversationId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching AI messages', {
        tenantId,
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update message metadata
   * @param {string} tenantId - Tenant ID
   * @param {string} messageId - Message ID
   * @param {object} metadata - New metadata
   * @returns {Promise<Object>} Updated message
   */
  async updateMessageMetadata(tenantId, messageId, metadata) {
    try {
      const query = `
        UPDATE conversation_messages
        SET metadata = $3
        WHERE id = $1 AND tenant_id = $2 AND is_deleted = false
        RETURNING
          id,
          tenant_id,
          conversation_id,
          sender_type,
          sender_id,
          channel,
          message_type,
          content,
          content_html,
          raw_payload,
          provider_message_id,
          ai_generated,
          metadata,
          created_at
      `;

      const result = await this.db.query(query, [messageId, tenantId, JSON.stringify(metadata)]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating message metadata', {
        tenantId,
        messageId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Soft delete message
   * @param {string} tenantId - Tenant ID
   * @param {string} messageId - Message ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteMessage(tenantId, messageId) {
    try {
      const query = `
        UPDATE conversation_messages
        SET is_deleted = true
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
      `;

      const result = await this.db.query(query, [messageId, tenantId]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error deleting conversation message', {
        tenantId,
        messageId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get message count for a conversation
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<number>} Message count
   */
  async getMessageCount(tenantId, conversationId) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM conversation_messages
        WHERE tenant_id = $1 AND conversation_id = $2 AND is_deleted = false
      `;

      const result = await this.db.query(query, [tenantId, conversationId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error getting message count', {
        tenantId,
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = ConversationMessagesRepository;
