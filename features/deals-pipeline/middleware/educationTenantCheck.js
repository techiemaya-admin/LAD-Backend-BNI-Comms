/**
 * Education Features Middleware
 * 
 * Uses feature flags to restrict access to student and counsellor features
 * Feature flags are set per-tenant in the database, not hardcoded
 */

const { FeatureFlagService } = require('../../../feature_flags/service');
const featureFlagService = new FeatureFlagService();

/**
 * Middleware to check if the tenant has student features enabled
 * Checks the 'education-students' feature flag
 */
const requireStudentsFeature = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const tenantId = req.user.tenantId || req.user.tenant_id;
  const userId = req.user.id || req.user.userId;
  
  try {
    const isEnabled = await featureFlagService.isEnabled(tenantId, 'education-students', userId);
    
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Feature not available',
        message: 'Student features are not enabled for your organization',
        featureRequired: 'education-students'
      });
    }
    
    next();
  } catch (error) {
    console.error('[educationTenantCheck] Error checking students feature:', error);
    return res.status(500).json({
      success: false,
      error: 'Error checking feature access'
    });
  }
};

/**
 * Middleware to check if the tenant has counsellor features enabled
 * Checks the 'education-counsellors' feature flag
 */
const requireCounsellorsFeature = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const tenantId = req.user.tenantId || req.user.tenant_id;
  const userId = req.user.id || req.user.userId;
  
  try {
    const isEnabled = await featureFlagService.isEnabled(tenantId, 'education-counsellors', userId);
    
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Feature not available',
        message: 'Counsellor features are not enabled for your organization',
        featureRequired: 'education-counsellors'
      });
    }
    
    next();
  } catch (error) {
    console.error('[educationTenantCheck] Error checking counsellors feature:', error);
    return res.status(500).json({
      success: false,
      error: 'Error checking feature access'
    });
  }
};

/**
 * Middleware to check if tenant has either students OR counsellors feature
 * (for routes that need access to either)
 */
const requireEducationFeatures = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const tenantId = req.user.tenantId || req.user.tenant_id;
  const userId = req.user.id || req.user.userId;
  
  try {
    const [studentsEnabled, counsellorsEnabled] = await Promise.all([
      featureFlagService.isEnabled(tenantId, 'education-students', userId),
      featureFlagService.isEnabled(tenantId, 'education-counsellors', userId)
    ]);
    
    if (!studentsEnabled && !counsellorsEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Feature not available',
        message: 'Education features are not enabled for your organization'
      });
    }
    
    next();
  } catch (error) {
    console.error('[educationTenantCheck] Error checking education features:', error);
    return res.status(500).json({
      success: false,
      error: 'Error checking feature access'
    });
  }
};

module.exports = {
  requireStudentsFeature,
  requireCounsellorsFeature,
  requireEducationFeatures
};
