/**
 * Stage Routes
 * /api/deals-pipeline/stages
 */

const express = require('express');
const router = express.Router();
const { validateStageCreate, validateStageUpdate } = require('../validators/stage.validator');
const stageController = require('../controllers/stage.controller');
const { jwtAuth } = require('../middleware/auth');

// PUT /api/deals-pipeline/stages/reorder - Must come before /:key
router.put('/reorder', jwtAuth, stageController.reorder);

// GET /api/deals-pipeline/stages
router.get('/',jwtAuth, stageController.list);

// POST /api/deals-pipeline/stages
router.post('/', jwtAuth, validateStageCreate, stageController.create);

// GET /api/deals-pipeline/stages/:key
router.get('/:key', jwtAuth, stageController.getByKey);

// PUT /api/deals-pipeline/stages/:key
router.put('/:key', jwtAuth, validateStageUpdate, stageController.update);

// DELETE /api/deals-pipeline/stages/:key
router.delete('/:key', jwtAuth, stageController.remove);

module.exports = router;
