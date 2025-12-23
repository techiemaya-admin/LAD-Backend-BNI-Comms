/**
 * Reference Data Service
 * Business logic for reference data (statuses, sources, priorities)
 * Controllers → Services → Models
 */

const LeadStatus = require('../models/leadStatus.pg');

/**
 * Get all lead statuses
 */
exports.getStatuses = async () => {
  return await LeadStatus.getAllLeadStatuses();
};

/**
 * Get all lead sources (static data)
 */
exports.getSources = () => {
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
 * Get all lead priorities (static data)
 */
exports.getPriorities = () => {
  return [
    { key: 'low', label: 'Low' },
    { key: 'medium', label: 'Medium' },
    { key: 'high', label: 'High' },
    { key: 'urgent', label: 'Urgent' }
  ];
};
