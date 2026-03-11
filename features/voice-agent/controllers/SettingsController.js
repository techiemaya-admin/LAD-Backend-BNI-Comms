const SettingsRepository = require('../repositories/settings.repository');
let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  logger = console;
}

class SettingsController {
  constructor(db) {
    this.settingsRepository = new SettingsRepository(db);
  }

  /**
   * Get all voice agents for a tenant
   */
  async getVoiceAgents(req, res) {
    try {
      // Support both tenant_id (snake_case) and tenantId (camelCase)
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      
      logger.debug('Request user object:', JSON.stringify(req.user, null, 2));
      logger.debug('Extracted tenant_id:', tenant_id);
      
      if (!tenant_id) {
        logger.error('No tenant_id found in JWT token');
        logger.error('Available user fields:', Object.keys(req.user || {}));
        return res.status(400).json({ error: 'Tenant ID not found in token' });
      }
      
      logger.debug('Fetching voice agents for tenant:', tenant_id);

      const agents = await this.settingsRepository.getAllVoiceAgents(tenant_id, req);
      
      logger.debug(`Found ${agents.length} voice agents for tenant: ${tenant_id}`);
      logger.debug('Agents data:', JSON.stringify(agents, null, 2));

      res.json({
        data: agents
      });
    } catch (error) {
      logger.error('Error getting voice agents:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get voice agent by ID
   */
  async getVoiceAgentById(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const { agentId } = req.params;

      const agent = await this.settingsRepository.getVoiceAgentById(
        agentId, 
        tenant_id
      );

      if (!agent) {
        return res.status(404).json({ error: 'Voice agent not found' });
      }

      res.json({ data: agent });
    } catch (error) {
      logger.error('Error getting voice agent:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create a new voice agent
   */
  async createVoiceAgent(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const agentData = req.body;

      // Normalize frontend field names to backend field names
      const normalizedData = {
        name: agentData.name || agentData.agent_name,
        gender: agentData.gender || agentData.voice_gender,
        language: agentData.language || agentData.agent_language,
        voice_id: agentData.voice_id,
        agent_instructions: agentData.agent_instructions,
        system_instructions: agentData.system_instructions,
        outbound_starter_prompt: agentData.outbound_starter_prompt,
        inbound_starter_prompt: agentData.inbound_starter_prompt
      };

      // Validate required fields
      const requiredFields = ['name', 'voice_id'];
      const missingFields = requiredFields.filter(field => !normalizedData[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        });
      }

      const agent = await this.settingsRepository.createVoiceAgent(
        tenant_id, 
        normalizedData
      );

      res.status(201).json({ data: agent });
    } catch (error) {
      logger.error('Error creating voice agent:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update voice agent
   */
  async updateVoiceAgent(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const { agentId } = req.params;
      const agentData = req.body;

      // Normalize frontend field names to backend field names
      const normalizedData = {
        name: agentData.name || agentData.agent_name,
        gender: agentData.gender || agentData.voice_gender,
        language: agentData.language || agentData.agent_language,
        voice_id: agentData.voice_id,
        agent_instructions: agentData.agent_instructions,
        system_instructions: agentData.system_instructions,
        outbound_starter_prompt: agentData.outbound_starter_prompt,
        inbound_starter_prompt: agentData.inbound_starter_prompt
      };

      const agent = await this.settingsRepository.updateVoiceAgent(
        agentId, 
        tenant_id, 
        normalizedData
      );

      if (!agent) {
        return res.status(404).json({ error: 'Voice agent not found' });
      }

      res.json({ data: agent });
    } catch (error) {
      logger.error('Error updating voice agent:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete voice agent
   */
  async deleteVoiceAgent(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const { agentId } = req.params;

      const deleted = await this.settingsRepository.deleteVoiceAgent(
        agentId, 
        tenant_id
      );

      if (!deleted) {
        return res.status(404).json({ error: 'Voice agent not found' });
      }

      res.json({ message: 'Voice agent deleted successfully' });
    } catch (error) {
      logger.error('Error deleting voice agent:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get all voice voices for a tenant
   */
  async getVoiceVoices(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      const voices = await this.settingsRepository.getAllVoiceVoices(
        tenant_id, 
        limit, 
        offset
      );
      
      const totalCount = await this.settingsRepository.getVoiceVoicesCount(tenant_id);

      res.json({
        data: voices,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting voice voices:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get voice by ID
   */
  async getVoiceById(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const { voiceId } = req.params;

      const voice = await this.settingsRepository.getVoiceById(
        voiceId, 
        tenant_id
      );

      if (!voice) {
        return res.status(404).json({ error: 'Voice not found' });
      }

      res.json({ data: voice });
    } catch (error) {
      logger.error('Error getting voice:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create a new voice
   */
  async createVoice(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const voiceData = req.body;

      // Validate required fields
      const requiredFields = ['description', 'provider'];
      const missingFields = requiredFields.filter(field => !voiceData[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        });
      }

      const voice = await this.settingsRepository.createVoice(
        tenant_id, 
        voiceData
      );

      res.status(201).json({ data: voice });
    } catch (error) {
      logger.error('Error creating voice:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update voice
   */
  async updateVoice(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const { voiceId } = req.params;
      const voiceData = req.body;

      const voice = await this.settingsRepository.updateVoice(
        voiceId, 
        tenant_id, 
        voiceData
      );

      if (!voice) {
        return res.status(404).json({ error: 'Voice not found' });
      }

      res.json({ data: voice });
    } catch (error) {
      logger.error('Error updating voice:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete voice
   */
  async deleteVoice(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const { voiceId } = req.params;

      const deleted = await this.settingsRepository.deleteVoice(
        voiceId, 
        tenant_id
      );

      if (!deleted) {
        return res.status(404).json({ error: 'Voice not found' });
      }

      res.json({ message: 'Voice deleted successfully' });
    } catch (error) {
      logger.error('Error deleting voice:', error);
      if (error.message.includes('Cannot delete voice')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get voices by provider
   */
  async getVoicesByProvider(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const { provider } = req.params;

      const voices = await this.settingsRepository.getVoicesByProvider(
        provider, 
        tenant_id
      );

      res.json({ data: voices });
    } catch (error) {
      logger.error('Error getting voices by provider:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get agents by voice ID
   */
  async getAgentsByVoiceId(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const { voiceId } = req.params;

      const agents = await this.settingsRepository.getAgentsByVoiceId(
        voiceId, 
        tenant_id
      );

      res.json({ data: agents });
    } catch (error) {
      logger.error('Error getting agents by voice ID:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Search voice agents
   */
  async searchVoiceAgents(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const { q: searchTerm } = req.query;
      const limit = parseInt(req.query.limit) || 20;

      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }

      const agents = await this.settingsRepository.searchVoiceAgents(
        searchTerm, 
        tenant_id, 
        limit
      );

      res.json({ data: agents });
    } catch (error) {
      logger.error('Error searching voice agents:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Search voice voices
   */
  async searchVoiceVoices(req, res) {
    try {
      const tenant_id = req.user.tenant_id || req.user.tenantId;
      const { q: searchTerm } = req.query;
      const limit = parseInt(req.query.limit) || 20;

      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }

      const voices = await this.settingsRepository.searchVoiceVoices(
        searchTerm, 
        tenant_id, 
        limit
      );

      res.json({ data: voices });
    } catch (error) {
      logger.error('Error searching voice voices:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = SettingsController;
