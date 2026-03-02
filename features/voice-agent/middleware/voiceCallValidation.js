/**
 * Voice Call Validation Middleware
 * 
 * LAD Architecture Compliant - Validates voice call prerequisites
 * 
 * VALIDATION PIPELINE:
 * 1. Feature access (voice-agent feature enabled)
 * 2. Business hours (configurable per tenant)
 * 3. Credit availability (minimum 3 credits for 1 minute call)
 * 4. Rate limiting (prevent abuse)
 * 
 * USAGE:
 * router.post('/calls/start-call',
 *   authenticateToken,
 *   validateVoiceCallPrerequisites,
 *   CallInitiationController.initiateCallV2
 * );
 */

const { getCreditBalance } = require('../../../shared/middleware/credit_guard');
const logger = require('../../../core/utils/logger');

/**
 * Business Hours Configuration per Tenant
 * Stored in metadata or environment variables
 * Format: { start: '09:00', end: '18:00', timezone: 'Asia/Dubai', days: [1,2,3,4,5] }
 */
const DEFAULT_BUSINESS_HOURS = {
  start: '19:00', // 9 AM
  end: '18:00',   // 6 PM
  timezone: 'Asia/Dubai',
  days: [0, 1, 2, 3, 4, 5] // Monday-Friday (0=Sunday, 6=Saturday)
};

const UAE_TIMEZONE = 'Asia/Dubai'; // UTC+4
const UAE_OFFSET_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

/**
 * Get timezone from request
 * Priority: 1. Request body (timezone), 2. Request headers (x-timezone), 3. User context (timezone), 4. Default to UTC
 * @param {Object} req - Express request object
 * @returns {string} Timezone identifier (e.g., 'America/New_York', 'Asia/Dubai')
 */
function getRequestTimezone(req) {
  try {
    // Priority 1: From request body
    if (req.body?.timezone) {
      return req.body.timezone;
    }

    // Priority 2: From request headers
    if (req.headers['x-timezone']) {
      return req.headers['x-timezone'];
    }

    // Priority 3: From user context/metadata
    if (req.user?.timezone) {
      return req.user.timezone;
    }

    // Priority 4: From cookies
    if (req.cookies?.timezone) {
      return req.cookies.timezone;
    }

    // Default to UTC if not provided
    logger.debug('[getRequestTimezone] No timezone found in request, defaulting to UTC');
    return 'UTC';
  } catch (error) {
    logger.error('[getRequestTimezone] Error extracting timezone', { error: error.message });
    return 'UTC';
  }
}

/**
 * Convert current time from any timezone to UAE time (Asia/Dubai)
 * @param {string} sourceTimezone - Source timezone (e.g., 'America/New_York', 'Asia/Kolkata')
 * @returns {Object} { uaeTime: Date, formattedTime: string, offset: number, sourceTimezone: string }
 */
function convertToUAETime(sourceTimezone = 'UTC') {
  try {
    // Create formatter to get time in source timezone
    const now = new Date();
    
    // Get offset of source timezone
    const sourceTime = new Date(now.toLocaleString('en-US', { timeZone: sourceTimezone }));
    const sourceOffset = (now - sourceTime) / (1000 * 60 * 60); // in hours

    // Get offset of UAE timezone
    const uaeTime = new Date(now.toLocaleString('en-US', { timeZone: UAE_TIMEZONE }));
    const uaeOffset = (now - uaeTime) / (1000 * 60 * 60); // in hours

    // Calculate difference
    const offsetDifference = (sourceOffset - uaeOffset); // hours
    
    // Create UAE time by adding the offset difference
    const convertedTime = new Date(now.getTime() + (offsetDifference * 60 * 60 * 1000));

    // Format the time
    const formattedOptions = {
      timeZone: UAE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };

    const formattedTime = new Date(convertedTime).toLocaleString('en-US', formattedOptions);

    return {
      uaeTime: convertedTime,
      formattedTime,
      sourceTimezone,
      uaeTimezone: UAE_TIMEZONE,
      offsetHours: sourceOffset - uaeOffset,
      timestamp: convertedTime.toISOString()
    };
  } catch (error) {
    logger.error('[convertToUAETime] Error converting timezone', { 
      sourceTimezone, 
      error: error.message 
    });
    return {
      uaeTime: new Date(),
      formattedTime: new Date().toISOString(),
      sourceTimezone,
      uaeTimezone: UAE_TIMEZONE,
      error: error.message
    };
  }
}

