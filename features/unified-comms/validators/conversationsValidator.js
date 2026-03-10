/**
 * conversationsValidator.js
 * Input validation functions for conversation endpoints
 */

const logger = require('@shared/logger');

class ConversationsValidator {
  /**
   * Validate get threads request
   * @param {object} query - Request query parameters
   * @returns {object} Validated and sanitized query
   */
  static validateGetThreadsQuery(query) {
    try {
      const {
        leadId,
        channel,
        status,
        campaignId,
        q,
        limit = 20,
        offset = 0,
      } = query;

      const validChannels = ['linkedin', 'whatsapp', 'email', 'instagram', 'voice'];
      const validStatuses = ['open', 'closed', 'archived', 'pending'];

      const errors = [];

      if (channel && !validChannels.includes(channel)) {
        errors.push(`Invalid channel: ${channel}`);
      }

      if (status && !validStatuses.includes(status)) {
        errors.push(`Invalid status: ${status}`);
      }

      const parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        errors.push('Limit must be between 1 and 100');
      }

      const parsedOffset = parseInt(offset, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        errors.push('Offset must be a non-negative integer');
      }

      if (errors.length > 0) {
        const error = new Error('Validation failed');
        error.validationErrors = errors;
        throw error;
      }

      return {
        leadId: leadId || null,
        channel: channel || null,
        status: status || 'open',
        campaignId: campaignId || null,
        searchQuery: q || null,
        limit: parsedLimit,
        offset: parsedOffset,
      };
    } catch (error) {
      logger.error('Validation error in getThreadsQuery', {
        query,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate send message request
   * @param {object} data - Request body data
   * @returns {object} Validated and sanitized data
   */
  static validateSendMessage(data) {
    try {
      const {
        conversationId,
        content,
        contentHtml,
        messageType = 'text',
        metadata = {},
      } = data;

      const errors = [];

      if (!conversationId || typeof conversationId !== 'string') {
        errors.push('conversationId is required and must be a string');
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        errors.push('content is required and must be a non-empty string');
      }

      const validMessageTypes = ['text', 'voice', 'attachment', 'image', 'video'];
      if (!validMessageTypes.includes(messageType)) {
        errors.push(`Invalid messageType: ${messageType}`);
      }

      // Check content length (max 5000 chars)
      if (content && content.length > 5000) {
        errors.push('Message content cannot exceed 5000 characters');
      }

      if (errors.length > 0) {
        const error = new Error('Validation failed');
        error.validationErrors = errors;
        throw error;
      }

      return {
        conversationId,
        content: content.trim(),
        contentHtml: contentHtml || null,
        messageType,
        metadata: typeof metadata === 'object' ? metadata : {},
      };
    } catch (error) {
      logger.error('Validation error in sendMessage', {
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate webhook ingestion request
   * @param {string} channel - Channel type
   * @param {object} payload - Webhook payload
   * @returns {object} Validated payload
   */
  static validateWebhookPayload(channel, payload) {
    try {
      if (!channel || typeof channel !== 'string') {
        throw new Error('channel is required');
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('payload is required');
      }

      const validChannels = ['linkedin', 'whatsapp', 'email', 'instagram', 'voice'];
      if (!validChannels.includes(channel)) {
        throw new Error(`Invalid channel: ${channel}`);
      }

      return {
        channel,
        payload,
      };
    } catch (error) {
      logger.error('Validation error in webhook payload', {
        channel,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate update status request
   * @param {object} data - Request body data
   * @returns {object} Validated data
   */
  static validateUpdateStatus(data) {
    try {
      const { status } = data;

      const validStatuses = ['open', 'closed', 'archived', 'pending'];

      if (!status || !validStatuses.includes(status)) {
        const error = new Error('Validation failed');
        error.validationErrors = [`status must be one of: ${validStatuses.join(', ')}`];
        throw error;
      }

      return { status };
    } catch (error) {
      logger.error('Validation error in updateStatus', {
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate add participant request
   * @param {object} data - Request body data
   * @returns {object} Validated data
   */
  static validateAddParticipant(data) {
    try {
      const {
        participantType,
        participantId,
        participantEmail,
      } = data;

      const errors = [];

      const validParticipantTypes = ['lead', 'user', 'ai'];
      if (!participantType || !validParticipantTypes.includes(participantType)) {
        errors.push(`participantType must be one of: ${validParticipantTypes.join(', ')}`);
      }

      if (participantType === 'lead' || participantType === 'user') {
        if (!participantId || typeof participantId !== 'string') {
          errors.push('participantId is required for lead and user types');
        }
      }

      // Basic email validation
      if (participantEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(participantEmail)) {
          errors.push('participantEmail is not valid');
        }
      }

      if (errors.length > 0) {
        const error = new Error('Validation failed');
        error.validationErrors = errors;
        throw error;
      }

      return {
        participantType,
        participantId: participantId || null,
        participantEmail: participantEmail || null,
      };
    } catch (error) {
      logger.error('Validation error in addParticipant', {
        data,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = ConversationsValidator;
