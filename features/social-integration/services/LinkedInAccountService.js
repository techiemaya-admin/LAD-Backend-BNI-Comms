/**
 * LinkedIn Account Service (Social Integration)
 * LAD Architecture Compliant:
 * - Business logic only (no SQL)
 * - Uses logger (no console statements)
 * - Calls repositories for data access
 * - Handles Unipile integration
 */

const linkedInAccountRepo = require('../repositories/LinkedInAccountRepository');
const logger = require('../../../core/utils/logger');
const UnipileService = require('./UnipileService');
const { handleCheckpointResponse } = require('./LinkedInCheckpointHelper');
const axios = require('axios');

// Try to load Unipile SDK (optional dependency)
let UnipileClient = null;
try {
  UnipileClient = require('unipile-node-sdk').UnipileClient;
  logger.info('[LinkedInAccountService] Unipile SDK loaded successfully');
} catch (sdkError) {
  logger.warn('[LinkedInAccountService] Unipile SDK not available', {
    error: sdkError.message
  });
  logger.warn('[LinkedInAccountService] Install with: npm install unipile-node-sdk');
}

class LinkedInAccountService {
  /**
   * Connect LinkedIn account
   * @param {Object} req - Request object
   * @param {Object} params - Connection parameters
   * @returns {Promise<Object>} Connection result
   */
  async connectAccount(req, params) {
    const { method, email, password, li_at, li_a, user_agent } = params;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id;

    if (!tenantId || !userId) {
      throw new Error('Tenant and user context required');
    }

    logger.info('[LinkedInAccountService] Connecting account', {
      tenantId,
      userId,
      method
    });

    // Call Unipile API to create account
    let unipileResult;
    try {
      unipileResult = await this._connectAccountToUnipile({
        method,
        email,
        password,
        li_at,
        li_a,
        user_agent
      });
    } catch (unipileError) {
      logger.error('[LinkedInAccountService] Unipile connection failed', {
        error: unipileError.message,
        tenantId,
        userId
      });
      throw new Error(`Failed to connect to LinkedIn: ${unipileError.message}`);
    }

    // Extract account ID from various possible fields
    const unipileAccountId = unipileResult.account_id || unipileResult.id || unipileResult._id || unipileResult.accountId;
    
    // Check if checkpoint required (checkpoint response has object === 'Checkpoint')
    if (unipileResult.object === 'Checkpoint' && unipileResult.checkpoint) {
      logger.warn('[LinkedInAccountService] Checkpoint required', {
        accountId: unipileAccountId,
        checkpointType: unipileResult.checkpoint?.type
      });
      
      // Extract checkpoint info with proper structure for frontend
      const checkpointType = unipileResult.checkpoint.type || 'IN_APP_VALIDATION';
      const hasCodeField = !!unipileResult.checkpoint.code;
      const hasChallengeField = !!unipileResult.checkpoint.challenge;
      const isOTP = hasCodeField || hasChallengeField || checkpointType === 'OTP' || checkpointType === 'SMS' || checkpointType === 'EMAIL';
      const isYesNo = !isOTP && (checkpointType === 'IN_APP_VALIDATION' || checkpointType === 'YES_NO');
      
      const checkpointInfo = {
        type: checkpointType,
        required: true,
        is_yes_no: isYesNo,
        is_otp: isOTP,
        message: unipileResult.checkpoint.message || unipileResult.checkpoint.description || null,
        sent_to: unipileResult.checkpoint.sent_to || unipileResult.checkpoint.sentTo || null
      };
      
      // Save account with checkpoint status
      const accountData = {
        tenant_id: tenantId,
        user_id: userId,
        provider: 'unipile',
        provider_account_id: unipileAccountId,
        account_name: unipileResult.profile_name || unipileResult.profileName || email,
        status: 'checkpoint',
        metadata: {
          checkpoint: checkpointInfo,
          checkpoint_required_at: new Date().toISOString(),
          email: unipileResult.email || email
        }
      };
      
      await linkedInAccountRepo.create(req, accountData);
      
      return {
        success: true,
        checkpoint_required: true,
        account_id: unipileAccountId,
        checkpoint: checkpointInfo,
        email: unipileResult.email || email,
        profileName: unipileResult.profile_name || unipileResult.profileName || email?.split('@')[0]
      };
    }

    if (!unipileAccountId) {
      throw new Error('Account ID not found in Unipile response');
    }

    // Save successful connection
    const accountData = {
      tenant_id: tenantId,
      user_id: userId,
      provider: 'unipile',
      provider_account_id: unipileAccountId,
      account_name: unipileResult.profile_name || unipileResult.profileName || unipileResult.name || email,
      session_cookies: unipileResult.cookies ? JSON.stringify(unipileResult.cookies) : null,
      access_token: unipileResult.access_token,
      refresh_token: unipileResult.refresh_token,
      token_expires_at: unipileResult.token_expires_at,
      status: 'active',
      default_daily_limit: 100,
      default_hourly_limit: 10,
      metadata: {
        profile_url: unipileResult.profile_url || unipileResult.profileUrl,
        connected_via: method,
        email: unipileResult.email || email
      }
    };

    const savedAccount = await linkedInAccountRepo.create(req, accountData);

    logger.info('[LinkedInAccountService] Account connected successfully', {
      accountId: savedAccount.id,
      providerAccountId: savedAccount.provider_account_id,
      tenantId,
      userId
    });

    return {
      success: true,
      account: savedAccount
    };
  }

