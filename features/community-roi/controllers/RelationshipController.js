/**
 * Relationship Controller
 * Request handling for relationship and interaction endpoints
 */

const { relationshipService, interactionService } = require('../services');
const { interactionValidator } = require('../validators');
const logger = require('../../../core/utils/logger');

class RelationshipController {
  /**
   * GET /api/community-roi/relationships/:memberId1/:memberId2
   * Get relationship score between two members
   */
  async getRelationshipScore(req, res) {
    try {
      const { memberId1, memberId2 } = req.params;
      const tenantId = req.user.tenantId || req.user.tenant_id;

      logger.debug('[RelationshipController] Get relationship score request', { 
        tenantId, memberId1, memberId2 
      });

      const score = await relationshipService.getRelationshipScore(
        tenantId,
        memberId1,
        memberId2
      );

      return res.json({
        success: true,
        data: score
      });
    } catch (error) {
      logger.error('[RelationshipController] Get relationship score error', { 
        error: error.message 
      });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/members/:memberId/relationships
   * Get all relationships for a member
   */
  async getMemberRelationships(req, res) {
    try {
      const { memberId } = req.params;
      const { minScore, maxResults } = req.query;
      const tenantId = req.user.tenantId || req.user.tenant_id;

      logger.debug('[RelationshipController] Get member relationships request', { 
        tenantId, memberId 
      });

      const relationships = await relationshipService.getMemberRelationships(
        tenantId,
        memberId,
        {
          minScore: minScore ? parseFloat(minScore) : undefined,
          maxResults: maxResults ? parseInt(maxResults) : undefined
        }
      );

      return res.json({
        success: true,
        data: relationships,
        count: relationships.length
      });
    } catch (error) {
      logger.error('[RelationshipController] Get member relationships error', { 
        error: error.message 
      });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/relationships/top
   * Get top relationships in the network
   */
  async getTopRelationships(req, res) {
    try {
      const { limit = 20 } = req.query;
      const tenantId = req.user.tenantId || req.user.tenant_id;

      logger.debug('[RelationshipController] Get top relationships request', { tenantId });

      const relationships = await relationshipService.getTopRelationships(
        tenantId,
        parseInt(limit)
      );

      return res.json({
        success: true,
        data: relationships,
        count: relationships.length
      });
    } catch (error) {
      logger.error('[RelationshipController] Get top relationships error', { 
        error: error.message 
      });

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/community-roi/interactions/meetings
   * Log a meeting between two members
   */
  async logMeeting(req, res) {
    try {
      const tenantId = req.user.tenantId || req.user.tenant_id;
      const data = req.body;

      logger.info('[RelationshipController] Log meeting request', { 
        tenantId,
        member1: data.member_a_id,
        member2: data.member_b_id
      });

      // Validate input
      const validation = interactionValidator.validateMeeting(data);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const interaction = await interactionService.logMeeting(tenantId, data);

      return res.status(201).json({
        success: true,
        data: interaction,
        message: 'Meeting logged successfully'
      });
    } catch (error) {
      logger.error('[RelationshipController] Log meeting error', { error: error.message });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('Cannot log interaction')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/community-roi/interactions/referrals
   * Log a referral
   */
  async logReferral(req, res) {
    try {
      const tenantId = req.user.tenantId || req.user.tenant_id;
      const data = req.body;

      logger.info('[RelationshipController] Log referral request', { 
        tenantId,
        referredBy: data.referred_by_id,
        referredTo: data.referred_to_id
      });

      // Validate input
      const validation = interactionValidator.validateReferral(data);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const referral = await interactionService.logReferral(tenantId, data);

      return res.status(201).json({
        success: true,
        data: referral,
        message: 'Referral logged successfully'
      });
    } catch (error) {
      logger.error('[RelationshipController] Log referral error', { error: error.message });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('Cannot refer')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/interactions/:memberId1/:memberId2
   * Get interaction history between two members
   */
  async getInteractionHistory(req, res) {
    try {
      const { memberId1, memberId2 } = req.params;
      const tenantId = req.user.tenantId || req.user.tenant_id;

      logger.debug('[RelationshipController] Get interaction history request', { 
        tenantId, memberId1, memberId2 
      });

      const history = await interactionService.getInteractionHistory(
        tenantId,
        memberId1,
        memberId2
      );

      return res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('[RelationshipController] Get interaction history error', { 
        error: error.message 
      });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/contributions/top
   * Get top contributors in the network
   */
  async getTopContributors(req, res) {
    try {
      const { limit = 20 } = req.query;
      const tenantId = req.user.tenantId || req.user.tenant_id;

      logger.debug('[RelationshipController] Get top contributors request', { tenantId });

      const contributors = await relationshipService.getTopContributors(
        tenantId,
        parseInt(limit)
      );

      return res.json({
        success: true,
        data: contributors,
        count: contributors.length
      });
    } catch (error) {
      logger.error('[RelationshipController] Get top contributors error', { 
        error: error.message 
      });

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/contributions/leaderboards
   * Get dashboard leaderboards
   */
  async getDashboardLeaderboards(req, res) {
    try {
      const tenantId = req.user.tenantId || req.user.tenant_id;

      const leaderboards = await relationshipService.getDashboardLeaderboards(tenantId);

      return res.json({
        success: true,
        data: leaderboards
      });
    } catch (error) {
      logger.error('[RelationshipController] Get leaderboards error', { 
        error: error.message 
      });

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/contributions/:memberId
   * Get contributions for a specific member

   */
  async getMemberContributions(req, res) {
    try {
      const { memberId } = req.params;
      const tenantId = req.user.tenantId || req.user.tenant_id;

      logger.debug('[RelationshipController] Get member contributions request', { tenantId, memberId });

      const contributions = await relationshipService.getMemberContributions(
        tenantId,
        memberId
      );

      return res.json({
        success: true,
        data: contributions
      });
    } catch (error) {
      logger.error('[RelationshipController] Get member contributions error', { 
        error: error.message 
      });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/referrals/member/:memberId
   * Get all referrals for a member
   */
  async getMemberReferrals(req, res) {
    try {
      const { memberId } = req.params;
      const tenantId = req.user.tenantId || req.user.tenant_id;

      logger.debug('[RelationshipController] Get member referrals request', { tenantId, memberId });

      const referrals = await interactionService.getMemberReferrals(
        tenantId,
        memberId
      );

      return res.json({
        success: true,
        data: referrals
      });
    } catch (error) {
      logger.error('[RelationshipController] Get member referrals error', { 
        error: error.message 
      });

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/members/:memberId/activity-history
   * Get activity history for a member (for charts)
   */
  async getMemberActivityHistory(req, res) {
    try {
      const { memberId } = req.params;
      const tenantId = req.user.tenantId || req.user.tenant_id;

      const history = await interactionService.getMemberActivityHistory(tenantId, memberId);
      return res.json({ success: true, data: history });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/community-roi/members/:memberId/recent-activity
   * Get recent activity feed for a member
   */
  async getRecentActivity(req, res) {
    try {
      const { memberId } = req.params;
      const { limit } = req.query;
      const tenantId = req.user?.tenantId || req.user?.tenant_id;

      if (!tenantId) {
        logger.warn('[RelationshipController] Tenant ID missing for recent activity request');
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      if (!memberId) {
        return res.status(400).json({ success: false, error: 'Member ID is required' });
      }

      logger.debug('[RelationshipController] Fetching recent activity', { tenantId, memberId, limit });

      const activity = await interactionService.getRecentActivity(tenantId, memberId, parseInt(limit || 10));
      
      return res.json({ 
        success: true, 
        data: activity,
        count: activity.length 
      });
    } catch (error) {
      logger.error('[RelationshipController] Error fetching recent activity', {
        error: error.message,
        stack: error.stack,
        memberId: req.params.memberId
      });
      
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch recent activity',
        details: error.message 
      });
    }
  }

  /**
   * GET /api/community-roi/network/stats
   * Get overall network statistics
   */
  async getNetworkStats(req, res) {
    try {
      const tenantId = req.user.tenantId || req.user.tenant_id;

      logger.debug('[RelationshipController] Get network stats request', { tenantId });

      const stats = await interactionService.getNetworkStats(tenantId);

      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('[RelationshipController] Get network stats error', { 
        error: error.message 
      });

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new RelationshipController();
