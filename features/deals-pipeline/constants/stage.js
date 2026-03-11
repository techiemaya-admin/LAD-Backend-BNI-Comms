/**
 * Stage Constants - LAD Architecture Compliant
 * Pipeline stage definitions
 */

// Default stage keys (lowercase, hyphenated)
const DEFAULT_STAGES = [
  { key: 'lead', label: 'Lead', color: '#3B82F6', display_order: 1 },
  { key: 'contact', label: 'Contact Made', color: '#8B5CF6', display_order: 2 },
  { key: 'qualified', label: 'Qualified', color: '#10B981', display_order: 3 },
  { key: 'proposal', label: 'Proposal Sent', color: '#F59E0B', display_order: 4 },
  { key: 'negotiation', label: 'Negotiation', color: '#EF4444', display_order: 5 },
  { key: 'closed-won', label: 'Closed Won', color: '#059669', display_order: 6 },
  { key: 'closed-lost', label: 'Closed Lost', color: '#6B7280', display_order: 7 }
];

// Stage key validation regex
const STAGE_KEY_REGEX = /^[a-z0-9_-]+$/;

// Maximum stage order
const MAX_STAGE_ORDER = 9999;

module.exports = {
  DEFAULT_STAGES,
  STAGE_KEY_REGEX,
  MAX_STAGE_ORDER
};
