// src/models/booking.pg.js
const { pool } = require("../../../shared/database/connection");

const CALL_MIN = 5;
const BUFFER_MIN = 5;
const SAFETY_MIN = 15;

class BookingModel {

  /**
   * Create a booking with buffer safety window
   */
  async createBooking(data) {
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
      FROM lad_dev.lead_bookings
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
      INSERT INTO lad_dev.lead_bookings (
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
  async markCompleted(bookingId) {
    const query = `
      UPDATE lad_dev.lead_bookings
      SET
        status = 'completed',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [bookingId]);
    return rows[0];
  }

  /**
   * Fail / Miss / Cancel booking → RELEASE BUFFER IMMEDIATELY
   */
  async markFailed(bookingId, status) {
    const allowed = ['missed', 'failed', 'cancelled'];
    if (!allowed.includes(status)) {
      throw new Error("Invalid failure status");
    }

    const query = `
      UPDATE lad_dev.lead_bookings
      SET
        status = $2,
        buffer_until = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [bookingId, status]);
    return rows[0];
  }

  /**
   * Get unavailable slots for calendar
   */
  async getBlockedSlots(assigned_user_id, dayStart, dayEnd) {
    const query = `
      SELECT scheduled_at, buffer_until
      FROM lad_dev.lead_bookings
      WHERE
        assigned_user_id = $1
        AND is_deleted = false
        AND status IN ('scheduled', 'in_progress')
        AND scheduled_at < $3
        AND buffer_until > $2
      ORDER BY scheduled_at;
    `;

    const { rows } = await pool.query(query, [
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
