/**
 * Lead Routes
 * /api/deals-pipeline/leads
 */

const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead.controller');

// GET /api/deals-pipeline/leads/stats - Must come before /:id
router.get('/stats', leadController.stats);

// GET /api/deals-pipeline/leads
router.get('/', leadController.list);

// GET /api/deals-pipeline/leads/:id
router.get('/:id', leadController.get);

// POST /api/deals-pipeline/leads
router.post('/', leadController.create);

// PUT /api/deals-pipeline/leads/:id
router.put('/:id', leadController.update);

// DELETE /api/deals-pipeline/leads/:id
router.delete('/:id', leadController.remove);

module.exports = router;