  /**
   * Get user's LinkedIn accounts
   * @param {Object} req - Request object
   * @param {string} userId - User ID (optional, defaults to req.user.userId)
   * @returns {Promise<Array>} User's accounts
   */
  async getUserAccounts(req, userId = null) {
    const tenantId = req.user?.tenantId;
    const effectiveUserId = userId || req.user?.userId || req.user?.id;

    if (!tenantId || !effectiveUserId) {
      throw new Error('Tenant and user context required');
    }

    const accounts = await linkedInAccountRepo.findByUser(req, effectiveUserId, tenantId);

    logger.info('[LinkedInAccountService] Retrieved user accounts', {
      tenantId,
      userId: effectiveUserId,
      count: accounts.length
    });

    return accounts;
  }

  /**
   * Get all tenant accounts (admin only)
   * @param {Object} req - Request object
   * @returns {Promise<Array>} Tenant's accounts
   */
  async getTenantAccounts(req) {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    // Check admin permission
    if (!this._isAdmin(req)) {
      throw new Error('Admin permission required');
    }

    const accounts = await linkedInAccountRepo.findByTenant(req, tenantId);

    logger.info('[LinkedInAccountService] Retrieved tenant accounts', {
      tenantId,
      count: accounts.length
    });

    return accounts;
  }

  /**
   * Disconnect LinkedIn account
   * @param {Object} req - Request object
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>} Success status
   */
  async disconnectAccount(req, accountId) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    // Get account to verify ownership
    const account = await linkedInAccountRepo.findById(req, accountId, tenantId);
    
    if (!account) {
      throw new Error('Account not found');
    }

    // Verify user owns this account (unless admin)
    if (account.user_id !== userId && !this._isAdmin(req)) {
      throw new Error('Permission denied');
    }

    // Revoke in Unipile
    try {
      const unipileService = new UnipileService();
      await unipileService.disconnectAccount(account.provider_account_id);
    } catch (unipileError) {
      logger.warn('[LinkedInAccountService] Failed to revoke in Unipile', {
        error: unipileError.message,
        accountId,
        providerAccountId: account.provider_account_id
      });
      // Continue with soft delete even if Unipile fails
    }

    // Soft delete in our database
    const deleted = await linkedInAccountRepo.softDelete(req, accountId, tenantId);

    logger.info('[LinkedInAccountService] Account disconnected', {
      accountId,
      tenantId,
      userId
    });

