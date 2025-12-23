/**
 * Stage Routes
 * /api/deals-pipeline/stages
 */

const express = require('express');
const router = express.Router();
const { jwtAuth } = require('../middleware/auth');
const stageController = require('../controllers/stage.controller');

// PUT /api/deals-pipeline/stages/reorder - Must come before /:key
router.put('/reorder', jwtAuth, stageController.reorder);

// GET /api/deals-pipeline/stages
router.get('/', jwtAuth, stageController.list);

// POST /api/deals-pipeline/stages
router.post('/', jwtAuth, stageController.create);

// PUT /api/deals-pipeline/stages/:key
router.put('/:key', jwtAuth, stageController.update);

// DELETE /api/deals-pipeline/stages/:key
router.delete('/:key', jwtAuth, stageController.remove);

module.exports = router;
