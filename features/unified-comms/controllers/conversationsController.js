/**
 * conversationsController.js
 * Request handling, validation orchestration, and response formatting
 * NO SQL QUERIES - all DB access through services
 */

const logger = require('@shared/logger');
const ConversationsValidator = require('../validators/conversationsValidator');
const ConversationDto = require('../dtos/conversationDto');
const { REQUIRED_CAPABILITIES, ERROR_CODES, PAGINATION_DEFAULTS } = require('../constants/conversationConstants');

class ConversationsController {
  constructor(conversationsService) {
    this.conversationsService = conversationsService;
  }

  /**
   * GET /threads - Get paginated conversation threads
   * Query params: leadId, channel, status, campaignId, q, limit, offset
   */
  async getThreads(req, res, next) {
    try {
      // Extract tenant from authenticated request
      const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
      if (!tenantId) {
        logger.warn('Tenant context missing in getThreads');
        return res.status(400).json(
          ConversationDto.error('Tenant context required', ERROR_CODES.TENANT_REQUIRED),
        );
      }

      // Check capability
      if (!this._hasCapability(req, REQUIRED_CAPABILITIES.GET_THREADS)) {
        logger.warn('User lacks required capability', {
          tenantId,
          capability: REQUIRED_CAPABILITIES.GET_THREADS,
        });
        return res.status(403).json(
          ConversationDto.error('Insufficient permissions', ERROR_CODES.FORBIDDEN),
        );
      }

      // Validate query parameters
      const validatedQuery = ConversationsValidator.validateGetThreadsQuery(req.query);

      // Fetch threads
      const result = await this.conversationsService.getThreads(
        tenantId,
        {
          leadId: validatedQuery.leadId,
          channel: validatedQuery.channel,
          status: validatedQuery.status,
          campaignId: validatedQuery.campaignId,
          searchQuery: validatedQuery.searchQuery,
        },
        validatedQuery.limit,
        validatedQuery.offset,
      );

      logger.info('Threads fetched successfully', {
        tenantId,
        count: result.threads.length,
        total: result.total,
      });

      // Format response
      const threads = ConversationDto.threadsToApi(result.threads);
      return res.status(200).json(
        ConversationDto.paginated(threads, result.total, result.limit, result.offset),
      );
    } catch (error) {
      logger.error('Error in getThreads', { error: error.message });
      return this._handleError(res, error);
    }
  }

