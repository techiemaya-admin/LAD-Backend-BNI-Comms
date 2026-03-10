/**
 * whatsappController.js
 * Request handlers for WhatsApp features: agent chat, broadcasting, forwarding
 * All endpoints validate tenant context and required capabilities
 */

const logger = require('@shared/logger');
const conversationConstants = require('../constants/conversationConstants');

class WhatsAppController {
  constructor(whatsappService, conversationDto) {
    this.whatsappService = whatsappService;
    this.conversationDto = conversationDto;
  }

  /**
   * AGENT CHAT ENDPOINTS
   */

  /**
   * Get or create agent chat with contact
   * POST /agent-chats
   */
  async createAgentChat(req, res) {
    try {
      logger.info('Creating agent chat', {
        tenantId: req.tenant.id,
        userId: req.user.id,
      });

      // Validate capability
      if (!req.tenant.capabilities.includes('conversations.manage')) {
        return res.status(403).json({
          error: conversationConstants.ERROR_CODES.CAPABILITY_NOT_ALLOWED,
          message: 'conversations.manage capability required',
        });
      }

      const { contactPhoneNumber, agentId } = req.body;

      // Input validation
      if (!contactPhoneNumber || !agentId) {
        return res.status(400).json({
          error: conversationConstants.ERROR_CODES.INVALID_INPUT,
          message: 'contactPhoneNumber and agentId are required',
        });
      }

      const chat = await this.whatsappService.getOrCreateAgentChat(
        req.tenant.id,
        contactPhoneNumber,
        agentId,
      );

      logger.info('Agent chat created/retrieved', {
        tenantId: req.tenant.id,
        chatId: chat.id,
      });

      return res.status(200).json(chat);
    } catch (error) {
      logger.error('Error creating agent chat', {
        tenantId: req.tenant.id,
        error: error.message,
      });

      return res.status(500).json({
        error: conversationConstants.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to create agent chat',
      });
    }
  }

  /**
   * Send message in agent chat
   * POST /agent-chats/:chatId/messages
   */
  async sendAgentMessage(req, res) {
    try {
      logger.info('Sending agent message', {
        tenantId: req.tenant.id,
        chatId: req.params.chatId,
      });

      const { agentId, messageContent, mediaUrl } = req.body;

      if (!agentId || !messageContent) {
        return res.status(400).json({
          error: conversationConstants.ERROR_CODES.INVALID_INPUT,
          message: 'agentId and messageContent are required',
        });
      }

      const message = await this.whatsappService.sendAgentMessage(
        req.tenant.id,
        req.params.chatId,
        agentId,
        messageContent,
        { mediaUrl },
      );

      logger.info('Agent message sent', {
        tenantId: req.tenant.id,
        messageId: message.id,
      });

      return res.status(201).json(message);
    } catch (error) {
      logger.error('Error sending agent message', {
        tenantId: req.tenant.id,
        chatId: req.params.chatId,
        error: error.message,
      });

      return res.status(500).json({
        error: conversationConstants.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to send message',
      });
    }
  }

