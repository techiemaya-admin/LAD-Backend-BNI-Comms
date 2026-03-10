/**
 * conversationsService.js
 * Business logic layer for conversations
 * No SQL queries here - all DB access through repositories
 */

const logger = require('@shared/logger');

class ConversationsService {
  constructor(
    conversationThreadsRepository,
    conversationMessagesRepository,
    conversationParticipantsRepository,
    normalizationService,
  ) {
    this.threadsRepo = conversationThreadsRepository;
    this.messagesRepo = conversationMessagesRepository;
    this.participantsRepo = conversationParticipantsRepository;
    this.normalizationService = normalizationService;
  }

  /**
   * Get paginated conversation threads for tenant
   * @param {string} tenantId - Tenant ID
   * @param {object} filters - Filter options
   * @param {number} limit - Results per page
   * @param {number} offset - Offset for pagination
   * @returns {Promise<{threads: Array, total: number}>} Threads and total count
   */
  async getThreads(tenantId, filters = {}, limit = 20, offset = 0) {
    try {
      logger.debug('Fetching conversation threads', { tenantId, filters, limit, offset });

      const [threads, total] = await Promise.all([
        this.threadsRepo.getThreads(tenantId, filters, limit, offset),
        this.threadsRepo.getThreadsCount(tenantId, filters),
      ]);

      return {
        threads,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      };
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
   * Get single conversation thread with messages
   * @param {string} tenantId - Tenant ID
   * @param {string} threadId - Thread ID
   * @param {object} options - Options for messages
   * @returns {Promise<Object>} Thread with messages and participants
   */
  async getThreadWithContext(tenantId, threadId, options = {}) {
    try {
      logger.debug('Fetching thread with context', { tenantId, threadId });

      const [thread, messages, participants] = await Promise.all([
        this.threadsRepo.getThreadById(tenantId, threadId),
        this.messagesRepo.getMessages(tenantId, threadId, options),
        this.participantsRepo.getParticipants(tenantId, threadId),
      ]);

      if (!thread) {
        throw new Error(`Thread ${threadId} not found for tenant ${tenantId}`);
      }

      return {
        ...thread,
        messages,
        participants,
        messageCount: messages.length,
      };
    } catch (error) {
      logger.error('Error fetching thread with context', {
        tenantId,
        threadId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create or get conversation thread
   * @param {string} tenantId - Tenant ID
   * @param {string} channel - Channel type
   * @param {string} externalThreadId - External thread ID
   * @param {object} createData - Data for thread creation
   * @returns {Promise<Object>} Conversation thread
   */
  async getOrCreateThread(tenantId, channel, externalThreadId, createData = {}) {
    try {
      logger.debug('Getting or creating conversation thread', {
        tenantId,
        channel,
        externalThreadId,
      });

      return await this.threadsRepo.findOrCreateByExternalId(
        tenantId,
        channel,
        externalThreadId,
        createData,
      );
    } catch (error) {
      logger.error('Error getting or creating thread', {
        tenantId,
        channel,
        externalThreadId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create a new outbound message
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation ID
   * @param {object} data - Message data
   * @returns {Promise<Object>} Created message
   */
  async sendMessage(tenantId, conversationId, data) {
    try {
      logger.debug('Creating outbound message', {
        tenantId,
        conversationId,
        messageType: data.messageType,
      });

      const thread = await this.threadsRepo.getThreadById(tenantId, conversationId);
      if (!thread) {
        throw new Error(`Conversation ${conversationId} not found for tenant ${tenantId}`);
      }

      const message = await this.messagesRepo.createMessage(tenantId, {
        ...data,
        conversationId,
        senderType: data.senderType || 'user',
      });

      // Update thread with last message info
      await this.threadsRepo.updateThread(tenantId, conversationId, {
        lastMessageAt: message.created_at,
        lastMessagePreview: this._truncatePreview(message.content),
      });

      logger.info('Message created successfully', {
        tenantId,
        conversationId,
        messageId: message.id,
      });

      return message;
    } catch (error) {
      logger.error('Error creating message', {
        tenantId,
        conversationId,
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Ingest message from external provider webhook
   * @param {string} tenantId - Tenant ID
   * @param {string} channel - Channel type
   * @param {object} payload - Raw provider payload
   * @returns {Promise<Object>} Normalized message
   */
  async ingestWebhookMessage(tenantId, channel, payload) {
    try {
      logger.debug('Ingesting webhook message', { tenantId, channel });

      // Normalize provider payload
      const normalized = this.normalizationService.normalize(channel, payload);

      // Get or create thread
      const thread = await this.getOrCreateThread(
        tenantId,
        channel,
        normalized.threadId,
        {
          leadId: normalized.leadId,
          campaignId: normalized.campaignId,
        },
      );

      // Check if message already exists (idempotency)
      const existingMessage = await this.messagesRepo.findByProviderMessageId(
        tenantId,
        channel,
        normalized.messageId,
      );

      if (existingMessage) {
        logger.info('Message already ingested', {
          tenantId,
          channel,
          messageId: normalized.messageId,
        });
        return existingMessage;
      }

      // Create message
      const message = await this.messagesRepo.createMessage(tenantId, {
        conversationId: thread.id,
        senderType: normalized.senderType,
        senderId: normalized.senderId,
        channel,
        messageType: normalized.messageType,
        content: normalized.content,
        contentHtml: normalized.contentHtml,
        rawPayload: payload,
        providerMessageId: normalized.messageId,
        aiGenerated: normalized.aiGenerated || false,
        metadata: normalized.metadata || {},
      });

      // Add participant if applicable
      if (normalized.senderId && normalized.senderType) {
        await this.participantsRepo.addParticipant(tenantId, thread.id, {
          participantType: normalized.senderType,
          participantId: normalized.senderId,
          participantEmail: normalized.senderEmail,
        });
      }

      // Update thread with last message
      await this.threadsRepo.updateThread(tenantId, thread.id, {
        lastMessageAt: message.created_at,
        lastMessagePreview: this._truncatePreview(message.content),
      });

      logger.info('Webhook message ingested successfully', {
        tenantId,
        channel,
        threadId: thread.id,
        messageId: message.id,
      });

      return message;
    } catch (error) {
      logger.error('Error ingesting webhook message', {
        tenantId,
        channel,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update conversation status
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated conversation
   */
  async updateConversationStatus(tenantId, conversationId, status) {
    try {
      const validStatuses = ['open', 'closed', 'archived', 'pending'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      logger.debug('Updating conversation status', {
        tenantId,
        conversationId,
        status,
      });

      const updated = await this.threadsRepo.updateThread(tenantId, conversationId, {
        status,
      });

      if (!updated) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      logger.info('Conversation status updated', {
        tenantId,
        conversationId,
        status,
      });

      return updated;
    } catch (error) {
      logger.error('Error updating conversation status', {
        tenantId,
        conversationId,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add participant to conversation
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation ID
   * @param {object} participantData - Participant data
   * @returns {Promise<Object>} Created participant
   */
  async addParticipant(tenantId, conversationId, participantData) {
    try {
      logger.debug('Adding participant to conversation', {
        tenantId,
        conversationId,
        participantType: participantData.participantType,
      });

      return await this.participantsRepo.addParticipant(
        tenantId,
        conversationId,
        participantData,
      );
    } catch (error) {
      logger.error('Error adding participant', {
        tenantId,
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Truncate preview to safe length
   * @private
   * @param {string} text - Text to truncate
   * @returns {string} Truncated text
   */
  _truncatePreview(text) {
    const maxLength = 200;
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  }
}

module.exports = ConversationsService;
