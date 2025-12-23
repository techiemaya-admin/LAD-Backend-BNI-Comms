/**
 * Lead Service
 * Business logic for lead operations
 * Controllers → Services → Models
 */

const Lead = require('../models/lead.pg');

/**
 * List all leads with optional filtering
 */
exports.list = async (filters = {}) => {
  const { stage, status, search } = filters;
  // TODO: Implement filtering logic
  return await Lead.getAllLeads(null, filters);
};

/**
 * Get a single lead by ID
 */
exports.getById = async (leadId) => {
  return await Lead.getLeadById(leadId);
};

/**
 * Create a new lead
 */
exports.create = async (leadData) => {
  // Validation logic can go here
  return await Lead.createLead(leadData);
};

/**
 * Update a lead
 */
exports.update = async (leadId, leadData) => {
  return await Lead.updateLead(leadId, leadData);
};

/**
 * Delete a lead
 */
exports.remove = async (leadId) => {
  return await Lead.deleteLead(leadId);
};

/**
 * Get lead statistics
 */
exports.getStats = async () => {
  return await Lead.getLeadConversionStats();
};
