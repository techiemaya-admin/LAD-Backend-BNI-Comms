/**
 * normalizationService.js
 * Normalizes provider-specific payloads into common message format
 * Handles: LinkedIn, WhatsApp, Email, Instagram, Voice
 */

const logger = require('@shared/logger');

class NormalizationService {
  /**
   * Normalize any provider payload
   * @param {string} channel - Channel type (linkedin, whatsapp, email, instagram, voice)
   * @param {object} payload - Raw provider payload
   * @returns {object} Normalized message data
   */
  normalize(channel, payload) {
    try {
      logger.debug('Normalizing provider payload', { channel });

      switch (channel) {
        case 'linkedin':
          return this.normalizeLinkedIn(payload);
        case 'whatsapp':
          return this.normalizeWhatsApp(payload);
        case 'email':
          return this.normalizeEmail(payload);
        case 'instagram':
          return this.normalizeInstagram(payload);
        case 'voice':
          return this.normalizeVoice(payload);
        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }
    } catch (error) {
      logger.error('Error normalizing provider payload', {
        channel,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Normalize LinkedIn message
   * @private
   * @param {object} payload - LinkedIn payload (via Unipile or direct API)
   * @returns {object} Normalized data
   */
  normalizeLinkedIn(payload) {
    return {
      messageId: payload.id || payload.message_id,
      threadId: payload.conversation_id || payload.thread_id,
      senderType: payload.sender_type || 'lead',
      senderId: payload.sender_id || payload.from_id,
      senderEmail: payload.sender_email || null,
      messageType: 'text',
      content: payload.body || payload.text || payload.message || '',
      contentHtml: null,
      metadata: {
        provider: 'linkedin',
        senderName: payload.sender_name,
        senderProfileUrl: payload.sender_profile_url,
        threadUrl: payload.conversation_url,
      },
    };
  }

  /**
   * Normalize WhatsApp message
   * @private
   * @param {object} payload - WhatsApp webhook payload
   * @returns {object} Normalized data
   */
  normalizeWhatsApp(payload) {
    const message = payload.messages ? payload.messages[0] : payload;
    const contact = payload.contacts ? payload.contacts[0] : {};

    let content = '';
    let messageType = 'text';
    let mediaUrl = null;
    let mediaMetadata = {};

    if (message.type === 'text') {
      content = message.text.body;
    } else if (message.type === 'image') {
      messageType = 'image';
      mediaUrl = message.image.link;
      mediaMetadata = { caption: message.image.caption };
      content = `[Image: ${message.image.link}]`;
    } else if (message.type === 'audio') {
      messageType = 'voice';
      mediaUrl = message.audio.link;
      content = '[Audio message]';
    } else if (message.type === 'video') {
      messageType = 'video';
      mediaUrl = message.video.link;
      mediaMetadata = { caption: message.video.caption };
      content = `[Video: ${message.video.link}]`;
    } else if (message.type === 'document') {
      messageType = 'attachment';
      mediaUrl = message.document.link;
      mediaMetadata = { filename: message.document.filename, mimeType: message.document.mime_type };
      content = `[Document: ${message.document.filename}]`;
    }

    return {
      messageId: message.id,
      threadId: contact.wa_id || message.from,
      senderType: 'lead',
      senderId: contact.wa_id || message.from,
      senderEmail: null,
      messageType,
      content,
      contentHtml: null,
      metadata: {
        provider: 'whatsapp',
        senderPhone: message.from,
        senderName: contact.profile.name,
        timestamp: message.timestamp,
        mediaUrl,
        ...mediaMetadata,
      },
    };
  }

  /**
   * Normalize Email message
   * @private
   * @param {object} payload - Email payload
   * @returns {object} Normalized data
   */
  normalizeEmail(payload) {
    return {
      messageId: payload.id || payload.message_id,
      threadId: payload.thread_id || payload.conversation_id,
      senderType: 'lead',
      senderId: payload.sender_id || payload.from_email,
      senderEmail: payload.from_email || payload.sender_email,
      messageType: 'text',
      content: payload.body_text || payload.body || '',
      contentHtml: payload.body_html || null,
      metadata: {
        provider: 'email',
        subject: payload.subject,
        senderName: payload.sender_name || payload.from_name,
        cc: payload.cc || [],
        bcc: payload.bcc || [],
        hasAttachments: payload.has_attachments || false,
        attachments: payload.attachments || [],
      },
    };
  }

  /**
   * Normalize Instagram message
   * @private
   * @param {object} payload - Instagram webhook payload
   * @returns {object} Normalized data
   */
  normalizeInstagram(payload) {
    const message = payload.messaging ? payload.messaging[0] : payload;
    const sender = message.sender;
    const messageData = message.message || message.postback || {};

    let content = '';
    let messageType = 'text';

    if (messageData.text) {
      content = messageData.text;
    } else if (messageData.attachments) {
      const attachment = messageData.attachments[0];
      messageType = attachment.type; // image, video, file, etc.
      content = `[${attachment.type.toUpperCase()}: ${attachment.payload.url}]`;
    }

    return {
      messageId: message.mid || message.id,
      threadId: message.recipient.id,
      senderType: 'lead',
      senderId: sender.id,
      senderEmail: null,
      messageType,
      content,
      contentHtml: null,
      metadata: {
        provider: 'instagram',
        senderName: sender.name,
        timestamp: message.timestamp,
      },
    };
  }

  /**
   * Normalize Voice call event
   * @private
   * @param {object} payload - Voice call payload
   * @returns {object} Normalized data
   */
  normalizeVoice(payload) {
    return {
      messageId: payload.call_id || payload.id,
      threadId: payload.participant_id || payload.from_number,
      senderType: 'lead',
      senderId: payload.participant_id || payload.from_number,
      senderEmail: null,
      messageType: 'voice',
      content: `[Voice Call: ${payload.duration || 0}s]`,
      contentHtml: null,
      metadata: {
        provider: 'voice',
        direction: payload.direction || 'inbound',
        duration: payload.duration || 0,
        status: payload.status,
        recordingUrl: payload.recording_url,
        transcriptUrl: payload.transcript_url,
        transcript: payload.transcript || null,
        participantName: payload.participant_name,
        participantPhone: payload.participant_phone || payload.from_number,
      },
    };
  }

  /**
   * Convert normalized message back to DTO
   * @param {object} normalizedMessage - Normalized message
   * @returns {object} DTO-formatted message
   */
  toDTO(normalizedMessage) {
    return {
      id: normalizedMessage.messageId,
      conversationId: normalizedMessage.threadId,
      senderType: normalizedMessage.senderType,
      senderId: normalizedMessage.senderId,
      messageType: normalizedMessage.messageType,
      content: normalizedMessage.content,
      contentHtml: normalizedMessage.contentHtml,
      metadata: normalizedMessage.metadata,
      createdAt: new Date().toISOString(),
    };
  }
}

module.exports = NormalizationService;
