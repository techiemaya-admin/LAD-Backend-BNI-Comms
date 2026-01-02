/**
 * Lead Service - LAD Architecture Compliant
 * Business logic for lead operations
 * Controllers → Services → Models
 */

const Lead = require('../repositories/lead.pg');

// Try core paths first, fallback to local shared
let getTenantContext;
try {
  ({ getTenantContext } = require('../../../../core/utils/schemaHelper'));
} catch (e) {
  ({ getTenantContext } = require('../../../shared/utils/schemaHelper'));
}

/**
 * List all leads with optional filtering
 */
exports.list = async (tenant_id, schema, filters = {}) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required');
  }
  return await Lead.getAllLeads(tenant_id, schema, filters);
};

/**
 * Get a single lead by ID
 */
exports.getById = async (leadId, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required');
  }
  return await Lead.getLeadById(leadId, tenant_id, schema);
};

/**
 * Create a new lead
 */
exports.create = async (leadData, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required');
  }
  // Validation logic can go here
  return await Lead.createLead(leadData, tenant_id, schema);
};

/**
 * Update a lead
 */
exports.update = async (leadId, tenant_id, leadData, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required');
  }
  return await Lead.updateLead(leadId, tenant_id, leadData, schema);
};

/**
 * Delete a lead
 */
exports.remove = async (leadId, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required');
  }
  return await Lead.deleteLead(leadId, tenant_id, schema);
};

/**
 * Get lead statistics
 */
exports.getStats = async (tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required');
  }
  return await Lead.getLeadConversionStats(tenant_id, schema);
};
