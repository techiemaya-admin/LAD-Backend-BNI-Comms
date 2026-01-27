/**
 * Validation Middleware for Voice Agent Feature
 */

/**
 * Validate phone number format
 */
function validatePhoneNumber(req, res, next) {
  const { phoneNumber, phone } = req.body;
  const number = phoneNumber || phone;

  if (!number) {
    return res.status(400).json({
      success: false,
      error: 'Phone number is required'
    });
  }

  // E.164 format validation (+1234567890)
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (!e164Regex.test(number)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number format. Must be in E.164 format (+1234567890)'
    });
  }

  next();
}

/**
 * Validate voice agent configuration
 */
function validateAgentConfig(req, res, next) {
  const { name, voice, language } = req.body;

  if (name && typeof name !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Agent name must be a string'
    });
  }

  if (voice && !['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid voice. Must be: alloy, echo, fable, onyx, nova, or shimmer'
    });
  }

  if (language && !/^[a-z]{2}-[A-Z]{2}$/.test(language)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid language format. Must be ISO format (e.g., en-US, es-ES)'
    });
  }

  next();
}

/**
 * Validate call creation request
 */
function validateCallRequest(req, res, next) {
  const { to, agentId, prompt } = req.body;

  if (!to) {
    return res.status(400).json({
      success: false,
      error: 'Destination phone number (to) is required'
    });
  }

  if (!agentId) {
    return res.status(400).json({
      success: false,
      error: 'Agent ID is required'
    });
  }

  // Validate UUID format for agentId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(agentId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid agent ID format'
    });
  }

  // Validate phone number
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (!e164Regex.test(to)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid destination phone number. Must be in E.164 format'
    });
  }

  if (prompt && typeof prompt !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Prompt must be a string'
    });
  }

  next();
}

/**
 * Validate UUID parameter
 */
function validateUuidParam(paramName = 'id') {
  return (req, res, next) => {
    const uuid = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuid || !uuidRegex.test(uuid)) {
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format`
      });
    }

    next();
  };
}

/**
 * Validate pagination parameters
 */
function validatePagination(req, res, next) {
  const { limit, offset, page, pageSize } = req.query;

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

  if (page !== undefined) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Page must be a positive number'
      });
    }
  }

  if (pageSize !== undefined) {
    const pageSizeNum = parseInt(pageSize);
    if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Page size must be between 1 and 100'
      });
    }
  }

  next();
}

/**
 * Validate webhook payload
 */
function validateWebhook(req, res, next) {
  const { callId, status } = req.body;

  if (!callId) {
    return res.status(400).json({
      success: false,
      error: 'Call ID is required'
    });
  }

  if (status && !['queued', 'ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid call status'
    });
  }

  next();
}

module.exports = {
  validatePhoneNumber,
  validateAgentConfig,
  validateCallRequest,
  validateUuidParam,
  validatePagination,
  validateWebhook
};
