/**
 * Social Integration Feature Routes
 * Entry point for the feature registry
 * 
 * LAD Architecture Compliant:
 * - Auth middleware applied per route (not globally)
 * - Tenant context enforced via auth middleware
 * - Uses shared database connection
 */

const { pool } = require('../../shared/database/connection');
const initializeRoutes = require('./routes/index');

// Initialize routes with database connection
const router = initializeRoutes(pool);

module.exports = router;
