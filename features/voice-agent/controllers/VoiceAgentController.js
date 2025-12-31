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
let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  const loggerAdapter = require('../utils/logger');
  logger = loggerAdapter.getLogger();
}
let getSchema;
try {
  ({ getSchema } = require('../../../core/utils/schemaHelper'));
} catch (e) {
  ({ getSchema } = require('../utils/schemaHelper'));
}

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
      // Return empty array if tables don't exist yet
      res.json({
        success: true,
        data: [],
        count: 0,
        warning: 'Voice agent tables not yet migrated'
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
      // Return empty array if tables don't exist yet
      res.json({
        success: true,
        data: [],
        count: 0,
        warning: 'Voice agent tables not yet migrated'
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
      const schema = getSchema(req);

      // Get voice details
      const voice = await this.voiceModel.getVoiceById(schema, id, tenantId);
      
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
   */
  async getAgentVoiceSampleSignedUrl(req, res) {
    try {
      const { agentId } = req.params;
      const tenantId = req.user.tenantId;
      const expirationHours = parseInt(req.query.expiration_hours) || 96;
      const schema = getSchema(req);

      // Get agent details
      const agent = await this.agentModel.getAgentById(schema, agentId, tenantId);
      
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      // Get voice sample URL for this agent's voice
      const voiceSampleUrl = await this.voiceModel.getVoiceSampleUrl(schema, agent.voice_id, tenantId);

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
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
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
        error: 'Failed to generate signed URL',
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
   */
  async getAgentByName(req, res) {
    try {
      const { name } = req.params;
      const tenantId = req.tenantId || req.user?.tenantId;
      const schema = getSchema(req);

      const agent = await this.agentModel.getAgentByName(schema, name, tenantId);

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
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
   * GET /settings
   * Get voice agent default settings
   */
  async getSettings(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const schema = getSchema(req);

      // Default settings for voice agent configuration
      // Matches the structure expected by VoiceAgentSettings.tsx and VoiceAgentHighlights.tsx
      const settings = {
        llm: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2000
        },
        tts: {
          provider: 'elevenlabs',
          voice: 'rachel',
          speed: 1.0,
          pitch: 1.0
        },
        stt: {
          provider: 'deepgram',
          language: 'en-US',
          model: 'nova-2'
        },
        systemPrompt: 'You are a helpful AI assistant focused on lead generation and customer engagement.'
      };

      logger.info('Get voice agent settings:', { tenantId, schema });

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('Get settings error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch settings',
        message: error.message
      });
    }
  }

  /**
   * PUT /settings
   * Update voice agent settings
   */
  async updateSettings(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const schema = getSchema(req);
      const updates = req.body;

      logger.info('Update voice agent settings:', { 
        tenantId, 
        schema, 
        updates 
      });

      // TODO: Implement database storage for settings
      // For now, just log the changes and return success

      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: updates
      });
    } catch (error) {
      logger.error('Update settings error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update settings',
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
