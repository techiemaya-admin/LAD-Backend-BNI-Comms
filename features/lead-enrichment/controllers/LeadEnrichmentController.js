const WebsiteScraperService = require('../services/WebsiteScraperService');
const CompanyAnalysisService = require('../services/CompanyAnalysisService');

class LeadEnrichmentController {
  /**
   * Enrich leads with website analysis and AI scoring
   * POST /api/lead-enrichment/enrich
   */
  async enrichLeads(req, res) {
    try {
      const {
        leads,
        topic,
        icp_description,
        min_relevance_score = 5,
        enable_website_scraping = true,
        enable_ai_analysis = true
      } = req.body;

      if (!leads || !Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'leads array is required and must not be empty'
        });
      }

      if (!topic && !icp_description) {
        return res.status(400).json({
          error: 'Missing required field',
          message: 'Either "topic" or "icp_description" is required for enrichment'
        });
      }

      const targetTopic = topic || icp_description;
      const maxLeadsToProcess = Math.min(leads.length, 50); // Limit to 50 per batch

      console.log(`🔍 Enriching ${maxLeadsToProcess} leads for topic: "${targetTopic}"`);

      let enrichedLeads = [...leads.slice(0, maxLeadsToProcess)];

      // Step 1: Website Scraping (if enabled)
      if (enable_website_scraping) {
        console.log(`🌐 Scraping ${enrichedLeads.length} websites...`);
        
        const websiteScraperService = new WebsiteScraperService();
        const urls = enrichedLeads
          .map(lead => lead.website || lead.domain || lead.website_url)
          .filter(Boolean);

        if (urls.length > 0) {
          const scrapedData = await websiteScraperService.scrapeMultiple(urls, 5);
          
          // Map scraped content back to leads
          enrichedLeads = enrichedLeads.map(lead => {
            const websiteUrl = lead.website || lead.domain || lead.website_url;
            const scraped = scrapedData.find(s => s && s.url === websiteUrl);
            
            return {
              ...lead,
              websiteContent: scraped ? 
                websiteScraperService.extractTextForAnalysis(scraped) : null,
              websiteScraped: !!scraped,
              scrapedAt: scraped?.scrapedAt || null
            };
          });

          console.log(`✅ Scraped ${scrapedData.length}/${urls.length} websites successfully`);
        }
      }

      // Step 2: AI Analysis (if enabled)
      if (enable_ai_analysis) {
        console.log(`🧠 Analyzing ${enrichedLeads.length} leads with AI...`);
        
        const analysisService = new CompanyAnalysisService();
        const analyzedLeads = await analysisService.analyzeCompanies(
          enrichedLeads,
          targetTopic
        );

        enrichedLeads = analyzedLeads;
        console.log(`✅ AI analysis complete`);
      }

      // Step 3: Filter by minimum relevance score
      const filteredLeads = enrichedLeads.filter(
        lead => !enable_ai_analysis || (lead.relevanceScore || 0) >= parseFloat(min_relevance_score)
      );

      // Step 4: Sort by relevance score (highest first)
      filteredLeads.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      console.log(`✨ Enrichment complete: ${filteredLeads.length}/${leads.length} leads passed filters`);

