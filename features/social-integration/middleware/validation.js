/**
 * Validation Middleware for Social Integration Feature
 */

const SUPPORTED_PLATFORMS = ['linkedin', 'twitter', 'facebook', 'instagram'];
const ACTIVITY_TYPES = ['invitation', 'message', 'connection', 'profile_lookup'];
const ACTIVITY_STATUSES = ['pending', 'sent', 'delivered', 'failed', 'accepted', 'rejected'];

/**
 * Validate platform parameter
 */
function validatePlatform(req, res, next) {
  const { platform } = req.params;

  if (!platform) {
    return res.status(400).json({
      success: false,
      error: 'Platform parameter is required'
    });
  }

  if (!SUPPORTED_PLATFORMS.includes(platform.toLowerCase())) {
    return res.status(400).json({
      success: false,
      error: `Unsupported platform. Supported platforms: ${SUPPORTED_PLATFORMS.join(', ')}`
    });
  }

  req.params.platform = platform.toLowerCase();
  next();
}

/**
 * Validate account connection request
 */
function validateConnectionRequest(req, res, next) {
  const { accessToken, accountId, username } = req.body;

  if (!accessToken || typeof accessToken !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Access token is required'
    });
  }

  if (!accountId || typeof accountId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Account ID is required'
    });
  }

  if (username && typeof username !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Username must be a string'
    });
  }

  next();
}

/**
 * Validate invitation request
 */
function validateInvitationRequest(req, res, next) {
  const { profileId, profileUrl, message } = req.body;

  if (!profileId && !profileUrl) {
    return res.status(400).json({
      success: false,
      error: 'Profile ID or profile URL is required'
    });
  }

  if (message && typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Message must be a string'
    });
  }

  if (message && message.length > 300) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot exceed 300 characters'
    });
  }

  next();
}

/**
 * Validate batch invitation request
 */
function validateBatchInvitationRequest(req, res, next) {
  const { profiles } = req.body;

  if (!profiles || !Array.isArray(profiles)) {
    return res.status(400).json({
      success: false,
      error: 'Profiles must be an array'
    });
  }

  if (profiles.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Profiles array cannot be empty'
    });
  }

  if (profiles.length > 50) {
    return res.status(400).json({
      success: false,
      error: 'Maximum 50 profiles per batch'
    });
  }

  // Validate each profile
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    
    if (!profile.profileId && !profile.profileUrl) {
      return res.status(400).json({
        success: false,
        error: `Profile at index ${i} must have profileId or profileUrl`,
        invalidProfile: profile
      });
    }
  }

  next();
}

/**
 * Validate message request
 */
function validateMessageRequest(req, res, next) {
  const { recipientId, message, conversationId } = req.body;

  if (!recipientId && !conversationId) {
    return res.status(400).json({
      success: false,
      error: 'Recipient ID or conversation ID is required'
    });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Message is required and must be a string'
    });
  }

  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot be empty'
    });
  }

  if (message.length > 5000) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot exceed 5000 characters'
    });
  }

  next();
}

/**
 * Validate profile lookup request
 */
function validateProfileLookupRequest(req, res, next) {
  const { profileId, profileUrl, username } = req.query;

  if (!profileId && !profileUrl && !username) {
    return res.status(400).json({
      success: false,
      error: 'Profile ID, profile URL, or username is required'
    });
  }

  next();
}

/**
 * Validate activity type
 */
function validateActivityType(req, res, next) {
  const { activityType } = req.query;

  if (activityType && !ACTIVITY_TYPES.includes(activityType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid activity type. Valid types: ${ACTIVITY_TYPES.join(', ')}`
    });
  }

  next();
}

/**
 * Validate activity status
 */
function validateActivityStatus(req, res, next) {
  const { status } = req.query;

  if (status && !ACTIVITY_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Valid statuses: ${ACTIVITY_STATUSES.join(', ')}`
    });
  }

  next();
}

/**
 * Validate pagination parameters
 */
function validatePagination(req, res, next) {
  const { limit, offset } = req.query;

  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100'
      });
    }
  }

  if (offset !== undefined) {
    const offsetNum = parseInt(offset);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        success: false,
        error: 'Offset must be a non-negative number'
      });
    }
  }

  next();
}

module.exports = {
  validatePlatform,
  validateConnectionRequest,
  validateInvitationRequest,
  validateBatchInvitationRequest,
  validateMessageRequest,
  validateProfileLookupRequest,
  validateActivityType,
  validateActivityStatus,
  validatePagination
};
