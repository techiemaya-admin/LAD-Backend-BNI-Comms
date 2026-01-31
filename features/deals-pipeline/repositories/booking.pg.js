// Booking Model - LAD Architecture Compliant
const { pool } = require("../../../shared/database/connection");

// Try core paths first, fallback to local shared
// Use core utils in LAD architecture
const { DEFAULT_SCHEMA } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');

const CALL_MIN = 5;
const BUFFER_MIN = 5;
const SAFETY_MIN = 15;

// Helper function to get timezone offset in hours
function getTimezoneOffset(timezone) {
  const timezoneOffsets = {
    'UTC': 0,
    'GMT': 0,
    'EST': -5,
    'PST': -8,
    'CST': -6,
    'MST': -7,
    'GST': 4,    // Gulf Standard Time (UTC+4)
    'UAE': 4,    // UAE Time (UTC+4)
    'AST': 4,    // Arabia Standard Time (UTC+4)
    'IST': 5.5,  // India Standard Time (UTC+5:30)
    'JST': 9,    // Japan Standard Time (UTC+9)
    'CET': 1,    // Central European Time (UTC+1)
    'BST': 1,    // British Summer Time (UTC+1)
  };
  
  return timezoneOffsets[timezone.toUpperCase()] || 0;
}

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
  slotMinutes,
  timezone,
  tenant_id
}, schema = DEFAULT_SCHEMA) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for calculateAvailability');
  }

  logger.info('BookingRepository calculateAvailability called', {
    userId,
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
    slotMinutes,
    currentTime: new Date().toISOString()
  });

  // 1️⃣ Fetch blocked ranges
  const blocked = await this.getBlockedSlots(
    userId,
    tenant_id,
    dayStart,
    dayEnd,
    schema
  );

  const slots = [];
  const slotMs = slotMinutes * 60 * 1000;
  
  // Get current time in the specified timezone
  const now = new Date();
  let bufferTime;
  
  if (timezone && timezone !== 'UTC') {
    // Convert current time to the specified timezone
    const timezoneOffset = getTimezoneOffset(timezone);
    bufferTime = new Date(now.getTime() + (15 * 60 * 1000) + (timezoneOffset * 60 * 60 * 1000));
    logger.debug('BookingRepository timezone calculations', {
      timezone,
      offset: timezoneOffset + ' hours',
      currentTimeUTC: now.toISOString(),
      bufferTimeWithTimezone: bufferTime.toISOString()
    });
  } else {
    // Add 15 minute buffer to prevent booking slots too close to current time
    bufferTime = new Date(now.getTime() + (15 * 60 * 1000));
    logger.debug('BookingRepository using UTC timezone', {
      currentTimeUTC: now.toISOString(),
      bufferTimeUTC: bufferTime.toISOString()
    });
  }

  let cursor = new Date(dayStart);

  while (cursor.getTime() + slotMs <= dayEnd.getTime()) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor.getTime() + slotMs);

    // Skip slots that are in the past or too close to current time
    if (slotStart <= bufferTime) {
      cursor = new Date(cursor.getTime() + slotMs);
      continue;
    }

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

  logger.debug('BookingRepository generated slots', {
    totalSlots: slots.length,
    firstSlot: slots.length > 0 ? slots[0].start.toISOString() : null,
    lastSlot: slots.length > 0 ? slots[slots.length - 1].start.toISOString() : null
  });

  return slots;
}

async getBookingById(bookingId, tenant_id, schema = DEFAULT_SCHEMA) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getBookingById');
  }

  const query = `
    SELECT * FROM ${schema}.lead_bookings
    WHERE tenant_id = $1 AND id = $2 AND is_deleted = false;
  `;
  const { rows } = await pool.query(query, [tenant_id, bookingId]);
  return rows.length > 0 ? rows[0] : null;
}

async getLeadBookings(leadId, tenant_id, schema = DEFAULT_SCHEMA) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getLeadBookings');
  }

  const query = `
    SELECT * FROM ${schema}.lead_bookings
    WHERE tenant_id = $1 AND lead_id = $2 AND is_deleted = false
    ORDER BY scheduled_at DESC;
  `;
  const { rows } = await pool.query(query, [tenant_id, leadId]);
  return rows;
}

async getLeadBookingsByDate(leadId, date, tenant_id, schema = DEFAULT_SCHEMA) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getLeadBookingsByDate');
  }

  // Convert date to start/end of day
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59Z`);

  const query = `
    SELECT * FROM ${schema}.lead_bookings
    WHERE tenant_id = $1 AND lead_id = $2 
    AND scheduled_at >= $3 AND scheduled_at <= $4
    AND is_deleted = false
    ORDER BY scheduled_at ASC;
  `;
  const { rows } = await pool.query(query, [tenant_id, leadId, dayStart, dayEnd]);
  return rows;
}

}

module.exports = new BookingModel();