  /**
   * Get agent chat history
   * GET /agent-chats/:chatId/messages
   */
  async getAgentChatHistory(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;

      logger.info('Fetching agent chat history', {
        tenantId: req.tenant.id,
        chatId: req.params.chatId,
        limit,
        offset,
      });

      const messages = await this.whatsappService.getAgentChatHistory(
        req.tenant.id,
        req.params.chatId,
        {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
        },
      );

      return res.status(200).json(messages);
    } catch (error) {
      logger.error('Error fetching agent chat history', {
        tenantId: req.tenant.id,
        chatId: req.params.chatId,
        error: error.message,
      });

      return res.status(500).json({
        error: conversationConstants.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to fetch chat history',
      });
    }
  }

  /**
   * BROADCASTING ENDPOINTS
   */

  /**
   * Create broadcast campaign
   * POST /broadcasts
   */
  async createBroadcast(req, res) {
    try {
      logger.info('Creating broadcast campaign', {
        tenantId: req.tenant.id,
        userId: req.user.id,
      });

      if (!req.tenant.capabilities.includes('conversations.manage')) {
        return res.status(403).json({
          error: conversationConstants.ERROR_CODES.CAPABILITY_NOT_ALLOWED,
          message: 'conversations.manage capability required',
        });
      }

      const {
        campaignId,
        contactPhoneNumbers,
        messageContent,
        messageType = 'text',
      } = req.body;

      if (!contactPhoneNumbers?.length || !messageContent) {
        return res.status(400).json({
          error: conversationConstants.ERROR_CODES.INVALID_INPUT,
          message: 'contactPhoneNumbers and messageContent are required',
        });
      }

      const broadcast = await this.whatsappService.createBroadcast(
        req.tenant.id,
        contactPhoneNumbers,
        messageContent,
        {
          campaignId,
          messageType,
          createdByUserId: req.user.id,
        },
      );

      logger.info('Broadcast campaign created', {
        tenantId: req.tenant.id,
        broadcastId: broadcast.id,
        contactCount: contactPhoneNumbers.length,
      });

      return res.status(201).json(broadcast);
    } catch (error) {
      logger.error('Error creating broadcast', {
        tenantId: req.tenant.id,
        error: error.message,
      });

      return res.status(500).json({
        error: conversationConstants.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to create broadcast campaign',
      });
    }
  }

  /**
   * Execute broadcast campaign
   * POST /broadcasts/:broadcastId/execute
   */
  async executeBroadcast(req, res) {
    try {
      logger.info('Executing broadcast campaign', {
        tenantId: req.tenant.id,
        broadcastId: req.params.broadcastId,
      });

      if (!req.tenant.capabilities.includes('conversations.manage')) {
        return res.status(403).json({
          error: conversationConstants.ERROR_CODES.CAPABILITY_NOT_ALLOWED,
          message: 'conversations.manage capability required',
        });
      }

      const result = await this.whatsappService.executeBroadcast(
        req.tenant.id,
        req.params.broadcastId,
      );

      logger.info('Broadcast campaign executed', {
        tenantId: req.tenant.id,
        broadcastId: req.params.broadcastId,
        messagesSent: result.messagesSent,
      });

      return res.status(200).json(result);
    } catch (error) {
      logger.error('Error executing broadcast', {
        tenantId: req.tenant.id,
        broadcastId: req.params.broadcastId,
        error: error.message,
      });

      return res.status(500).json({
        error: conversationConstants.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to execute broadcast campaign',
      });
    }
  }

  /**
   * Get broadcast campaign details
   * GET /broadcasts/:broadcastId
   */
  async getBroadcastDetails(req, res) {
    try {
      logger.info('Fetching broadcast details', {
        tenantId: req.tenant.id,
        broadcastId: req.params.broadcastId,
      });

      const broadcast = await this.whatsappService.getBroadcastDetails(
        req.tenant.id,
        req.params.broadcastId,
      );

      if (!broadcast) {
        return res.status(404).json({
          error: conversationConstants.ERROR_CODES.NOT_FOUND,
          message: 'Broadcast campaign not found',
        });
      }

      return res.status(200).json(broadcast);
    } catch (error) {
      logger.error('Error fetching broadcast details', {
        tenantId: req.tenant.id,
        broadcastId: req.params.broadcastId,
        error: error.message,
      });

      return res.status(500).json({
        error: conversationConstants.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to fetch broadcast details',
      });
    }
  }

  /**
   * Get broadcast list with pagination
   * GET /broadcasts
   */
  async listBroadcasts(req, res) {
    try {
      const { status, limit = 20, offset = 0 } = req.query;

      logger.info('Listing broadcasts', {
        tenantId: req.tenant.id,
        status,
        limit,
        offset,
      });

      const broadcasts = await this.whatsappService.listBroadcasts(
        req.tenant.id,
        {
          status,
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
        },
      );

      return res.status(200).json(broadcasts);
    } catch (error) {
      logger.error('Error listing broadcasts', {
        tenantId: req.tenant.id,
        error: error.message,
      });

      return res.status(500).json({
        error: conversationConstants.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to list broadcasts',
      });
    }
  }

  /**
   * MESSAGE FORWARDING ENDPOINTS
   */

  /**
   * Create forwarding rule
   * POST /forwarding-rules
   */
  async createForwardingRule(req, res) {
    try {
      logger.info('Creating forwarding rule', {
        tenantId: req.tenant.id,
        userId: req.user.id,
      });

      if (!req.tenant.capabilities.includes('conversations.manage')) {
        return res.status(403).json({
          error: conversationConstants.ERROR_CODES.CAPABILITY_NOT_ALLOWED,
          message: 'conversations.manage capability required',
        });
      }

      const { adminGroupId, memberGroupIds } = req.body;

      if (!adminGroupId || !memberGroupIds?.length) {
        return res.status(400).json({
          error: conversationConstants.ERROR_CODES.INVALID_INPUT,
          message: 'adminGroupId and memberGroupIds are required',
        });
      }

      const rule = await this.whatsappService.createForwardingRule(
        req.tenant.id,
        adminGroupId,
        memberGroupIds,
      );

      logger.info('Forwarding rule created', {
        tenantId: req.tenant.id,
        ruleId: rule.id,
        adminGroupId,
      });

      return res.status(201).json(rule);
    } catch (error) {
      logger.error('Error creating forwarding rule', {
        tenantId: req.tenant.id,
        error: error.message,
      });

      return res.status(500).json({
        error: conversationConstants.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to create forwarding rule',
      });
    }
  }

  /**
   * Sync member group contacts
   * POST /forwarding-rules/:ruleId/sync
   */
  async syncMemberGroupContacts(req, res) {
    try {
      logger.info('Syncing member group contacts', {
        tenantId: req.tenant.id,
        ruleId: req.params.ruleId,
      });

      if (!req.tenant.capabilities.includes('conversations.manage')) {
        return res.status(403).json({
          error: conversationConstants.ERROR_CODES.CAPABILITY_NOT_ALLOWED,
          message: 'conversations.manage capability required',
        });
      }

      const { memberGroupId, phoneNumbers } = req.body;

      if (!memberGroupId || !phoneNumbers?.length) {
        return res.status(400).json({
          error: conversationConstants.ERROR_CODES.INVALID_INPUT,
          message: 'memberGroupId and phoneNumbers are required',
        });
      }

      const result = await this.whatsappService.syncMemberGroupContacts(
        req.tenant.id,
        memberGroupId,
        phoneNumbers,
      );

      logger.info('Member group contacts synced', {
        tenantId: req.tenant.id,
        memberGroupId,
        contactCount: phoneNumbers.length,
      });

      return res.status(200).json(result);
    } catch (error) {
      logger.error('Error syncing member group contacts', {
        tenantId: req.tenant.id,
        ruleId: req.params.ruleId,
        error: error.message,
      });

      return res.status(500).json({
        error: conversationConstants.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to sync contacts',
      });
    }
  }

  /**
   * Get forwarding records
   * GET /forwarding-records
   */
  async getForwardingRecords(req, res) {
    try {
      const { adminGroupId, memberGroupId, limit = 50, offset = 0 } = req.query;

      logger.info('Fetching forwarding records', {
        tenantId: req.tenant.id,
        adminGroupId,
        memberGroupId,
      });

      const records = await this.whatsappService.getForwardingRecords(
        req.tenant.id,
        {
          adminGroupId,
          memberGroupId,
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
        },
      );

      return res.status(200).json(records);
    } catch (error) {
      logger.error('Error fetching forwarding records', {
        tenantId: req.tenant.id,
        error: error.message,
      });

      return res.status(500).json({
        error: conversationConstants.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to fetch forwarding records',
      });
    }
  }
}

module.exports = WhatsAppController;
