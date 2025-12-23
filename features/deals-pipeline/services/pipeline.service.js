/**
 * Pipeline Service
 * Business logic for pipeline board and lead movement
 * Controllers → Services → Models
 */

const Lead = require('../models/lead.pg');
const LeadStage = require('../models/leadStage.pg');

/**
 * Get complete pipeline board data
 */
exports.getBoard = async () => {
  const [stages, leads] = await Promise.all([
    LeadStage.getAllLeadStages(),
    Lead.getAllLeads()
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
exports.moveLeadToStage = async (leadId, stageKey) => {
  return await Lead.updateLead(leadId, { stage: stageKey });
};

/**
 * Update lead status
 */
exports.updateLeadStatus = async (leadId, statusKey) => {
  return await Lead.updateLead(leadId, { status: statusKey });
};
