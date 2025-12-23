/**
 * Main Router - Deals Pipeline Feature
 * Base Path: /api/deals-pipeline
 * 
 * This is the entry point that combines all route modules
 */

const express = require('express');
const router = express.Router();

// Import route modules
const leadsRoutes = require('./leads.routes');
const stagesRoutes = require('./stages.routes');
const pipelineRoutes = require('./pipeline.routes');
const referenceRoutes = require('./reference.routes');
const attachmentsRoutes = require('./attachments.routes');

// Mount route modules
router.use('/leads', leadsRoutes);
router.use('/stages', stagesRoutes);
router.use('/pipeline', pipelineRoutes);
router.use('/reference', referenceRoutes);
router.use('/leads/:id', attachmentsRoutes);

module.exports = router;
