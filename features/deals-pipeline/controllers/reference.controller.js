/**
 * Reference Data Controller - LAD Architecture Compliant
 * Handles HTTP requests for reference data (statuses, sources, priorities)
 * Routes → Controllers → Services → Models
 */

const referenceService = require('../services/reference.service');

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
 * Get all lead statuses
 * GET /api/deals-pipeline/reference/statuses
 */
exports.getStatuses = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const statuses = await referenceService.getStatuses(tenant_id, schema);
    res.json(statuses);
  } catch (error) {
    logger.error('Error getting statuses', error, { path: req.path });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch statuses', details: error.message });
  }
};

/**
 * Get all lead sources
 * GET /api/deals-pipeline/reference/sources
 */
exports.getSources = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const sources = await referenceService.getSources(tenant_id, schema);
    res.json(sources);
  } catch (error) {
    logger.error('Error getting sources', error, { path: req.path });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch sources', details: error.message });
  }
};

/**
 * Get all lead priorities
 * GET /api/deals-pipeline/reference/priorities
 */
exports.getPriorities = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const priorities = await referenceService.getPriorities(tenant_id, schema);
    res.json(priorities);
  } catch (error) {
    logger.error('Error getting priorities', error, { path: req.path });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch priorities', details: error.message });
  }
};

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
