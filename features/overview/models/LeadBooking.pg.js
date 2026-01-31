/**
 * Lead Booking Model
 * Handles database queries for lead bookings
 */

const logger = require('../../../core/utils/logger');

class LeadBookingModel {
  constructor(db) {
    this.pool = db;
  }

  /**
   * Get lead bookings with role-based filtering
   * Admins can see all bookings, regular users see only their assigned bookings
   * 
   * @param {string} schema - Database schema name
   * @param {string} tenantId - Tenant ID
   * @param {string} userId - Current user ID
   * @param {string} userRole - User role (admin, user, etc.)
   * @param {string} selectedUserId - Selected user ID (deprecated, use filters.user_id)
   * @param {object} filters - Additional filters
   * @param {number} limit - Result limit
   * @returns {Promise<Array>} Lead bookings
   */
  async getLeadBookings(
    schema,
    tenantId,
    userId,
    userRole = 'user',
    selectedUserId = null,
    filters = {},
    limit = 50
  ) {
    const whereClauses = ['tenant_id = $1'];
    const values = [tenantId];
    let paramIndex = 2;

    // Debug logging
    logger.debug(`[LeadBookingModel] Filter params: ${JSON.stringify({ userRole, filters, userId })}`);

    // Role-based filtering
    if ((userRole === 'owner' || userRole === 'admin') && filters.user_id) {
      // Owner/Admin explicitly selected another user's bookings by user_id
      logger.debug(`[LeadBookingModel] Filtering by user_id: ${filters.user_id}`);
      whereClauses.push(`assigned_user_id = $${paramIndex}`);
      values.push(filters.user_id);
      paramIndex++;
    } else {
      // Owner/Admin without user_id OR regular users - show own bookings
      logger.debug(`[LeadBookingModel] Filtering by own userId: ${userId}`);
      whereClauses.push(`assigned_user_id = $${paramIndex}`);
      values.push(userId);
      paramIndex++;
    }

    // Additional filters
    if (filters.status) {
      whereClauses.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.bookingType) {
      whereClauses.push(`booking_type = $${paramIndex}`);
      values.push(filters.bookingType);
      paramIndex++;
    }

    if (filters.bookingSource) {
      whereClauses.push(`booking_source = $${paramIndex}`);
      values.push(filters.bookingSource);
      paramIndex++;
    }

    if (filters.leadId) {
      whereClauses.push(`lead_id = $${paramIndex}`);
      values.push(filters.leadId);
      paramIndex++;
    }

    if (filters.startDate) {
      whereClauses.push(`scheduled_at >= $${paramIndex}`);
      values.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      whereClauses.push(`scheduled_at <= $${paramIndex}`);
      values.push(filters.endDate);
      paramIndex++;
    }

    if (filters.callResult) {
      whereClauses.push(`call_result = $${paramIndex}`);
      values.push(filters.callResult);
      paramIndex++;
    }

    // Exclude deleted records by default
    if (filters.includeDeleted !== true) {
      whereClauses.push('is_deleted = false');
    }

    const query = `
      SELECT 
        id,
        tenant_id,
        lead_id,
        assigned_user_id,
        booking_type,
        booking_source,
        scheduled_at,
        timezone,
        status,
        call_result,
        retry_count,
        parent_booking_id,
        notes,
        metadata,
        created_by,
        created_at,
        updated_at,
        is_deleted,
        buffer_until,
        task_name,
        task_scheduled_at,
        task_status,
        executed_at,
        execution_attempts,
        last_execution_error,
        idempotency_key
      FROM ${schema}.lead_bookings
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY scheduled_at DESC
      LIMIT $${paramIndex}
    `;

    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Get a single lead booking by ID
   * 
   * @param {string} schema - Database schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<object>} Lead booking or null
   */
  async getLeadBookingById(schema, bookingId, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        lead_id,
        assigned_user_id,
        booking_type,
        booking_source,
        scheduled_at,
        timezone,
        status,
        call_result,
        retry_count,
        parent_booking_id,
        notes,
        metadata,
        created_by,
        created_at,
        updated_at,
        is_deleted,
        buffer_until,
        task_name,
        task_scheduled_at,
        task_status,
        executed_at,
        execution_attempts,
        last_execution_error,
        idempotency_key
      FROM ${schema}.lead_bookings
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [bookingId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Create a new lead booking
   * 
   * @param {string} schema - Database schema name
   * @param {object} bookingData - Booking data
   * @returns {Promise<object>} Created booking
   */
  async createLeadBooking(schema, bookingData) {
    const {
      tenantId,
      leadId,
      assignedUserId,
      bookingType,
      bookingSource,
      scheduledAt,
      timezone,
      status = 'pending',
      notes,
      metadata,
      createdBy
    } = bookingData;

    const query = `
      INSERT INTO ${schema}.lead_bookings (
        tenant_id,
        lead_id,
        assigned_user_id,
        booking_type,
        booking_source,
        scheduled_at,
        timezone,
        status,
        notes,
        metadata,
        created_by,
        created_at,
        updated_at,
        is_deleted
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), false)
      RETURNING *;
    `;

    const values = [
      tenantId,
      leadId,
      assignedUserId,
      bookingType,
      bookingSource,
      scheduledAt,
      timezone,
      status,
      notes || null,
      metadata || null,
      createdBy
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Update a lead booking
   * 
   * @param {string} schema - Database schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID
   * @param {object} updateData - Data to update
   * @returns {Promise<object>} Updated booking
   */
  async updateLeadBooking(schema, bookingId, tenantId, updateData) {
    const updateFields = [];
    const values = [bookingId, tenantId];
    let paramIndex = 3;

    const allowedFields = [
      'status',
      'call_result',
      'retry_count',
      'notes',
      'metadata',
      'task_name',
      'task_scheduled_at',
      'task_status',
      'executed_at',
      'execution_attempts',
      'last_execution_error'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        values.push(updateData[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push(`updated_at = NOW()`);

    const query = `
      UPDATE ${schema}.lead_bookings
      SET ${updateFields.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *;
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Get all users for a tenant (Owner role only)
   * 
   * @param {string} schema - Database schema name
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>} Users list
   */
  async getTenantUsers(schema, tenantId) {
    const query = `
      SELECT 
        id,
        email,
        first_name,
        last_name,
        CONCAT(first_name, ' ', last_name) AS name,
        avatar_url,
        phone,
        is_active,
        last_login_at,
        created_at,
        updated_at
      FROM ${schema}.users
      WHERE primary_tenant_id = $1 AND is_active = true AND deleted_at IS NULL
      ORDER BY first_name ASC, last_name ASC
    `;

    const result = await this.pool.query(query, [tenantId]);
    return result.rows;
  }
}

module.exports = LeadBookingModel;
