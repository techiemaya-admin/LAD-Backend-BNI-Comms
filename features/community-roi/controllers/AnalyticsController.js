/**
 * Analytics Controller
 * Request Handler Layer - Orchestrate analytics requests
 * 
 * LAD Architecture: Controller Layer
 * - Handles requests and responses
 * - Validates input
 * - Calls services (no direct SQL)
 * - Returns formatted responses
 */

const AnalyticsService = require('../services/AnalyticsService');
const logger = require('../../../core/utils/logger');

class AnalyticsController {
  /**
   * GET /api/community-roi/analytics/dashboard
   * Get dashboard KPIs
   */
  async getDashboardKPIs(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.user?.tenant_id || req.user?.organizationId;

      if (!tenantId) {
        logger.warn('[AnalyticsController] Tenant ID missing from auth context');
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      logger.debug('[AnalyticsController] Fetching dashboard KPIs', { tenantId });

      const kpis = await AnalyticsService.getDashboardKPIs(tenantId);

      return res.json({
        success: true,
        data: kpis,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[AnalyticsController] Error fetching dashboard KPIs', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch KPIs',
        details: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/analytics/engagement
   * Get member engagement report
   */
  async getMemberEngagement(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.user?.tenant_id || req.user?.organizationId;

      if (!tenantId) {
        logger.warn('[AnalyticsController] Tenant ID missing');
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      logger.debug('[AnalyticsController] Fetching member engagement report', { tenantId });

      const report = await AnalyticsService.getMemberEngagementReport(tenantId);

      return res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[AnalyticsController] Error fetching engagement report', {
        error: error.message
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch engagement report',
        details: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/analytics/top-connectors
   * Get top network connectors
   */
  async getTopConnectors(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.user?.tenant_id || req.user?.organizationId;
      const limit = Math.min(parseInt(req.query.limit || 10), 100);

      if (!tenantId) {
        logger.warn('[AnalyticsController] Tenant ID missing');
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      logger.debug('[AnalyticsController] Fetching top connectors', { tenantId, limit });

      const data = await AnalyticsService.getTopConnectors(tenantId, limit);

      return res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[AnalyticsController] Error fetching top connectors', {
        error: error.message
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch top connectors',
        details: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/analytics/top-referrers
   * Get top referrers
   */
  async getTopReferrers(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.user?.tenant_id || req.user?.organizationId;
      const limit = Math.min(parseInt(req.query.limit || 10), 100);

      if (!tenantId) {
        logger.warn('[AnalyticsController] Tenant ID missing');
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      logger.debug('[AnalyticsController] Fetching top referrers', { tenantId, limit });

      const data = await AnalyticsService.getTopReferrers(tenantId, limit);

      return res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[AnalyticsController] Error fetching top referrers', {
        error: error.message
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch top referrers',
        details: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/analytics/health
   * Get network health score
   */
  async getNetworkHealth(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.user?.tenant_id || req.user?.organizationId;

      logger.debug('[AnalyticsController] getNetworkHealth called', {
        hasUser: !!req.user,
        userKeys: req.user ? Object.keys(req.user) : []
      });

      if (!tenantId) {
        logger.warn('[AnalyticsController] Tenant ID missing from auth context', {
          user: req.user ? {
            id: req.user.id || req.user.userId,
            email: req.user.email,
            keys: Object.keys(req.user)
          } : null
        });
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      logger.debug('[AnalyticsController] Fetching network health score', { tenantId });

      const data = await AnalyticsService.getNetworkHealthScore(tenantId);

      return res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[AnalyticsController] Error fetching network health', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch network health',
        details: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/contribution-stats
   * Get contribution report statistics (unique meetings, referrals, impact)
   */
  async getContributionStats(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.user?.tenant_id || req.user?.organizationId;

      if (!tenantId) {
        logger.warn('[AnalyticsController] Tenant ID missing from auth context');
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      logger.debug('[AnalyticsController] Fetching contribution statistics', { tenantId });

      const stats = await AnalyticsService.getContributionStats(tenantId);

      return res.json({
        success: true,
        data: stats.data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[AnalyticsController] Error fetching contribution statistics', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch contribution statistics',
        details: error.message
      });
    }
  }
}

module.exports = new AnalyticsController();
