/**
 * conversationDto.js
 * Data Transfer Objects and field mapping converters
 * Converts between database and API response formats
 */

class ConversationDto {
  /**
   * Convert thread database record to API response
   * @param {object} threadRecord - Database record
   * @returns {object} API response object
   */
  static threadToApi(threadRecord) {
    if (!threadRecord) return null;

    return {
      id: threadRecord.id,
      tenantId: threadRecord.tenant_id,
      leadId: threadRecord.lead_id,
      campaignId: threadRecord.campaign_id,
      channel: threadRecord.channel,
      externalThreadId: threadRecord.external_thread_id,
      status: threadRecord.status,
      lastMessageAt: threadRecord.last_message_at,
      lastMessagePreview: threadRecord.last_message_preview,
      metadata: threadRecord.metadata,
      messageCount: threadRecord.message_count || 0,
      createdAt: threadRecord.created_at,
      updatedAt: threadRecord.updated_at,
    };
  }

  /**
   * Convert multiple thread records to API response
   * @param {Array} threadRecords - Database records
   * @returns {Array} API response objects
   */
  static threadsToApi(threadRecords) {
    return threadRecords.map(record => this.threadToApi(record));
  }

  /**
   * Convert message database record to API response
   * @param {object} messageRecord - Database record
   * @returns {object} API response object
   */
  static messageToApi(messageRecord) {
    if (!messageRecord) return null;

    return {
      id: messageRecord.id,
      conversationId: messageRecord.conversation_id,
      senderType: messageRecord.sender_type,
      senderId: messageRecord.sender_id,
      channel: messageRecord.channel,
      messageType: messageRecord.message_type,
      content: messageRecord.content,
      contentHtml: messageRecord.content_html,
      aiGenerated: messageRecord.ai_generated,
      metadata: messageRecord.metadata,
      createdAt: messageRecord.created_at,
    };
  }

  /**
   * Convert multiple message records to API response
   * @param {Array} messageRecords - Database records
   * @returns {Array} API response objects
   */
  static messagesToApi(messageRecords) {
    return messageRecords.map(record => this.messageToApi(record));
  }

  /**
   * Convert participant database record to API response
   * @param {object} participantRecord - Database record
   * @returns {object} API response object
   */
  static participantToApi(participantRecord) {
    if (!participantRecord) return null;

    return {
      id: participantRecord.id,
      conversationId: participantRecord.conversation_id,
      type: participantRecord.participant_type,
      participantId: participantRecord.participant_id,
      email: participantRecord.participant_email,
      isActive: participantRecord.is_active,
      createdAt: participantRecord.created_at,
    };
  }

  /**
   * Convert multiple participant records to API response
   * @param {Array} participantRecords - Database records
   * @returns {Array} API response objects
   */
  static participantsToApi(participantRecords) {
    return participantRecords.map(record => this.participantToApi(record));
  }

  /**
   * Convert request body to thread creation data
   * @param {object} body - Request body
   * @returns {object} Thread data for repository
   */
  static apiToThreadCreate(body) {
    return {
      leadId: body.leadId || null,
      campaignId: body.campaignId || null,
      channel: body.channel,
      externalThreadId: body.externalThreadId,
      status: body.status || 'open',
      metadata: body.metadata || {},
    };
  }

  /**
   * Convert request body to message creation data
   * @param {object} body - Request body
   * @returns {object} Message data for repository
   */
  static apiToMessageCreate(body) {
    return {
      conversationId: body.conversationId,
      senderType: body.senderType || 'user',
      senderId: body.senderId || null,
      channel: body.channel,
      messageType: body.messageType || 'text',
      content: body.content,
      contentHtml: body.contentHtml || null,
      metadata: body.metadata || {},
    };
  }

  /**
   * Format paginated response
   * @param {Array} items - Items to return
   * @param {number} total - Total count
   * @param {number} limit - Limit per page
   * @param {number} offset - Current offset
   * @returns {object} Paginated response
   */
  static paginated(items, total, limit, offset) {
    return {
      data: items,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Format thread with context response
   * @param {object} thread - Thread record
   * @param {Array} messages - Message records
   * @param {Array} participants - Participant records
   * @returns {object} Formatted response
   */
  static threadWithContext(thread, messages, participants) {
    return {
      thread: this.threadToApi(thread),
      messages: this.messagesToApi(messages),
      participants: this.participantsToApi(participants),
    };
  }

  /**
   * Format error response
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Array} details - Error details
   * @returns {object} Error response
   */
  static error(message, code = 'ERROR', details = []) {
    return {
      error: {
        message,
        code,
        details,
      },
    };
  }

  /**
   * Format success response
   * @param {object} data - Response data
   * @param {string} message - Success message
   * @returns {object} Success response
   */
  static success(data, message = 'Success') {
    return {
      success: true,
      message,
      data,
    };
  }
}

module.exports = ConversationDto;
