const ApolloLeadsService = require('../services/ApolloLeadsService');

class ApolloLeadsController {
  async searchCompanies(req, res) {
    try {
      const {
        keywords,
        industry,
        location,
        company_size,
        revenue_range,
        technology,
        limit = 50,
        page = 1
      } = req.query;

      const searchParams = {
        keywords: keywords ? keywords.split(',') : [],
        industry,
        location,
        company_size,
        revenue_range,
        technology,
        limit: parseInt(limit),
        page: parseInt(page)
      };

      const results = await ApolloLeadsService.searchCompanies(searchParams);
      
      res.json({
        success: true,
        data: results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: results.length
        }
      });
    } catch (error) {
      console.error('Apollo search error:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error.message
      });
    }
  }

  async bulkSearchCompanies(req, res) {
    try {
      const { searches } = req.body;
      
      if (!Array.isArray(searches)) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'searches must be an array'
        });
      }

      const results = await Promise.all(
        searches.map(search => ApolloLeadsService.searchCompanies(search))
      );

      res.json({
        success: true,
        data: results,
        total_searches: searches.length
      });
    } catch (error) {
      console.error('Apollo bulk search error:', error);
      res.status(500).json({
        error: 'Bulk search failed',
        message: error.message
      });
    }
  }

  async getCompanyDetails(req, res) {
    try {
      const { id } = req.params;
      const company = await ApolloLeadsService.getCompanyById(id);
      
      if (!company) {
        return res.status(404).json({
          error: 'Company not found',
          message: `Company with ID ${id} not found`
        });
      }

      res.json({
        success: true,
        data: company
      });
    } catch (error) {
      console.error('Get company details error:', error);
      res.status(500).json({
        error: 'Failed to get company details',
        message: error.message
      });
    }
  }

  async getCompanyLeads(req, res) {
    try {
      const { id } = req.params;
      const { limit = 25, page = 1, title_filter } = req.query;

      const leads = await ApolloLeadsService.getCompanyLeads(id, {
        limit: parseInt(limit),
        page: parseInt(page),
        title_filter
      });

      res.json({
        success: true,
        data: leads
      });
    } catch (error) {
      console.error('Get company leads error:', error);
      res.status(500).json({
        error: 'Failed to get company leads',
        message: error.message
      });
    }
  }

  async revealEmail(req, res) {
    try {
      const { id } = req.params;
      const email = await ApolloLeadsService.revealEmail(id);
      
      res.json({
        success: true,
        email,
        credits_used: 1
      });
    } catch (error) {
      console.error('Reveal email error:', error);
      res.status(500).json({
        error: 'Email reveal failed',
        message: error.message
      });
    }
  }

  async revealPhone(req, res) {
    try {
      const { id } = req.params;
      const phone = await ApolloLeadsService.revealPhone(id);
      
      res.json({
        success: true,
        phone,
        credits_used: 9
      });
    } catch (error) {
      console.error('Reveal phone error:', error);
      res.status(500).json({
        error: 'Phone reveal failed',
        message: error.message
      });
    }
  }

  async getSearchHistory(req, res) {
    try {
      const userId = req.user?.id || 'demo-user';
      const { limit = 50, page = 1 } = req.query;

      const history = await ApolloLeadsService.getSearchHistory(userId, {
        limit: parseInt(limit),
        page: parseInt(page)
      });

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Get search history error:', error);
      res.status(500).json({
        error: 'Failed to get search history',
        message: error.message
      });
    }
  }

  async deleteSearchHistory(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'demo-user';

      await ApolloLeadsService.deleteSearchHistory(id, userId);

      res.json({
        success: true,
        message: 'Search history deleted'
      });
    } catch (error) {
      console.error('Delete search history error:', error);
      res.status(500).json({
        error: 'Failed to delete search history',
        message: error.message
      });
    }
  }
}

module.exports = new ApolloLeadsController();