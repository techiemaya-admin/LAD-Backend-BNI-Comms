/**
 * conversationParticipantsRepository.js
 * Data access layer for conversation participants
 * All SQL queries for conversation_participants table with tenant isolation
 */

const logger = require('@shared/logger');

class ConversationParticipantsRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get all participants for a conversation
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array>} List of participants
   */
  async getParticipants(tenantId, conversationId) {
    try {
      const query = `
        SELECT
          id,
          conversation_id,
          tenant_id,
          participant_type,
          participant_id,
          participant_email,
          is_active,
          created_at
        FROM conversation_participants
        WHERE tenant_id = $1 AND conversation_id = $2 AND is_active = true
        ORDER BY created_at ASC
      `;

      const result = await this.db.query(query, [tenantId, conversationId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching conversation participants', {
        tenantId,
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get participant by ID
   * @param {string} tenantId - Tenant ID
   * @param {string} participantId - Participant ID
   * @returns {Promise<Object>} Participant object
   */
  async getParticipantById(tenantId, participantId) {
    try {
      const query = `
        SELECT
          id,
          conversation_id,
          tenant_id,
          participant_type,
          participant_id,
          participant_email,
          is_active,
          created_at
        FROM conversation_participants
        WHERE id = $1 AND tenant_id = $2 AND is_active = true
      `;

      const result = await this.db.query(query, [participantId, tenantId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching participant by ID', {
        tenantId,
        participantId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add participant to conversation
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation ID
   * @param {object} data - Participant data
   * @returns {Promise<Object>} Created participant
   */
  async addParticipant(tenantId, conversationId, data) {
    try {
      const {
        participantType,
        participantId,
        participantEmail,
      } = data;

      const query = `
        INSERT INTO conversation_participants (
          conversation_id,
          tenant_id,
          participant_type,
          participant_id,
          participant_email,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (conversation_id, participant_type, participant_id)
        DO UPDATE SET
          is_active = true,
          participant_email = EXCLUDED.participant_email
        RETURNING
          id,
          conversation_id,
          tenant_id,
          participant_type,
          participant_id,
          participant_email,
          is_active,
          created_at
      `;

      const result = await this.db.query(query, [
        conversationId,
        tenantId,
        participantType,
        participantId || null,
        participantEmail || null,
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error adding conversation participant', {
        tenantId,
        conversationId,
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove participant from conversation
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation ID
   * @param {string} participantType - Participant type
   * @param {string} participantId - Participant ID
   * @returns {Promise<boolean>} Success status
   */
  async removeParticipant(tenantId, conversationId, participantType, participantId) {
    try {
      const query = `
        UPDATE conversation_participants
        SET is_active = false
        WHERE
          tenant_id = $1
          AND conversation_id = $2
          AND participant_type = $3
          AND participant_id = $4
        RETURNING id
      `;

      const result = await this.db.query(query, [
        tenantId,
        conversationId,
        participantType,
        participantId,
      ]);

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error removing conversation participant', {
        tenantId,
        conversationId,
        participantType,
        participantId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if participant exists in conversation
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation ID
   * @param {string} participantType - Participant type
   * @param {string} participantId - Participant ID
   * @returns {Promise<boolean>} Whether participant exists
   */
  async participantExists(tenantId, conversationId, participantType, participantId) {
    try {
      const query = `
        SELECT 1
        FROM conversation_participants
        WHERE
          tenant_id = $1
          AND conversation_id = $2
          AND participant_type = $3
          AND participant_id = $4
          AND is_active = true
        LIMIT 1
      `;

      const result = await this.db.query(query, [
        tenantId,
        conversationId,
        participantType,
        participantId,
      ]);

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking participant existence', {
        tenantId,
        conversationId,
        participantType,
        participantId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get conversations for a participant
   * @param {string} tenantId - Tenant ID
   * @param {string} participantType - Participant type
   * @param {string} participantId - Participant ID
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} List of conversation IDs
   */
  async getConversationsForParticipant(tenantId, participantType, participantId, limit = 50) {
    try {
      const query = `
        SELECT DISTINCT
          cp.conversation_id
        FROM conversation_participants cp
        WHERE
          cp.tenant_id = $1
          AND cp.participant_type = $2
          AND cp.participant_id = $3
          AND cp.is_active = true
        LIMIT $4
      `;

      const result = await this.db.query(query, [tenantId, participantType, participantId, limit]);
      return result.rows.map(row => row.conversation_id);
    } catch (error) {
      logger.error('Error fetching conversations for participant', {
        tenantId,
        participantType,
        participantId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = ConversationParticipantsRepository;
