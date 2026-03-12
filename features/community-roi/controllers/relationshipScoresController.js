const relationshipScoresService = require('../services/relationshipScoresService');
const logger = require('../../../core/utils/logger');

/**
 * Relationship Scores Controller
 * Handles HTTP requests for relationship score calculations and heatmap data
 * 
 * LAD Architecture: Controller Layer
 * - Handles HTTP requests/responses
 * - Validates input
 * - Calls service layer
 * - Returns formatted responses
 */
class RelationshipScoresController {
  /**
   * POST /api/community-roi/relationship-scores/update
   * Update relationship scores for tenant
   */
  async updateScores(req, res) {
    try {
      const tenantId = req.user.tenantId || req.user.tenant_id;
      
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required'
        });
      }
      
      logger.info(`[RelationshipScoresController] Update scores request`, { tenantId });
      
      const result = await relationshipScoresService.updateRelationshipScores(tenantId);
      
      return res.status(200).json(result);
      
    } catch (error) {
      logger.error(`[RelationshipScoresController] Error updating scores`, {
        error: error.message
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to update relationship scores',
        error: error.message
      });
    }
  }
  
  /**
   * GET /api/community-roi/relationship-scores/heatmap
   * Get heatmap data for visualization
   */
  async getHeatmap(req, res) {
    try {
      const tenantId = req.user.tenantId || req.user.tenant_id;
      
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required'
        });
      }
      
      logger.info(`[RelationshipScoresController] Get heatmap request`, { tenantId });
      
      const result = await relationshipScoresService.getRelationshipHeatmap(tenantId);
      
      return res.status(200).json(result);
      
    } catch (error) {
      logger.error(`[RelationshipScoresController] Error fetching heatmap`, {
        error: error.message
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch heatmap data',
        error: error.message
      });
    }
  }
}

module.exports = new RelationshipScoresController();
