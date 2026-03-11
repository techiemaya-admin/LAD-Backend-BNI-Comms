const express = require('express');
const { 
  VoiceAgentController,
  LeadBookingController
} = require('../controllers');

const { getSchema } = require('../../../core/utils/schemaHelper');

// Note: Core JWT authentication is already applied in app.js
// This is just a pass-through that ensures req.user exists and normalizes properties
const ensureAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      error: 'Authentication required' 
    });
  }
  
  // Normalize user ID (JWT uses 'userId', some code expects 'id')
  if (!req.user.id && req.user.userId) {
    req.user.id = req.user.userId;
  }
  if (!req.user.userId && req.user.id) {
    req.user.userId = req.user.id;
  }
  
  // Normalize tenant ID (support both snake_case and camelCase)
  const tenantId = req.user.tenantId || req.user.tenant_id || 
                   req.headers['x-tenant-id'] || req.headers['x-tenantid'];
  
  if (!tenantId) {
    return res.status(400).json({ 
      success: false,
      error: 'Tenant context required',
      message: 'Missing tenant information in token'
    });
  }
  
  // Set both formats for backward compatibility
  req.user.tenantId = tenantId;
  req.user.tenant_id = tenantId;
  
  // Set schema at request level
  if (!req.schema) {
    try {
      req.schema = getSchema(req);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant',
        message: 'Invalid tenant_id format'
      });
    }
  }
  
  next();
};
    
function createVoiceAgentRouter(db, options = {}) {
  const router = express.Router();
  
  // Initialize controllers
  const voiceAgentController = new VoiceAgentController(db);
  const leadBookingController = new LeadBookingController(db);

  /**
   * GET /user/available-agents
   * Get available agents for authenticated user
   */
  router.get(
    '/user/available-agents',
    ensureAuth,
    (req, res) => voiceAgentController.getUserAvailableAgents(req, res)
  );

  /**
   * GET /calls
   * Get call logs with optional filters (status, agentId, startDate, endDate, userId)
   */
  router.get(
    '/calls',
    ensureAuth,
    (req, res) => voiceAgentController.getCallLogs(req, res)
  );

  /**
   * GET /bookings
   * Get lead bookings with role-based filtering
   * Query params: selectedUserId, status, bookingType, bookingSource, leadId, startDate, endDate, callResult, limit
   */
  router.get(
    '/bookings',
    ensureAuth,
    (req, res) => leadBookingController.getLeadBookings(req, res)
  );

  /**
   * GET /bookings/:id
   * Get a single lead booking by ID
   */
  router.get(
    '/bookings/:id',
    ensureAuth,
    (req, res) => leadBookingController.getLeadBookingById(req, res)
  );

  /**
   * POST /bookings
   * Create a new lead booking
   */
  router.post(
    '/bookings',
    ensureAuth,
    (req, res) => leadBookingController.createLeadBooking(req, res)
  );

  /**
   * PUT /bookings/:id
   * Update a lead booking
   */
  router.put(
    '/bookings/:id',
    ensureAuth,
    (req, res) => leadBookingController.updateLeadBooking(req, res)
  );

  /**
   * GET /users
   * Get all users for the tenant (Owner role only)
   */
  router.get(
    '/users',
    ensureAuth,
    (req, res) => leadBookingController.getTenantUsers(req, res)
  );

  return router;
}

module.exports = createVoiceAgentRouter;