/**
 * Get current time in specific timezone
 * @param {string} timezone - Target timezone (e.g., 'America/New_York')
 * @returns {Object} { time: string, date: Date, timezone: string }
 */
function getCurrentTimeInTimezone(timezone = 'UTC') {
  try {
    const now = new Date();
    const options = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };

    const timeString = new Date(now.toLocaleString('en-US', options));
    
    return {
      time: now.toLocaleString('en-US', options),
      date: timeString,
      timezone,
      isoString: now.toISOString()
    };
  } catch (error) {
    logger.error('[getCurrentTimeInTimezone] Error getting time in timezone', {
      timezone,
      error: error.message
    });
    return {
      time: new Date().toISOString(),
      date: new Date(),
      timezone,
      error: error.message
    };
  }
}

/**
 * Check if current time is within business hours
 * @param {Object} config - Business hours configuration
 * @returns {Object} { withinHours: boolean, reason?: string }
 */
function isWithinBusinessHours(config = DEFAULT_BUSINESS_HOURS) {
  try {
    const now = new Date();
    
    // Check day of week
    const currentDay = now.getDay();
    if (!config.days.includes(currentDay)) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      return {
        withinHours: false,
        reason: `Calls are not allowed on ${dayNames[currentDay]}. Allowed days: ${config.days.map(d => dayNames[d]).join(', ')}`
      };
    }
    
    // Check time range
    // Convert to tenant timezone if needed (simplified - using system time for now)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    
    const [startHour, startMinute] = config.start.split(':').map(Number);
    const [endHour, endMinute] = config.end.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMinute;
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return {
        withinHours: false,
        reason: `Calls are only allowed between ${config.start} and ${config.end} (${config.timezone}). Current time: ${currentTime}`
      };
    }
    
    return { withinHours: true };
  } catch (error) {
    logger.error('[Business Hours] Error checking business hours', { error: error.message });
    // Fail open - allow calls if check fails
    return { withinHours: true };
  }
}

/**
 * Get business hours configuration for tenant
 * Can be extended to read from database per tenant
 */
async function getTenantBusinessHours(tenantId) {
  // TODO: Fetch from database tenant_settings table
  // For now, return default configuration
  // Future: SELECT business_hours FROM tenant_settings WHERE tenant_id = $1
  
  // Check environment variable override
  if (process.env.BUSINESS_HOURS_DISABLED === 'true') {
    return null; // Business hours check disabled
  }
  
  return DEFAULT_BUSINESS_HOURS;
}

/**
 * Minimum credits required for voice call (3 credits = 1 minute minimum)
 */
const MIN_CREDITS_FOR_CALL = 3;

/**
 * Middleware: Validate all prerequisites before initiating voice call
 */
