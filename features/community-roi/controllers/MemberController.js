/**
 * Member Controller
 * Request handling and orchestration layer
 * 
 * LAD Architecture: Controller Layer
 * - Validates input (using validators)
 * - Calls services (no SQL)
 * - Formats and returns responses
 * - Handles HTTP concerns (status codes, headers)
 */

const { memberService, relationshipService } = require('../services');
const { memberValidator } = require('../validators');
const logger = require('../../../core/utils/logger');

class MemberController {
  /**
   * GET /api/community-roi/members
   * List all members for a tenant
   */
  async listMembers(req, res) {
    try {
      const tenantId = req.user.tenantId;

      logger.debug('[MemberController] List members request', { tenantId });

      const members = await memberService.getAllMembers(tenantId, req);

      return res.json({
        success: true,
        data: members,
        count: members.length
      });
    } catch (error) {
      logger.error('[MemberController] List members error', { error: error.message });
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/members/:memberId
   * Get a single member with full profile
   */
  async getMember(req, res) {
    try {
      const { memberId } = req.params;
      const tenantId = req.user.tenantId;

      logger.debug('[MemberController] Get member request', { tenantId, memberId });

      const member = await memberService.getMemberProfile(tenantId, memberId, req);

      return res.json({
        success: true,
        data: member
      });
    } catch (error) {
      logger.error('[MemberController] Get member error', { 
        error: error.message,
        memberId: req.params.memberId 
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
   * POST /api/community-roi/members
   * Create a new member
   */
  async createMember(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const data = req.body;

      logger.info('[MemberController] Create member request', { tenantId, name: data.name });

      // Validate input
      const validation = memberValidator.validateCreateMember(data);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const member = await memberService.createMember(tenantId, data, req);

      return res.status(201).json({
        success: true,
        data: member,
        message: `Member "${member.name}" created successfully`
      });
    } catch (error) {
      logger.error('[MemberController] Create member error', { error: error.message });

      if (error.message.includes('already exists')) {
        return res.status(409).json({
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
   * PUT /api/community-roi/members/:memberId
   * Update a member
   */
  async updateMember(req, res) {
    try {
      const { memberId } = req.params;
      const tenantId = req.user.tenantId;
      const data = req.body;

      logger.info('[MemberController] Update member request', { tenantId, memberId });

      // Validate input
      const validation = memberValidator.validateUpdateMember(data);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const member = await memberService.updateMember(tenantId, memberId, data);

      return res.json({
        success: true,
        data: member,
        message: 'Member updated successfully'
      });
    } catch (error) {
      logger.error('[MemberController] Update member error', { error: error.message });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('already exists')) {
        return res.status(409).json({
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
   * DELETE /api/community-roi/members/:memberId
   * Delete a member (soft delete)
   */
  async deleteMember(req, res) {
    try {
      const { memberId } = req.params;
      const tenantId = req.user.tenantId;

      logger.info('[MemberController] Delete member request', { tenantId, memberId });

      const success = await memberService.deleteMember(tenantId, memberId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: `Member ${memberId} not found`
        });
      }

      return res.json({
        success: true,
        message: 'Member deleted successfully'
      });
    } catch (error) {
      logger.error('[MemberController] Delete member error', { error: error.message });
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/members/search
   * Search members by name
   */
  async searchMembers(req, res) {
    try {
      const { q } = req.query;
      const tenantId = req.user.tenantId;

      if (!q || q.trim().length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'Please provide a search query'
        });
      }

      logger.debug('[MemberController] Search members request', { tenantId, query: q });

      const members = await memberService.searchMembers(tenantId, q);

      return res.json({
        success: true,
        data: members,
        count: members.length
      });
    } catch (error) {
      logger.error('[MemberController] Search members error', { error: error.message });
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/community-roi/members/:memberId/engagement-score
   * Get engagement score for a member
   */
  async getEngagementScore(req, res) {
    try {
      const { memberId } = req.params;
      const tenantId = req.user.tenantId;

      logger.debug('[MemberController] Get engagement score request', { tenantId, memberId });

      const score = await memberService.calculateEngagementScore(tenantId, memberId);

      return res.json({
        success: true,
        data: {
          member_id: memberId,
          engagement_score: score,
          scale: '0-100'
        }
      });
    } catch (error) {
      logger.error('[MemberController] Get engagement score error', { error: error.message });

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
   * GET /api/community-roi/members/:memberId/recommendations
   * Get recommended connections for a member
   */
  async getRecommendations(req, res) {
    try {
      const { memberId } = req.params;
      const { limit = 10 } = req.query;
      const tenantId = req.user.tenantId;

      logger.debug('[MemberController] Get recommendations request', { tenantId, memberId });

      const recommendations = await relationshipService.getRecommendations(
        tenantId,
        memberId,
        parseInt(limit)
      );

      return res.json({
        success: true,
        data: recommendations,
        count: recommendations.length
      });
    } catch (error) {
      logger.error('[MemberController] Get recommendations error', { error: error.message });

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
}

module.exports = new MemberController();
