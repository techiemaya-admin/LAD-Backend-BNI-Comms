/**
 * Lead Enrichment Feature Manifest
 * 
 * PURPOSE:
 * Provides AI-powered lead enrichment and filtering capabilities.
 * Enriches company/lead data from various sources (Apollo, LinkedIn, etc.)
 * with website analysis and AI-based relevance scoring.
 * 
 * FEATURE DESCRIPTION:
 * This is an OPTIONAL add-on feature that processes lead data from other sources
 * (like Apollo.io, LinkedIn, etc.) and enriches it with:
 * - Website content analysis
 * - AI-powered relevance scoring based on ICP/topic
 * - Company filtering and ranking
 * - Lead qualification insights
 * 
 * INTEGRATION:
 * - Works as a post-processing layer after Apollo/LinkedIn searches
 * - Can be enabled/disabled per client
 * - Clients without this feature get raw lead data
 * - Clients with this feature get enriched, filtered, and scored leads
 * 
 * BILLING:
 * - 2 credits per enrichment batch (up to 50 companies)
 * - Website scraping included
 * - AI analysis included
 */

module.exports = {
  key: 'lead-enrichment',
  name: 'Lead Enrichment',
  version: '1.0.0',
  description: 'AI-powered lead enrichment with website analysis and relevance scoring',
  
  routes: [
    {
      path: '/enrich',
      method: 'POST',
      description: 'Enrich and filter leads with AI analysis',
      credits: 2
    },
    {
      path: '/analyze-website',
      method: 'POST',
      description: 'Analyze a single company website',
      credits: 0.5
    },
    {
      path: '/batch-enrich',
      method: 'POST',
      description: 'Batch enrich multiple lead lists',
      credits: 2
    }
  ],

  dependencies: {
    'apollo-leads': 'optional', // Works with Apollo but not required
    'linkedin-scraper': 'optional' // Works with LinkedIn but not required
  },

  configuration: {
    ai_provider: process.env.AI_PROVIDER || 'openai',
    ai_model: process.env.AI_MODEL || 'gpt-4o-mini',
    max_concurrent_scraping: 5,
    scraping_timeout: 10000,
    min_confidence_threshold: 50
  },

  healthCheck: async () => {
    try {
      const hasAIKey = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
      
      return {
        status: hasAIKey ? 'healthy' : 'degraded',
        message: hasAIKey ? 
          'AI provider configured and ready' : 
          'AI provider not configured - enrichment will be limited',
        ai_provider: process.env.AI_PROVIDER || 'openai',
        ai_configured: hasAIKey
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
};
