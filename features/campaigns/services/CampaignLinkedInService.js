/**
 * Campaign LinkedIn Account Service
 * LAD Architecture Compliant:
 * - Business logic only (no SQL)
 * - Uses logger (no console statements)
 * - Calls repositories for data access
 * - Handles campaign-account mapping and rate limits
 */

const campaignLinkedInRepo = require('../repositories/CampaignLinkedInAccountRepository');
const linkedInAccountRepo = require('../../social-integration/repositories/LinkedInAccountRepository');
const logger = require('../../../shared/utils/logger');

class CampaignLinkedInService {
  /**
   * Attach LinkedIn account to campaign
   * @param {Object} req - Request object
   * @param {string} campaignId - Campaign ID
   * @param {Object} params - Attachment parameters
   * @returns {Promise<Object>} Created mapping
   */
  async attachAccount(req, campaignId, params) {
    const { linkedin_account_id, daily_limit, hourly_limit, is_primary } = params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    // Verify account exists and belongs to tenant
    const account = await linkedInAccountRepo.findById(req, linkedin_account_id, tenantId);
    
    if (!account) {
      throw new Error('LinkedIn account not found');
    }

    if (account.status !== 'active') {
      throw new Error(`Account is not active (status: ${account.status})`);
    }

    // Use account defaults if limits not specified
    const effectiveDailyLimit = daily_limit || account.default_daily_limit || 100;
    const effectiveHourlyLimit = hourly_limit || account.default_hourly_limit || 10;

    const mappingData = {
      tenant_id: tenantId,
      campaign_id: campaignId,
      linkedin_account_id,
      daily_limit: effectiveDailyLimit,
      hourly_limit: effectiveHourlyLimit,
      is_primary: is_primary || false,
      priority: is_primary ? 100 : 0
    };

    const mapping = await campaignLinkedInRepo.create(req, mappingData);

    logger.info('[CampaignLinkedInService] Account attached to campaign', {
      campaignId,
      accountId: linkedin_account_id,
      dailyLimit: effectiveDailyLimit,
      isPrimary: is_primary,
      tenantId
    });

    return mapping;
  }

  /**
   * Get all LinkedIn accounts for a campaign
   * @param {Object} req - Request object
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Array>} Account mappings
   */
  async getCampaignAccounts(req, campaignId) {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    const accounts = await campaignLinkedInRepo.findByCampaign(req, campaignId, tenantId);

    logger.info('[CampaignLinkedInService] Retrieved campaign accounts', {
      campaignId,
      tenantId,
      count: accounts.length
    });

    return accounts;
  }

  /**
   * Get available account for campaign (respects rate limits)
   * @param {Object} req - Request object
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object|null>} Available account or null
   */
  async getAvailableAccount(req, campaignId) {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    const account = await campaignLinkedInRepo.findAvailableAccount(req, campaignId, tenantId);

    if (!account) {
      logger.warn('[CampaignLinkedInService] No available accounts for campaign', {
        campaignId,
        tenantId
      });
      return null;
    }

    logger.info('[CampaignLinkedInService] Found available account', {
      campaignId,
      accountId: account.linkedin_account_id,
      providerAccountId: account.provider_account_id,
      actionsToday: account.actions_today,
      dailyLimit: account.daily_limit,
      tenantId
    });

    return account;
  }

  /**
   * Increment action counter for account
   * @param {Object} req - Request object
   * @param {string} mappingId - Mapping ID
   * @returns {Promise<Object>} Updated mapping
   */
  async recordAction(req, mappingId) {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    const updated = await campaignLinkedInRepo.incrementActions(req, mappingId, tenantId);

    logger.info('[CampaignLinkedInService] Action recorded', {
      mappingId,
      actionsToday: updated.actions_today,
      dailyLimit: updated.daily_limit,
      tenantId
    });

    // Warn if approaching limit
    if (updated.actions_today >= updated.daily_limit * 0.9) {
      logger.warn('[CampaignLinkedInService] Account approaching daily limit', {
        mappingId,
        actionsToday: updated.actions_today,
        dailyLimit: updated.daily_limit,
        tenantId
      });
    }

    return updated;
  }

  /**
   * Remove account from campaign
   * @param {Object} req - Request object
   * @param {string} campaignId - Campaign ID
   * @param {string} mappingId - Mapping ID
   * @returns {Promise<boolean>} Success status
   */
  async detachAccount(req, campaignId, mappingId) {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    const deleted = await campaignLinkedInRepo.softDelete(req, mappingId, tenantId);

    logger.info('[CampaignLinkedInService] Account detached from campaign', {
      campaignId,
      mappingId,
      tenantId
    });

    return deleted;
  }

  /**
   * Get campaigns using a LinkedIn account
   * @param {Object} req - Request object
   * @param {string} linkedInAccountId - LinkedIn account ID
   * @returns {Promise<Array>} Campaign mappings
   */
  async getAccountCampaigns(req, linkedInAccountId) {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    const campaigns = await campaignLinkedInRepo.findByLinkedInAccount(
      req,
      linkedInAccountId,
      tenantId
    );

    logger.info('[CampaignLinkedInService] Retrieved campaigns using account', {
      linkedInAccountId,
      tenantId,
      count: campaigns.length
    });

    return campaigns;
  }

  /**
   * Check if account has capacity for more actions
   * @param {Object} account - Account mapping
   * @returns {boolean} Has capacity
   */
  hasCapacity(account) {
    if (!account) return false;
    
    // Check if daily limit reached
    if (account.actions_today >= account.daily_limit) {
      return false;
    }

    // Check if needs daily reset
    const today = new Date().toISOString().split('T')[0];
    if (account.last_reset_date && account.last_reset_date < today) {
      // Counter will be reset on next increment
      return true;
    }

    return true;
  }

  /**
   * Get account utilization percentage
   * @param {Object} account - Account mapping
   * @returns {number} Utilization percentage (0-100)
   */
  getUtilization(account) {
    if (!account || !account.daily_limit) return 0;
    return Math.round((account.actions_today / account.daily_limit) * 100);
  }
}

module.exports = new CampaignLinkedInService();
