/**
 * Deals Pipeline Auth Middleware
 * 
 * Note: Core JWT authentication is already applied globally in core/app.js
 * This middleware is just a pass-through since req.user is already set
 */

const jwtAuth = (req, res, next) => {
  // User is already authenticated by core middleware
  // req.user is already populated with: userId, email, role, tenantId
  
  if (!req.user) {
    console.error('[Deals-Pipeline Auth] No user found - core auth middleware may have failed');
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  
  console.log('[Deals-Pipeline Auth] User authenticated:', req.user.userId, req.user.email);
  next();
};

module.exports = { jwtAuth };
