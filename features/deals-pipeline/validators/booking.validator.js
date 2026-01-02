/**
 * Booking Validators - LAD Architecture Compliant
 * Input validation for booking-related operations
 */

const { isValidUUID } = require('./common.validator');

/**
 * Validate booking creation payload
 */
const validateBookingCreate = (req, res, next) => {
  const { student_id, counsellor_id, booking_date, booking_time, duration_minutes, status } = req.body;
  const errors = [];

  // Required fields
  if (!student_id || !isValidUUID(student_id)) {
    errors.push('Valid student_id (UUID) is required');
  }

  if (!counsellor_id || !isValidUUID(counsellor_id)) {
    errors.push('Valid counsellor_id (UUID) is required');
  }

  if (!booking_date || !/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) {
    errors.push('booking_date is required in YYYY-MM-DD format');
  }

  if (!booking_time || !/^\d{2}:\d{2}$/.test(booking_time)) {
    errors.push('booking_time is required in HH:MM format');
  }

  if (duration_minutes !== undefined) {
    const duration = Number(duration_minutes);
    if (isNaN(duration) || duration <= 0 || duration > 480) {
      errors.push('duration_minutes must be between 1 and 480 (8 hours)');
    }
  }

  if (status && !['scheduled', 'completed', 'cancelled'].includes(status)) {
    errors.push('status must be one of: scheduled, completed, cancelled');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

module.exports = {
  validateBookingCreate
};
