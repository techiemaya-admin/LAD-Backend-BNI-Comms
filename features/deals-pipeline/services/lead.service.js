/**
 * Lead Service - LAD Architecture Compliant
 * Business logic for lead operations
 * Controllers → Services → Models
 */

const Lead = require('../repositories/lead.pg');

// Try core paths first, fallback to local shared
// Use core utils in LAD architecture
const { getTenantContext } = require('../../../core/utils/schemaHelper');

/**
 * List all leads with optional filtering
 */
exports.list = async (tenant_id, schema, filters = {}, pagination = {}) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required');
  }
  return await Lead.getAllLeads(tenant_id, schema, filters, pagination);
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
 * Add a comment to a lead (stored in leads.raw_data JSONB)
 */
exports.addComment = async (leadId, tenant_id, commentData, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required');
  }

  const lead = await Lead.getLeadById(leadId, tenant_id, schema);
  if (!lead) return null;

  const raw = (lead.raw_data && typeof lead.raw_data === 'object') ? lead.raw_data : {};
  const existingComments = Array.isArray(raw.comments) ? raw.comments : [];

  const nextRaw = {
    ...raw,
    comments: [...existingComments, commentData]
  };

  return await Lead.updateLead(leadId, tenant_id, { raw_data: nextRaw }, schema);
};

exports.getComments = async (leadId, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required');
  }

  const lead = await Lead.getLeadById(leadId, tenant_id, schema);
  if (!lead) return null;

  const raw = (lead.raw_data && typeof lead.raw_data === 'object') ? lead.raw_data : {};
  return Array.isArray(raw.comments) ? raw.comments : [];
};

exports.getTags = async (leadId, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required');
  }

  const lead = await Lead.getLeadById(leadId, tenant_id, schema);
  if (!lead) return null;

  const tags = lead.tags;
  return Array.isArray(tags) ? tags : [];
};

exports.updateTags = async (leadId, tenant_id, tags, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required');
  }

  if (!Array.isArray(tags)) {
    throw new Error('tags must be an array');
  }

  const lead = await Lead.getLeadById(leadId, tenant_id, schema);
  if (!lead) return null;

  return await Lead.updateLead(leadId, tenant_id, { tags }, schema);
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
