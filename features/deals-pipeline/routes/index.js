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
const bookingRoutes = require('./booking.routes');
const studentRoutes = require('./student.routes');
const settingsRoutes = require('./settings.routes');
const { requireCounsellorsFeature } = require('../middleware/educationTenantCheck');

// Mount route modules
router.use('/leads', leadsRoutes);
router.use('/stages', stagesRoutes);
router.use('/pipeline', pipelineRoutes);
router.use('/reference', referenceRoutes);
router.use('/leads/:id', attachmentsRoutes);
router.use('/bookings', bookingRoutes);
// Legacy singular booking route alias
router.use('/booking', bookingRoutes);
router.use('/students', studentRoutes);
router.use('/settings', settingsRoutes);

// Counsellors endpoint (requires 'education-counsellors' feature flag)
router.get('/counsellors', requireCounsellorsFeature, async (req, res) => {
  try {
    const studentController = require('../controllers/student.controller');
    await studentController.getAllCounsellors(req, res);
  } catch (err) {
    const logger = require('../../../core/utils/logger');
    logger.error('[deals-pipeline] counsellors route error', { error: err.message, stack: err.stack });
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch counsellors' 
    });
  }
});

module.exports = router;
