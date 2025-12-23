/**
 * Stage Controller
 * Handles HTTP requests for pipeline stage operations
 * Routes → Controllers → Services → Models
 */

const stageService = require('../services/stage.service');

/**
 * List all stages
 * GET /api/deals-pipeline/stages
 */
exports.list = async (req, res) => {
  try {
    const organizationId =
      (req.tenant && req.tenant.id) ||
      (req.user && req.user.tenant_id) ||
      null;

    const stages = await stageService.list(organizationId);
    res.json(stages);
  } catch (error) {
    console.error('[Stage Controller] Error listing stages:', error);
    res.status(500).json({
      error: 'Failed to fetch stages',
      details: error.message
    });
  }
};


/**
 * Create a new stage
 * POST /api/deals-pipeline/stages
 */
exports.create = async (req, res) => {
  try {
    const tenantId =
      (req.tenant && req.tenant.id) ||
      (req.user && req.user.tenant_id) ||
      null;

    const stagePayload = {
      ...req.body,
      tenant_id: tenantId
    };

    const stage = await stageService.create(stagePayload);
    res.status(201).json(stage);
  } catch (error) {
    console.error('[Stage Controller] Error creating stage:', error);
    res.status(500).json({ error: 'Failed to create stage', details: error.message });
  }
};

/**
 * Update a stage
 * PUT /api/deals-pipeline/stages/:key
 */
exports.update = async (req, res) => {
  try {
    const stage = await stageService.update(req.params.key, req.body);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    res.json(stage);
  } catch (error) {
    console.error('[Stage Controller] Error updating stage:', error);
    res.status(500).json({ error: 'Failed to update stage', details: error.message });
  }
};

/**
 * Delete a stage
 * DELETE /api/deals-pipeline/stages/:key
 */
exports.remove = async (req, res) => {
  try {
    await stageService.remove(req.params.key);
    res.status(204).send();
  } catch (error) {
    console.error('[Stage Controller] Error deleting stage:', error);
    res.status(500).json({ error: 'Failed to delete stage', details: error.message });
  }
};

/**
 * Reorder stages
 * PUT /api/deals-pipeline/stages/reorder
 */
exports.reorder = async (req, res) => {
  try {
    const stages = await stageService.reorder(req.body.stages);
    res.json(stages);
  } catch (error) {
    console.error('[Stage Controller] Error reordering stages:', error);
    res.status(500).json({ error: 'Failed to reorder stages', details: error.message });
  }
};
