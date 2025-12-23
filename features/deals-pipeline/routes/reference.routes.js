/**
 * Reference Data Routes
 * /api/deals-pipeline/reference
 */

const express = require('express');
const router = express.Router();
const referenceController = require('../controllers/reference.controller');

// GET /api/deals-pipeline/reference/statuses
router.get('/statuses', referenceController.getStatuses);

// GET /api/deals-pipeline/reference/sources
router.get('/sources', referenceController.getSources);

// GET /api/deals-pipeline/reference/priorities
router.get('/priorities', referenceController.getPriorities);

module.exports = router;
