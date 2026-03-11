/**
 * Bookings Routes
 * 
 * HTTP routing for booking-related operations
 * Includes follow-up call scheduling and execution endpoints
 */

const express = require('express');
const router = express.Router();

/**
 * Setup routes with database connection
 * 
 * @param {Object} db - Database connection pool
 * @returns {express.Router} Configured router
 */
function setupRoutes(db) {
  const BookingsController = require('../controllers/bookingsController');
  const controller = new BookingsController(db);

  // Cloud Tasks authentication middleware
  const validateCloudTasksAuth = (req, res, next) => {
    const cloudTasksSecret = process.env.CLOUD_TASKS_SECRET;
    
    // If OIDC is configured, validate JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // TODO: Implement OIDC token validation
      // For now, allow if Bearer token present
      return next();
    }

    // Fallback: Check shared secret
    if (cloudTasksSecret) {
      const requestSecret = req.headers['x-cloudtasks-secret'];
      if (requestSecret !== cloudTasksSecret) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
      }
    }

    next();
  };

  // Internal endpoint - called by Cloud Tasks
  // POST /api/deals-pipeline/bookings/:id/execute-followup
  router.post(
    '/:id/execute-followup',
    validateCloudTasksAuth,
    (req, res) => controller.executeFollowUpCall(req, res)
  );

  // Schedule a follow-up call for a booking
  // POST /api/deals-pipeline/bookings/:id/schedule-followup
  router.post(
    '/:id/schedule-followup',
    (req, res) => controller.scheduleFollowUpCall(req, res)
  );

  // Cancel a scheduled follow-up call
  // DELETE /api/deals-pipeline/bookings/:id/followup
  router.delete(
    '/:id/followup',
    (req, res) => controller.cancelFollowUpCall(req, res)
  );

  // Get follow-up call status
  // GET /api/deals-pipeline/bookings/:id/followup-status
  router.get(
    '/:id/followup-status',
    (req, res) => controller.getFollowUpStatus(req, res)
  );

  // Retry a failed follow-up call
  // POST /api/deals-pipeline/bookings/:id/retry-followup
  router.post(
    '/:id/retry-followup',
    (req, res) => controller.retryFollowUpCall(req, res)
  );

  return router;
}

module.exports = setupRoutes;
