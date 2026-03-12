/**
 * conversationThreadsRepository.js
 * Data access layer for conversation threads
 * All SQL queries for conversations table with tenant isolation
 */

const logger = require('@shared/logger');

class ConversationThreadsRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get paginated conversation threads
   * @param {string} tenantId - Tenant ID
   * @param {object} filters - Filter options
   * @param {number} limit - Results per page
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Array>} List of conversation threads
   */
  async getThreads(tenantId, filters = {}, limit = 20, offset = 0) {
    try {
      const {
        leadId,
        channel,
        status = 'open',
        campaignId,
        searchQuery,
      } = filters;

      let query = `
        SELECT
          c.id,
          c.tenant_id,
          c.lead_id,
          c.campaign_id,
          c.channel,
          c.external_thread_id,
          c.status,
          c.last_message_at,
          c.last_message_preview,
          c.metadata,
          c.created_at,
          c.updated_at,
          COUNT(cm.id) as message_count
        FROM conversations c
        LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id AND cm.is_deleted = false
        WHERE c.tenant_id = $1 AND c.is_deleted = false
      `;

      const params = [tenantId];
      let paramIndex = 2;

      if (leadId) {
        query += ` AND c.lead_id = $${paramIndex}`;
        params.push(leadId);
        paramIndex++;
      }

      if (channel) {
        query += ` AND c.channel = $${paramIndex}`;
        params.push(channel);
        paramIndex++;
      }

      if (status) {
        query += ` AND c.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (campaignId) {
        query += ` AND c.campaign_id = $${paramIndex}`;
        params.push(campaignId);
        paramIndex++;
      }

      if (searchQuery) {
        query += ` AND (c.last_message_preview ILIKE $${paramIndex} OR c.external_thread_id ILIKE $${paramIndex})`;
        params.push(`%${searchQuery}%`);
        paramIndex++;
      }

      query += ` GROUP BY c.id ORDER BY c.last_message_at DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching conversation threads', {
        tenantId,
        filters,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get thread count for pagination
   * @param {string} tenantId - Tenant ID
   * @param {object} filters - Filter options
   * @returns {Promise<number>} Total count
   */
  async getThreadsCount(tenantId, filters = {}) {
    try {
      const {
        leadId,
        channel,
        status = 'open',
        campaignId,
        searchQuery,
      } = filters;

      let query = `
        SELECT COUNT(*) as total
        FROM conversations
        WHERE tenant_id = $1 AND is_deleted = false
      `;

      const params = [tenantId];
      let paramIndex = 2;

      if (leadId) {
        query += ` AND lead_id = $${paramIndex}`;
        params.push(leadId);
        paramIndex++;
      }

      if (channel) {
        query += ` AND channel = $${paramIndex}`;
        params.push(channel);
        paramIndex++;
      }

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (campaignId) {
        query += ` AND campaign_id = $${paramIndex}`;
        params.push(campaignId);
        paramIndex++;
      }

      if (searchQuery) {
        query += ` AND (last_message_preview ILIKE $${paramIndex} OR external_thread_id ILIKE $${paramIndex})`;
        params.push(`%${searchQuery}%`);
        paramIndex++;
      }

      const result = await this.db.query(query, params);
      return parseInt(result.rows[0].total, 10);
    } catch (error) {
      logger.error('Error counting conversation threads', {
        tenantId,
        filters,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get single conversation thread by ID
   * @param {string} tenantId - Tenant ID
   * @param {string} threadId - Thread ID
   * @returns {Promise<Object>} Conversation thread
   */
  async getThreadById(tenantId, threadId) {
    try {
      const query = `
        SELECT
          id,
          tenant_id,
          lead_id,
          campaign_id,
          channel,
          external_thread_id,
          status,
          last_message_at,
          last_message_preview,
          metadata,
          created_at,
          updated_at
        FROM conversations
        WHERE id = $1 AND tenant_id = $2 AND is_deleted = false
      `;

      const result = await this.db.query(query, [threadId, tenantId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching conversation thread by ID', {
        tenantId,
        threadId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create a new conversation thread
   * @param {string} tenantId - Tenant ID
   * @param {object} data - Thread data
   * @returns {Promise<Object>} Created thread
   */
  async createThread(tenantId, data) {
    try {
      const {
        leadId,
        campaignId,
        channel,
        externalThreadId,
        status = 'open',
        metadata = {},
      } = data;

      const query = `
        INSERT INTO conversations (
          tenant_id,
          lead_id,
          campaign_id,
          channel,
          external_thread_id,
          status,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          tenant_id,
          lead_id,
          campaign_id,
          channel,
          external_thread_id,
          status,
          metadata,
          created_at,
          updated_at
      `;

      const result = await this.db.query(query, [
        tenantId,
        leadId || null,
        campaignId || null,
        channel,
        externalThreadId,
        status,
        JSON.stringify(metadata),
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating conversation thread', {
        tenantId,
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update conversation thread
   * @param {string} tenantId - Tenant ID
   * @param {string} threadId - Thread ID
   * @param {object} data - Updated data
   * @returns {Promise<Object>} Updated thread
   */
  async updateThread(tenantId, threadId, data) {
    try {
      const {
        status,
        lastMessageAt,
        lastMessagePreview,
        metadata,
      } = data;

      const updates = [];
      const params = [tenantId, threadId];
      let paramIndex = 3;

      if (status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (lastMessageAt !== undefined) {
        updates.push(`last_message_at = $${paramIndex}`);
        params.push(lastMessageAt);
        paramIndex++;
      }

      if (lastMessagePreview !== undefined) {
        updates.push(`last_message_preview = $${paramIndex}`);
        params.push(lastMessagePreview);
        paramIndex++;
      }

      if (metadata !== undefined) {
        updates.push(`metadata = $${paramIndex}`);
        params.push(JSON.stringify(metadata));
        paramIndex++;
      }

      if (updates.length === 0) {
        return this.getThreadById(tenantId, threadId);
      }

      const query = `
        UPDATE conversations
        SET ${updates.join(', ')}
        WHERE id = $2 AND tenant_id = $1 AND is_deleted = false
        RETURNING
          id,
          tenant_id,
          lead_id,
          campaign_id,
          channel,
          external_thread_id,
          status,
          last_message_at,
          last_message_preview,
          metadata,
          created_at,
          updated_at
      `;

      const result = await this.db.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating conversation thread', {
        tenantId,
        threadId,
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find or create conversation by external thread ID
   * @param {string} tenantId - Tenant ID
   * @param {string} channel - Channel type
   * @param {string} externalThreadId - External thread ID
   * @param {object} createData - Data for thread creation if not exists
   * @returns {Promise<Object>} Conversation thread
   */
  async findOrCreateByExternalId(tenantId, channel, externalThreadId, createData = {}) {
    try {
      // First, try to find existing thread
      const findQuery = `
        SELECT
          id,
          tenant_id,
          lead_id,
          campaign_id,
          channel,
          external_thread_id,
          status,
          last_message_at,
          last_message_preview,
          metadata,
          created_at,
          updated_at
        FROM conversations
        WHERE tenant_id = $1 AND channel = $2 AND external_thread_id = $3 AND is_deleted = false
      `;

      const findResult = await this.db.query(findQuery, [tenantId, channel, externalThreadId]);

      if (findResult.rows.length > 0) {
        return findResult.rows[0];
      }

      // Create new thread if not found
      return this.createThread(tenantId, {
        channel,
        externalThreadId,
        ...createData,
      });
    } catch (error) {
      logger.error('Error finding or creating conversation by external ID', {
        tenantId,
        channel,
        externalThreadId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Soft delete conversation thread
   * @param {string} tenantId - Tenant ID
   * @param {string} threadId - Thread ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteThread(tenantId, threadId) {
    try {
      const query = `
        UPDATE conversations
        SET is_deleted = true
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
      `;

      const result = await this.db.query(query, [threadId, tenantId]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error deleting conversation thread', {
        tenantId,
        threadId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = ConversationThreadsRepository;
