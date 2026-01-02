/**
 * Priority Constants - LAD Architecture Compliant
 * Priority level mappings for leads
 */

// Priority mapping: string to integer (DB uses integer priority)
const PRIORITY_TO_INT = {
  'low': 1,
  'medium': 2,
  'high': 3,
  'urgent': 4
};

// Priority mapping: integer to string
const INT_TO_PRIORITY = {
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'urgent'
};

// Valid priority strings
const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'];

// Default priority
const DEFAULT_PRIORITY = 'medium';
const DEFAULT_PRIORITY_INT = 2;

module.exports = {
  PRIORITY_TO_INT,
  INT_TO_PRIORITY,
  PRIORITY_VALUES,
  DEFAULT_PRIORITY,
  DEFAULT_PRIORITY_INT
};
