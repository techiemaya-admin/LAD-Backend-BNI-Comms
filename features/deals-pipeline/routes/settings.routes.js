/**
 * Settings Routes - Deals Pipeline Feature
 * Base Path: /api/deal-pipeline/settings
 * 
 * Handles pipeline-specific user preferences and settings
 */

const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { jwtAuth } = require('../middleware/auth');

// GET /api/deal-pipeline/settings - Get pipeline preferences
router.get('/', jwtAuth, settingsController.getSettings);

// PUT /api/deal-pipeline/settings - Update pipeline preferences
router.put('/', jwtAuth, settingsController.updateSettings);

module.exports = router;