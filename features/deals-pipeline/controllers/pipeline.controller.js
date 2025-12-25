/**
 * Pipeline Controller
 * Handles HTTP requests for pipeline board and lead stage management
 * Routes → Controllers → Services → Models
 */

const pipelineService = require('../services/pipeline.service');

/**
 * Get complete pipeline board data
 * GET /api/deals-pipeline/pipeline/board
 */
exports.getBoard = async (req, res) => {
  try {
    const board = await pipelineService.getBoard();
    res.json(board);
  } catch (error) {
    console.error('[Pipeline Controller] Error getting board:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline board', details: error.message });
  }
};

/**
 * Move a lead to a different stage
 * PUT /api/deals-pipeline/pipeline/leads/:id/stage
 */
exports.moveLeadToStage = async (req, res) => {
  try {
    const { stageKey } = req.body;
    if (!stageKey) {
      return res.status(400).json({ error: 'stageKey is required' });
    }
    
    const lead = await pipelineService.moveLeadToStage(req.params.id, stageKey);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json(lead);
  } catch (error) {
    console.error('[Pipeline Controller] Error moving lead:', error);
    res.status(500).json({ error: 'Failed to move lead', details: error.message });
  }
};

/**
 * Update lead status
 * PUT /api/deals-pipeline/pipeline/leads/:id/status
 */
exports.updateLeadStatus = async (req, res) => {
  try {
    const { statusKey } = req.body;
    if (!statusKey) {
      return res.status(400).json({ error: 'statusKey is required' });
    }
    
    const lead = await pipelineService.updateLeadStatus(req.params.id, statusKey);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json(lead);
  } catch (error) {
    console.error('[Pipeline Controller] Error updating lead status:', error);
    res.status(500).json({ error: 'Failed to update lead status', details: error.message });
  }
};
