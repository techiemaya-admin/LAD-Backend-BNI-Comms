/**
 * Public Routes - Deals Pipeline Feature
 * 
 * Routes that don't require feature flags (e.g., Cloud Tasks callbacks)
 * These are mounted without feature flag middleware
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { jwtAuth } = require('../middleware/auth');

// Get database connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD
});

// Import booking routes that handle the execute-followup endpoint
const setupBookingRoutes = require('./bookingsRoutes');
const bookingRoutes = setupBookingRoutes(pool);

// Mount only the public booking routes (execute-followup)
router.use('/bookings', jwtAuth, bookingRoutes);

module.exports = router;
