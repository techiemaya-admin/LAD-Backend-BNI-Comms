/**
 * Stage Routes
 * /api/deals-pipeline/stages
 */

const express = require('express');
const router = express.Router();
const { validateStageCreate, validateStageUpdate } = require('../validators/stage.validator');
const stageController = require('../controllers/stage.controller');

// PUT /api/deals-pipeline/stages/reorder - Must come before /:key
router.put('/reorder', stageController.reorder);

// GET /api/deals-pipeline/stages
router.get('/', stageController.list);

// POST /api/deals-pipeline/stages
router.post('/', validateStageCreate, stageController.create);

// GET /api/deals-pipeline/stages/:key
router.get('/:key', stageController.getByKey);

// PUT /api/deals-pipeline/stages/:key
router.put('/:key', validateStageUpdate, stageController.update);

// DELETE /api/deals-pipeline/stages/:key
router.delete('/:key', stageController.remove);

module.exports = router;
