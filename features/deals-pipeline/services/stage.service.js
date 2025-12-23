/**
 * Stage Service
 * Business logic for pipeline stage operations
 * Controllers → Services → Models
 */

const LeadStage = require('../models/leadStage.pg');

/**
 * List all pipeline stages
 */
exports.list = async () => {
  return await LeadStage.getAllLeadStages();
};

/**
 * Create a new stage
 */
exports.create = async (stageData) => {
  return await LeadStage.createLeadStage(stageData);
};

/**
 * Update a stage
 */
exports.update = async (stageKey, stageData) => {
  return await LeadStage.updateLeadStage(stageKey, stageData);
};

/**
 * Delete a stage
 */
exports.remove = async (stageKey) => {
  return await LeadStage.deleteLeadStage(stageKey);
};

/**
 * Reorder stages
 */
exports.reorder = async (stageOrder) => {
  return await LeadStage.reorderLeadStages(stageOrder);
};
