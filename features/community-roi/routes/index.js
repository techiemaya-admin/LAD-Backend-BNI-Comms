/**
 * Community ROI Routes
 * Defines all API endpoints for the feature
 * 
 * Pattern:
 * - All routes require authentication (authenticateToken middleware)
 * - All routes enforce feature flag (createFeatureMiddleware)
 * - All routes are tenant-scoped
 */

const express = require('express');
const multer = require('multer');
const { memberController, relationshipController, importController, analyticsController } = require('../controllers');
const relationshipScoresController = require('../controllers/relationshipScoresController');
const dataImportRoutes = require('./dataImportRoutes');
const logger = require('../../../core/utils/logger');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Only accept Excel files
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/octet-stream' // Accept generic binary as well
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx?|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only Excel files are accepted.`), false);
    }
  }
});

/**
 * ============================================
 * DATA IMPORT ENDPOINTS
 * ============================================
 */

/**
 * POST /api/community-roi/import/excel
 * Import data from Excel file
 * 
 * Expected request:
 * - Content-Type: multipart/form-data
 * - Body: form data with 'file' field containing Excel file
 */
router.post('/import/excel', 
  // Diagnostic logging middleware
  (req, res, next) => {
    logger.debug('[ImportController] Incoming file upload', {
      stage: 'initial',
      method: req.method,
      contentType: req.get('content-type'),
      contentLength: req.get('content-length'),
      hasBoundary: (req.get('content-type') || '').includes('boundary')
    });
    next();
  },
  
  // Multer file upload middleware (single file with field name 'file')
  upload.single('file'),
  
  // Log after file processed
  (req, res, next) => {
    logger.debug('[ImportController] After multer processing', {
      stage: 'after-multer',
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      fileField: req.file ? 'file' : 'missing',
      bufferSize: req.file?.buffer ? req.file.buffer.length : 0
    });
    next();
  },
  
  // Controller handler
  importController.importExcel.bind(importController)
);

/**
 * ============================================
 * MEMBER ENDPOINTS
 * ============================================
 */

/**
 * GET /api/community-roi/members
 * List all members for the tenant
 */
router.get('/members', memberController.listMembers.bind(memberController));

/**
 * POST /api/community-roi/members
 * Create a new member
 */
router.post('/members', memberController.createMember.bind(memberController));

/**
 * GET /api/community-roi/members/search
 * Search members by name (must come before /:memberId)
 */
router.get('/members/search', memberController.searchMembers.bind(memberController));

/**
 * GET /api/community-roi/members/:memberId
 * Get a single member with full profile
 */
router.get('/members/:memberId', memberController.getMember.bind(memberController));

/**
 * PUT /api/community-roi/members/:memberId
 * Update a member
 */
router.put('/members/:memberId', memberController.updateMember.bind(memberController));

/**
 * DELETE /api/community-roi/members/:memberId
 * Delete a member (soft delete)
 */
router.delete('/members/:memberId', memberController.deleteMember.bind(memberController));

/**
 * GET /api/community-roi/members/:memberId/engagement-score
 * Get engagement score for a member
 */
router.get('/members/:memberId/engagement-score', memberController.getEngagementScore.bind(memberController));

/**
 * GET /api/community-roi/members/:memberId/recommendations
 * Get recommended connections for a member
 */
router.get('/members/:memberId/recommendations', memberController.getRecommendations.bind(memberController));

/**
 * ============================================
 * RELATIONSHIP ENDPOINTS
 * ============================================
 */

/**
 * GET /api/community-roi/relationships/:memberId1/:memberId2
 * Get relationship score between two members
 */
router.get('/relationships/:memberId1/:memberId2', relationshipController.getRelationshipScore.bind(relationshipController));

/**
 * GET /api/community-roi/relationships/member/:memberId
 * Get all relationships for a member
 */
router.get('/relationships/member/:memberId', relationshipController.getMemberRelationships.bind(relationshipController));

/**
 * GET /api/community-roi/relationships/top
 * Get top relationships in the network (must come before /:memberId1)
 */
router.get('/relationships/top', relationshipController.getTopRelationships.bind(relationshipController));

/**
 * ============================================
 * INTERACTION ENDPOINTS (MEETINGS & REFERRALS)
 * ============================================
 */

/**
 * POST /api/community-roi/interactions/meetings
 * Log a meeting between two members
 */
router.post('/interactions/meetings', relationshipController.logMeeting.bind(relationshipController));

/**
 * POST /api/community-roi/interactions/referrals
 * Log a referral
 */
router.post('/interactions/referrals', relationshipController.logReferral.bind(relationshipController));

/**
 * GET /api/community-roi/referrals/member/:memberId
 * Get all referrals for a member
 */
router.get('/referrals/member/:memberId', relationshipController.getMemberReferrals.bind(relationshipController));

/**
 * GET /api/community-roi/members/:memberId/activity-history
 * Get activity history for a member (for charts)
 */
router.get('/members/:memberId/activity-history', relationshipController.getMemberActivityHistory.bind(relationshipController));

/**
 * GET /api/community-roi/members/:memberId/recent-activity
 * Get recent activity feed for a member
 */
router.get('/members/:memberId/recent-activity', relationshipController.getRecentActivity.bind(relationshipController));

/**
 * GET /api/community-roi/interactions/:memberId1/:memberId2
 * Get interaction history between two members
 */
router.get('/interactions/:memberId1/:memberId2', relationshipController.getInteractionHistory.bind(relationshipController));

/**
 * ============================================
 * CONTRIBUTIONS ENDPOINTS
 * ============================================
 */

/**
 * GET /api/community-roi/contributions/top
 * Get top contributors in the network
 */
router.get('/contributions/top', relationshipController.getTopContributors.bind(relationshipController));

/**
 * GET /api/community-roi/contributions/leaderboards
 * Get dashboard leaderboards
 */
router.get('/contributions/leaderboards', relationshipController.getDashboardLeaderboards.bind(relationshipController));

/**
 * GET /api/community-roi/contributions/:memberId
 * Get contributions for a specific member
 */
router.get('/contributions/:memberId', relationshipController.getMemberContributions.bind(relationshipController));

/**
 * ============================================
 * NETWORK STATISTICS ENDPOINTS
 * ============================================
 */

/**
 * GET /api/community-roi/contributions/network/stats
 * Get overall network statistics
 */
router.get('/contributions/network/stats', relationshipController.getNetworkStats.bind(relationshipController));

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Community ROI feature is operational',
    timestamp: new Date().toISOString()
  });
});

/**
 * Diagnostic endpoint for testing file uploads
 * This helps debug multipart/form-data issues
 */
router.post('/debug/upload-test', (req, res, next) => {
  logger.info('[DEBUG] Upload test endpoint called', {
    method: req.method,
    contentType: req.get('content-type'),
    contentLength: req.get('content-length'),
    headers: {
      'content-type': req.get('content-type'),
      'content-length': req.get('content-length'),
      'authorization': req.get('authorization') ? 'present' : 'missing',
      'x-tenant-id': req.get('x-tenant-id') ? 'present' : 'missing'
    }
  });
  next();
}, upload.single('file'), (req, res, next) => {
  logger.info('[DEBUG] After multer in test endpoint', {
    hasFile: !!req.file,
    fileName: req.file?.originalname,
    fileSize: req.file?.size,
    fileField: req.file?.fieldname,
    mimetypeDetected: req.file?.mimetype
  });
  next();
}, (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
      debug: {
        contentType: req.get('content-type'),
        contentLength: req.get('content-length'),
        hasBody: !!req.body,
        bodyKeys: Object.keys(req.body || {}),
        message: 'Check Content-Type header has boundary parameter'
      }
    });
  }
  
  return res.json({
    success: true,
    message: 'File upload test successful',
    file: {
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      fieldName: req.file.fieldname,
      encoding: req.file.encoding
    }
  });
});

/**
 * ============================================
 * ERROR HANDLING MIDDLEWARE
 * ============================================
 */

/**
 * Multer and file upload error handler
 */
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error('[ImportController] Multer error', { 
      error: err.message,
      code: err.code,
      diagnostics: req.uploadDiagnostics
    });
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        success: false, 
        error: 'File too large. Maximum file size is 10MB.'
      });
    }
    
    // LIMIT_PART_COUNT, LIMIT_FILE_COUNT, LIMIT_FIELDNAME_SIZE, LIMIT_FIELDSIZE, LIMIT_FIELDS, LIMIT_UNEXPECTED_FILE
    return res.status(400).json({ 
      success: false, 
      error: `File upload error: ${err.message}`,
      code: err.code,
      details: process.env.NODE_ENV === 'development' ? {
        diagnostics: req.uploadDiagnostics,
        contentType: req.get('content-type'),
        expectedField: 'file (form field name)'
      } : undefined
    });
  }
  
  // Handle other errors (including custom file validation errors)
  if (err && err.message) {
    logger.error('[ImportController] File upload error', { 
      error: err.message,
      stack: err.stack,
      diagnostics: req.uploadDiagnostics
    });
    
    if (err.message.includes('Invalid file type')) {
      return res.status(400).json({ 
        success: false, 
        error: err.message
      });
    }
    
    if (err.message.includes('Boundary')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid multipart form data. Ensure Content-Type header is "multipart/form-data" with a boundary parameter.',
        details: process.env.NODE_ENV === 'development' ? {
          contentType: req.get('content-type')
        } : undefined
      });
    }
    
    return res.status(400).json({ 
      success: false, 
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? {
        stack: err.stack,
        diagnostics: req.uploadDiagnostics
      } : undefined
    });
  }
  
  // Pass to next error handler if it exists
  next(err);
});

/**
 * ============================================
 * ANALYTICS ENDPOINTS
 * ============================================
 */

/**
 * GET /api/community-roi/analytics/dashboard
 * Get dashboard KPIs (Network Breakdown, Relationship Strength, Connectivity Analysis)
 */
router.get('/analytics/dashboard', analyticsController.getDashboardKPIs.bind(analyticsController));

/**
 * GET /api/community-roi/analytics/engagement
 * Get member engagement report with detailed metrics
 */
router.get('/analytics/engagement', analyticsController.getMemberEngagement.bind(analyticsController));

/**
 * GET /api/community-roi/analytics/top-connectors
 * Get top network connectors (hubs with most connections)
 * Query params: ?limit=10 (default: 10, max: 100)
 */
router.get('/analytics/top-connectors', analyticsController.getTopConnectors.bind(analyticsController));

/**
 * GET /api/community-roi/analytics/top-referrers
 * Get top referrers (members who made the most referrals)
 * Query params: ?limit=10 (default: 10, max: 100)
 */
router.get('/analytics/top-referrers', analyticsController.getTopReferrers.bind(analyticsController));

/**
 * GET /api/community-roi/analytics/health
 * Get network health score with assessment and recommendations
 */
router.get('/analytics/health', analyticsController.getNetworkHealth.bind(analyticsController));

/**
 * GET /api/community-roi/contribution-stats
 * Get contribution report statistics (unique meetings, referrals, impact)
 */
router.get('/contribution-stats', analyticsController.getContributionStats.bind(analyticsController));

/**
 * ============================================
 * RELATIONSHIP SCORES & HEATMAP ENDPOINTS
 * ============================================
 */

/**
 * POST /api/community-roi/relationship-scores/update
 * Update relationship scores for all member pairs
 * Calculates combination types (M=Meeting, R=Referral, MR=Both) and assigns color codes
 */
router.post('/relationship-scores/update', relationshipScoresController.updateScores.bind(relationshipScoresController));

/**
 * GET /api/community-roi/relationship-scores/heatmap
 * Get relationship heatmap data for visualization
 * Returns member pairs with scores and color codes (Red=Meeting, Orange=Referral, Green=Both)
 */
router.get('/relationship-scores/heatmap', relationshipScoresController.getHeatmap.bind(relationshipScoresController));

/**
 * ============================================
 * DATA IMPORT (EXCEL SHEET SELECTION) ROUTES
 * ============================================
 */
router.use('/data-import', dataImportRoutes);

module.exports = router;
