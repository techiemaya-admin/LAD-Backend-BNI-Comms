// Booking Model - LAD Architecture Compliant
const { pool } = require("../../../shared/database/connection");

// Try core paths first, fallback to local shared
let DEFAULT_SCHEMA, logger;
try {
  ({ DEFAULT_SCHEMA } = require('../../../../core/utils/schemaHelper'));
  logger = require('../../../../core/utils/logger');
} catch (e) {
  ({ DEFAULT_SCHEMA } = require('../../../shared/utils/schemaHelper'));
  logger = require('../../../shared/utils/logger');
}

const CALL_MIN = 5;
const BUFFER_MIN = 5;
const SAFETY_MIN = 15;

class BookingModel {

  /**
   * Create a booking with buffer safety window
   */
  async createBooking(data, schema = DEFAULT_SCHEMA) {
    const {
      tenant_id,
      lead_id,
      assigned_user_id,
      booking_type,
      booking_source,
      scheduled_at,
      created_by,
      timezone = 'UTC',
      notes,
      metadata
    } = data;

    if (!tenant_id) {
      throw new Error('tenant_id is required for createBooking');
    }

    const scheduledAt = new Date(scheduled_at);
    if (isNaN(scheduledAt.getTime())) {
      throw new Error("Invalid scheduled_at timestamp");
    }

    // FULL BLOCK WINDOW (15 mins)
    const bufferUntil = new Date(
      scheduledAt.getTime() + SAFETY_MIN * 60 * 1000
    );

    /**
     * SLOT CONFLICT CHECK
     * Any overlap between scheduled_at < new.buffer_until
     * AND buffer_until > new.scheduled_at
     */
    const conflictQuery = `
      SELECT 1
      FROM ${schema}.lead_bookings
      WHERE
        tenant_id = $1
        AND assigned_user_id = $2
        AND is_deleted = false
        AND status IN ('scheduled', 'in_progress')
        AND scheduled_at < $4
        AND buffer_until > $3
    `;

    const conflict = await pool.query(conflictQuery, [
      tenant_id,
      assigned_user_id,
      scheduledAt,
      bufferUntil
    ]);

    if (conflict.rowCount > 0) {
      throw new Error("Slot unavailable (booking or buffer overlap)");
    }

    /**
     * INSERT BOOKING
     */
    const insertQuery = `
      INSERT INTO ${schema}.lead_bookings (
        tenant_id,
        lead_id,
        assigned_user_id,
        booking_type,
        booking_source,
        scheduled_at,
        buffer_until,
        timezone,
        status,
        notes,
        metadata,
        created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        'scheduled',$9,$10,$11
      )
      RETURNING *;
    `;

    const { rows } = await pool.query(insertQuery, [
      tenant_id,
      lead_id,
      assigned_user_id,
      booking_type,
      booking_source,
      scheduledAt,
      bufferUntil,
      timezone,
      notes || null,
      metadata || null,
      created_by
    ]);

    return rows[0];
  }

  /**
   * Mark booking completed (buffer expires naturally)
   */
  async markCompleted(bookingId, tenant_id, schema = DEFAULT_SCHEMA) {
    if (!tenant_id) {
      throw new Error('tenant_id is required for markCompleted');
    }

    const query = `
      UPDATE ${schema}.lead_bookings
      SET
        status = 'completed',
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [bookingId, tenant_id]);
    return rows[0];
  }

  /**
   * Fail / Miss / Cancel booking → RELEASE BUFFER IMMEDIATELY
   */
  async markFailed(bookingId, status, tenant_id, schema = DEFAULT_SCHEMA) {
    if (!tenant_id) {
      throw new Error('tenant_id is required for markFailed');
    }

    const allowed = ['missed', 'failed', 'cancelled'];
    if (!allowed.includes(status)) {
      throw new Error("Invalid failure status");
    }

    const query = `
      UPDATE ${schema}.lead_bookings
      SET
        status = $2,
        buffer_until = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $3
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [bookingId, status, tenant_id]);
    return rows[0];
  }

  /**
   * Get unavailable slots for calendar
   */
  async getBlockedSlots(assigned_user_id, tenant_id, dayStart, dayEnd, schema = DEFAULT_SCHEMA) {
    if (!tenant_id) {
      throw new Error('tenant_id is required for getBlockedSlots');
    }

    const query = `
      SELECT scheduled_at, buffer_until
      FROM ${schema}.lead_bookings
      WHERE
        tenant_id = $1
        AND assigned_user_id = $2
        AND is_deleted = false
        AND status IN ('scheduled', 'in_progress')
        AND scheduled_at < $4
        AND buffer_until > $3
      ORDER BY scheduled_at;
    `;

    const { rows } = await pool.query(query, [
      tenant_id,
      assigned_user_id,
      dayStart,
      dayEnd
    ]);

    return rows;
  }

  /**
 * Calculate available slots excluding booked + buffer windows
 */
async calculateAvailability({
  userId,
  dayStart,
  dayEnd,
  slotMinutes
}) {
  // 1️⃣ Fetch blocked ranges
  const blocked = await this.getBlockedSlots(
    userId,
    dayStart,
    dayEnd
  );

  const slots = [];
  const slotMs = slotMinutes * 60 * 1000;

  let cursor = new Date(dayStart);

  while (cursor.getTime() + slotMs <= dayEnd.getTime()) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor.getTime() + slotMs);

    const overlaps = blocked.some(b =>
      slotStart < new Date(b.buffer_until) &&
      slotEnd > new Date(b.scheduled_at)
    );

    if (!overlaps) {
      slots.push({
        start: slotStart,
        end: slotEnd
      });
    }

    cursor = new Date(cursor.getTime() + slotMs);
  }

  return slots;
}

}

module.exports = new BookingModel();
