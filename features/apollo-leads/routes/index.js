/**
 * Apollo Leads Feature Routes
 * 
 * PURPOSE:
 * Provides Apollo.io lead generation API endpoints with proper feature access
 * control and billing enforcement. This is an OPTIONAL feature that clients
 * access based on their subscription plan.
 * 
 * FEATURE ARCHITECTURE:
 * 1. FEATURE GUARD: All routes require 'apollo-leads' feature access
 * 2. CREDIT GUARD: Billable operations deduct credits automatically
 * 3. SWAGGER DOCS: Self-documenting API with OpenAPI specifications
 * 4. HEALTH CHECKS: Feature-specific health monitoring
 * 
 * API ENDPOINTS:
 * - POST /search: Search companies (1 credit)
 * - GET /companies/:id: Get company details (free)
 * - POST /companies/:id/leads: Get company employees (free)
 * - GET /leads/:id/email: Reveal email address (1 credit)
 * - GET /leads/:id/phone: Reveal phone number (8 credits)
 * - GET /health: Feature health status (free)
 * 
 * BILLING ENFORCEMENT:
 * Credit costs are enforced at middleware level:
 * - Search operations: 1 credit per search
 * - Email reveals: 1 credit per email
 * - Phone reveals: 8 credits per phone (Apollo.io pricing)
 * 
 * MIDDLEWARE STACK:
 * 1. requireFeature('apollo-leads'): Check feature access
 * 2. requireCredits(type, amount): Check and deduct credits
 * 3. Controller function: Business logic
 * 
 * INTEGRATION:
 * - Uses existing Apollo service from sts-service/scripts/apollo_service.py
 * - Maintains backward compatibility with existing Apollo implementation
 * - Adds proper access control and billing on top of existing functionality
 * 
 * SECURITY:
 * - Feature access controlled by subscription plan
 * - Credit limits prevent abuse
 * - User authentication required for all endpoints
 * - API rate limiting (implement as needed)
 * 
 * HEALTH MONITORING:
 * /health endpoint checks:
 * - Apollo.io API connectivity
 * - Database connectivity
 * - Feature-specific metrics
 */

const express = require('express');
const router = express.Router();
const { requireFeature } = require('../../shared/middleware/feature_guard');
const { requireCredits } = require('../../shared/middleware/credit_guard');
const ApolloLeadsController = require('./controllers/ApolloLeadsController');

// Feature guard middleware - all routes require apollo-leads feature
router.use(requireFeature('apollo-leads'));

/**
 * @swagger
 * /api/apollo-leads/search:
 *   post:
 *     summary: Search companies using Apollo.io
 *     tags: [Apollo Leads]
 */
router.post('/search', 
  requireCredits('apollo_search', 1), 
  ApolloLeadsController.searchCompanies
);

/**
 * @swagger
 * /api/apollo-leads/companies/{id}:
 *   get:
 *     summary: Get company details
 *     tags: [Apollo Leads]
 */
router.get('/companies/:id', ApolloLeadsController.getCompanyDetails);

/**
 * @swagger
 * /api/apollo-leads/companies/{id}/leads:
 *   post:
 *     summary: Get leads for a company
 *     tags: [Apollo Leads]
 */
router.post('/companies/:id/leads', ApolloLeadsController.getCompanyLeads);

/**
 * @swagger
 * /api/apollo-leads/leads/{id}/email:
 *   get:
 *     summary: Reveal email for a lead
 *     tags: [Apollo Leads]
 */
router.get('/leads/:id/email', 
  requireCredits('apollo_email', 1),
  ApolloLeadsController.revealEmail
);

/**
 * @swagger
 * /api/apollo-leads/leads/{id}/phone:
 *   get:
 *     summary: Reveal phone for a lead
 *     tags: [Apollo Leads]
 */
router.get('/leads/:id/phone',
  requireCredits('apollo_phone', 8),
  ApolloLeadsController.revealPhone
);

// Additional routes for compatibility
router.post('/bulk-search', ApolloLeadsController.bulkSearchCompanies);
router.get('/search-history', ApolloLeadsController.getSearchHistory);
router.delete('/search-history/:id', ApolloLeadsController.deleteSearchHistory);

/**
 * Feature health check
 */
router.get('/health', async (req, res) => {
  try {
    const { healthCheck } = require('./manifest');
    const health = await healthCheck();
    
    res.json({
      feature: 'apollo-leads',
      ...health
    });
  } catch (error) {
    res.status(500).json({
      feature: 'apollo-leads',
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;