/**
 * Social Integration Controller
 * 
 * Unified controller for all social media platform integrations
 * Routes requests to appropriate platform-specific services
 */

const LinkedInIntegration = require('../services/LinkedInIntegration');
const InstagramIntegration = require('../services/InstagramIntegration');
const WhatsAppIntegration = require('../services/WhatsAppIntegration');
const FacebookIntegration = require('../services/FacebookIntegration');
const LinkedInWebhookService = require('../services/LinkedInWebhookService');
const PlatformValidator = require('../utils/platformValidator');
const UrlParser = require('../utils/urlParser');

class SocialIntegrationController {
  constructor(db) {
    this.db = db;
    
    // Initialize platform-specific services
    this.services = {
      linkedin: new LinkedInIntegration(),
      instagram: new InstagramIntegration(),
      whatsapp: new WhatsAppIntegration(),
      facebook: new FacebookIntegration()
    };
    
    // Initialize webhook service
    this.webhookService = new LinkedInWebhookService(db);
    
    console.log('[SocialIntegrationController] Initialized with platforms:', Object.keys(this.services));
  }
  
  /**
   * Get service for a platform
   * 
   * @param {string} platform - Platform name
   * @returns {Object} Platform service
   */
  getService(platform) {
    const normalizedPlatform = platform.toLowerCase();
    const service = this.services[normalizedPlatform];
    
    if (!service) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    return service;
  }
  
