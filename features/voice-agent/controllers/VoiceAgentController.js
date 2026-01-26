const { CallLoggingService } = require('../services');

class VoiceAgentController {
  constructor(db) {
    this.db = db;
    this.callLoggingService = new CallLoggingService(db);
  }

  /**
   * GET /user/available-agents
   * Get available agents for the authenticated user
   */
  async getUserAvailableAgents(req, res) {
    try {
      const { tenant_id, id: userId } = req.user;
      const schema = req.schema || req.user.schema;

      // Get agents from repository
      const { VoiceCallRepository } = require('../repositories');
      const voiceCallRepository = new VoiceCallRepository(this.db);
      
      const agents = await voiceCallRepository.getAvailableAgentsForUser(
        schema,
        userId,
        tenant_id
      );

      res.json({ agents });
    } catch (error) {
      console.error('Error fetching available agents:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * GET /calls
   * Get call logs with optional filters
   */
  async getCallLogs(req, res) {
    try {
      const { tenant_id } = req.user;
      const { startDate, endDate, status, agentId, userId } = req.query;
      const limit = parseInt(req.query.limit) || 50;

      const filters = {
        status,
        agentId,
        userId,
        startDate,
        endDate
      };

      const calls = await this.callLoggingService.getCallLogs(
        tenant_id,
        filters,
        limit
      );

      res.json({ calls });
    } catch (error) {
      console.error('Error fetching call logs:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = VoiceAgentController;