const validateVoiceCallPrerequisites = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant context required',
        message: 'Unable to validate call prerequisites without tenant identification'
      });
    }

    logger.info('[Voice Call Validation] Starting prerequisites check', {
      tenantId,
      userId,
      toNumber: req.body?.to_number?.substring(0, 4) + '***'
    });

    // VALIDATION 1: Feature Access (voice-agent feature must be enabled)
    // Note: This should be handled by requireFeature middleware in routes
    // We'll add a safety check here as well
    const { FeatureFlagService } = require('../../../feature_flags/service');
    const featureFlagService = new FeatureFlagService();
    
    const hasVoiceFeature = await featureFlagService.isEnabled(tenantId, 'voice-agent', userId);
    if (!hasVoiceFeature) {
      logger.warn('[Voice Call Validation] Feature not enabled', { tenantId, feature: 'voice-agent' });
      return res.status(403).json({
        success: false,
        error: 'Voice calling feature not available',
        message: 'Your subscription plan does not include voice calling. Please upgrade to access this feature.',
        upgrade_required: true,
        feature: 'voice-agent'
      });
    }

    logger.debug('[Voice Call Validation] ✓ Feature access verified');

    // VALIDATION 2: Business Hours Check - Convert request timezone to UAE
    const requestTimezone = getRequestTimezone(req);
    const uaeTimeInfo = convertToUAETime(requestTimezone);
    
    logger.info('[Voice Call Validation] Timezone Information', {
      requestTimezone,
      uaeTime: uaeTimeInfo.formattedTime,
      offsetHours: uaeTimeInfo.offsetHours,
      requestTimestamp: new Date().toISOString()
    });
    
    const businessHours = await getTenantBusinessHours(tenantId);
    if (businessHours) {
      const { withinHours, reason } = isWithinBusinessHours(businessHours);
      if (!withinHours) {
        logger.warn('[Voice Call Validation] Outside business hours', { 
          tenantId, 
          reason,
          requestTimezone,
          uaeTime: uaeTimeInfo.formattedTime,
          businessHours 
        });
        return res.status(403).json({
          success: false,
          error: 'Outside business hours',
          message: reason,
          business_hours: {
            start: businessHours.start,
            end: businessHours.end,
            timezone: businessHours.timezone,
            allowed_days: businessHours.days
          },
          user_timezone: {
            requested: requestTimezone,
            uae_time: uaeTimeInfo.formattedTime,
            offset_from_uae: `${uaeTimeInfo.offsetHours > 0 ? '+' : ''}${uaeTimeInfo.offsetHours} hours`
          }
        });
      }
      logger.debug('[Voice Call Validation] ✓ Business hours validated');
    } else {
      logger.debug('[Voice Call Validation] Business hours check disabled');
    }

    // VALIDATION 3: Credit Balance Check
    const creditBalance = await getCreditBalance(tenantId);
    if (creditBalance < MIN_CREDITS_FOR_CALL) {
      logger.warn('[Voice Call Validation] Insufficient credits', { 
        tenantId, 
        balance: creditBalance, 
        required: MIN_CREDITS_FOR_CALL 
      });
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: `Voice calls require at least ${MIN_CREDITS_FOR_CALL} credits (1 minute minimum). Your current balance: ${creditBalance} credits.`,
        credits_required: MIN_CREDITS_FOR_CALL,
        credits_available: creditBalance,
        credits_needed: MIN_CREDITS_FOR_CALL - creditBalance,
        action: 'Please add credits to your account to make calls'
      });
    }

    logger.info('[Voice Call Validation] ✓ Credit balance sufficient', { 
      balance: creditBalance, 
      required: MIN_CREDITS_FOR_CALL 
    });

    // VALIDATION 4: Rate Limiting (Optional - can be added later)
    // TODO: Check max calls per hour/day per tenant
    // Example: SELECT COUNT(*) FROM call_logs WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 hour'

    // Attach validation metadata to request
    req.callValidation = {
      tenantId,
      userId,
      creditBalance,
      businessHoursChecked: !!businessHours,
      validatedAt: new Date().toISOString(),
      timezone: {
        requested: requestTimezone,
        uaeTime: uaeTimeInfo.formattedTime,
        uaeTimestamp: uaeTimeInfo.timestamp,
        offsetFromUAE: uaeTimeInfo.offsetHours
      }
    };

    logger.info('[Voice Call Validation] ✓ All prerequisites validated', {
      tenantId,
      creditBalance
    });

    next();
  } catch (error) {
    logger.error('[Voice Call Validation] Validation error', { 
      error: error.message, 
      stack: error.stack 
    });
    
    return res.status(500).json({
      success: false,
      error: 'Call validation failed',
      message: 'Unable to validate call prerequisites at this time',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  validateVoiceCallPrerequisites,
  isWithinBusinessHours,
  getTenantBusinessHours,
  getRequestTimezone,
  convertToUAETime,
  getCurrentTimeInTimezone,
  MIN_CREDITS_FOR_CALL,
  UAE_TIMEZONE,
  DEFAULT_BUSINESS_HOURS
};
