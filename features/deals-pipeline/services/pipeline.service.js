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
exports.getBoard = async (tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getBoard');
  }

  const [stages, leads] = await Promise.all([
    LeadStage.getAllLeadStages(tenant_id, schema),
    Lead.getAllLeads(tenant_id, schema)
  ]);

  // Group leads by stage
  const leadsByStage = leads.reduce((acc, lead) => {
    const stageKey = lead.stage || 'unassigned';
    if (!acc[stageKey]) acc[stageKey] = [];
    acc[stageKey].push(lead);
    return acc;
  }, {});

  return {
    stages: stages || [],
    leads: leads || [],
    leadsByStage
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
