/**
 * Tenant Helpers
 * LAD-Compliant: Utility functions for tenant-specific operations
 */

const { query } = require('../../../shared/database/connection');

// Try core paths first, fallback to local shared
let DEFAULT_SCHEMA, logger;
try {
  ({ DEFAULT_SCHEMA } = require('../../../../core/utils/schemaHelper'));
  logger = require('../../../../core/utils/logger');
} catch (e) {
  ({ DEFAULT_SCHEMA } = require('../../../shared/utils/schemaHelper'));
  logger = require('../../../shared/utils/logger');
}

/**
 * Check if tenant has education vertical enabled
 * @param {string} tenantId - Tenant ID
 * @param {string} schema - Database schema (optional)
 * @returns {Promise<boolean>} True if education tenant
 */
async function isEducationTenant(tenantId, schema = DEFAULT_SCHEMA) {
  if (!tenantId) {
    throw new Error('tenantId is required for isEducationTenant');
  }

  try {
    logger.debug('Checking if tenant is education vertical', { tenantId });

    // Check if vertical column exists first
    const columnCheckSql = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = $1 
        AND table_name = 'tenants' 
        AND column_name = 'vertical'
    `;
    
    const columnCheck = await query(columnCheckSql, [schema]);
    const hasVerticalColumn = columnCheck.rows.length > 0;

    // Option 1: Check tenants.vertical column (if exists)
    if (hasVerticalColumn) {
      const sql = `
        SELECT vertical, settings 
        FROM ${schema}.tenants 
        WHERE id = $1 AND is_deleted = false
      `;
      
      const result = await query(sql, [tenantId]);
      const tenant = result.rows[0];
      
      if (!tenant) {
        logger.warn('Tenant not found', { tenantId });
        return false;
      }

      // Check if vertical is explicitly set to 'education'
      if (tenant.vertical === 'education') {
        logger.debug('Tenant is education vertical (by vertical column)', { tenantId });
        return true;
      }

      // Option 2: Check settings.vertical field (if stored in JSONB)
      if (tenant.settings && tenant.settings.vertical === 'education') {
        logger.debug('Tenant is education vertical (by settings)', { tenantId });
        return true;
      }
    }

    // Option 3: Check tenant_features table (if using feature flags)
    const featureSql = `
      SELECT enabled 
      FROM ${schema}.tenant_features
      WHERE tenant_id = $1 
        AND feature_key = 'education_vertical'
        AND is_deleted = false
    `;
    
    const featureResult = await query(featureSql, [tenantId]);
    
    if (featureResult.rows[0]?.enabled === true) {
      logger.debug('Tenant is education vertical (by feature flag)', { tenantId });
      return true;
    }

    // Development fallback: If no vertical configuration found, enable for development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Tenant education vertical enabled (development mode)', { tenantId });
      return true;
    }

    logger.debug('Tenant is NOT education vertical', { tenantId });
    return false;
  } catch (error) {
    logger.error('Error checking education tenant', { tenantId, error: error.message });
    
    // In development, be permissive
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Allowing education vertical in development despite error', { tenantId });
      return true;
    }
    
    throw error;
  }
}

/**
 * Get tenant vertical type
 * @param {string} tenantId - Tenant ID
 * @param {string} schema - Database schema (optional)
 * @returns {Promise<string|null>} Vertical name (e.g., 'education', 'real_estate', 'healthcare') or null
 */
async function getTenantVertical(tenantId, schema = DEFAULT_SCHEMA) {
  if (!tenantId) {
    throw new Error('tenantId is required for getTenantVertical');
  }

  try {
    // Check if vertical column exists
    const columnCheckSql = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = $1 
        AND table_name = 'tenants' 
        AND column_name = 'vertical'
    `;
    
    const columnCheck = await query(columnCheckSql, [schema]);
    const hasVerticalColumn = columnCheck.rows.length > 0;

    if (hasVerticalColumn) {
      const sql = `
        SELECT vertical, settings 
        FROM ${schema}.tenants 
        WHERE id = $1 AND is_deleted = false
      `;
      
      const result = await query(sql, [tenantId]);
      const tenant = result.rows[0];
      
      if (!tenant) {
        return null;
      }

      // Check vertical column first
      if (tenant.vertical) {
        return tenant.vertical;
      }

      // Check settings.vertical as fallback
      if (tenant.settings && tenant.settings.vertical) {
        return tenant.settings.vertical;
      }
    }

    // Development fallback
    if (process.env.NODE_ENV === 'development') {
      return 'education'; // Default to education in dev
    }

    return null;
  } catch (error) {
    logger.error('Error getting tenant vertical', { tenantId, error: error.message });
    
    // Development fallback
    if (process.env.NODE_ENV === 'development') {
      return 'education';
    }
    
    throw error;
  }
}

/**
 * Check if tenant has a specific feature enabled
 * @param {string} tenantId - Tenant ID
 * @param {string} featureKey - Feature key (e.g., 'education_vertical', 'advanced_analytics')
 * @param {string} schema - Database schema (optional)
 * @returns {Promise<boolean>} True if feature is enabled
 */
async function hasTenantFeature(tenantId, featureKey, schema = DEFAULT_SCHEMA) {
  if (!tenantId || !featureKey) {
    throw new Error('tenantId and featureKey are required for hasTenantFeature');
  }

  try {
    const sql = `
      SELECT enabled 
      FROM ${schema}.tenant_features
      WHERE tenant_id = $1 
        AND feature_key = $2
        AND is_deleted = false
    `;
    
    const result = await query(sql, [tenantId, featureKey]);
    
    return result.rows[0]?.enabled === true;
  } catch (error) {
    logger.error('Error checking tenant feature', { 
      tenantId, 
      featureKey, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Get all enabled features for a tenant
 * @param {string} tenantId - Tenant ID
 * @param {string} schema - Database schema (optional)
 * @returns {Promise<string[]>} Array of enabled feature keys
 */
async function getTenantFeatures(tenantId, schema = DEFAULT_SCHEMA) {
  if (!tenantId) {
    throw new Error('tenantId is required for getTenantFeatures');
  }

  try {
    const sql = `
      SELECT feature_key 
      FROM ${schema}.tenant_features
      WHERE tenant_id = $1 
        AND enabled = true
        AND is_deleted = false
    `;
    
    const result = await query(sql, [tenantId]);
    
    return result.rows.map(row => row.feature_key);
  } catch (error) {
    logger.error('Error getting tenant features', { tenantId, error: error.message });
    throw error;
  }
}

/**
 * Validate tenant has access to education features
 * Throws error if not authorized
 * @param {string} tenantId - Tenant ID
 * @param {string} schema - Database schema (optional)
 * @throws {Error} If tenant doesn't have education access
 */
async function requireEducationTenant(tenantId, schema = DEFAULT_SCHEMA) {
  const isEducation = await isEducationTenant(tenantId, schema);
  
  if (!isEducation) {
    const error = new Error('Education vertical not enabled for this tenant');
    error.code = 'EDUCATION_NOT_ENABLED';
    error.statusCode = 403;
    throw error;
  }
}

module.exports = {
  isEducationTenant,
  getTenantVertical,
  hasTenantFeature,
  getTenantFeatures,
  requireEducationTenant,
};