    return deleted;
  }

  /**
   * Update account status
   * @param {Object} req - Request object
   * @param {string} accountId - Account ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated account
   */
  async updateAccountStatus(req, accountId, status) {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    const validStatuses = ['active', 'expired', 'revoked', 'error', 'checkpoint'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const updated = await linkedInAccountRepo.updateStatus(req, accountId, tenantId, status);

    logger.info('[LinkedInAccountService] Account status updated', {
      accountId,
      status,
      tenantId
    });

    return updated;
  }

  /**
   * Verify OTP for checkpoint
   * @param {Object} req - Request object
   * @param {string} accountId - Account ID (can be database UUID or unipile_account_id)
   * @param {string} otp - OTP code
   * @returns {Promise<Object>} Verification result
   */
  async verifyOTP(req, accountId, otp) {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    // accountId can be either database UUID or unipile_account_id
    // Try to find by database ID first, then by unipile_account_id
    let account = null;
    let unipileAccountId = null;

    // Check if accountId is a UUID (database ID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);
    
    if (isUUID) {
      // Try to find by database UUID
      account = await linkedInAccountRepo.findById(req, accountId, tenantId);
      if (account) {
        unipileAccountId = account.provider_account_id;
      }
    }

    // If not found by UUID, try to find by unipile_account_id
    if (!account && !isUUID) {
      // accountId might be unipile_account_id, try to find account by provider_account_id
      const accounts = await linkedInAccountRepo.findByUser(req, req.user?.userId || req.user?.id, tenantId);
      account = accounts.find(acc => acc.provider_account_id === accountId || acc.unipile_account_id === accountId);
      if (account) {
        unipileAccountId = account.provider_account_id || account.unipile_account_id || accountId;
      } else {
        // Use accountId as unipile_account_id directly
        unipileAccountId = accountId;
      }
    } else if (!account && isUUID) {
      throw new Error('Account not found');
    }

    if (!unipileAccountId) {
      throw new Error('Unipile account ID not found');
    }

    // Call Unipile to verify OTP
    try {
      await this._verifyOTPToUnipile(unipileAccountId, otp);
      
      // Update account status to active if we found the account in our database
      if (account) {
        await linkedInAccountRepo.updateStatus(req, account.id, tenantId, 'active');
      }
      
      logger.info('[LinkedInAccountService] OTP verified successfully', {
        accountId,
        unipileAccountId,
        tenantId
      });
      
      return { success: true };
    } catch (error) {
      logger.error('[LinkedInAccountService] OTP verification failed', {
        error: error.message,
        accountId,
        unipileAccountId,
        tenantId
      });
      throw new Error(`OTP verification failed: ${error.message}`);
    }
  }

  /**
   * Connect account to Unipile (private helper method)
   * @private
   * @param {Object} params - Connection parameters
   * @returns {Promise<Object>} Unipile account response
   */
  async _connectAccountToUnipile(params) {
    const { method, email, password, li_at, li_a, user_agent } = params;
    const unipileService = new UnipileService();

    if (!unipileService.isConfigured()) {
      logger.error('[LinkedInAccountService] Unipile not configured', {
        dsnPresent: !!unipileService.dsn,
        tokenPresent: !!unipileService.token,
        dsnValue: unipileService.dsn ? unipileService.dsn.substring(0, 20) + '...' : 'undefined',
        envDsn: process.env.UNIPILE_DSN ? 'present' : 'undefined',
        envToken: process.env.UNIPILE_TOKEN ? 'present' : 'undefined'
      });
      throw new Error('Unipile is not configured');
    }

    if (!method || (method !== 'credentials' && method !== 'cookies')) {
      throw new Error('Invalid method. Must be "credentials" or "cookies"');
    }

    // Get base URL and prepare SDK base URL (SDK expects URL without /api/v1)
    const baseUrl = unipileService.getBaseUrl();
    let sdkBaseUrl = baseUrl;
    if (sdkBaseUrl.endsWith('/api/v1')) {
      sdkBaseUrl = sdkBaseUrl.replace(/\/api\/v1$/, '');
    } else if (sdkBaseUrl.endsWith('/api/v1/')) {
      sdkBaseUrl = sdkBaseUrl.replace(/\/api\/v1\/$/, '');
    }

    logger.info('[LinkedInAccountService] Using Unipile SDK for connection', {
      sdkBaseUrl: sdkBaseUrl.substring(0, 50) + '...' // Don't log full URL
    });

    // Try SDK first (preferred method)
    if (UnipileClient) {
      try {
        const token = (unipileService.token || process.env.UNIPILE_TOKEN || '').trim();
        
        if (!token) {
          throw new Error('UNIPILE_TOKEN is not configured');
        }
        
        logger.debug('[LinkedInAccountService] Initializing Unipile SDK');
        const unipile = new UnipileClient(sdkBaseUrl, token);
        
        if (method === 'credentials') {
          if (!email || !password) {
            throw new Error('Email and password are required for credentials method');
          }

          logger.info('[LinkedInAccountService] Connecting via SDK with credentials');
          const account = await unipile.account.connectLinkedin({
            username: email,
            password: password
          });

          // Check if response is a checkpoint (OTP/2FA required)
          if (account && account.object === 'Checkpoint' && account.checkpoint) {
            return await handleCheckpointResponse(account, unipile, email);
          }

          logger.info('[LinkedInAccountService] SDK connection successful');
          return account;
        } else if (method === 'cookies') {
          if (!li_at) {
            throw new Error('li_at cookie is required for cookies method');
          }

          logger.info('[LinkedInAccountService] Connecting via SDK with cookies');
          const account = await unipile.account.connectLinkedin({
            cookies: {
              li_at: li_at,
              li_a: li_a || undefined
            },
            user_agent: user_agent || 'LAD/1.0'
          });

          // Check if response is a checkpoint (OTP/2FA required)
          if (account && account.object === 'Checkpoint' && account.checkpoint) {
            return await handleCheckpointResponse(account, unipile, account.email);
          }

          logger.info('[LinkedInAccountService] SDK cookie connection successful');
          return account;
        }
      } catch (sdkError) {
        logger.error('[LinkedInAccountService] SDK connection failed', {
          error: sdkError.message,
          stack: sdkError.stack,
          response: sdkError.response?.data,
          status: sdkError.response?.status,
          statusText: sdkError.response?.statusText
        });
        throw sdkError;
      }
    } else {
      // SDK not available, try HTTP API (fallback)
      logger.warn('[LinkedInAccountService] Unipile SDK not available, using HTTP API fallback');
      const headers = unipileService.getAuthHeaders();

      let payload = {};
      if (method === 'credentials') {
        // Unipile API requires provider field for credentials method
        payload = {
          provider: 'LINKEDIN',
          username: email,
          password: password
        };
      } else if (method === 'cookies') {
        // For cookies method, use access_token and premium_token fields
        payload = { 
          provider: 'LINKEDIN',
          access_token: li_at,
          premium_token: li_a || undefined
        };
        if (user_agent) {
          payload.user_agent = user_agent;
        }
      }

      try {
        const response = await axios.post(
          `${baseUrl}/accounts`,
          payload,
          { headers, timeout: 60000 }
        );

        return response.data;
      } catch (apiError) {
        // Handle 404 - endpoint doesn't exist
        if (apiError.response?.status === 404) {
          logger.warn('[LinkedInAccountService] Unipile endpoint not found (404)');
          throw new Error(
            'LinkedIn connection endpoint not found. Please install unipile-node-sdk: npm install unipile-node-sdk'
          );
        }
        
        logger.error('[LinkedInAccountService] HTTP API connection failed', {
          error: apiError.message,
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          responseData: apiError.response?.data,
          url: `${baseUrl}/accounts`
        });
        
        throw apiError;
      }
    }
  }

  /**
   * Verify OTP with Unipile (private helper method)
   * @private
   * @param {string} unipileAccountId - Unipile account ID
   * @param {string} otp - OTP code
   * @returns {Promise<Object>} Verification response
   */
  async _verifyOTPToUnipile(unipileAccountId, otp) {
    const unipileService = new UnipileService();

    if (!unipileService.isConfigured()) {
      throw new Error('Unipile is not configured');
    }

    const baseUrl = unipileService.getBaseUrl();
    let sdkBaseUrl = baseUrl;
    if (sdkBaseUrl.endsWith('/api/v1')) {
      sdkBaseUrl = sdkBaseUrl.replace(/\/api\/v1$/, '');
    } else if (sdkBaseUrl.endsWith('/api/v1/')) {
      sdkBaseUrl = sdkBaseUrl.replace(/\/api\/v1\/$/, '');
    }

    const token = (unipileService.token || process.env.UNIPILE_TOKEN || '').trim();

    if (!token) {
      throw new Error('UNIPILE_TOKEN is not configured');
    }

    // Try SDK first
    try {
      const { UnipileClient } = require('unipile-node-sdk');
      const unipile = new UnipileClient(sdkBaseUrl, token);

      let verificationResponse;
      if (unipile.account && typeof unipile.account.solveCodeCheckpoint === 'function') {
        logger.info('[LinkedInAccountService] Using SDK solveCodeCheckpoint()');
        verificationResponse = await unipile.account.solveCodeCheckpoint({
          provider: 'LINKEDIN',
          account_id: unipileAccountId,
          code: otp
        });
      } else {
        // Fallback to HTTP
        logger.info('[LinkedInAccountService] SDK method not available, using HTTP fallback');
        const headers = unipileService.getAuthHeaders();
        const response = await axios.post(
          `${baseUrl}/accounts/${unipileAccountId}/solve-checkpoint`,
          {
            type: 'OTP',
            code: otp
          },
          { headers, timeout: 30000 }
        );
        verificationResponse = response.data;
      }

      logger.info('[LinkedInAccountService] OTP verified successfully');
      return verificationResponse;
    } catch (error) {
      logger.error('[LinkedInAccountService] Error verifying OTP', {
        error: error.message,
        accountId: unipileAccountId
      });
      throw error;
    }
  }

  /**
   * Solve checkpoint (Yes/No validation)
   * @param {Object} req - Request object
   * @param {string} accountId - Account ID (database UUID)
   * @param {string} answer - Answer ('YES' or 'NO')
   * @param {string} checkpointType - Checkpoint type (default: 'IN_APP_VALIDATION')
   * @returns {Promise<Object>} Solve result
   */
  async solveCheckpoint(req, accountId, answer, checkpointType = 'IN_APP_VALIDATION') {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    if (!answer || (answer !== 'YES' && answer !== 'NO')) {
      throw new Error('Answer must be YES or NO');
    }

    const account = await linkedInAccountRepo.findById(req, accountId, tenantId);
    
    if (!account) {
      throw new Error('Account not found');
    }

    // Get checkpoint type from account metadata if not provided
    if (checkpointType === 'IN_APP_VALIDATION' && account.metadata?.checkpoint?.type) {
      checkpointType = account.metadata.checkpoint.type;
    }

    // Call Unipile to solve checkpoint
    try {
      await this._solveCheckpointToUnipile(account.provider_account_id, answer, checkpointType);
      
      // Update account status to active
      await linkedInAccountRepo.updateStatus(req, accountId, tenantId, 'active');
      
      logger.info('[LinkedInAccountService] Checkpoint solved successfully', {
        accountId,
        answer,
        checkpointType,
        tenantId
      });
      
      return { success: true };
    } catch (error) {
      logger.error('[LinkedInAccountService] Checkpoint solve failed', {
        error: error.message,
        accountId,
        answer,
        checkpointType,
        tenantId
      });
      throw new Error(`Checkpoint solve failed: ${error.message}`);
    }
  }

  /**
   * Get checkpoint status for an account
   * @param {Object} req - Request object
   * @param {string} unipileAccountId - Unipile account ID
   * @returns {Promise<Object>} Checkpoint status
   */
  async getCheckpointStatus(req, unipileAccountId) {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    if (!unipileAccountId) {
      throw new Error('Account ID is required');
    }

    try {
      // Get account details from Unipile
      const unipileService = new UnipileService();
      const accountDetails = await unipileService.getAccountInfo(unipileAccountId);
      
      if (!accountDetails) {
        throw new Error('Account not found in Unipile');
      }

      // Check if account is still in checkpoint state
      const isCheckpoint = accountDetails?.checkpoint && accountDetails.checkpoint.required;
      const isConnected = accountDetails?.state === 'connected' || accountDetails?.status === 'connected';
      
      logger.info('[LinkedInAccountService] Checkpoint status retrieved', {
        unipileAccountId,
        isCheckpoint,
        isConnected,
        tenantId
      });

      return {
        success: true,
        connected: isConnected && !isCheckpoint,
        status: isConnected ? 'connected' : (isCheckpoint ? 'checkpoint' : 'disconnected'),
        checkpoint: accountDetails?.checkpoint || null
      };
    } catch (error) {
      logger.error('[LinkedInAccountService] Error getting checkpoint status', {
        error: error.message,
        unipileAccountId,
        tenantId
      });
      throw new Error(`Failed to get checkpoint status: ${error.message}`);
    }
  }

  /**
   * Solve checkpoint with Unipile (private helper method)
   * @private
   * @param {string} unipileAccountId - Unipile account ID
   * @param {string} answer - Answer ('YES' or 'NO')
   * @param {string} checkpointType - Checkpoint type
   * @returns {Promise<Object>} Solve response
   */
  async _solveCheckpointToUnipile(unipileAccountId, answer, checkpointType) {
    const unipileService = new UnipileService();

    if (!unipileService.isConfigured()) {
      throw new Error('Unipile is not configured');
    }

    const baseUrl = unipileService.getBaseUrl();
    let sdkBaseUrl = baseUrl;
    if (sdkBaseUrl.endsWith('/api/v1')) {
      sdkBaseUrl = sdkBaseUrl.replace(/\/api\/v1$/, '');
    } else if (sdkBaseUrl.endsWith('/api/v1/')) {
      sdkBaseUrl = sdkBaseUrl.replace(/\/api\/v1\/$/, '');
    }

    const token = (unipileService.token || process.env.UNIPILE_TOKEN || '').trim();

    if (!token) {
      throw new Error('UNIPILE_TOKEN is not configured');
    }

    // Try SDK first
    try {
      const { UnipileClient } = require('unipile-node-sdk');
      const unipile = new UnipileClient(sdkBaseUrl, token);

      let solveResponse;
      if (unipile.account && typeof unipile.account.solveCheckpoint === 'function') {
        logger.info('[LinkedInAccountService] Using SDK solveCheckpoint()');
        solveResponse = await unipile.account.solveCheckpoint({
          account_id: unipileAccountId,
          type: checkpointType,
          answer: answer
        });
      } else {
        // Fallback to HTTP
        logger.info('[LinkedInAccountService] SDK method not available, using HTTP fallback');
        const headers = unipileService.getAuthHeaders();
        const response = await axios.post(
          `${baseUrl}/accounts/${unipileAccountId}/solve-checkpoint`,
          {
            type: checkpointType,
            answer: answer
          },
          { headers, timeout: 30000 }
        );
        solveResponse = response.data;
      }

      logger.info('[LinkedInAccountService] Checkpoint solved successfully');
      return solveResponse;
    } catch (error) {
      logger.error('[LinkedInAccountService] Error solving checkpoint', {
        error: error.message,
        accountId: unipileAccountId
      });
      throw error;
    }
  }

  /**
   * Check if user is admin
   * @private
   */
  _isAdmin(req) {
    const capabilities = req.user?.capabilities || [];
    return capabilities.includes('admin') || 
           capabilities.includes('tenant.admin') ||
           req.user?.role === 'admin' ||
           req.user?.role === 'owner';
  }
}

module.exports = new LinkedInAccountService();
