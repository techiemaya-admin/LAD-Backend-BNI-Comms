/**
 * whatsappService.js
 * WhatsApp-specific business logic integrating agent chat, broadcasting, and forwarding
 * Follows LAD layering: services contain business logic only (no SQL)
 * 
 * Three Core WhatsApp Features:
 * 1. Agent Chat - Two-way conversations between agents and contacts
 * 2. Broadcasting - Send message to multiple individual contacts
 * 3. Message Forwarding - Forward from admin group to member groups
 */

const logger = require('@shared/logger');

class WhatsAppService {
  constructor(
    conversationsService,
    conversationMessagesRepository,
    conversationParticipantsRepository,
    normalizationService,
    whatsappRepository,
  ) {
    this.conversationsService = conversationsService;
    this.messagesRepository = conversationMessagesRepository;
    this.participantsRepository = conversationParticipantsRepository;
    this.normalizationService = normalizationService;
    this.whatsappRepository = whatsappRepository;
  }

  /**
   * FEATURE 1: Agent Chat
   * Two-way conversation between agent and WhatsApp contact
   * Integrates with conversation management system
   */

  /**
   * Get or create agent chat conversation
   * @param {string} tenantId - Tenant ID
   * @param {string} contactPhoneNumber - Contact's WhatsApp phone number
   * @param {string} agentId - Agent user ID
   * @returns {Promise<Object>} Conversation thread
   */
  async getOrCreateAgentChat(tenantId, contactPhoneNumber, agentId) {
    try {
      logger.debug('Getting or creating agent chat', {
        tenantId,
        contactPhoneNumber,
        agentId,
      });

      // Get or create thread
      const thread = await this.conversationsService.getOrCreateThread(
        tenantId,
        'whatsapp',
        contactPhoneNumber,
        {
          metadata: {
            chatType: 'agent_chat',
            contactPhone: contactPhoneNumber,
          },
        },
      );

      // Ensure agent is participant
      await this.participantsRepository.addParticipant(tenantId, thread.id, {
        participantType: 'user',
        participantId: agentId,
      });

      logger.info('Agent chat retrieved/created', {
        tenantId,
        threadId: thread.id,
        agentId,
      });

      return thread;
    } catch (error) {
      logger.error('Error getting or creating agent chat', {
        tenantId,
        contactPhoneNumber,
        agentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send agent message in chat
   * @param {string} tenantId - Tenant ID
   * @param {string} threadId - Conversation thread ID
   * @param {string} agentId - Agent user ID
   * @param {string} messageContent - Message text
   * @param {object} options - Additional options
   * @returns {Promise<Object>} Sent message
   */
  async sendAgentMessage(tenantId, threadId, agentId, messageContent, options = {}) {
    try {
      const { messageType = 'text', metadata = {} } = options;

      logger.debug('Sending agent message', {
        tenantId,
        threadId,
        agentId,
        messageType,
      });

      // Send message via conversations service
      const message = await this.conversationsService.sendMessage(
        tenantId,
        threadId,
        {
          content: messageContent,
          channel: 'whatsapp',
          messageType,
          senderId: agentId,
          senderType: 'user',
          metadata: {
            ...metadata,
            agentId,
            chatType: 'agent_chat',
          },
        },
      );

      // Dispatch to WhatsApp provider (placeholder)
      await this._dispatchToWhatsAppProvider(tenantId, threadId, message);

      logger.info('Agent message sent', {
        tenantId,
        threadId,
        messageId: message.id,
      });

      return message;
    } catch (error) {
      logger.error('Error sending agent message', {
        tenantId,
        threadId,
        agentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get agent chat history
   * @param {string} tenantId - Tenant ID
   * @param {string} threadId - Conversation thread ID
   * @param {object} options - Pagination options
   * @returns {Promise<Array>} Messages in conversation
   */
  async getAgentChatHistory(tenantId, threadId, options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;

      logger.debug('Fetching agent chat history', { tenantId, threadId, limit });

      const messages = await this.messagesRepository.getMessages(
        tenantId,
        threadId,
        { limit, offset },
      );

      return messages;
    } catch (error) {
      logger.error('Error fetching agent chat history', {
        tenantId,
        threadId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * FEATURE 2: Broadcasting
   * Send message to multiple individual contacts at once
   * Creates separate conversations for each contact
   */

  /**
   * Create broadcast campaign
   * @param {string} tenantId - Tenant ID
   * @param {Array<string>} contactPhoneNumbers - List of contact phone numbers
   * @param {string} messageContent - Message to broadcast
   * @param {object} options - Broadcast options
   * @returns {Promise<Object>} Broadcast campaign details
   */
  async createBroadcast(tenantId, contactPhoneNumbers, messageContent, options = {}) {
    try {
      const {
        campaignId,
        messageType = 'text',
        metadata = {},
        createdByUserId,
      } = options;

      logger.debug('Creating broadcast campaign', {
        tenantId,
        contactCount: contactPhoneNumbers.length,
        campaignId,
      });

      // Store broadcast campaign
      const broadcast = await this.whatsappRepository.createBroadcast(tenantId, {
        campaignId,
        contactPhoneNumbers,
        messageContent,
        messageType,
        metadata,
        createdByUserId,
        status: 'pending',
      });

      logger.info('Broadcast campaign created', {
        tenantId,
        broadcastId: broadcast.id,
        contactCount: contactPhoneNumbers.length,
      });

      return broadcast;
    } catch (error) {
      logger.error('Error creating broadcast campaign', {
        tenantId,
        contactCount: contactPhoneNumbers.length,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send broadcast messages
   * Processes broadcast campaign and sends to all contacts
   * @param {string} tenantId - Tenant ID
   * @param {string} broadcastId - Broadcast campaign ID
   * @returns {Promise<Object>} Broadcast execution result
   */
  async executeBroadcast(tenantId, broadcastId) {
    try {
      logger.info('Executing broadcast campaign', { tenantId, broadcastId });

      const broadcast = await this.whatsappRepository.getBroadcast(
        tenantId,
        broadcastId,
      );

      if (!broadcast) {
        throw new Error(`Broadcast ${broadcastId} not found`);
      }

      const results = {
        successful: 0,
        failed: 0,
        errors: [],
      };

      // Send to each contact
      for (const phoneNumber of broadcast.contact_phone_numbers) {
        try {
          // Get or create thread for each contact
          const thread = await this.conversationsService.getOrCreateThread(
            tenantId,
            'whatsapp',
            phoneNumber,
            {
              campaignId: broadcast.campaign_id,
              metadata: {
                broadcastId,
                broadcastType: 'broadcast',
              },
            },
          );

          // Send message
          const message = await this.conversationsService.sendMessage(
            tenantId,
            thread.id,
            {
              content: broadcast.message_content,
              channel: 'whatsapp',
              messageType: broadcast.message_type,
              senderType: 'system',
              metadata: {
                broadcastId,
                broadcastCampaignId: broadcast.campaign_id,
              },
            },
          );

          // Dispatch to WhatsApp provider
          await this._dispatchToWhatsAppProvider(tenantId, thread.id, message);

          // Track success
          await this.whatsappRepository.updateBroadcastContact(
            tenantId,
            broadcastId,
            phoneNumber,
            {
              status: 'sent',
              messageId: message.id,
              sentAt: new Date().toISOString(),
            },
          );

          results.successful++;
        } catch (error) {
          logger.error('Error sending to contact in broadcast', {
            tenantId,
            broadcastId,
            phoneNumber,
            error: error.message,
          });

          results.failed++;
          results.errors.push({
            phoneNumber,
            error: error.message,
          });

          // Mark as failed
          await this.whatsappRepository.updateBroadcastContact(
            tenantId,
            broadcastId,
            phoneNumber,
            {
              status: 'failed',
              error: error.message,
            },
          );
        }
      }

      // Update broadcast status
      const finalStatus = results.failed === 0 ? 'completed' : 'partial';
      await this.whatsappRepository.updateBroadcast(tenantId, broadcastId, {
        status: finalStatus,
      });

      logger.info('Broadcast campaign executed', {
        tenantId,
        broadcastId,
        results,
      });

      return {
        broadcastId,
        ...results,
      };
    } catch (error) {
      logger.error('Error executing broadcast campaign', {
        tenantId,
        broadcastId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get broadcast campaign details
   * @param {string} tenantId - Tenant ID
   * @param {string} broadcastId - Broadcast campaign ID
   * @returns {Promise<Object>} Broadcast details with status
   */
  async getBroadcastDetails(tenantId, broadcastId) {
    try {
      logger.debug('Fetching broadcast details', { tenantId, broadcastId });

      const broadcast = await this.whatsappRepository.getBroadcast(
        tenantId,
        broadcastId,
      );

      if (!broadcast) {
        throw new Error(`Broadcast ${broadcastId} not found`);
      }

      // Get contact statuses
      const contactStatuses = await this.whatsappRepository.getBroadcastContactStatus(
        tenantId,
        broadcastId,
      );

      return {
        ...broadcast,
        contactStatuses,
        summary: {
          total: broadcast.contact_phone_numbers.length,
          sent: contactStatuses.filter(s => s.status === 'sent').length,
          failed: contactStatuses.filter(s => s.status === 'failed').length,
          pending: contactStatuses.filter(s => s.status === 'pending').length,
        },
      };
    } catch (error) {
      logger.error('Error fetching broadcast details', {
        tenantId,
        broadcastId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * FEATURE 3: Message Forwarding
   * Forward message from admin group to all member groups
   * Message flows: Admin Group → Forward Service → Member Groups
   */

  /**
   * Configure group forwarding rule
   * @param {string} tenantId - Tenant ID
   * @param {string} adminGroupId - Admin group WhatsApp ID
   * @param {Array<string>} memberGroupIds - List of member group WhatsApp IDs
   * @param {object} options - Forwarding options
   * @returns {Promise<Object>} Created forwarding rule
   */
  async createForwardingRule(tenantId, adminGroupId, memberGroupIds, options = {}) {
    try {
      const { enabled = true, metadata = {} } = options;

      logger.debug('Creating message forwarding rule', {
        tenantId,
        adminGroupId,
        memberGroupCount: memberGroupIds.length,
      });

      const rule = await this.whatsappRepository.createForwardingRule(
        tenantId,
        {
          adminGroupId,
          memberGroupIds,
          enabled,
          metadata,
        },
      );

      logger.info('Forwarding rule created', {
        tenantId,
        ruleId: rule.id,
        adminGroupId,
      });

      return rule;
    } catch (error) {
      logger.error('Error creating forwarding rule', {
        tenantId,
        adminGroupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Handle incoming message from admin group
   * Forward to all configured member groups
   * @param {string} tenantId - Tenant ID
   * @param {string} adminGroupId - Admin group ID
   * @param {object} messageData - Message data
   * @returns {Promise<Object>} Forwarding result
   */
  async forwardMessageFromAdminGroup(tenantId, adminGroupId, messageData) {
    try {
      logger.debug('Forwarding message from admin group', {
        tenantId,
        adminGroupId,
      });

      // Get forwarding rules for this admin group
      const rules = await this.whatsappRepository.getForwardingRulesByAdminGroup(
        tenantId,
        adminGroupId,
      );

      if (rules.length === 0) {
        logger.warn('No forwarding rules configured for admin group', {
          tenantId,
          adminGroupId,
        });
        return { forwardedCount: 0, errors: [] };
      }

      const forwardingResults = {
        forwardedCount: 0,
        errors: [],
      };

      // Forward to all member groups in all rules
      for (const rule of rules) {
        if (!rule.enabled) continue;

        for (const memberGroupId of rule.member_group_ids) {
          try {
            // Get or create thread for member group
            const thread = await this.conversationsService.getOrCreateThread(
              tenantId,
              'whatsapp',
              memberGroupId,
              {
                metadata: {
                  groupType: 'member_group',
                  forwardedFromAdmin: adminGroupId,
                  forwardingRuleId: rule.id,
                },
              },
            );

            // Create forwarded message
            const forwardedMessage = {
              ...messageData,
              conversationId: thread.id,
              senderType: 'system',
              metadata: {
                ...messageData.metadata,
                originalAdminGroupId: adminGroupId,
                forwardingRuleId: rule.id,
                forwardedAt: new Date().toISOString(),
              },
            };

            const message = await this.conversationsService.sendMessage(
              tenantId,
              thread.id,
              forwardedMessage,
            );

            // Dispatch to WhatsApp provider
            await this._dispatchToWhatsAppProvider(tenantId, thread.id, message);

            // Track successful forwarding
            await this.whatsappRepository.createForwardingRecord(tenantId, {
              forwardingRuleId: rule.id,
              adminGroupId,
              memberGroupId,
              originalMessageId: messageData.providerId,
              forwardedMessageId: message.id,
              status: 'forwarded',
            });

            forwardingResults.forwardedCount++;
          } catch (error) {
            logger.error('Error forwarding message to member group', {
              tenantId,
              adminGroupId,
              memberGroupId,
              error: error.message,
            });

            forwardingResults.errors.push({
              memberGroupId,
              error: error.message,
            });
          }
        }
      }

      logger.info('Message forwarded from admin group', {
        tenantId,
        adminGroupId,
        forwardingResults,
      });

      return forwardingResults;
    } catch (error) {
      logger.error('Error in message forwarding process', {
        tenantId,
        adminGroupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Sync member group with contacts
   * Updates which numbers are associated with which member groups
   * @param {string} tenantId - Tenant ID
   * @param {string} memberGroupId - Member group WhatsApp ID
   * @param {Array<string>} phoneNumbers - Associated phone numbers
   * @returns {Promise<Object>} Sync result
   */
  async syncMemberGroupContacts(tenantId, memberGroupId, phoneNumbers) {
    try {
      logger.debug('Syncing member group contacts', {
        tenantId,
        memberGroupId,
        contactCount: phoneNumbers.length,
      });

      const sync = await this.whatsappRepository.syncGroupContacts(
        tenantId,
        memberGroupId,
        phoneNumbers,
      );

      logger.info('Member group contacts synced', {
        tenantId,
        memberGroupId,
        contactCount: phoneNumbers.length,
      });

      return sync;
    } catch (error) {
      logger.error('Error syncing member group contacts', {
        tenantId,
        memberGroupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Private: Dispatch message to WhatsApp provider
   * @private
   */
  async _dispatchToWhatsAppProvider(tenantId, threadId, message) {
    try {
      // TODO: Implement WhatsApp provider API dispatch
      // This would call the actual WhatsApp Business API to send messages
      logger.debug('Dispatching message to WhatsApp provider', {
        tenantId,
        threadId,
        messageId: message.id,
      });

      // Placeholder for actual provider integration
      return { status: 'queued' };
    } catch (error) {
      logger.warn('Error dispatching to WhatsApp provider', {
        tenantId,
        threadId,
        error: error.message,
      });
      // Don't fail if provider dispatch fails - message is stored in DB
      return { status: 'stored_offline' };
    }
  }

  /**
   * List broadcast campaigns with pagination
   * @param {string} tenantId - Tenant ID
   * @param {object} filters - Filter options
   * @returns {Promise<Object>} Paginated broadcasts
   */
  async listBroadcasts(tenantId, filters = {}) {
    try {
      const { status, limit = 20, offset = 0 } = filters;

      logger.debug('Listing broadcasts', {
        tenantId,
        status,
        limit,
        offset,
      });

      // Get broadcasts via repository with pagination
      // Note: Repository would implement the actual pagination query
      // For now, returning structure that controller expects
      const broadcasts = [];

      logger.info('Broadcasts listed', {
        tenantId,
        count: broadcasts.length,
      });

      return {
        data: broadcasts,
        pagination: {
          limit,
          offset,
          hasMore: broadcasts.length >= limit,
        },
      };
    } catch (error) {
      logger.error('Error listing broadcasts', {
        tenantId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get forwarding records for audit and analytics
   * @param {string} tenantId - Tenant ID
   * @param {object} filters - Filter options
   * @returns {Promise<Object>} Paginated forwarding records
   */
  async getForwardingRecords(tenantId, filters = {}) {
    try {
      const { adminGroupId, memberGroupId, limit = 50, offset = 0 } = filters;

      logger.debug('Getting forwarding records', {
        tenantId,
        adminGroupId,
        memberGroupId,
        limit,
        offset,
      });

      // Get records via repository
      const records = [];

      logger.info('Forwarding records retrieved', {
        tenantId,
        count: records.length,
      });

      return {
        data: records,
        pagination: {
          limit,
          offset,
          hasMore: records.length >= limit,
        },
      };
    } catch (error) {
      logger.error('Error getting forwarding records', {
        tenantId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = WhatsAppService;
