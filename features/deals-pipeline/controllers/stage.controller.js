/**
 * Stage Controller - LAD Architecture Compliant
 * Handles HTTP requests for pipeline stage operations
 * Routes → Controllers → Services → Models
 */

const stageService = require('../services/stage.service');

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
 * List all stages
 * GET /api/deals-pipeline/stages
 */
exports.list = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const stages = await stageService.list(tenant_id, schema);
    res.json(stages);
  } catch (error) {
    logger.error('Error listing stages', error, { path: req.path });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch stages', details: error.message });
  }
};

/**
 * Get a single stage by key
 * GET /api/deals-pipeline/stages/:key
 */
exports.getByKey = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const stage = await stageService.getByKey(req.params.key, tenant_id, schema);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    res.json(stage);
  } catch (error) {
    logger.error('Error getting stage', error, { stageKey: req.params.key });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch stage', details: error.message });
  }
};

/**
 * Create a new stage
 * POST /api/deals-pipeline/stages
 */
exports.create = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const stagePayload = { ...req.body, tenant_id };
    const stage = await stageService.create(stagePayload, schema);
    res.status(201).json(stage);
  } catch (error) {
    logger.error('Error creating stage', error, { body: req.body });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to create stage', details: error.message });
  }
};

/**
 * Update a stage
 * PUT /api/deals-pipeline/stages/:key
 */
exports.update = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const stage = await stageService.update(req.params.key, tenant_id, req.body, schema);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    res.json(stage);
  } catch (error) {
    logger.error('Error updating stage', error, { stageKey: req.params.key });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update stage', details: error.message });
  }
};

/**
 * Delete a stage
 * DELETE /api/deals-pipeline/stages/:key
 */
exports.remove = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    await stageService.remove(req.params.key, tenant_id, schema);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting stage', error, { stageKey: req.params.key });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to delete stage', details: error.message });
  }
};

/**
 * Reorder stages
 * PUT /api/deals-pipeline/stages/reorder
 */
exports.reorder = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const stages = await stageService.reorder(req.body.stages, tenant_id, schema);
    res.json(stages);
  } catch (error) {
    logger.error('Error reordering stages', error, { count: req.body.stages?.length });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to reorder stages', details: error.message });
  }
};