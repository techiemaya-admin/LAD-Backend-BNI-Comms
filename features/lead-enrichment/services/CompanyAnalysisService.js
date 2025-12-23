const axios = require('axios');

class CompanyAnalysisService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    this.provider = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'anthropic'
    this.model = process.env.AI_MODEL || 'gpt-4o-mini';
    
    if (!this.apiKey) {
      console.warn('⚠️ AI API key not configured for company analysis');
    }
  }

  /**
   * Analyze if a company is relevant to a given topic/ICP
   * @param {Object} company - Company data
   * @param {string} websiteContent - Scraped website content
   * @param {string} topic - Target topic or ICP description
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeCompanyRelevance(company, websiteContent, topic) {
    if (!this.apiKey) {
      return {
        isRelevant: null,
        confidence: 0,
        reasoning: 'AI analysis not configured',
        score: 0
      };
    }

    const prompt = this.buildAnalysisPrompt(company, websiteContent, topic);

    try {
      const response = await this.callAI(prompt);
      return this.parseAnalysisResponse(response);
    } catch (error) {
      console.error('AI analysis error:', error.message);
      return {
        isRelevant: null,
        confidence: 0,
        reasoning: `Analysis failed: ${error.message}`,
        score: 0
      };
    }
  }

  /**
   * Generate sales intelligence summary for a company
   * Migrated from vcp_sales_agent summarize_data()
   * @param {Object} company - Company data
   * @param {string} websiteContent - Scraped website content  
   * @param {string} topic - Target topic/ICP
   * @param {Array} socialPosts - Optional social media posts
   * @returns {Promise<Object>} Sales intelligence summary
   */
  async generateSalesIntelligence(company, websiteContent, topic, socialPosts = []) {
    if (!this.apiKey) {
      return {
        summary: 'AI analysis not configured',
        travelActivity: null,
        keyInsights: [],
        businessContext: null,
        salesNotes: []
      };
    }

    const companyName = company.name || 'Unknown Company';
    const companyIndustry = company.industry || topic;

    const prompt = `You are a smart and professional sales intelligence analyst.
Your job is to analyze company information and generate a concise, actionable sales intelligence summary.

**Company Information:**
Name: ${companyName}
Industry: ${companyIndustry}
Location: ${company.location || 'Unknown'}
Size: ${company.estimated_num_employees || 'Unknown'} employees
Description: ${company.short_description || 'N/A'}

**Website Content:**
${websiteContent ? websiteContent.substring(0, 2000) : 'No website content available'}

${socialPosts && socialPosts.length > 0 ? `
**Social Media Activity:**
${JSON.stringify(socialPosts.slice(0, 5), null, 2)}
` : ''}

**Target Profile:** ${topic}

Provide a comprehensive sales intelligence analysis with these sections:

1. **Company Overview:** Brief summary of what they do and their market position
2. **Relevance to Target:** How well they match the target profile (0-10 score)
3. **Key Business Signals:** Any expansion, hiring, or growth indicators
4. **Pain Points & Opportunities:** Potential needs or challenges they might have
5. **Recommended Approach:** Best way to engage (timing, messaging, decision makers)

Provide the output in clean markdown format with clear section headers (##).
Keep it concise but actionable - focus on insights that help close deals.`;

    try {
      const response = await this.callAIFlexible(prompt, '', 0.7);
      return this.parseSalesIntelligence(response, company);
    } catch (error) {
      console.error('Sales intelligence generation error:', error.message);
      return {
        summary: `Could not generate sales intelligence: ${error.message}`,
        relevanceScore: 0,
        keyInsights: [],
        salesNotes: []
      };
    }
  }

  /**
   * Filter social media posts by relevance to topic
   * Migrated from vcp_sales_agent filter_posts_by_topic()
   * @param {Array} posts - Array of social posts with {id, text/caption}
   * @param {string} topic - Topic to filter by
   * @param {number} chunkSize - Batch size for processing
   * @returns {Promise<Array>} Filtered posts
   */
  async filterPostsByTopic(posts, topic, chunkSize = 20) {
    if (!this.apiKey || !posts || posts.length === 0) {
      return posts || [];
    }

    console.log(`Filtering ${posts.length} posts for topic: '${topic.substring(0, 100)}...'`);

    const systemPrompt = `You are an AI data filter. The user is searching for posts related to the following keywords and concepts: '${topic}'.

You will be given a list of JSON objects, each with an "id" and a "text".
Your task is to return a JSON array containing ONLY the "id" numbers (as integers) of the posts that are clearly and explicitly relevant to any of those topics.

Example:
User topic: "business trips, attending conference, work travel"
Data: [
  {"id": 1, "text": "Excited to be at #GDC in San Francisco this week!"},
  {"id": 2, "text": "Just posted our Q3 earnings, great results!"},
  {"id": 3, "text": "Packing my bags for the London sales meeting!"}
]

Your response: [1, 3]`;

    const relevantPostIds = new Set();

    // Process posts in chunks
    for (let i = 0; i < posts.length; i += chunkSize) {
      const chunk = posts.slice(i, i + chunkSize);
      const simplifiedChunk = chunk.map(post => ({
        id: post.id,
        text: post.caption || post.text || post.content || ''
      }));

      const userPrompt = `Data:\n${JSON.stringify(simplifiedChunk, null, 2)}`;
      console.log(`  - Filtering chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(posts.length / chunkSize)}...`);

      try {
        const response = await this.callAIFlexible(userPrompt, systemPrompt, 0.0);
        
        // Parse JSON array from response
        const startIndex = response.indexOf('[');
        const endIndex = response.lastIndexOf(']');

        if (startIndex !== -1 && endIndex !== -1) {
          const jsonString = response.substring(startIndex, endIndex + 1);
          const ids = JSON.parse(jsonString);
          if (Array.isArray(ids)) {
            ids.forEach(id => relevantPostIds.add(id));
          }
        }
      } catch (error) {
        console.error(`Error filtering chunk: ${error.message}`);
      }
    }

    const relevantPosts = posts.filter(post => relevantPostIds.has(post.id));
    console.log(`  ✅ Filtered to ${relevantPosts.length} relevant posts`);
    
    return relevantPosts;
  }

  /**
   * Build prompt for company relevance analysis
   */
  buildAnalysisPrompt(company, websiteContent, topic) {
    return `You are a B2B sales analyst. Analyze if this company matches the target profile.

**Target Profile/Topic:**
${topic}

**Company Information:**
Name: ${company.name || 'Unknown'}
Industry: ${company.industry || 'Unknown'}
Location: ${company.location || 'Unknown'}
Size: ${company.estimated_num_employees || 'Unknown'} employees
Description: ${company.short_description || 'N/A'}

**Website Content Analysis:**
${websiteContent ? websiteContent.substring(0, 3000) : 'No website content available'}

**Task:**
Analyze if this company is a good fit for the target profile. Consider:
1. Does their business align with the target topic/industry?
2. Do they have relevant products/services?
3. Are they likely to need the solution implied by the target profile?
4. Does their company size/type match the ICP?

**Response Format (JSON only):**
{
  "isRelevant": true/false,
  "confidence": 0-100,
  "score": 0-10,
  "reasoning": "Brief explanation (2-3 sentences)",
  "keyMatches": ["match1", "match2"],
  "concerns": ["concern1", "concern2"]
}`;
  }

  /**
   * Call AI provider
   */
  async callAI(prompt) {
    if (this.provider === 'openai') {
      return this.callOpenAI(prompt);
    } else if (this.provider === 'anthropic') {
      return this.callAnthropic(prompt);
    }
    throw new Error('Unsupported AI provider');
  }

  async callOpenAI(prompt) {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a B2B sales analyst. Respond only with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  async callAnthropic(prompt) {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: this.model || 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.content[0].text;
  }

  /**
   * Parse AI response
   */
  parseAnalysisResponse(response) {
    try {
      const parsed = JSON.parse(response);
      return {
        isRelevant: parsed.isRelevant === true,
        confidence: parseInt(parsed.confidence) || 0,
        score: parseFloat(parsed.score) || 0,
        reasoning: parsed.reasoning || '',
        keyMatches: parsed.keyMatches || [],
        concerns: parsed.concerns || []
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return {
        isRelevant: null,
        confidence: 0,
        reasoning: 'Failed to parse AI response',
        score: 0
      };
    }
  }

  /**
   * Batch analyze multiple companies
   * @param {Array} companies - Array of company objects with website content
   * @param {string} topic - Target topic
   * @returns {Promise<Array>} Analyzed companies with scores
   */
  async analyzeCompanies(companies, topic) {
    const results = [];
    
    for (const company of companies) {
      const analysis = await this.analyzeCompanyRelevance(
        company,
        company.websiteContent || '',
        topic
      );
      
      results.push({
        ...company,
        aiAnalysis: analysis,
        relevanceScore: analysis.score
      });
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Sort by relevance score (highest first)
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Filter companies by topic using parallel processing
   * Migrated from vcp_sales_agent filter_companies_by_topic()
   * 
   * @param {Array} companies - Array of companies with website/domain
   * @param {string} topic - Topic to filter by
   * @param {Object} scraperService - WebsiteScraperService instance
   * @param {number} maxConcurrent - Max concurrent operations (default: 10)
   * @returns {Promise<Array>} Filtered companies that match topic
   */
  async filterCompaniesByTopicParallel(companies, topic, scraperService, maxConcurrent = 10) {
    if (!companies || companies.length === 0) {
      return [];
    }

    console.log(`\n🔍 Filtering ${companies.length} companies by topic: '${topic}'`);
    console.log(`🚀 Using parallel processing with max ${maxConcurrent} concurrent operations\n`);

    const processCompany = async (company, index) => {
      const companyName = company.name || company.companyName || 'Unknown';
      const websiteUrl = company.website || company.website_url || company.domain;

      if (!websiteUrl) {
        console.log(`[${index + 1}/${companies.length}] ⚠️ ${companyName}: No website URL`);
        return { company, index, isRelated: null };
      }

      // Ensure URL has protocol
      let fullUrl = websiteUrl;
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        fullUrl = 'https://' + fullUrl;
      }

      try {
        // Step 1: Scrape website
        const scraped = await scraperService.scrapeWebsite(fullUrl);
        
        if (!scraped) {
          console.log(`[${index + 1}/${companies.length}] ⚠️ ${companyName}: Could not scrape website`);
          return { company, index, isRelated: null };
        }

        // Use extractTextForAnalysis to get properly formatted content
        const websiteContent = scraperService.extractTextForAnalysis(scraped);

        // Step 2: Check if related to topic using AI
        const isRelated = await this.checkCompanyTopicRelation(fullUrl, websiteContent, topic);

        if (isRelated) {
          console.log(`[${index + 1}/${companies.length}] ✅ ${companyName}: Matches topic!`);
        } else {
          console.log(`[${index + 1}/${companies.length}] ❌ ${companyName}: Does not match topic`);
        }

        return { company, index, isRelated };

      } catch (error) {
        console.log(`[${index + 1}/${companies.length}] ❌ ${companyName}: Error - ${error.message}`);
        return { company, index, isRelated: null };
      }
    };

    // Process in batches to control concurrency
    const results = [];
    for (let i = 0; i < companies.length; i += maxConcurrent) {
      const batch = companies.slice(i, i + maxConcurrent);
      const batchPromises = batch.map((company, batchIndex) => 
        processCompany(company, i + batchIndex)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Sort by original index and filter matched companies
    const filteredCompanies = results
      .sort((a, b) => a.index - b.index)
      .filter(r => r.isRelated === true)
      .map(r => r.company);

    console.log(`\n✅ Filtered to ${filteredCompanies.length} companies matching topic '${topic}'\n`);
    return filteredCompanies;
  }

  /**
   * Check if company website is related to topic
   * Migrated from vcp_sales_agent check_company_related_to_topic()
   * 
   * @param {string} websiteUrl - Company website URL
   * @param {string} websiteContent - Scraped content
   * @param {string} topic - Topic to check against
   * @returns {Promise<boolean>} True if related, false otherwise
   */
  async checkCompanyTopicRelation(websiteUrl, websiteContent, topic) {
    if (!websiteContent || !websiteContent.trim()) {
      console.log(`No website content to analyze for ${websiteUrl}`);
      return false;
    }

    // Truncate content if too long
    const maxLength = 3000;
    let content = websiteContent;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...';
    }

    const systemPrompt = `You are an AI company analyst. Your task is to determine if a company's website indicates that the company is related to a specific topic/industry.

Analyze the website content and determine if the company operates in or is related to the topic: "${topic}".

Consider:
- Company description and services
- Industry keywords and terminology
- Products or services offered
- Company focus and expertise

Respond with ONLY "YES" if the company is clearly related to the topic, or "NO" if it is not related.

Be strict - only return YES if there is clear evidence the company is related.`;

    const userPrompt = `Website URL: ${websiteUrl}
Topic: ${topic}

Website Content:
${content}

Is this company related to "${topic}"? Answer YES or NO only.`;

    try {
      const response = await this.callAIFlexible(userPrompt, systemPrompt, 0.0);
      const answer = response.trim().toUpperCase();

      return answer.includes('YES');

    } catch (error) {
      console.error(`Error checking company topic relation: ${error.message}`);
      return false; // Default to false on error (safer to filter out)
    }
  }

  /**
   * Call AI with flexible parameters (OpenAI/Anthropic compatible)
   * @param {string} prompt - User prompt
   * @param {string} systemPrompt - System prompt (optional)
   * @param {number} temperature - Temperature setting (default: 0.5)
   * @returns {Promise<string>} AI response
   */
  async callAIFlexible(prompt, systemPrompt = '', temperature = 0.5) {
    if (this.provider === 'openai') {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          messages,
          temperature,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } else if (this.provider === 'anthropic') {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: this.model || 'claude-3-haiku-20240307',
          max_tokens: 2000,
          temperature,
          messages: [{ role: 'user', content: prompt }],
          ...(systemPrompt && { system: systemPrompt })
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.content[0].text;
    }

    throw new Error('Unsupported AI provider');
  }

  /**
   * Parse sales intelligence response into structured format
   * @param {string} response - AI response text
   * @param {Object} company - Company data
   * @returns {Object} Parsed sales intelligence
   */
  parseSalesIntelligence(response, company) {
    // Extract relevance score if present
    const scoreMatch = response.match(/score[:\s]+(\d+)/i);
    const relevanceScore = scoreMatch ? parseInt(scoreMatch[1]) : 5;

    // Extract key sections
    const sections = {
      companyOverview: this.extractSection(response, 'Company Overview'),
      relevanceToTarget: this.extractSection(response, 'Relevance to Target'),
      businessSignals: this.extractSection(response, 'Key Business Signals'),
      painPoints: this.extractSection(response, 'Pain Points & Opportunities'),
      recommendedApproach: this.extractSection(response, 'Recommended Approach')
    };

    return {
      summary: response,
      relevanceScore,
      companyName: company.name,
      companyDomain: company.domain,
      ...sections,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Extract a specific section from markdown text
   * @param {string} text - Full markdown text
   * @param {string} sectionTitle - Section title to extract
   * @returns {string} Section content
   */
  extractSection(text, sectionTitle) {
    const regex = new RegExp(`#+\\s*${sectionTitle}[:\s]*\\n([\\s\\S]*?)(?=\\n#+|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }
}

module.exports = CompanyAnalysisService;
