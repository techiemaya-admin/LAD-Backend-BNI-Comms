/**
 * Deals Pipeline Feature - Index
 * 
 * Entry point for deals-pipeline feature
 * Exports routes and services for follow-up call system
 */

const setupBookingsRoutes = require('./routes/bookingsRoutes');

module.exports = {
  // Routes
  setupBookingsRoutes,
  
  // Services (for programmatic use)
  FollowUpSchedulerService: require('./services/followUpSchedulerService'),
  FollowUpExecutionService: require('./services/followUpExecutionService'),
  
  // Repositories
  BookingsRepository: require('./repositories/bookingsRepository'),
  
  // Controllers
  BookingsController: require('./controllers/bookingsController')
};
