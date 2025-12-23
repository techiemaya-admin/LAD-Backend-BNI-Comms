/**
 * Reference Data Controller
 * Handles HTTP requests for reference data (statuses, sources, priorities)
 * Routes → Controllers → Services → Models
 */

const referenceService = require('../services/reference.service');

/**
 * Get all lead statuses
 * GET /api/deals-pipeline/reference/statuses
 */
exports.getStatuses = async (req, res) => {
  try {
    const statuses = await referenceService.getStatuses();
    res.json(statuses);
  } catch (error) {
    console.error('[Reference Controller] Error getting statuses:', error);
    res.status(500).json({ error: 'Failed to fetch statuses', details: error.message });
  }
};

/**
 * Get all lead sources
 * GET /api/deals-pipeline/reference/sources
 */
exports.getSources = async (req, res) => {
  try {
    const sources = referenceService.getSources();
    res.json(sources);
  } catch (error) {
    console.error('[Reference Controller] Error getting sources:', error);
    res.status(500).json({ error: 'Failed to fetch sources', details: error.message });
  }
};

/**
 * Get all lead priorities
 * GET /api/deals-pipeline/reference/priorities
 */
exports.getPriorities = async (req, res) => {
  try {
    const priorities = referenceService.getPriorities();
    res.json(priorities);
  } catch (error) {
    console.error('[Reference Controller] Error getting priorities:', error);
    res.status(500).json({ error: 'Failed to fetch priorities', details: error.message });
  }
};
