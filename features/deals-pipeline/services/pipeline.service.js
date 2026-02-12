/**
 * Pipeline Service - LAD Architecture Compliant
 * Business logic for pipeline board and lead movement
 * Controllers → Services → Models
 */

const Lead = require('../repositories/lead.pg');
const LeadStage = require('../repositories/leadStage.pg');

/**
 * Get complete pipeline board data
 */
exports.getBoard = async (tenant_id, schema, pagination = {}) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getBoard');
  }

  const [stages, leadData] = await Promise.all([
    LeadStage.getAllLeadStages(tenant_id, schema),
    Lead.getAllLeads(tenant_id, schema, {}, pagination)
  ]);

  // Handle both array and paginated object response
  const leads = Array.isArray(leadData) ? leadData : leadData.leads;
  const paginationInfo = Array.isArray(leadData) ? null : leadData.pagination;

  // Group leads by stage
  const leadsByStage = (leads || []).reduce((acc, lead) => {
    const stageKey = lead.stage || 'unassigned';
    if (!acc[stageKey]) acc[stageKey] = [];
    acc[stageKey].push(lead);
    return acc;
  }, {});

  return {
    stages: stages || [],
    leads: leads || [],
    leadsByStage,
    pagination: paginationInfo
  };
};

/**
 * Move a lead to a different stage
 */
exports.moveLeadToStage = async (leadId, stageKey, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for moveLeadToStage');
  }
  return await Lead.updateLead(leadId, tenant_id, { stage: stageKey }, schema);
};

/**
 * Update lead status
 */
exports.updateLeadStatus = async (leadId, statusKey, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for updateLeadStatus');
  }
  return await Lead.updateLead(leadId, tenant_id, { status: statusKey }, schema);
};

/**
 * Get pipeline statistics
 */
exports.getStats = async (tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getStats');
  }
  return await Lead.getPipelineStats(tenant_id, schema);
};
