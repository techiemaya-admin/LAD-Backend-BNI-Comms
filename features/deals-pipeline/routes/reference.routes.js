/**
 * Reference Data Routes
 * /api/deals-pipeline/reference
 */

const express = require('express');
const router = express.Router();
const { jwtAuth } = require('../middleware/auth');
const referenceController = require('../controllers/reference.controller');

// GET /api/deals-pipeline/reference/statuses
router.get('/statuses', jwtAuth, referenceController.getStatuses);

// GET /api/deals-pipeline/reference/sources
router.get('/sources', jwtAuth, referenceController.getSources);

// GET /api/deals-pipeline/reference/priorities
router.get('/priorities', jwtAuth, referenceController.getPriorities);

module.exports = router;
