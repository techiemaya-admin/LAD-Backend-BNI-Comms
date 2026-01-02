/**
 * Pipeline Controller - LAD Architecture Compliant
 * Handles HTTP requests for pipeline board and lead stage management
 * Routes → Controllers → Services → Models
 */

const pipelineService = require('../services/pipeline.service');

// Try core paths first, fallback to local shared
let getTenantContext, logger;
try {
  ({ getTenantContext } = require('../../../../core/utils/schemaHelper'));
  logger = require('../../../../core/utils/logger');
} catch (e) {
  ({ getTenantContext } = require('../../../shared/utils/schemaHelper'));
  logger = require('../../../shared/utils/logger');
}

/**
 * Get complete pipeline board data
 * GET /api/deals-pipeline/pipeline/board
 */
exports.getBoard = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const board = await pipelineService.getBoard(tenant_id, schema);
    res.json(board);
  } catch (error) {
    logger.error('Error getting pipeline board', error, { path: req.path });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch pipeline board', details: error.message });
  }
};

/**
 * Move a lead to a different stage
 * PUT /api/deals-pipeline/pipeline/leads/:id/stage
 */
exports.moveLeadToStage = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const { stageKey } = req.body;
    
    if (!stageKey) {
      return res.status(400).json({ error: 'stageKey is required' });
    }
    
    const lead = await pipelineService.moveLeadToStage(req.params.id, stageKey, tenant_id, schema);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json(lead);
  } catch (error) {
    logger.error('Error moving lead', error, { leadId: req.params.id });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to move lead', details: error.message });
  }
};

/**
 * Update lead status
 * PUT /api/deals-pipeline/pipeline/leads/:id/status
 */
exports.updateLeadStatus = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const { statusKey } = req.body;
    
    if (!statusKey) {
      return res.status(400).json({ error: 'statusKey is required' });
    }
    
    const lead = await pipelineService.updateLeadStatus(req.params.id, statusKey, tenant_id, schema);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json(lead);
  } catch (error) {
    logger.error('Error updating lead status', error, { leadId: req.params.id });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update lead status', details: error.message });
  }
};
