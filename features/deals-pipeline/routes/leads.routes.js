/**
 * Lead Routes
 * /api/deals-pipeline/leads
 */

const express = require('express');
const router = express.Router();
const { validateLeadCreate, validateLeadUpdate } = require('../validators/lead.validator');
const { validateUUIDParam, validatePagination } = require('../validators/common.validator');
const leadController = require('../controllers/lead.controller');

// GET /api/deals-pipeline/leads/stats - Must come before /:id
router.get('/stats', leadController.stats);

// GET /api/deals-pipeline/leads
router.get('/', validatePagination, leadController.list);

// GET /api/deals-pipeline/leads/:id
router.get('/:id', validateUUIDParam('id'), leadController.get);

// POST /api/deals-pipeline/leads
router.post('/', validateLeadCreate, leadController.create);

// PUT /api/deals-pipeline/leads/:id
router.put('/:id', validateUUIDParam('id'), validateLeadUpdate, leadController.update);

// DELETE /api/deals-pipeline/leads/:id
router.delete('/:id', validateUUIDParam('id'), leadController.remove);

module.exports = router;
