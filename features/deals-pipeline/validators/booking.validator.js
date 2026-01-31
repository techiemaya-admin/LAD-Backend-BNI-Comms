/**
 * Booking Validators - LAD Architecture Compliant
 * Input validation for booking-related operations
 */

const { isValidUUID } = require('./common.validator');

/**
 * Validate booking creation payload
 */
const validateBookingCreate = (req, res, next) => {
  const { 
    lead_id, 
    assigned_user_id, 
    scheduled_at,
    booking_type, 
    booking_source,
    created_by 
  } = req.body;
  const errors = [];

  // Required fields
  if (!lead_id || !isValidUUID(lead_id)) {
    errors.push('Valid lead_id (UUID) is required');
  }

  if (!assigned_user_id || !isValidUUID(assigned_user_id)) {
    errors.push('Valid assigned_user_id (UUID) is required');
  }

  if (!scheduled_at) {
    errors.push('scheduled_at is required in ISO format (e.g., 2026-01-05T14:30:00Z)');
  } else {
    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      errors.push('scheduled_at must be a valid ISO datetime string');
    }
  }

  if (!created_by || !isValidUUID(created_by)) {
    errors.push('Valid created_by (UUID) is required');
  }

  if (booking_type && typeof booking_type !== 'string') {
    errors.push('booking_type must be a string');
  }

  if (booking_source && typeof booking_source !== 'string') {
    errors.push('booking_source must be a string');
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
