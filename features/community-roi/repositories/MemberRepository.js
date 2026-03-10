/**
 * Member Repository
 * Data Access Layer - SQL queries only
 * 
 * LAD Architecture: Repository Layer
 * - Contains ONLY SQL queries
 * - No business logic
 * - No transformations
 * - Tenant-scoped queries enforced
 */

const { query } = require('../../../shared/database/connection');
const logger = require('../../../core/utils/logger');
const { getSchema } = require('../../../core/utils/schemaHelper');

class MemberRepository {
  /**
   * Get all members for a tenant
   * @param {string} tenantId - Tenant ID (UUID)
   * @returns {Promise<Array>} Array of member records
   */
  async getAllMembers(tenantId) {
    try {
      const schema = getSchema();
      const result = await query(
        `SELECT 
          id,
          tenant_id,
          name,
          email,
          company_name,
          designation,
          industry,
          total_one_to_ones,
          total_referrals_given,
          total_referrals_received,
          total_business_inside_aed,
          current_streak,
          max_streak,
          last_unique_meeting_at,
          metadata,
          created_at,
          updated_at
        FROM ${schema}.community_roi_members
        WHERE tenant_id = $1::uuid
        AND is_deleted = false
        ORDER BY name ASC`,
        [tenantId]
      );

      return result.rows;
    } catch (error) {
      logger.error('[MemberRepository] Error fetching all members', { 
        error: error.message, 
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Get a single member by ID
   * @param {string} tenantId - Tenant ID (UUID)
   * @param {string} memberId - Member ID (UUID)
   * @returns {Promise<Object|null>} Member record or null
   */
  async getMemberById(tenantId, memberId) {
    try {
      const schema = getSchema();
      const result = await query(
        `SELECT * FROM ${schema}.community_roi_members
         WHERE tenant_id = $1::uuid 
         AND id = $2::uuid
         AND is_deleted = false`,
        [tenantId, memberId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('[MemberRepository] Error fetching member', { 
        error: error.message, 
        memberId 
      });
      throw error;
    }
  }

  /**
   * Search members by name
   * @param {string} tenantId - Tenant ID (UUID)
   * @param {string} searchQuery - Search query string
   * @returns {Promise<Array>} Matching member records
   */
  async searchMembers(tenantId, searchQuery) {
    try {
      const schema = getSchema();
      const result = await query(
        `SELECT * FROM ${schema}.community_roi_members
         WHERE tenant_id = $1::uuid 
         AND is_deleted = false
         AND (name ILIKE $2 OR email ILIKE $2)
         ORDER BY name ASC`,
        [tenantId, `%${searchQuery}%`]
      );

      return result.rows;
    } catch (error) {
      logger.error('[MemberRepository] Error searching members', { 
        error: error.message, 
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Create a new member
   * @param {string} tenantId - Tenant ID (UUID)
   * @param {Object} data - Member data
   * @returns {Promise<Object>} Created member record
   */
  async createMember(tenantId, data) {
    try {
      const schema = getSchema();
      const result = await query(
        `INSERT INTO ${schema}.community_roi_members 
         (tenant_id, name, email, is_deleted)
         VALUES ($1::uuid, $2, $3, false)
         RETURNING *`,
        [
          tenantId,
          data.name,
          data.email
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('[MemberRepository] Error creating member', { 
        error: error.message, 
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Update a member
   * @param {string} tenantId - Tenant ID (UUID)
   * @param {string} memberId - Member ID (UUID)
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated member record
   */
  async updateMember(tenantId, memberId, data) {
    try {
      const updates = [];
      const values = [tenantId, memberId];
      let paramIndex = 3;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        values.push(data.name);
        paramIndex++;
      }
      if (data.email !== undefined) {
        updates.push(`email = $${paramIndex}`);
        values.push(data.email);
        paramIndex++;
      }

      updates.push(`updated_at = NOW()`);

      if (updates.length === 0) {
        return this.getMemberById(tenantId, memberId);
      }

      const schema = getSchema();
      const result = await query(
        `UPDATE ${schema}.community_roi_members
         SET ${updates.join(', ')}
         WHERE tenant_id = $1::uuid AND id = $2::uuid AND is_deleted = false
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Member not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('[MemberRepository] Error updating member', { 
        error: error.message, 
        memberId 
      });
      throw error;
    }
  }

  /**
   * Update member streak
   */
  async updateStreak(tenantId, memberId, streakData) {
    try {
      const { currentStreak, lastUniqueMeetingAt } = streakData;
      const schema = getSchema();
      const result = await query(
        `UPDATE ${schema}.community_roi_members
         SET current_streak = $3,
             max_streak = GREATEST(max_streak, $3),
             last_unique_meeting_at = $4,
             updated_at = NOW()
         WHERE tenant_id = $1::uuid AND id = $2::uuid
         RETURNING *`,
        [tenantId, memberId, currentStreak, lastUniqueMeetingAt]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('[MemberRepository] Error updating streak', { error: error.message, memberId });
      throw error;
    }
  }

  /**
   * Reset member streak
   */
  async resetStreak(tenantId, memberId) {
    try {
      const schema = getSchema();
      const result = await query(
        `UPDATE ${schema}.community_roi_members
         SET current_streak = 0,
             updated_at = NOW()
         WHERE tenant_id = $1::uuid AND id = $2::uuid
         RETURNING *`,
        [tenantId, memberId]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('[MemberRepository] Error resetting streak', { error: error.message, memberId });
      throw error;
    }
  }

  /**
   * Soft delete a member
   * @param {string} tenantId - Tenant ID (UUID)
   * @param {string} memberId - Member ID (UUID)
   * @returns {Promise<boolean>} Success flag
   */
  async deleteMember(tenantId, memberId) {
    try {
      const schema = getSchema();
      const result = await query(
        `UPDATE ${schema}.community_roi_members
         SET is_deleted = true, updated_at = NOW()
         WHERE tenant_id = $1::uuid AND id = $2::uuid
         RETURNING id`,
        [tenantId, memberId]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('[MemberRepository] Error deleting member', { 
        error: error.message, 
        memberId 
      });
      throw error;
    }
  }
}

module.exports = new MemberRepository();
