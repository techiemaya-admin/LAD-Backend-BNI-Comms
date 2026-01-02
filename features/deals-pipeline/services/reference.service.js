/**
 * Reference Data Service - LAD Architecture Compliant
 * Business logic for reference data (statuses, sources, priorities)
 * Controllers → Services → Models
 */

const LeadStatus = require('../repositories/leadStatus.pg');

/**
 * Get all lead statuses
 */
exports.getStatuses = async (tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getStatuses');
  }
  return await LeadStatus.getAllLeadStatuses(tenant_id, schema);
};

/**
 * Get all lead sources (static data - tenant-aware for future expansion)
 */
exports.getSources = (tenant_id, schema) => {
  // Static data for now, but tenant_id passed for future customization
  return [
    { key: 'website', label: 'Website' },
    { key: 'referral', label: 'Referral' },
    { key: 'event', label: 'Event' },
    { key: 'social', label: 'Social Media' },
    { key: 'cold_call', label: 'Cold Call' },
    { key: 'email', label: 'Email Campaign' }
  ];
};

/**
 * Get all lead priorities (static data - tenant-aware for future expansion)
 */
exports.getPriorities = (tenant_id, schema) => {
  // Static data for now, but tenant_id passed for future customization
  return [
    { key: 'low', label: 'Low' },
    { key: 'medium', label: 'Medium' },
    { key: 'high', label: 'High' },
    { key: 'urgent', label: 'Urgent' }
  ];
};
