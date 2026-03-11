/**
 * Lead Routes
 * /api/deals-pipeline/leads
 */

const express = require('express');
const router = express.Router();
const { validateLeadCreate, validateLeadUpdate } = require('../validators/lead.validator');
const { validateUUIDParam, validatePagination } = require('../validators/common.validator');
const leadController = require('../controllers/lead.controller');
const { jwtAuth } = require('../middleware/auth');

// GET /api/deals-pipeline/leads/stats - Must come before /:id
router.get('/stats', jwtAuth, leadController.stats);

// GET /api/deals-pipeline/leads
router.get('/', jwtAuth, validatePagination, leadController.list);

// GET /api/deals-pipeline/leads/:id
router.get('/:id', jwtAuth, validateUUIDParam('id'), leadController.get);

// POST /api/deals-pipeline/leads
router.post('/', jwtAuth, validateLeadCreate, leadController.create);

// PUT /api/deals-pipeline/leads/:id
router.put('/:id', jwtAuth, validateUUIDParam('id'), validateLeadUpdate, leadController.update);

// GET /api/deals-pipeline/leads/:id/comments
router.get('/:id/comments', jwtAuth, validateUUIDParam('id'), leadController.getComments);

// POST /api/deals-pipeline/leads/:id/comments
router.post('/:id/comments', jwtAuth, validateUUIDParam('id'), leadController.addComment);

// GET /api/deals-pipeline/leads/:id/tags
router.get('/:id/tags', jwtAuth, validateUUIDParam('id'), leadController.getTags);

// PUT /api/deals-pipeline/leads/:id/tags
router.put('/:id/tags', jwtAuth, validateUUIDParam('id'), leadController.updateTags);

// DELETE /api/deals-pipeline/leads/:id
router.delete('/:id', jwtAuth, validateUUIDParam('id'), leadController.remove);

module.exports = router;
