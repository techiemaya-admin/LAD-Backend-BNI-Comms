/**
 * Lead Routes
 * /api/deals-pipeline/leads
 */

const express = require('express');
const router = express.Router();
const { jwtAuth } = require('../middleware/auth');
const leadController = require('../controllers/lead.controller');

// GET /api/deals-pipeline/leads/stats - Must come before /:id
router.get('/stats', jwtAuth, leadController.stats);

// GET /api/deals-pipeline/leads
router.get('/', jwtAuth, leadController.list);

// GET /api/deals-pipeline/leads/:id
router.get('/:id', jwtAuth, leadController.get);

// POST /api/deals-pipeline/leads
router.post('/', jwtAuth, leadController.create);

// PUT /api/deals-pipeline/leads/:id
router.put('/:id', jwtAuth, leadController.update);

// DELETE /api/deals-pipeline/leads/:id
router.delete('/:id', jwtAuth, leadController.remove);

module.exports = router;
