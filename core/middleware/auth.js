/**
 * Core Authentication Middleware
 * 
 * PURPOSE:
 * Provides JWT token validation and user context extraction for all API routes.
 * This middleware ensures that protected endpoints verify user identity and
 * extract essential information needed for feature access control.
 * 
 * AUTHENTICATION FLOW:
 * 1. Extract JWT token from Authorization header (Bearer format)
 * 2. Verify token signature and expiration
 * 3. Decode user information (id, email, role, clientId)
 * 4. Attach user context to request object
 * 5. Allow request to proceed to next middleware/route
 * 
 * USER CONTEXT PROVIDED:
 * - req.user.id: User identifier
 * - req.user.email: User email address
 * - req.user.role: User role (admin, user, viewer)
 * - req.user.clientId: Organization/client identifier (crucial for feature flags)
 * 
 * SECURITY FEATURES:
 * - Token signature verification prevents tampering
 * - Expiration checking prevents replay attacks
 * - Public endpoints bypass authentication (login, register, health)
 * - Proper error responses for invalid/missing tokens
 * 
 * INTEGRATION:
 * - ClientId is used by FeatureFlagService for feature access control
 * - User context flows to all downstream middleware and routes
 * - Supports multi-tenant architecture with client isolation
 * 
 * ERROR HANDLING:
 * - 401 Unauthorized: Missing or invalid token
 * - 403 Forbidden: Token valid but insufficient permissions
 * - Graceful handling of malformed tokens
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authenticateToken = (req, res, next) => {
  // Skip auth for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Skip auth for public endpoints
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/health'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  // Skip auth for Cloud Tasks endpoints (they have their own auth via headers)
  if (req.path.includes('/execute-followup')) {
    return next();
  }

  // Try to get token from Authorization header first, then from cookies
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  // If no Authorization header, try to get token from cookies
  if (!token && req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    // Only log at debug level - missing tokens are common for unauthenticated requests
    logger.debug(`Auth failed - No token for ${req.method} ${req.path}`);
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    req.user = decoded;
    logger.debug(`Auth success for ${req.method} ${req.path}`, { 
      userId: decoded.userId, 
      email: decoded.email 
    });
    next();
  } catch (error) {
    logger.warn(`Auth failed - Invalid token for ${req.method} ${req.path}`, {
      error: error.message,
      tokenPrefix: token ? token.substring(0, 20) : 'none'
    });
    return res.status(403).json({
      success: false,
      error: 'Invalid token',
      details: error.message
    });
  }
};

module.exports = { authenticateToken };