/**
 * Lead Controller - LAD Architecture Compliant
 * Handles HTTP requests for lead CRUD operations
 * Routes → Controllers → Services → Models
 */

const leadService = require('../services/lead.service');

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
 * List all leads
 * GET /api/deals-pipeline/leads
 */
exports.list = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const { stage, status, search } = req.query;
    const leads = await leadService.list(tenant_id, schema, { stage, status, search });
    res.json(leads);
  } catch (error) {
    logger.error('Error listing leads', error, { path: req.path });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch leads', details: error.message });
  }
};

/**
 * Get a single lead by ID
 * GET /api/deals-pipeline/leads/:id
 */
exports.get = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const lead = await leadService.getById(req.params.id, tenant_id, schema);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    logger.error('Error getting lead', error, { leadId: req.params.id });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch lead', details: error.message });
  }
};

/**
 * Create a new lead
 * POST /api/deals-pipeline/leads
 */
exports.create = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const lead = await leadService.create(req.body, tenant_id, schema);
    res.status(201).json(lead);
  } catch (error) {
    logger.error('Error creating lead', error, { body: req.body });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to create lead', details: error.message });
  }
};

/**
 * Update a lead
 * PUT /api/deals-pipeline/leads/:id
 */
exports.update = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const lead = await leadService.update(req.params.id, tenant_id, req.body, schema);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    logger.error('Error updating lead', error, { leadId: req.params.id });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update lead', details: error.message });
  }
};

/**
 * Delete a lead
 * DELETE /api/deals-pipeline/leads/:id
 */
exports.remove = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    await leadService.remove(req.params.id, tenant_id, schema);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting lead', error, { leadId: req.params.id });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to delete lead', details: error.message });
  }
};

/**
 * Get lead statistics
 * GET /api/deals-pipeline/leads/stats
 */
exports.stats = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const stats = await leadService.getStats(tenant_id, schema);
    res.json(stats);
  } catch (error) {
    logger.error('Error getting stats', error, { path: req.path });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch lead stats', details: error.message });
  }
};
