/**
 * Booking Constants - LAD Architecture Compliant
 * Booking status and type definitions
 */

// Valid booking statuses
const BOOKING_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
  'no-show',
  'rescheduled'
];

// Valid booking types
const BOOKING_TYPES = [
  'consultation',
  'follow-up',
  'demo',
  'onboarding',
  'support'
];

// Valid booking sources
const BOOKING_SOURCES = [
  'web',
  'phone',
  'email',
  'chat',
  'referral'
];

// Default values
const DEFAULT_BOOKING_STATUS = 'scheduled';
const DEFAULT_BOOKING_DURATION = 30; // minutes
const MAX_BOOKING_DURATION = 480; // 8 hours
const MAX_RETRY_COUNT = 3;

module.exports = {
  BOOKING_STATUSES,
  BOOKING_TYPES,
  BOOKING_SOURCES,
  DEFAULT_BOOKING_STATUS,
  DEFAULT_BOOKING_DURATION,
  MAX_BOOKING_DURATION,
  MAX_RETRY_COUNT
};
