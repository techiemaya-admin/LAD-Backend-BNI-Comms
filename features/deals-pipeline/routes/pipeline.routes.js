/**
 * Pipeline Routes
 * /api/deals-pipeline/pipeline
 */

const express = require('express');
const router = express.Router();
const { jwtAuth } = require('../middleware/auth');
const pipelineController = require('../controllers/pipeline.controller');

// GET /api/deals-pipeline/pipeline/board
router.get('/board', jwtAuth, pipelineController.getBoard);

// PUT /api/deals-pipeline/pipeline/leads/:id/stage
router.put('/leads/:id/stage', jwtAuth, pipelineController.moveLeadToStage);

// PUT /api/deals-pipeline/pipeline/leads/:id/status
router.put('/leads/:id/status', jwtAuth, pipelineController.updateLeadStatus);

module.exports = router;