      res.json({
        success: true,
        data: filteredLeads,
        metadata: {
          total_input: leads.length,
          total_processed: maxLeadsToProcess,
          total_enriched: filteredLeads.length,
          website_scraping_enabled: enable_website_scraping,
          ai_analysis_enabled: enable_ai_analysis,
          min_relevance_score: parseFloat(min_relevance_score),
          topic: targetTopic
        }
      });

    } catch (error) {
      console.error('Lead enrichment error:', error);
      res.status(500).json({
        error: 'Enrichment failed',
        message: error.message
      });
    }
  }

  /**
   * Analyze a single company website
   * POST /api/lead-enrichment/analyze-website
   */
  async analyzeWebsite(req, res) {
    try {
      const { url, company, topic } = req.body;

      if (!url) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'url is required'
        });
      }

      console.log(`🌐 Analyzing website: ${url}`);

      // Scrape website
      const websiteScraperService = new WebsiteScraperService();
      const scrapedData = await websiteScraperService.scrapeWebsite(url);

      if (!scrapedData) {
        return res.json({
          success: false,
          message: 'Failed to scrape website',
          url
        });
      }

      const websiteContent = websiteScraperService.extractTextForAnalysis(scrapedData);

      // AI analysis (if topic provided)
      let analysis = null;
      if (topic) {
        const analysisService = new CompanyAnalysisService();
        analysis = await analysisService.analyzeCompanyRelevance(
          company || { name: url, website: url },
          websiteContent,
          topic
        );
      }

      res.json({
        success: true,
        data: {
          url,
          scraped: scrapedData,
          content: websiteContent,
          analysis: analysis
        }
      });

    } catch (error) {
      console.error('Website analysis error:', error);
      res.status(500).json({
        error: 'Analysis failed',
        message: error.message
      });
    }
  }

  /**
   * Batch enrich multiple lead lists
   * POST /api/lead-enrichment/batch-enrich
   */
  async batchEnrich(req, res) {
    try {
      const { batches } = req.body;

      if (!batches || !Array.isArray(batches)) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'batches array is required'
        });
      }

      console.log(`📦 Processing ${batches.length} enrichment batches...`);

      const results = [];

      for (const batch of batches) {
        try {
          const enrichResult = await this.enrichLeadsInternal(batch);
          results.push({
            success: true,
            batch_id: batch.id || results.length + 1,
            ...enrichResult
          });
        } catch (error) {
          results.push({
            success: false,
            batch_id: batch.id || results.length + 1,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;

      res.json({
        success: true,
        data: results,
        summary: {
          total_batches: batches.length,
          successful: successCount,
          failed: batches.length - successCount
        }
      });

    } catch (error) {
      console.error('Batch enrichment error:', error);
      res.status(500).json({
        error: 'Batch enrichment failed',
        message: error.message
      });
    }
  }

  /**
   * Internal helper for enrichment logic
   */
  async enrichLeadsInternal(params) {
    const {
      leads,
      topic,
      min_relevance_score = 5,
      enable_website_scraping = true,
      enable_ai_analysis = true
    } = params;

    let enrichedLeads = [...leads];

    if (enable_website_scraping) {
      const websiteScraperService = new WebsiteScraperService();
      const urls = enrichedLeads
        .map(lead => lead.website || lead.domain)
        .filter(Boolean);

      if (urls.length > 0) {
        const scrapedData = await websiteScraperService.scrapeMultiple(urls, 3);
        
        enrichedLeads = enrichedLeads.map(lead => {
          const websiteUrl = lead.website || lead.domain;
          const scraped = scrapedData.find(s => s.url === websiteUrl);
          
          return {
            ...lead,
            websiteContent: scraped ? 
              websiteScraperService.extractTextForAnalysis(scraped) : null
          };
        });
      }
    }

    if (enable_ai_analysis && topic) {
      const analysisService = new CompanyAnalysisService();
      enrichedLeads = await analysisService.analyzeCompanies(enrichedLeads, topic);
    }

    const filteredLeads = enrichedLeads.filter(
      lead => !enable_ai_analysis || (lead.relevanceScore || 0) >= parseFloat(min_relevance_score)
    );

    return {
      data: filteredLeads,
      metadata: {
        total_input: leads.length,
        total_enriched: filteredLeads.length
      }
    };
  }

  /**
   * Generate sales intelligence summary for a company
   * POST /api/lead-enrichment/generate-intelligence
   * Migrated from vcp_sales_agent summarize_data()
   */
  async generateSalesIntelligence(req, res) {
    try {
      const { company, topic, socialPosts = [] } = req.body;

      if (!company) {
        return res.status(400).json({
          error: 'Missing required field',
          message: '"company" object is required'
        });
      }

      if (!topic) {
        return res.status(400).json({
          error: 'Missing required field',
          message: '"topic" or ICP description is required'
        });
      }

      console.log(`🧠 Generating sales intelligence for ${company.name || company.domain}...`);

      // Scrape website if domain is provided and content not included
      let websiteContent = company.websiteContent || '';
      if (!websiteContent && (company.domain || company.website)) {
        const scraperService = new WebsiteScraperService();
        const url = company.domain || company.website;
        console.log(`🌐 Scraping website: ${url}`);
        
        try {
          const scraped = await scraperService.scrape(url);
          if (scraped) {
            websiteContent = scraperService.extractTextForAnalysis(scraped);
          }
        } catch (error) {
          console.warn(`Failed to scrape ${url}:`, error.message);
        }
      }

      // Generate intelligence using AI
      const analysisService = new CompanyAnalysisService();
      const intelligence = await analysisService.generateSalesIntelligence(
        company,
        websiteContent,
        topic,
        socialPosts
      );

      console.log(`✅ Sales intelligence generated successfully`);

      res.json({
        success: true,
        data: intelligence
      });

    } catch (error) {
      console.error('Sales intelligence generation error:', error);
      res.status(500).json({
        error: 'Intelligence generation failed',
        message: error.message
      });
    }
  }

  /**
   * Filter social media posts by topic relevance
   * POST /api/lead-enrichment/filter-posts
   * Migrated from vcp_sales_agent filter_posts_by_topic()
   */
  async filterPosts(req, res) {
    try {
      const { posts, topic, chunkSize = 20 } = req.body;

      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: '"posts" array is required and must not be empty'
        });
      }

      if (!topic) {
        return res.status(400).json({
          error: 'Missing required field',
          message: '"topic" is required for filtering'
        });
      }

      console.log(`🔍 Filtering ${posts.length} posts for topic: "${topic.substring(0, 100)}..."`);

      const analysisService = new CompanyAnalysisService();
      const filteredPosts = await analysisService.filterPostsByTopic(posts, topic, chunkSize);

      console.log(`✅ Filtered to ${filteredPosts.length} relevant posts`);

      res.json({
        success: true,
        data: filteredPosts,
        metadata: {
          total_input: posts.length,
          total_filtered: filteredPosts.length,
          filter_rate: `${((filteredPosts.length / posts.length) * 100).toFixed(1)}%`
        }
      });

    } catch (error) {
      console.error('Post filtering error:', error);
      res.status(500).json({
        error: 'Post filtering failed',
        message: error.message
      });
    }
  }

  /**
   * Filter companies by topic using parallel website analysis
   * POST /api/lead-enrichment/filter-companies
   * Migrated from vcp_sales_agent filter_companies_by_topic()
   */
  async filterCompanies(req, res) {
    try {
      const { companies, topic, maxConcurrent = 10 } = req.body;

      if (!companies || !Array.isArray(companies) || companies.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: '"companies" array is required and must not be empty'
        });
      }

      if (!topic) {
        return res.status(400).json({
          error: 'Missing required field',
          message: '"topic" is required for filtering'
        });
      }

      console.log(`🔍 Filtering ${companies.length} companies by topic: "${topic}"`);
      console.log(`🚀 Using parallel processing (max ${maxConcurrent} concurrent)`);

      const scraperService = new WebsiteScraperService();
      const analysisService = new CompanyAnalysisService();

      const filteredCompanies = await analysisService.filterCompaniesByTopicParallel(
        companies,
        topic,
        scraperService,
        maxConcurrent
      );

      console.log(`✅ Filtered to ${filteredCompanies.length} matching companies`);

      res.json({
        success: true,
        data: filteredCompanies,
        metadata: {
          total_input: companies.length,
          total_filtered: filteredCompanies.length,
          filter_rate: `${((filteredCompanies.length / companies.length) * 100).toFixed(1)}%`,
          max_concurrent: maxConcurrent
        }
      });

    } catch (error) {
      console.error('Company filtering error:', error);
      res.status(500).json({
        error: 'Company filtering failed',
        message: error.message
      });
    }
  }
}

module.exports = new LeadEnrichmentController();
