/**
 * whatsappRepository.js
 * Data access layer for WhatsApp-specific features
 * All SQL queries for broadcast, forwarding, and group management
 * Maintains tenant isolation on all queries
 */

const logger = require('@shared/logger');

class WhatsAppRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * BROADCAST FEATURE - Data Access
   */

  /**
   * Create broadcast campaign
   * @param {string} tenantId - Tenant ID
   * @param {object} data - Broadcast data
   * @returns {Promise<Object>} Created broadcast record
   */
  async createBroadcast(tenantId, data) {
    try {
      const {
        campaignId,
        contactPhoneNumbers,
        messageContent,
        messageType,
        metadata = {},
        createdByUserId,
        status = 'pending',
      } = data;

      const query = `
        INSERT INTO whatsapp_broadcasts (
          tenant_id,
          campaign_id,
          contact_phone_numbers,
          message_content,
          message_type,
          metadata,
          created_by_user_id,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          tenant_id,
          campaign_id,
          contact_phone_numbers,
          message_content,
          message_type,
          metadata,
          created_by_user_id,
          status,
          created_at,
          updated_at
      `;

      const result = await this.db.query(query, [
        tenantId,
        campaignId || null,
        contactPhoneNumbers, // PostgreSQL array
        messageContent,
        messageType,
        JSON.stringify(metadata),
        createdByUserId || null,
        status,
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating broadcast campaign', {
        tenantId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get broadcast campaign
   * @param {string} tenantId - Tenant ID
   * @param {string} broadcastId - Broadcast ID
   * @returns {Promise<Object>} Broadcast record
   */
  async getBroadcast(tenantId, broadcastId) {
    try {
      const query = `
        SELECT
          id,
          tenant_id,
          campaign_id,
          contact_phone_numbers,
          message_content,
          message_type,
          metadata,
          created_by_user_id,
          status,
          created_at,
          updated_at
        FROM whatsapp_broadcasts
        WHERE id = $1 AND tenant_id = $2
      `;

      const result = await this.db.query(query, [broadcastId, tenantId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching broadcast', {
        tenantId,
        broadcastId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update broadcast campaign
   * @param {string} tenantId - Tenant ID
   * @param {string} broadcastId - Broadcast ID
   * @param {object} updates - Fields to update
   * @returns {Promise<Object>} Updated broadcast
   */
  async updateBroadcast(tenantId, broadcastId, updates) {
    try {
      const { status, metadata } = updates;

      const updateFields = [];
      const params = [tenantId, broadcastId];
      let paramIndex = 3;

      if (status !== undefined) {
        updateFields.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex}`);
        params.push(JSON.stringify(metadata));
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return this.getBroadcast(tenantId, broadcastId);
      }

      const query = `
        UPDATE whatsapp_broadcasts
        SET ${updateFields.join(', ')}
        WHERE id = $2 AND tenant_id = $1
        RETURNING
          id,
          tenant_id,
          campaign_id,
          contact_phone_numbers,
          message_content,
          message_type,
          metadata,
          created_by_user_id,
          status,
          created_at,
          updated_at
      `;

      const result = await this.db.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating broadcast', {
        tenantId,
        broadcastId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Track broadcast contact status
   * @param {string} tenantId - Tenant ID
   * @param {string} broadcastId - Broadcast ID
   * @param {string} phoneNumber - Contact phone number
   * @param {object} statusUpdate - Status update data
   * @returns {Promise<Object>} Updated contact status
   */
  async updateBroadcastContact(tenantId, broadcastId, phoneNumber, statusUpdate) {
    try {
      const {
        status,
        messageId,
        sentAt,
        error,
      } = statusUpdate;

      const query = `
        INSERT INTO whatsapp_broadcast_contacts (
          tenant_id,
          broadcast_id,
          phone_number,
          status,
          message_id,
          sent_at,
          error
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (broadcast_id, phone_number)
        DO UPDATE SET
          status = EXCLUDED.status,
          message_id = COALESCE(EXCLUDED.message_id, whatsapp_broadcast_contacts.message_id),
          sent_at = COALESCE(EXCLUDED.sent_at, whatsapp_broadcast_contacts.sent_at),
          error = EXCLUDED.error,
          updated_at = CURRENT_TIMESTAMP
        RETURNING
          id,
          tenant_id,
          broadcast_id,
          phone_number,
          status,
          message_id,
          sent_at,
          error,
          created_at,
          updated_at
      `;

      const result = await this.db.query(query, [
        tenantId,
        broadcastId,
        phoneNumber,
        status,
        messageId || null,
        sentAt || null,
        error || null,
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating broadcast contact', {
        tenantId,
        broadcastId,
        phoneNumber,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get broadcast contact statuses
   * @param {string} tenantId - Tenant ID
   * @param {string} broadcastId - Broadcast ID
   * @returns {Promise<Array>} Contact statuses
   */
  async getBroadcastContactStatus(tenantId, broadcastId) {
    try {
      const query = `
        SELECT
          id,
          broadcast_id,
          phone_number,
          status,
          message_id,
          sent_at,
          error,
          created_at,
          updated_at
        FROM whatsapp_broadcast_contacts
        WHERE tenant_id = $1 AND broadcast_id = $2
        ORDER BY created_at DESC
      `;

      const result = await this.db.query(query, [tenantId, broadcastId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching broadcast contact statuses', {
        tenantId,
        broadcastId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * MESSAGE FORWARDING FEATURE - Data Access
   */

  /**
   * Create forwarding rule
   * @param {string} tenantId - Tenant ID
   * @param {object} data - Rule data
   * @returns {Promise<Object>} Created rule
   */
  async createForwardingRule(tenantId, data) {
    try {
      const {
        adminGroupId,
        memberGroupIds,
        enabled = true,
        metadata = {},
      } = data;

      const query = `
        INSERT INTO whatsapp_forwarding_rules (
          tenant_id,
          admin_group_id,
          member_group_ids,
          enabled,
          metadata
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          tenant_id,
          admin_group_id,
          member_group_ids,
          enabled,
          metadata,
          created_at,
          updated_at
      `;

      const result = await this.db.query(query, [
        tenantId,
        adminGroupId,
        memberGroupIds, // PostgreSQL array
        enabled,
        JSON.stringify(metadata),
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating forwarding rule', {
        tenantId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get forwarding rules for admin group
   * @param {string} tenantId - Tenant ID
   * @param {string} adminGroupId - Admin group ID
   * @returns {Promise<Array>} Forwarding rules
   */
  async getForwardingRulesByAdminGroup(tenantId, adminGroupId) {
    try {
      const query = `
        SELECT
          id,
          tenant_id,
          admin_group_id,
          member_group_ids,
          enabled,
          metadata,
          created_at,
          updated_at
        FROM whatsapp_forwarding_rules
        WHERE tenant_id = $1 AND admin_group_id = $2 AND enabled = true
      `;

      const result = await this.db.query(query, [tenantId, adminGroupId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching forwarding rules', {
        tenantId,
        adminGroupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create forwarding record (track each message forward)
   * @param {string} tenantId - Tenant ID
   * @param {object} data - Forward record data
   * @returns {Promise<Object>} Created record
   */
  async createForwardingRecord(tenantId, data) {
    try {
      const {
        forwardingRuleId,
        adminGroupId,
        memberGroupId,
        originalMessageId,
        forwardedMessageId,
        status,
      } = data;

      const query = `
        INSERT INTO whatsapp_forwarding_records (
          tenant_id,
          forwarding_rule_id,
          admin_group_id,
          member_group_id,
          original_message_id,
          forwarded_message_id,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          tenant_id,
          forwarding_rule_id,
          admin_group_id,
          member_group_id,
          original_message_id,
          forwarded_message_id,
          status,
          created_at
      `;

      const result = await this.db.query(query, [
        tenantId,
        forwardingRuleId,
        adminGroupId,
        memberGroupId,
        originalMessageId,
        forwardedMessageId,
        status,
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating forwarding record', {
        tenantId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get forwarding records for audit
   * @param {string} tenantId - Tenant ID
   * @param {object} filters - Filter options
   * @returns {Promise<Array>} Forwarding records
   */
  async getForwardingRecords(tenantId, filters = {}) {
    try {
      const {
        adminGroupId,
        memberGroupId,
        limit = 100,
        offset = 0,
      } = filters;

      let query = `
        SELECT
          id,
          tenant_id,
          forwarding_rule_id,
          admin_group_id,
          member_group_id,
          original_message_id,
          forwarded_message_id,
          status,
          created_at
        FROM whatsapp_forwarding_records
        WHERE tenant_id = $1
      `;

      const params = [tenantId];
      let paramIndex = 2;

      if (adminGroupId) {
        query += ` AND admin_group_id = $${paramIndex}`;
        params.push(adminGroupId);
        paramIndex++;
      }

      if (memberGroupId) {
        query += ` AND member_group_id = $${paramIndex}`;
        params.push(memberGroupId);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching forwarding records', {
        tenantId,
        filters,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GROUP CONTACT SYNC
   */

  /**
   * Sync member group contacts
   * @param {string} tenantId - Tenant ID
   * @param {string} memberGroupId - Member group ID
   * @param {Array<string>} phoneNumbers - List of phone numbers
   * @returns {Promise<Object>} Sync result
   */
  async syncGroupContacts(tenantId, memberGroupId, phoneNumbers) {
    try {
      const query = `
        INSERT INTO whatsapp_group_contacts (
          tenant_id,
          member_group_id,
          phone_numbers
        ) VALUES ($1, $2, $3)
        ON CONFLICT (tenant_id, member_group_id)
        DO UPDATE SET
          phone_numbers = EXCLUDED.phone_numbers,
          updated_at = CURRENT_TIMESTAMP
        RETURNING
          id,
          tenant_id,
          member_group_id,
          phone_numbers,
          created_at,
          updated_at
      `;

      const result = await this.db.query(query, [
        tenantId,
        memberGroupId,
        phoneNumbers, // PostgreSQL array
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error syncing group contacts', {
        tenantId,
        memberGroupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get group contacts
   * @param {string} tenantId - Tenant ID
   * @param {string} memberGroupId - Member group ID
   * @returns {Promise<Array>} Phone numbers in group
   */
  async getGroupContacts(tenantId, memberGroupId) {
    try {
      const query = `
        SELECT
          id,
          tenant_id,
          member_group_id,
          phone_numbers,
          created_at,
          updated_at
        FROM whatsapp_group_contacts
        WHERE tenant_id = $1 AND member_group_id = $2
      `;

      const result = await this.db.query(query, [tenantId, memberGroupId]);
      return result.rows[0]?.phone_numbers || [];
    } catch (error) {
      logger.error('Error fetching group contacts', {
        tenantId,
        memberGroupId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = WhatsAppRepository;