  /**
   * GET /threads/:threadId - Get single conversation with messages and participants
   * Query params: limit, offset, before
   */
  async getThread(req, res, next) {
    try {
      const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json(
          ConversationDto.error('Tenant context required', ERROR_CODES.TENANT_REQUIRED),
        );
      }

      if (!this._hasCapability(req, REQUIRED_CAPABILITIES.GET_THREAD)) {
        return res.status(403).json(
          ConversationDto.error('Insufficient permissions', ERROR_CODES.FORBIDDEN),
        );
      }

      const { threadId } = req.params;
      if (!threadId || typeof threadId !== 'string') {
        return res.status(400).json(
          ConversationDto.error('Invalid threadId', ERROR_CODES.VALIDATION_ERROR),
        );
      }

      const options = {
        limit: Math.min(parseInt(req.query.limit, 10) || PAGINATION_DEFAULTS.LIMIT, PAGINATION_DEFAULTS.MAX_LIMIT),
        offset: parseInt(req.query.offset, 10) || PAGINATION_DEFAULTS.OFFSET,
        beforeTimestamp: req.query.before || null,
      };

      const threadData = await this.conversationsService.getThreadWithContext(
        tenantId,
        threadId,
        options,
      );

      logger.info('Thread fetched with context', { tenantId, threadId });

      const response = ConversationDto.threadWithContext(
        threadData,
        threadData.messages,
        threadData.participants,
      );

      return res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getThread', { error: error.message });
      return this._handleError(res, error);
    }
  }

  /**
   * POST /threads/:threadId/messages - Create outbound message
   * Body: { conversationId, content, contentHtml?, messageType, metadata? }
   */
  async sendMessage(req, res, next) {
    try {
      const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json(
          ConversationDto.error('Tenant context required', ERROR_CODES.TENANT_REQUIRED),
        );
      }

      if (!this._hasCapability(req, REQUIRED_CAPABILITIES.SEND_MESSAGE)) {
        return res.status(403).json(
          ConversationDto.error('Insufficient permissions', ERROR_CODES.FORBIDDEN),
        );
      }

      const { threadId } = req.params;
      if (!threadId) {
        return res.status(400).json(
          ConversationDto.error('threadId is required', ERROR_CODES.VALIDATION_ERROR),
        );
      }

      // Validate message data
      const validatedData = ConversationsValidator.validateSendMessage({
        ...req.body,
        conversationId: threadId,
      });

      // Create message
      const message = await this.conversationsService.sendMessage(tenantId, threadId, {
        ...validatedData,
        senderId: req.user?.id,
        channel: req.body.channel || 'unknown',
        senderType: 'user',
      });

      logger.info('Message sent successfully', {
        tenantId,
        threadId,
        messageId: message.id,
      });

      return res.status(201).json(
        ConversationDto.success(ConversationDto.messageToApi(message), 'Message created'),
      );
    } catch (error) {
      logger.error('Error in sendMessage', { error: error.message });
      return this._handleError(res, error);
    }
  }

  /**
   * POST /webhooks/:channel/:provider - Ingest webhook message
   * Validates signature, normalizes payload, stores message
   */
  async ingestWebhook(req, res, next) {
    try {
      const { channel, provider } = req.params;
      const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

      // For webhooks, tenant might come from webhook signature validation
      // or from a configured tenant per webhook endpoint
      if (!tenantId) {
        logger.warn('Tenant context missing in webhook ingestion', { channel, provider });
        return res.status(400).json(
          ConversationDto.error('Tenant context required', ERROR_CODES.TENANT_REQUIRED),
        );
      }

      // Validate webhook signature (provider-specific)
      if (!this._validateWebhookSignature(req, channel, provider)) {
        logger.warn('Invalid webhook signature', { channel, provider, tenantId });
        return res.status(401).json(
          ConversationDto.error('Invalid webhook signature', ERROR_CODES.WEBHOOK_INVALID),
        );
      }

      // Validate payload
      const validatedPayload = ConversationsValidator.validateWebhookPayload(
        channel,
        req.body,
      );

      // Ingest message
      const message = await this.conversationsService.ingestWebhookMessage(
        tenantId,
        validatedPayload.channel,
        validatedPayload.payload,
      );

      logger.info('Webhook message ingested', {
        tenantId,
        channel,
        messageId: message.id,
      });

      // Return 200 quickly for webhook processing
      return res.status(200).json({
        success: true,
        messageId: message.id,
      });
    } catch (error) {
      logger.error('Error in ingestWebhook', {
        channel: req.params?.channel,
        error: error.message,
      });
      return this._handleError(res, error);
    }
  }

  /**
   * PUT /threads/:threadId/status - Update conversation status
   * Body: { status }
   */
  async updateStatus(req, res, next) {
    try {
      const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json(
          ConversationDto.error('Tenant context required', ERROR_CODES.TENANT_REQUIRED),
        );
      }

      if (!this._hasCapability(req, REQUIRED_CAPABILITIES.UPDATE_STATUS)) {
        return res.status(403).json(
          ConversationDto.error('Insufficient permissions', ERROR_CODES.FORBIDDEN),
        );
      }

      const { threadId } = req.params;

      // Validate status
      const validatedData = ConversationsValidator.validateUpdateStatus(req.body);

      // Update status
      const updated = await this.conversationsService.updateConversationStatus(
        tenantId,
        threadId,
        validatedData.status,
      );

      logger.info('Conversation status updated', {
        tenantId,
        threadId,
        status: validatedData.status,
      });

      return res.status(200).json(
        ConversationDto.success(ConversationDto.threadToApi(updated), 'Status updated'),
      );
    } catch (error) {
      logger.error('Error in updateStatus', { error: error.message });
      return this._handleError(res, error);
    }
  }

  /**
   * POST /threads/:threadId/participants - Add participant to conversation
   * Body: { participantType, participantId, participantEmail? }
   */
  async addParticipant(req, res, next) {
    try {
      const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json(
          ConversationDto.error('Tenant context required', ERROR_CODES.TENANT_REQUIRED),
        );
      }

      if (!this._hasCapability(req, REQUIRED_CAPABILITIES.ADD_PARTICIPANT)) {
        return res.status(403).json(
          ConversationDto.error('Insufficient permissions', ERROR_CODES.FORBIDDEN),
        );
      }

      const { threadId } = req.params;

      // Validate participant data
      const validatedData = ConversationsValidator.validateAddParticipant(req.body);

      // Add participant
      const participant = await this.conversationsService.addParticipant(
        tenantId,
        threadId,
        validatedData,
      );

      logger.info('Participant added to conversation', {
        tenantId,
        threadId,
        participantId: participant.id,
      });

      return res.status(201).json(
        ConversationDto.success(ConversationDto.participantToApi(participant), 'Participant added'),
      );
    } catch (error) {
      logger.error('Error in addParticipant', { error: error.message });
      return this._handleError(res, error);
    }
  }

  /**
   * Check if user has required capability
   * @private
   */
  _hasCapability(req, requiredCapability) {
    const userCapabilities = req.user?.capabilities || [];
    return userCapabilities.includes(requiredCapability) || userCapabilities.includes('*');
  }

  /**
   * Validate webhook signature (provider-specific)
   * @private
   * Stub implementation - should be expanded per provider
   */
  _validateWebhookSignature(req, channel, provider) {
    // TODO: Implement provider-specific signature validation
    // LinkedIn, WhatsApp, etc. have different signature algorithms
    // For now, return true if signature header present
    const signatureHeader = req.headers['x-signature'] || req.headers['x-hub-signature-256'];
    return !!signatureHeader || process.env.NODE_ENV === 'development';
  }

  /**
   * Handle errors and format response
   * @private
   */
  _handleError(res, error) {
    if (error.validationErrors && error.message === 'Validation failed') {
      return res.status(400).json(
        ConversationDto.error(error.message, ERROR_CODES.VALIDATION_ERROR, error.validationErrors),
      );
    }

    if (error.message && error.message.includes('not found')) {
      return res.status(404).json(
        ConversationDto.error(error.message, ERROR_CODES.NOT_FOUND),
      );
    }

    if (error.message && error.message.includes('already')) {
      return res.status(409).json(
        ConversationDto.error(error.message, ERROR_CODES.DUPLICATE_MESSAGE),
      );
    }

    return res.status(500).json(
      ConversationDto.error('Internal server error', ERROR_CODES.DATABASE_ERROR),
    );
  }
}

module.exports = ConversationsController;
