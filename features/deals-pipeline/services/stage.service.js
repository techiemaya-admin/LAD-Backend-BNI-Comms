/**
 * Stage Service - LAD Architecture Compliant
 * Business logic for pipeline stage operations
 * Controllers → Services → Models
 */

const LeadStage = require('../repositories/leadStage.pg');

/**
 * List all pipeline stages
 */
exports.list = async (tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for list');
  }
  return await LeadStage.getAllLeadStages(tenant_id, schema);
};

/**
 * Get a single stage by key
 */
exports.getByKey = async (key, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getByKey');
  }
  return await LeadStage.getLeadStageByKey(key, tenant_id, schema);
};

/**
 * Create a new stage
 */
exports.create = async (stageData, schema) => {
  if (!stageData.tenant_id) {
    throw new Error('tenant_id is required for create');
  }
  return await LeadStage.createLeadStage(stageData, schema);
};

/**
 * Update a stage
 */
exports.update = async (stageKey, tenant_id, stageData, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for update');
  }
  return await LeadStage.updateLeadStage(stageKey, tenant_id, stageData, schema);
};

/**
 * Delete a stage
 */
exports.remove = async (stageKey, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for remove');
  }
  return await LeadStage.deleteLeadStage(stageKey, tenant_id, schema);
};

/**
 * Reorder stages
 */
exports.reorder = async (stageOrder, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for reorder');
  }
  return await LeadStage.reorderLeadStages(stageOrder, tenant_id, schema);
};
