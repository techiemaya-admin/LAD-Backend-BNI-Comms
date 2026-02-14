/**
 * Bookings Repository
 * 
 * SQL-only layer for lead_bookings table operations
 * Handles follow-up call task metadata and state management
 * Multi-tenant safe with schema and tenant_id enforcement
 */

let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  logger = {
    info: (...args) => console.log('[BookingsRepository INFO]', ...args),
    error: (...args) => console.error('[BookingsRepository ERROR]', ...args),
    warn: (...args) => console.warn('[BookingsRepository WARN]', ...args)
  };
}

class BookingsRepository {
  constructor(db) {
    this.pool = db;
  }

  /**
   * Get booking by ID (tenant-isolated)
   * 
   * @param {string} schema - Schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object|null>} Booking or null
   */
  async getBookingById(schema, bookingId, tenantId) {
    const query = `
      SELECT 
        id,
        tenant_id,
        lead_id,
        assigned_user_id,
        scheduled_at,
        booking_type,
        status,
        task_name,
        task_scheduled_at,
        task_status,
        executed_at,
        execution_attempts,
        last_execution_error,
        idempotency_key,
        created_at,
        updated_at
      FROM ${schema}.lead_bookings
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [bookingId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Mark booking task as scheduled
   * 
   * @param {string} schema - Schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} taskName - Cloud Tasks task name
   * @param {Date|string} scheduledAt - Task schedule time
   * @param {string} idempotencyKey - Idempotency key
   * @returns {Promise<Object>} Updated booking
   */
  async markTaskScheduled(schema, bookingId, tenantId, taskName, scheduledAt, idempotencyKey) {
    const query = `
      UPDATE ${schema}.lead_bookings
      SET 
        task_name = $1,
        task_scheduled_at = $2,
        task_status = 'scheduled',
        idempotency_key = $3,
        updated_at = NOW()
      WHERE id = $4 AND tenant_id = $5
      RETURNING 
        id,
        tenant_id,
        task_name,
        task_scheduled_at,
        task_status,
        idempotency_key
    `;

    const values = [taskName, scheduledAt, idempotencyKey, bookingId, tenantId];
    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Booking not found or tenant mismatch');
    }

    return result.rows[0];
  }

  /**
   * Lock booking for execution (SELECT FOR UPDATE)
   * Used to prevent concurrent execution
   * Enforces tenant isolation for multi-tenancy
   * 
   * @param {string} schema - Schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID for isolation
   * @param {Object} client - Database client for transaction
   * @returns {Promise<Object|null>} Locked booking or null
   * @throws {Error} If tenant mismatch or booking not found
   */
  async lockBookingForExecution(schema, bookingId, tenantId, client = null) {
    // Validate inputs
    if (!schema || !bookingId || !tenantId) {
      throw new Error(`Missing parameters: schema=${schema}, bookingId=${bookingId}, tenantId=${tenantId}`);
    }

    const query = `
      SELECT 
        id,
        tenant_id,
        lead_id,
        assigned_user_id,
        scheduled_at,
        booking_type,
        status,
        task_status,
        executed_at,
        execution_attempts,
        idempotency_key
      FROM ${schema}.lead_bookings
      WHERE id = $1 AND tenant_id = $2
      FOR UPDATE NOWAIT
    `;

    const db = client || this.pool;
    const result = await db.query(query, [bookingId, tenantId]);
    
    if (!result.rows[0]) {
      // Provide diagnostic error message for debugging tenant mismatches
      throw new Error(
        `Booking not found or tenant mismatch: ` +
        `bookingId=${bookingId}, tenantId=${tenantId}, schema=${schema}`
      );
    }
    
    return result.rows[0];
  }

  /**
   * Mark booking task as executed
   * 
   * @param {string} schema - Schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID for isolation
   * @param {Object} client - Database client for transaction
   * @returns {Promise<Object>} Updated booking
   */
  async markExecuted(schema, bookingId, tenantId, client = null) {
    const query = `
      UPDATE ${schema}.lead_bookings
      SET 
        task_status = 'executed',
        executed_at = NOW(),
        execution_attempts = execution_attempts + 1,
        last_execution_error = NULL,
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING 
        id,
        task_status,
        executed_at,
        execution_attempts
    `;

    const db = client || this.pool;
    const result = await db.query(query, [bookingId, tenantId]);

    if (result.rows.length === 0) {
      throw new Error('Booking not found or tenant mismatch');
    }

    return result.rows[0];
  }

  /**
   * Mark booking task as failed
   * 
   * @param {string} schema - Schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} errorMessage - Error message
   * @param {Object} client - Database client for transaction
   * @returns {Promise<Object>} Updated booking
   */
  async markFailed(schema, bookingId, tenantId, errorMessage, client = null) {
    const query = `
      UPDATE ${schema}.lead_bookings
      SET 
        task_status = 'failed',
        execution_attempts = execution_attempts + 1,
        last_execution_error = $1,
        updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING 
        id,
        task_status,
        execution_attempts,
        last_execution_error
    `;

    const db = client || this.pool;
    const result = await db.query(query, [errorMessage, bookingId, tenantId]);

    if (result.rows.length === 0) {
      throw new Error('Booking not found or tenant mismatch');
    }

    return result.rows[0];
  }

  /**
   * Mark booking task as cancelled
   * 
   * @param {string} schema - Schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object>} Updated booking
   */
  async markCancelled(schema, bookingId, tenantId) {
    const query = `
      UPDATE ${schema}.lead_bookings
      SET 
        task_status = 'cancelled',
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING 
        id,
        task_status,
        task_name
    `;

    const result = await this.pool.query(query, [bookingId, tenantId]);

    if (result.rows.length === 0) {
      throw new Error('Booking not found or tenant mismatch');
    }

    return result.rows[0];
  }

  /**
   * Create a new booking
   * 
   * @param {string} schema - Schema name
   * @param {Object} bookingData - Booking data
   * @returns {Promise<Object>} Created booking
   */
  async createBooking(schema, bookingData) {
    const {
      tenantId,
      leadId,
      assignedUserId,
      scheduledAt,
      bookingType,
      status = 'scheduled'
    } = bookingData;

    const query = `
      INSERT INTO ${schema}.lead_bookings (
        tenant_id,
        lead_id,
        assigned_user_id,
        scheduled_at,
        booking_type,
        status,
        task_status,
        execution_attempts,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0, NOW(), NOW())
      RETURNING 
        id,
        tenant_id,
        lead_id,
        assigned_user_id,
        scheduled_at,
        booking_type,
        status,
        task_status,
        created_at
    `;

    const values = [
      tenantId,
      leadId,
      assignedUserId,
      scheduledAt,
      bookingType,
      status
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get bookings by status for a tenant
   * 
   * @param {string} schema - Schema name
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} taskStatus - Task status filter
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Bookings
   */
  async getBookingsByTaskStatus(schema, tenantId, taskStatus, limit = 100) {
    const query = `
      SELECT 
        id,
        tenant_id,
        lead_id,
        assigned_user_id,
        scheduled_at,
        booking_type,
        status,
        task_status,
        task_scheduled_at,
        execution_attempts,
        created_at
      FROM ${schema}.lead_bookings
      WHERE tenant_id = $1 AND task_status = $2
      ORDER BY scheduled_at ASC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [tenantId, taskStatus, limit]);
    return result.rows;
  }
}

module.exports = BookingsRepository;
