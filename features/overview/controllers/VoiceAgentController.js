const { VoiceCallRepository } = require('../repositories');
const CallLoggingService = require('../services/CallLoggingService');

const logger = require('../../../core/utils/logger');
const { getSchema } = require('../../../core/utils/schemaHelper');

class VoiceAgentController {
  constructor(db) {
    this.callLoggingService = new CallLoggingService(db);
    this.voiceCallRepository = new VoiceCallRepository(db);
  }

    /**
   * GET /user/available-agents
   * Get available agents for the authenticated user
   * JWT Auth Required
   */
  async getUserAvailableAgents(req, res) {
    try {
      const userId = req.user.id; // From JWT middleware
      const tenantId = req.user.tenantId; // From JWT middleware
      const schema = getSchema(req);

      logger.info(`Fetching available agents for tenant: ${tenantId}, schema: ${schema}, userId: ${userId}`);

      const agents = await this.voiceCallRepository.getAvailableAgentsForUser(schema, userId, tenantId);

      res.json({
        success: true,
        data: agents,
        count: agents.length
      });
    } catch (error) {
      logger.error('Get user available agents error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch available agents',
        message: error.message
      });
    }
  }

  /**
   * GET /calls
   * Get call logs with optional filters (status, agentId, startDate/from_date, endDate/to_date, userId)
   * JWT Auth Required
   */
  async getCallLogs(req, res) {
    try {
      const tenantId = req.user.tenantId; // From JWT middleware
      const schema = getSchema(req);

      // Extract filters from query parameters (support both startDate/endDate and from_date/to_date)
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.agentId) filters.agentId = req.query.agentId;
      if (req.query.startDate) filters.startDate = req.query.startDate;
      if (req.query.from_date) filters.startDate = req.query.from_date;
      if (req.query.endDate) filters.endDate = req.query.endDate;
      if (req.query.to_date) filters.endDate = req.query.to_date;
      if (req.query.userId) filters.userId = req.query.userId;

      // No limit when date range is provided, otherwise default to 50
      const limit = (filters.startDate && filters.endDate) ? 999999 : (req.query.limit ? parseInt(req.query.limit) : 50);

      logger.info(`Fetching call logs for tenant: ${tenantId}, schema: ${schema}, filters:`, filters, `limit: ${limit}`);

      const callLogs = await this.callLoggingService.getCallLogs(tenantId, filters, limit);

      res.json({
        success: true,
        data: callLogs,
        count: callLogs.length
      });
    } catch (error) {
      logger.error('Get call logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch call logs',
        message: error.message
      });
    }
  }

}

module.exports = VoiceAgentController;