/**
 * Lead Controller
 * Handles HTTP requests for lead CRUD operations
 * Routes → Controllers → Services → Models
 */

const leadService = require('../services/lead.service');

/**
 * List all leads
 * GET /api/deals-pipeline/leads
 */
exports.list = async (req, res) => {
  try {
    const { stage, status, search } = req.query;
    const leads = await leadService.list({ stage, status, search });
    res.json(leads);
  } catch (error) {
    console.error('[Lead Controller] Error listing leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads', details: error.message });
  }
};

/**
 * Get a single lead by ID
 * GET /api/deals-pipeline/leads/:id
 */
exports.get = async (req, res) => {
  try {
    const lead = await leadService.getById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    console.error('[Lead Controller] Error getting lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead', details: error.message });
  }
};

/**
 * Create a new lead
 * POST /api/deals-pipeline/leads
 */
exports.create = async (req, res) => {
  try {
    const lead = await leadService.create(req.body);
    res.status(201).json(lead);
  } catch (error) {
    console.error('[Lead Controller] Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead', details: error.message });
  }
};

/**
 * Update a lead
 * PUT /api/deals-pipeline/leads/:id
 */
exports.update = async (req, res) => {
  try {
    const lead = await leadService.update(req.params.id, req.body);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    console.error('[Lead Controller] Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead', details: error.message });
  }
};

/**
 * Delete a lead
 * DELETE /api/deals-pipeline/leads/:id
 */
exports.remove = async (req, res) => {
  try {
    await leadService.remove(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('[Lead Controller] Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead', details: error.message });
  }
};

/**
 * Get lead statistics
 * GET /api/deals-pipeline/leads/stats
 */
exports.stats = async (req, res) => {
  try {
    const stats = await leadService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('[Lead Controller] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to fetch lead stats', details: error.message });
  }
};
