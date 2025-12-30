/**
 * Voice Agent Controller
 * 1.0
 * Handles voice agent, voice profile, and phone number management
 * Includes user-specific endpoints for available resources
 */

const { 
  VoiceAgentModel, 
  VoiceModel, 
  PhoneNumberModel 
} = require('../models');
const { RecordingService } = require('../services');
const { getSchema } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');

class VoiceAgentController {
  constructor(db) {
    this.agentModel = new VoiceAgentModel(db);
    this.voiceModel = new VoiceModel(db);
    this.phoneModel = new PhoneNumberModel(db);
    this.recordingService = new RecordingService();
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

      const agents = await this.agentModel.getAvailableAgentsForUser(schema, userId, tenantId);

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
   * GET /user/available-numbers
   * Get available phone numbers for the authenticated user
   * JWT Auth Required
   */
  async getUserAvailableNumbers(req, res) {
    try {
      const userId = req.user.id;
      const tenantId = req.user.tenantId;
      const schema = getSchema(req);

      const numbers = await this.phoneModel.getAvailableNumbersForUser(schema, userId, tenantId);

      res.json({
        success: true,
        data: numbers,
        count: numbers.length
      });
    } catch (error) {
      logger.error('Get user available numbers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch available numbers',
        message: error.message
      });
    }
  }

  /**
   * GET /voices/:id/sample-signed-url
   * Get signed URL for voice sample
   * JWT Auth Required
   */
  async getVoiceSampleSignedUrl(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;
      const expirationHours = parseInt(req.query.expiration_hours) || 96;

      // Get voice details
      const voice = await this.voiceModel.getVoiceById(id, tenantId);
      
      if (!voice) {
        return res.status(404).json({
          success: false,
          error: 'Voice not found'
        });
      }

      // Get signed URL for voice sample
      const result = await this.recordingService.getVoiceSampleSignedUrl(
        voice.voice_sample_url,
        expirationHours
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          voice_id: id,
          voice_name: voice.voice_name,
          signed_url: result.signedUrl,
          expires_at: result.expiresAt,
          expiration_hours: expirationHours
        }
      });
    } catch (error) {
      logger.error('Get voice sample signed URL error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate signed URL',
        message: error.message
      });
    }
  }

  /**
   * GET /agents/:agentId/sample-signed-url
   * Get signed URL for agent's voice sample
   * JWT Auth Required
   * 
   * Optimized: Uses getAvailableAgentsForUser which already includes voice_sample_url
   * to avoid multiple database queries
   */
  async getAgentVoiceSampleSignedUrl(req, res) {
    try {
      const { agentId } = req.params;
      const tenantId = req.user.tenantId;
      const schema = getSchema(req);
      const userId = req.user.id;
      const expirationHours = parseInt(req.query.expiration_hours) || 96;

      // Optimize: Use getAvailableAgentsForUser which already includes voice_sample_url
      // This avoids multiple database queries (getAgentById + getVoiceSampleUrl)
      const agents = await this.agentModel.getAvailableAgentsForUser(schema, userId, tenantId);
      const agent = agents.find(a => String(a.agent_id) === String(agentId));
      
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      // Use voice_sample_url directly from agent (already loaded from view)
      const voiceSampleUrl = agent.voice_sample_url;

      if (!voiceSampleUrl) {
        return res.status(404).json({
          success: false,
          error: 'Voice sample not found for this agent'
        });
      }

      // Get signed URL
      const result = await this.recordingService.getAgentVoiceSampleSignedUrl(
        agent.voice_id,
        voiceSampleUrl,
        expirationHours
      );

      if (!result.success) {
        logger.error('Failed to generate signed URL for agent voice sample', {
          agentId,
          voiceId: agent.voice_id,
          voiceSampleUrl,
          error: result.error
        });
        
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to generate signed URL',
          message: result.error
        });
      }

      // LAD Standard: Return snake_case for API/HTTP response
      // Frontend expects signed_url at top level
      // Add cache headers for signed URLs (valid for 96 hours, cache for 1 hour)
      res.set({
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Expires': new Date(Date.now() + 3600000).toUTCString()
      });
      
      res.json({
        success: true,
        signed_url: result.signedUrl,  // Top-level for frontend compatibility
        data: {
          agent_id: agentId,
          agent_name: agent.agent_name,
          voice_id: agent.voice_id,
          signed_url: result.signedUrl,
          expires_at: result.expiresAt,
          expiration_hours: expirationHours
        }
      });
    } catch (error) {
      logger.error('Get agent voice sample signed URL error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get voice sample signed URL',
        message: error.message
      });
    }
  }

  /**
   * GET /all
   * Get all agents for tenant
   */
  async getAllAgents(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const schema = getSchema(req);

      logger.info('[/api/voiceagent/all] request context:', {
        user: req.user,
        tenantId,
        schema,
        headersTenantId: req.headers['x-tenant-id'],
        queryTenantId: req.query.tenant_id,
      });

      const agents = await this.agentModel.getAllAgents(schema, tenantId);

      res.json({
        success: true,
        data: agents,
        count: agents.length
      });
    } catch (error) {
      logger.error('Get all agents error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch agents',
        message: error.message
      });
    }
  }

  /**
   * GET /agent/:name
   * Get agent by name
      }

      res.json({
        success: true,
        data: agent
      });
    } catch (error) {
      logger.error('Get agent by name error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch agent',
        message: error.message
      });
    }
  }

  /**
   * GET / or GET /voices
   * Get all voices for tenant
   */
  async getAllVoices(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const schema = getSchema(req);

      const voices = await this.voiceModel.getAllVoices(schema, tenantId);

      res.json({
        success: true,
        data: voices,
        count: voices.length
      });
    } catch (error) {
      logger.error('Get all voices error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch voices',
        message: error.message
      });
    }
  }

  /**
   * GET /numbers
   * Get all phone numbers for tenant
   */
  async getAllPhoneNumbers(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const schema = getSchema(req);

      const numbers = await this.phoneModel.getAllPhoneNumbers(schema, tenantId);

      res.json({
        success: true,
        data: numbers,
        count: numbers.length
      });
    } catch (error) {
      logger.error('Get all phone numbers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch phone numbers',
        message: error.message
      });
    }
  }

  /**
   * GET /test
   * Test endpoint
   */
  async test(req, res) {
    res.json({
      success: true,
      message: 'Voice agent API is working',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }
}

module.exports = VoiceAgentController;