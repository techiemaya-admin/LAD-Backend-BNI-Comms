/**
 * Lead Enrichment Feature Routes
 * 
 * PURPOSE:
 * Provides AI-powered lead enrichment endpoints that work as a post-processing
 * layer for leads from Apollo, LinkedIn, or other sources.
 * 
 * FEATURE TOGGLE:
 * This feature can be enabled/disabled per client. When disabled, clients
 * receive raw lead data without enrichment. When enabled, leads are enriched
 * with website analysis and AI-powered relevance scoring.
 * 
 * WORKFLOW:
 * 1. Client gets leads from Apollo/LinkedIn/etc.
 * 2. Client sends leads to /enrich endpoint (if feature enabled)
 * 3. Service scrapes websites and runs AI analysis
 * 4. Returns filtered and scored leads based on ICP/topic
 * 
 * API ENDPOINTS:
 * - POST /enrich: Enrich and filter leads (2 credits per batch)
 * - POST /analyze-website: Analyze single website (0.5 credits)
 * - POST /batch-enrich: Process multiple batches (2 credits per batch)
 * - GET /health: Feature health check (free)
 */

const express = require('express');
const router = express.Router();
const { requireFeature } = require('../../shared/middleware/feature_guard');
const { requireCredits } = require('../../shared/middleware/credit_guard');
const LeadEnrichmentController = require('./controllers/LeadEnrichmentController');

// Feature guard middleware - all routes require lead-enrichment feature
router.use(requireFeature('lead-enrichment'));

/**
 * @swagger
 * /api/lead-enrichment/enrich:
 *   post:
 *     summary: Enrich leads with AI analysis
 *     description: Scrape websites and analyze leads for relevance to target ICP/topic
 *     tags: [Lead Enrichment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - leads
 *               - topic
 *             properties:
 *               leads:
 *                 type: array
 *                 description: Array of lead/company objects from Apollo, LinkedIn, etc.
 *               topic:
 *                 type: string
 *                 description: Target topic or ICP description for filtering
 *               min_relevance_score:
 *                 type: number
 *                 default: 5
 *                 description: Minimum relevance score (0-10)
 *               enable_website_scraping:
 *                 type: boolean
 *                 default: true
 *               enable_ai_analysis:
 *                 type: boolean
 *                 default: true
 */
router.post('/enrich',
  requireCredits('lead_enrichment', 2),
  LeadEnrichmentController.enrichLeads
);

/**
 * @swagger
 * /api/lead-enrichment/analyze-website:
 *   post:
 *     summary: Analyze a single company website
 *     tags: [Lead Enrichment]
 */
router.post('/analyze-website',
  requireCredits('website_analysis', 0.5),
  LeadEnrichmentController.analyzeWebsite
);

/**
 * @swagger
 * /api/lead-enrichment/batch-enrich:
 *   post:
 *     summary: Batch enrich multiple lead lists
 *     tags: [Lead Enrichment]
 */
router.post('/batch-enrich',
  requireCredits('batch_enrichment', 2),
  LeadEnrichmentController.batchEnrich
);

/**
 * @swagger
 * /api/lead-enrichment/generate-intelligence:
 *   post:
 *     summary: Generate AI-powered sales intelligence for a company
 *     description: Create comprehensive sales intelligence summary with business insights
 *     tags: [Lead Enrichment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company
 *               - topic
 *             properties:
 *               company:
 *                 type: object
 *                 description: Company data with domain, name, industry, etc.
 *               topic:
 *                 type: string
 *                 description: Target ICP or sales context
 *               socialPosts:
 *                 type: array
 *                 description: Optional social media posts for additional context
 */
router.post('/generate-intelligence',
  requireCredits('sales_intelligence', 1),
  LeadEnrichmentController.generateSalesIntelligence
);

/**
 * @swagger
 * /api/lead-enrichment/filter-posts:
 *   post:
 *     summary: Filter social media posts by topic relevance
 *     description: Use AI to filter posts for relevance to a specific topic
 *     tags: [Lead Enrichment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - posts
 *               - topic
 *             properties:
 *               posts:
 *                 type: array
 *                 description: Array of posts with id and text/caption
 *               topic:
 *                 type: string
 *                 description: Topic or keywords to filter by
 */
router.post('/filter-posts',
  requireCredits('post_filtering', 0.5),
  LeadEnrichmentController.filterPosts
);

/**
 * @swagger
 * /api/lead-enrichment/filter-companies:
 *   post:
 *     summary: Filter companies by topic using parallel website analysis
 *     description: Scrapes company websites in parallel and filters by topic relevance using AI
 *     tags: [Lead Enrichment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companies
 *               - topic
 *             properties:
 *               companies:
 *                 type: array
 *                 description: Array of companies with website/domain field
 *               topic:
 *                 type: string
 *                 description: Topic or industry to filter by (e.g., "oil and gas")
 *               maxConcurrent:
 *                 type: number
 *                 default: 10
 *                 description: Maximum concurrent scraping operations
 */
router.post('/filter-companies',
  requireCredits('company_filtering', 2),
  LeadEnrichmentController.filterCompanies
);

/**
 * Feature health check
 */
router.get('/health', async (req, res) => {
  try {
    const { healthCheck } = require('./manifest');
    const health = await healthCheck();
    
    res.json({
      feature: 'lead-enrichment',
      ...health
    });
  } catch (error) {
    res.status(500).json({
      feature: 'lead-enrichment',
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;
