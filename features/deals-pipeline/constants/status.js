/**
 * Status Constants - LAD Architecture Compliant
 * Lead status definitions
 */

// Valid lead statuses
const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'unqualified',
  'lost',
  'converted'
];

// Default status
const DEFAULT_STATUS = 'new';

// Status colors (can be used for UI)
const STATUS_COLORS = {
  'new': '#3B82F6',          // blue
  'contacted': '#8B5CF6',    // purple
  'qualified': '#10B981',    // green
  'unqualified': '#6B7280',  // gray
  'lost': '#EF4444',         // red
  'converted': '#059669'     // dark green
};

module.exports = {
  LEAD_STATUSES,
  DEFAULT_STATUS,
  STATUS_COLORS
};
