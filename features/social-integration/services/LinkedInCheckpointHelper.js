/**
 * LinkedIn Checkpoint Helper
 * Handles checkpoint detection and processing for LinkedIn account connection
 * LAD Architecture Compliant: Uses logger, no console statements
 */

const logger = require('../../../core/utils/logger');

/**
 * Detect checkpoint type from account response
 * @param {Object} account - Account response from Unipile
 * @returns {Object|null} Checkpoint detection info or null
 */
function detectCheckpoint(account) {
  if (!account || account.object !== 'Checkpoint' || !account.checkpoint) {
    return null;
  }
  
  const checkpointType = account.checkpoint.type || 'IN_APP_VALIDATION';
  const hasCodeField = !!account.checkpoint.code;
  const hasChallengeField = !!account.checkpoint.challenge;
  const isOTP = hasCodeField || hasChallengeField || checkpointType === 'OTP' || checkpointType === 'SMS' || checkpointType === 'EMAIL';
  const isYesNo = !isOTP && (checkpointType === 'IN_APP_VALIDATION' || checkpointType === 'YES_NO');
  
  return {
    type: checkpointType,
    isOTP,
    isYesNo,
    checkpoint: account.checkpoint
  };
}

/**
 * Extract checkpoint information from account response
 * @param {Object} account - Account response from Unipile SDK
 * @param {Object} unipile - Unipile SDK client instance
 * @param {string} accountId - Unipile account ID
 * @returns {Promise<Object>} Checkpoint information
 */
async function extractCheckpointInfo(account, unipile, accountId) {
  if (!account || account.object !== 'Checkpoint' || !account.checkpoint) {
    return null;
  }
  
  const checkpointDetection = detectCheckpoint(account);
  if (!checkpointDetection) {
    return null;
  }
  
  // Try to fetch account details for more checkpoint information
  let checkpointMessage = null;
  let checkpointSentTo = null;
  let checkpointExpiresAt = null;
  
  try {
    if (unipile && unipile.account && typeof unipile.account.getOne === 'function') {
      const accountDetails = await unipile.account.getOne(accountId);
      if (accountDetails?.checkpoint) {
        checkpointMessage = accountDetails.checkpoint.message;
        checkpointSentTo = accountDetails.checkpoint.sent_to || accountDetails.checkpoint.sentTo;
        checkpointExpiresAt = accountDetails.checkpoint.expires_at || accountDetails.checkpoint.expiresAt;
      }
    }
  } catch (detailError) {
    logger.warn('[LinkedInCheckpointHelper] Could not fetch account details for checkpoint info', {
      error: detailError.message,
      accountId
    });
  }
  
  // Extract checkpoint fields from response
  const checkpointObj = account.checkpoint || {};
  checkpointMessage = checkpointMessage || checkpointObj.message || checkpointObj.description;
  checkpointSentTo = checkpointSentTo || checkpointObj.sent_to || checkpointObj.sentTo;
  checkpointExpiresAt = checkpointExpiresAt || checkpointObj.expires_at || checkpointObj.expiresAt;
  
  return {
    object: 'Checkpoint',
    account_id: accountId,
    checkpoint: {
      type: checkpointDetection.type,
      required: true,
      is_yes_no: checkpointDetection.isYesNo,
      is_otp: checkpointDetection.isOTP,
      message: checkpointMessage,
      sent_to: checkpointSentTo,
      expires_at: checkpointExpiresAt
    }
  };
}

/**
 * Handle checkpoint response from Unipile SDK
 * @param {Object} account - Account response from Unipile SDK
 * @param {Object} unipile - Unipile SDK client instance
 * @param {string} email - Email address (optional)
 * @returns {Promise<Object>} Checkpoint information
 */
async function handleCheckpointResponse(account, unipile, email = null) {
  if (!account || account.object !== 'Checkpoint' || !account.checkpoint) {
    return null;
  }
  
  // Extract account ID from checkpoint response
  const accountId = account.account_id || account.id || account._id;
  
  if (!accountId) {
    throw new Error('LinkedIn requires verification, but no account ID was returned.');
  }
  
  logger.warn('[LinkedInCheckpointHelper] Checkpoint required', {
    accountId,
    checkpointType: account.checkpoint.type
  });
  
  // Extract checkpoint information
  const checkpointInfo = await extractCheckpointInfo(account, unipile, accountId);
  
  if (!checkpointInfo) {
    throw new Error('Failed to extract checkpoint information');
  }
  
  // Add email and profileName if provided
  if (email) {
    checkpointInfo.email = email;
    checkpointInfo.profileName = email.split('@')[0];
  } else if (account.profile_name) {
    checkpointInfo.profileName = account.profile_name;
    checkpointInfo.email = account.email || null;
  }
  
  return checkpointInfo;
}

module.exports = {
  detectCheckpoint,
  extractCheckpointInfo,
  handleCheckpointResponse
};