  /**
   * List available platforms and their status
   * 
   * GET /api/social-integration/platforms
   */
  async listPlatforms(req, res) {
    try {
      const enabledPlatforms = PlatformValidator.getEnabledPlatforms();
      
      const platformsInfo = enabledPlatforms.map(platform => {
        const config = PlatformValidator.getPlatformConfig(platform);
        return {
          id: platform,
          name: config.name,
          provider: config.provider,
          enabled: config.enabled,
          features: config.features,
          costs: config.costPerAction
        };
      });
      
      res.json({
        success: true,
        platforms: platformsInfo
      });
      
    } catch (error) {
      console.error('[SocialIntegrationController] List platforms error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list platforms',
        message: error.message
      });
    }
  }
  
  /**
   * Send connection request/invitation
   * 
   * POST /api/social-integration/:platform/send-invitation
   * 
   * Body:
   * - profile: { name, profile_url, publicIdentifier } OR
   * - profileUrl: string OR
   * - publicIdentifier: string
   * - accountId: string (required)
   * - customMessage: string (optional)
   */
  async sendInvitation(req, res) {
    try {
      const { platform } = req.params;
      const { profile, profileUrl, publicIdentifier, accountId, customMessage } = req.body;
      
      // Validate request
      const validation = PlatformValidator.validateActionPayload(platform, 'send-invitation', req.body);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          errors: validation.errors
        });
      }
      
      // Build profile object
      let profileObj = profile || {};
      if (profileUrl) {
        profileObj.profile_url = profileUrl;
      }
      if (publicIdentifier) {
        profileObj.publicIdentifier = publicIdentifier;
      }
      
      // Get platform service
      const service = this.getService(platform);
      
      console.log(`[SocialIntegrationController] Sending ${platform} invitation`);
      
      // Send invitation
      const result = await service.sendInvitation(profileObj, accountId, PlatformValidator.getProviderName(platform), customMessage);
      
      // Calculate credits
      const creditsUsed = result.alreadySent ? 0 : PlatformValidator.getActionCost(platform, 'invitation');
      
      // TODO: Deduct credits from user account
      // await this.deductCredits(req.user.id, creditsUsed, platform, 'invitation');
      
      res.json({
        success: result.success,
        data: result.data,
        profile: result.profile,
        alreadySent: result.alreadySent || false,
        creditsUsed: creditsUsed
      });
      
    } catch (error) {
      console.error(`[SocialIntegrationController] Send invitation error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to send invitation',
        message: error.message
      });
    }
  }
  
  /**
   * Batch send invitations
   * 
   * POST /api/social-integration/:platform/batch-send-invitations
   * 
   * Body:
   * - profiles: Array<{ name, profile_url, publicIdentifier }>
   * - accountId: string (required)
   * - customMessage: string (optional)
   * - delayMs: number (optional, default: 2000)
   */
  async batchSendInvitations(req, res) {
    try {
      const { platform } = req.params;
      const { profiles, accountId, customMessage, delayMs } = req.body;
      
      // Validate platform
      if (!PlatformValidator.isPlatformEnabled(platform)) {
        return res.status(400).json({
          success: false,
          error: `Platform ${platform} is not enabled`
        });
      }
      
      if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'profiles array is required'
        });
      }
      
      if (!accountId) {
        return res.status(400).json({
          success: false,
          error: 'accountId is required'
        });
      }
      
      const service = this.getService(platform);
      
      console.log(`[SocialIntegrationController] Batch sending ${profiles.length} ${platform} invitations`);
      
      // Use platform-specific batch method if available
      let result;
      if (platform === 'linkedin' && service.batchSendConnectionRequests) {
        result = await service.batchSendConnectionRequests(profiles, accountId, customMessage, delayMs);
      } else if (platform === 'facebook' && service.batchSendFriendRequests) {
        result = await service.batchSendFriendRequests(profiles, accountId, delayMs);
      } else {
        // Generic batch implementation
        result = await this.genericBatchSend(service, profiles, accountId, platform, customMessage, delayMs);
      }
      
      // Calculate total credits
      const costPerInvitation = PlatformValidator.getActionCost(platform, 'invitation');
      const creditsUsed = result.successful * costPerInvitation;
      
      // TODO: Deduct credits
      // await this.deductCredits(req.user.id, creditsUsed, platform, 'batch-invitation');
      
      res.json({
        success: true,
        ...result,
        creditsUsed: creditsUsed
      });
      
    } catch (error) {
      console.error(`[SocialIntegrationController] Batch send error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to batch send invitations',
        message: error.message
      });
    }
  }
  
  /**
   * Generic batch send for platforms without specific implementation
   */
  async genericBatchSend(service, profiles, accountId, platform, customMessage, delayMs = 2000) {
    const results = {
      total: profiles.length,
      successful: 0,
      failed: 0,
      alreadySent: 0,
      results: []
    };
    
    const provider = PlatformValidator.getProviderName(platform);
    
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      
      try {
        const result = await service.sendInvitation(profile, accountId, provider, customMessage);
        
        if (result.success) {
          if (result.alreadySent) {
            results.alreadySent++;
          } else {
            results.successful++;
          }
        } else {
          results.failed++;
        }
        
        results.results.push({
          profile: profile.name || 'Unknown',
          success: result.success,
          alreadySent: result.alreadySent || false,
          error: result.error || null
        });
        
        // Delay between requests
        if (i < profiles.length - 1 && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
      } catch (error) {
        results.failed++;
        results.results.push({
          profile: profile.name || 'Unknown',
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * Send direct message
   * 
   * POST /api/social-integration/:platform/send-message
   * 
   * Body:
   * - providerId: string (for LinkedIn, Instagram, Facebook) OR
   * - phoneNumber: string (for WhatsApp)
   * - message: string (required)
   * - accountId: string (required)
   */
  async sendMessage(req, res) {
    try {
      const { platform } = req.params;
      const { providerId, phoneNumber, message, accountId } = req.body;
      
      // Validate request
      const validation = PlatformValidator.validateActionPayload(platform, 'send-message', req.body);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          errors: validation.errors
        });
      }
      
      const service = this.getService(platform);
      const provider = PlatformValidator.getProviderName(platform);
      
      console.log(`[SocialIntegrationController] Sending ${platform} message`);
      
      let result;
      
      // WhatsApp uses phone number instead of provider ID
      if (platform === 'whatsapp') {
        result = await service.sendWhatsAppMessage(phoneNumber, message, accountId);
      } else {
        result = await service.sendMessage(providerId, message, accountId, provider);
      }
      
      // Calculate credits
      const creditsUsed = PlatformValidator.getActionCost(platform, 'message');
      
      // TODO: Deduct credits
      // await this.deductCredits(req.user.id, creditsUsed, platform, 'message');
      
      res.json({
        success: result.success,
        data: result.data,
        creditsUsed: creditsUsed
      });
      
    } catch (error) {
      console.error(`[SocialIntegrationController] Send message error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to send message',
        message: error.message
      });
    }
  }
  
  /**
   * Look up profile information
   * 
   * GET /api/social-integration/:platform/lookup
   * 
   * Query params:
   * - profileUrl: string OR
   * - publicIdentifier: string OR
   * - phoneNumber: string (for WhatsApp)
   * - accountId: string (required)
   */
  async lookupProfile(req, res) {
    try {
      const { platform } = req.params;
      const { profileUrl, publicIdentifier, phoneNumber, accountId } = req.query;
      
      // Validate request
      const validation = PlatformValidator.validateActionPayload(platform, 'lookup', { 
        profileUrl, 
        publicIdentifier, 
        phoneNumber, 
        accountId 
      });
      
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          errors: validation.errors
        });
      }
      
      const service = this.getService(platform);
      const provider = PlatformValidator.getProviderName(platform);
      
      const identifier = profileUrl || publicIdentifier || phoneNumber;
      
      console.log(`[SocialIntegrationController] Looking up ${platform} profile: ${identifier}`);
      
      const result = await service.lookupProfile(identifier, accountId, provider);
      
      // Calculate credits
      const creditsUsed = PlatformValidator.getActionCost(platform, 'lookup');
      
      // TODO: Deduct credits
      // await this.deductCredits(req.user.id, creditsUsed, platform, 'lookup');
      
      res.json({
        success: true,
        profile: result,
        creditsUsed: creditsUsed
      });
      
    } catch (error) {
      console.error(`[SocialIntegrationController] Lookup error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to lookup profile',
        message: error.message
      });
    }
  }
  
  /**
   * Get connection status for a platform
   * 
   * GET /api/social-integration/:platform/status
   * 
   * Query params:
   * - accountId: string (optional - if provided, checks specific account)
   */
  async getStatus(req, res) {
    try {
      const { platform } = req.params;
      const { accountId } = req.query;
      
      if (!PlatformValidator.isPlatformEnabled(platform)) {
        return res.status(400).json({
          success: false,
          error: `Platform ${platform} is not enabled`
        });
      }
      
      const service = this.getService(platform);
      
      // If accountId provided, get specific account info
      if (accountId) {
        const accountInfo = await service.getAccountInfo(accountId);
        
        return res.json({
          success: true,
          platform: platform,
          connected: true,
          account: accountInfo
        });
      }
      
      // Otherwise, check if Unipile is configured for this platform
      const configured = service.isConfigured();
      
      res.json({
        success: true,
        platform: platform,
        configured: configured,
        message: configured ? 
          'Platform is configured and ready' : 
          'Platform credentials not configured'
      });
      
    } catch (error) {
      console.error(`[SocialIntegrationController] Status error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get status',
        message: error.message
      });
    }
  }
  
  /**
   * List all connected accounts
   * 
   * GET /api/social-integration/accounts
   */
  async listAccounts(req, res) {
    try {
      // Use any service to list accounts (they all use same Unipile token)
      const service = this.services.linkedin;
      
      const accounts = await service.listAccounts();
      
      // Group accounts by provider
      const groupedAccounts = {
        linkedin: [],
        instagram: [],
        whatsapp: [],
        facebook: [],
        other: []
      };
      
      accounts.forEach(account => {
        const provider = account.provider?.toLowerCase();
        if (groupedAccounts[provider]) {
          groupedAccounts[provider].push(account);
        } else {
          groupedAccounts.other.push(account);
        }
      });
      
      res.json({
        success: true,
        accounts: groupedAccounts,
        total: accounts.length
      });
      
    } catch (error) {
      console.error('[SocialIntegrationController] List accounts error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list accounts',
        message: error.message
      });
    }
  }

  /**
   * Connect/authenticate an account
   * 
   * POST /api/social-integration/:platform/connect
   * 
   * For LinkedIn (via Unipile):
   * - method: 'credentials' | 'cookies'
   * - For credentials: { email, password }
   * - For cookies: { li_at, li_a, user_agent }
   * 
   * Body:
   * - method: string (required)
   * - email, password: for credentials method
   * - li_at, li_a, user_agent: for cookies method
   */
  async connectAccount(req, res) {
    try {
      const { platform } = req.params;
      const { method, email, password, li_at, li_a, user_agent } = req.body;

      if (platform.toLowerCase() === 'linkedin') {
        // Validate method
        if (!method || (method !== 'credentials' && method !== 'cookies')) {
          return res.status(400).json({
            success: false,
            error: 'Invalid authentication method',
            message: 'Method must be "credentials" or "cookies"'
          });
        }

        // Validate credentials/cookies based on method
        if (method === 'credentials' && (!email || !password)) {
          return res.status(400).json({
            success: false,
            error: 'Email and password are required for credentials method'
          });
        }

        if (method === 'cookies' && !li_at) {
          return res.status(400).json({
            success: false,
            error: 'li_at cookie is required for cookies method'
          });
        }

        try {
          // Use new LinkedInAccountService (LAD architecture compliant)
          const LinkedInAccountService = require('../services/LinkedInAccountService');
          
          const result = await LinkedInAccountService.connectAccount(req, {
            method,
            email,
            password,
            li_at,
            li_a,
            user_agent: user_agent || req.headers['user-agent']
          });

          // Handle checkpoint/2FA response
          if (result.checkpoint_required) {
            return res.json({
              success: true,
              checkpoint_required: true,
              data: {
                accountId: result.account_id,
                checkpoint: result.checkpoint,
                method: method
              },
              message: 'LinkedIn account created but requires verification (OTP/2FA)'
            });
          }

          // Successful connection
          return res.json({
            success: true,
            data: {
              accountId: result.account.id,
              providerAccountId: result.account.provider_account_id,
              accountName: result.account.account_name,
              status: result.account.status,
              connected: true,
              method: method
            },
            message: 'LinkedIn account connected successfully'
          });

        } catch (connectionError) {
          return res.status(400).json({
            success: false,
            error: 'LinkedIn connection failed',
            message: connectionError.message
          });
        }
      }

      // For other platforms, use old service method
      const service = this.getService(platform);
      if (service.connectAccount) {
        const result = await service.connectAccount(req.body);
        return res.json({
          success: true,
          data: result,
          message: `${platform} account connected successfully`
        });
      }

      return res.status(501).json({
        success: false,
        error: `Direct connection not supported for ${platform}`,
        message: 'This platform requires external authentication'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to connect account',
        message: error.message
      });
    }
  }

  /**
   * Verify OTP for checkpoint
   * 
   * POST /api/social-integration/:platform/verify-otp
   * 
   * Body:
   * - otp: string (required)
   * - account_id: string (optional, can be database UUID or unipile_account_id)
   * - email: string (optional)
   */
  async verifyOTP(req, res) {
    try {
      const { platform } = req.params;
      const { otp, account_id, email } = req.body;

      if (platform.toLowerCase() !== 'linkedin') {
        return res.status(501).json({
          success: false,
          error: `OTP verification not supported for ${platform}`
        });
      }

      if (!otp) {
        return res.status(400).json({
          success: false,
          error: 'OTP is required'
        });
      }

      const LinkedInAccountService = require('../services/LinkedInAccountService');
      
      // account_id can be database UUID or unipile_account_id
      // LinkedInAccountService.verifyOTP will handle both cases
      const accountId = account_id;
      
      if (!accountId) {
        // Try to get first account for user
        const accounts = await LinkedInAccountService.getUserAccounts(req);
        if (accounts.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Account ID is required. No LinkedIn accounts found.'
          });
        }
        // Use first account's ID
        const firstAccount = accounts.find(acc => acc.status === 'checkpoint') || accounts[0];
        const result = await LinkedInAccountService.verifyOTP(req, firstAccount.id, otp);
        
        return res.json({
          success: true,
          message: 'OTP verified successfully',
          result
        });
      }

      const result = await LinkedInAccountService.verifyOTP(req, accountId, otp);
      
      res.json({
        success: true,
        message: 'OTP verified successfully',
        result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to verify OTP',
        message: error.message
      });
    }
  }

  /**
   * Solve checkpoint (Yes/No validation)
   * 
   * POST /api/social-integration/:platform/solve-checkpoint
   * 
   * Body:
   * - answer: string (required, 'YES' or 'NO')
   * - account_id: string (optional, database UUID)
   * - email: string (optional)
   */
  async solveCheckpoint(req, res) {
    try {
      const { platform } = req.params;
      const { answer, account_id, email } = req.body;

      if (platform.toLowerCase() !== 'linkedin') {
        return res.status(501).json({
          success: false,
          error: `Checkpoint solving not supported for ${platform}`
        });
      }

      if (!answer || (answer !== 'YES' && answer !== 'NO')) {
        return res.status(400).json({
          success: false,
          error: 'Answer is required and must be YES or NO'
        });
      }

      const LinkedInAccountService = require('../services/LinkedInAccountService');
      
      let accountId = account_id;
      
      if (!accountId) {
        // Try to get first checkpoint account for user
        const accounts = await LinkedInAccountService.getUserAccounts(req);
        const checkpointAccount = accounts.find(acc => acc.status === 'checkpoint');
        
        if (!checkpointAccount) {
          return res.status(400).json({
            success: false,
            error: 'Account ID is required. No checkpoint account found.'
          });
        }
        accountId = checkpointAccount.id;
      }

      // Get checkpoint type from account metadata (default: IN_APP_VALIDATION)
      let checkpointType = 'IN_APP_VALIDATION';
      try {
        const accounts = await LinkedInAccountService.getUserAccounts(req);
        const account = accounts.find(acc => acc.id === accountId);
        if (account?.metadata?.checkpoint?.type) {
          checkpointType = account.metadata.checkpoint.type;
        }
      } catch (dbError) {
        // Use default checkpoint type
      }

      const result = await LinkedInAccountService.solveCheckpoint(req, accountId, answer, checkpointType);
      
      res.json({
        success: true,
        message: 'Checkpoint solved successfully',
        result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to solve checkpoint',
        message: error.message
      });
    }
  }

  /**
   * Get checkpoint status (for polling Yes/No checkpoints)
   * 
   * GET /api/social-integration/:platform/checkpoint-status
   * 
   * Query params:
   * - account_id: string (optional, unipile_account_id)
   */
  async getCheckpointStatus(req, res) {
    try {
      const { platform } = req.params;
      const { account_id } = req.query;

      if (platform.toLowerCase() !== 'linkedin') {
        return res.status(501).json({
          success: false,
          error: `Checkpoint status not supported for ${platform}`
        });
      }

      const LinkedInAccountService = require('../services/LinkedInAccountService');
      
      let unipileAccountId = account_id;
      
      if (!unipileAccountId) {
        // Try to get first checkpoint account for user
        const accounts = await LinkedInAccountService.getUserAccounts(req);
        const checkpointAccount = accounts.find(acc => acc.status === 'checkpoint');
        
        if (!checkpointAccount) {
          return res.status(400).json({
            success: false,
            error: 'Account ID is required. No checkpoint account found.'
          });
        }
        unipileAccountId = checkpointAccount.provider_account_id || checkpointAccount.unipile_account_id;
      }

      const result = await LinkedInAccountService.getCheckpointStatus(req, unipileAccountId);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get checkpoint status',
        message: error.message
      });
    }
  }

  /**
   * Disconnect an account
   * 
   * POST /api/social-integration/:platform/disconnect
   * 
   * Body:
   * - accountId: string (required)
   */
  async disconnectAccount(req, res) {
    try {
      const { platform } = req.params;
      const { accountId } = req.body;
      
      if (!accountId) {
        return res.status(400).json({
          success: false,
          error: 'accountId is required'
        });
      }
      
      const service = this.getService(platform);
      
      console.log(`[SocialIntegrationController] Disconnecting ${platform} account: ${accountId}`);
      
      const result = await service.disconnectAccount(accountId);
      
      res.json(result);
      
    } catch (error) {
      console.error(`[SocialIntegrationController] Disconnect error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect account',
        message: error.message
      });
    }
  }
  
  /**
   * Get invitations status
   * 
   * GET /api/social-integration/:platform/invitations
   * 
   * Query params:
   * - accountId: string (required)
   * - status: string (optional - 'pending', 'accepted', 'declined')
   */
  async getInvitationsStatus(req, res) {
    try {
      const { platform } = req.params;
      const { accountId, status } = req.query;
      
      if (!accountId) {
        return res.status(400).json({
          success: false,
          error: 'accountId is required'
        });
      }
      
      if (!PlatformValidator.isPlatformEnabled(platform)) {
        return res.status(400).json({
          success: false,
          error: `Platform ${platform} is not enabled`
        });
      }
      
      const service = this.getService(platform);
      
      const filters = {};
      if (status) {
        filters.status = status;
      }
      
      console.log(`[SocialIntegrationController] Getting ${platform} invitations status`);
      
      const result = await service.getInvitationsStatus(accountId, filters);
      
      res.json(result);
      
    } catch (error) {
      console.error(`[SocialIntegrationController] Get invitations error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get invitations status',
        message: error.message
      });
    }
  }
  
  /**
   * Get messages
   * 
   * GET /api/social-integration/:platform/messages
   * 
   * Query params:
   * - accountId: string (required)
   * - conversationId: string (optional)
   * - since: timestamp (optional)
   */
  async getMessages(req, res) {
    try {
      const { platform } = req.params;
      const { accountId, conversationId, since } = req.query;
      
      if (!accountId) {
        return res.status(400).json({
          success: false,
          error: 'accountId is required'
        });
      }
      
      if (!PlatformValidator.isPlatformEnabled(platform)) {
        return res.status(400).json({
          success: false,
          error: `Platform ${platform} is not enabled`
        });
      }
      
      const service = this.getService(platform);
      
      const filters = {};
      if (conversationId) filters.conversation_id = conversationId;
      if (since) filters.since = since;
      
      console.log(`[SocialIntegrationController] Getting ${platform} messages`);
      
      const result = await service.getMessages(accountId, filters);
      
      res.json(result);
      
    } catch (error) {
      console.error(`[SocialIntegrationController] Get messages error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get messages',
        message: error.message
      });
    }
  }
  
  /**
   * Get conversations
   * 
   * GET /api/social-integration/:platform/conversations
   * 
   * Query params:
   * - accountId: string (required)
   */
  async getConversations(req, res) {
    try {
      const { platform } = req.params;
      const { accountId } = req.query;
      
      if (!accountId) {
        return res.status(400).json({
          success: false,
          error: 'accountId is required'
        });
      }
      
      if (!PlatformValidator.isPlatformEnabled(platform)) {
        return res.status(400).json({
          success: false,
          error: `Platform ${platform} is not enabled`
        });
      }
      
      const service = this.getService(platform);
      
      console.log(`[SocialIntegrationController] Getting ${platform} conversations`);
      
      const result = await service.getConversations(accountId);
      
      res.json(result);
      
    } catch (error) {
      console.error(`[SocialIntegrationController] Get conversations error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get conversations',
        message: error.message
      });
    }
  }
  
  /**
   * Handle Unipile webhook events
   * 
   * POST /api/social-integration/webhook
   * 
   * Handles events like:
   * - new_relation (primary event for connection acceptance)
   * - connection.accepted / invitation.accepted
   * - connection.sent / invitation.sent
   * - connection.declined / invitation.declined
   * - AccountStatus (account state changes: OK, ERROR, CREDENTIALS, etc.)
   * - message.received
   * 
   * 📡 Unipile Webhook Timing:
   * - Best Case: 1-5 seconds (active sync)
   * - Normal: 5-30 seconds (most notifications)
   * - Typical: 30-60 seconds (average)
   * - Delayed: 1-2 minutes (high load)
   * - Very Delayed: 15-30 minutes (inactive account, waiting for sync cycle)
   */
  async handleWebhook(req, res) {
    try {
      const payload = req.body;
      
      // Check if this is an AccountStatus webhook (Unipile format)
      // Format: { "AccountStatus": { "account_id": "...", "account_type": "LINKEDIN", "message": "OK|ERROR|CREDENTIALS|..." } }
      if (payload.AccountStatus) {
        console.log(`[Unipile Webhook] 📨 Received AccountStatus webhook`);
        console.log(`[Unipile Webhook] Account ID: ${payload.AccountStatus.account_id}`);
        console.log(`[Unipile Webhook] Account Type: ${payload.AccountStatus.account_type}`);
        console.log(`[Unipile Webhook] Status Message: ${payload.AccountStatus.message}`);
        
        // Handle account status update
        await this.webhookService.handleAccountStatusChanged(payload.AccountStatus);
        
        return res.status(200).json({
          success: true,
          message: 'AccountStatus webhook received and processed'
        });
      }
      
      // Handle other webhook formats (connection events, etc.)
      const event = payload.event || payload.type || payload.object;
      const timestamp = payload.timestamp || new Date().toISOString();
      
      // Log receipt with timing info
      const receivedAt = new Date();
      console.log(`[Unipile Webhook] 📨 Received event: ${event} at ${timestamp}`);
      console.log(`[Unipile Webhook] ⏰ Webhook received at: ${receivedAt.toISOString()}`);
      
      // Calculate delay if timestamp provided
      if (payload.timestamp) {
        try {
          const eventTime = new Date(payload.timestamp);
          const delayMs = receivedAt - eventTime;
          const delaySeconds = Math.round(delayMs / 1000);
          if (delaySeconds > 0) {
            console.log(`[Unipile Webhook] ⏱️  Estimated delay: ~${delaySeconds} seconds`);
          }
        } catch (timeError) {
          // Ignore timestamp parsing errors
        }
      }

      // Handle different event types
      // Note: "new_relation" is the primary event type for "New Reaction / Read / Event" webhooks
      // It fires when someone accepts your LinkedIn connection request
      switch (event) {
        case 'connection.accepted':
        case 'invitation.accepted':
        case 'new_relation':  // Primary event type from Unipile "Users" webhook
        case 'relation':      // Alternative event name
          console.log(`[Unipile Webhook] ✅ Processing connection acceptance event`);
          await this.webhookService.handleConnectionAccepted(payload);
          break;

        case 'connection.sent':
        case 'invitation.sent':
          console.log(`[Unipile Webhook] 📤 Processing connection sent event`);
          await this.webhookService.handleConnectionSent(payload);
          break;

        case 'connection.declined':
        case 'invitation.declined':
          console.log(`[Unipile Webhook] ❌ Processing connection declined event`);
          await this.webhookService.handleConnectionDeclined(payload);
          break;

        case 'account.status_changed':
        case 'account.status':
        case 'account.state_changed':
        case 'account.state':
          console.log(`[Unipile Webhook] 🔄 Processing account status changed event`);
          await this.webhookService.handleAccountStatusChanged(payload);
          break;

        case 'message.received':
          console.log(`[Unipile Webhook] 💬 Message received event`);
          // TODO: Implement message handling
          break;

        default:
          console.log(`[Unipile Webhook] ℹ️ Unhandled event type: ${event}`);
      }

      // Always return 200 to acknowledge receipt
      res.status(200).json({
        success: true,
        message: 'Webhook received and processed'
      });

    } catch (error) {
      console.error('[Unipile Webhook] Error processing webhook:', error);
      
      // Still return 200 to prevent Unipile from retrying
      // Log the error for manual investigation
      res.status(200).json({
        success: false,
        error: error.message,
        message: 'Webhook received but processing failed'
      });
    }
  }
  
  /**
   * Test webhook endpoint (GET) to verify accessibility
   * 
   * GET /api/social-integration/webhook/test
   */
  async testWebhook(req, res) {
    res.json({
      success: true,
      message: 'Unipile webhook endpoint is accessible',
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * TODO: Deduct credits from user account
   * This should integrate with your credit/billing system
   */
  async deductCredits(userId, credits, platform, action) {
    // Implementation depends on your credit system
    console.log(`[Credits] Deducting ${credits} credits from user ${userId} for ${platform}/${action}`);
    
    // Example implementation:
    // const query = `
    //   INSERT INTO credit_transactions (user_id, credits, feature, action, created_at)
    //   VALUES ($1, $2, $3, $4, NOW())
    // `;
    // await this.db.query(query, [userId, -credits, `social-integration-${platform}`, action]);
  }
}

module.exports = SocialIntegrationController;
