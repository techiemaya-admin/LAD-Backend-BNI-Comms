const axios = require('axios');
const cheerio = require('cheerio');

class WebsiteScraperService {
  constructor() {
    this.timeout = 10000; // 10 seconds
    this.maxContentLength = 50000; // 50KB max
  }

  /**
   * Scrape website content for analysis
   * @param {string} url - Website URL
   * @returns {Promise<Object>} Extracted content
   */
  async scrapeWebsite(url) {
    if (!url || !url.startsWith('http')) {
      console.log(`Invalid URL: ${url}`);
      return null;
    }

    try {
      console.log(`Scraping website: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: this.timeout,
        maxContentLength: this.maxContentLength,
        validateStatus: (status) => status < 400
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Remove script, style, and other non-content tags
      $('script, style, noscript, iframe, nav, footer, header').remove();

      // Extract metadata
      const title = $('title').text().trim() || 
                   $('meta[property="og:title"]').attr('content') || 
                   $('h1').first().text().trim() || 
                   '';

      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || 
                         '';

      // Extract main content
      const bodyText = $('body').text()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // Limit to first 5000 chars

      // Extract headings
      const headings = [];
      $('h1, h2, h3').each((i, el) => {
        const text = $(el).text().trim();
        if (text && headings.length < 10) {
          headings.push(text);
        }
      });

      return {
        url,
        title,
        description,
        headings: headings.join(' | '),
        content: bodyText,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Error scraping ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Scrape multiple websites in parallel
   * @param {Array<string>} urls - Array of URLs
   * @param {number} concurrency - Max concurrent requests
   * @returns {Promise<Array>} Array of scraped content
   */
  async scrapeMultiple(urls, concurrency = 5) {
    const results = [];
    
    // Process in batches
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(url => this.scrapeWebsite(url))
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else {
          console.log(`Failed to scrape: ${batch[index]}`);
        }
      });
      
      // Small delay between batches to be respectful
      if (i + concurrency < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Extract clean text summary for AI analysis
   * @param {Object} scrapedData - Data from scrapeWebsite
   * @returns {string} Clean text summary
   */
  extractTextForAnalysis(scrapedData) {
    if (!scrapedData) return '';

    const parts = [
      `Title: ${scrapedData.title}`,
      `Description: ${scrapedData.description}`,
      `Key Sections: ${scrapedData.headings}`,
      `Content: ${scrapedData.content.substring(0, 2000)}`
    ];

    return parts.filter(p => p.length > 10).join('\n\n');
  }
}

module.exports = WebsiteScraperService;
