// Adapter helper for resolving database schema in the voice-agent feature.
// This file is intentionally lightweight and is allowed per LAD_Architecture
// as an adapter that delegates to core/shared infra when available.

let coreSchemaHelper = null;
try {
  // Attempt to load LAD core/shared schema helper if present in host app
  // The host LAD app can alias this path as needed.
  // From backend/features/voice-agent/utils -> project root /core/utils
  // eslint-disable-next-line global-require, import/no-unresolved
  coreSchemaHelper = require('../../../../core/utils/schemaHelper');
} catch (e) {
  coreSchemaHelper = null;
}

/**
 * Resolve database schema for a request in a multi-tenant environment.
 *
 * Priority:
 * - Delegate to core helper if available (getSchemaFromRequest or getSchema)
 * - req.user.schema (preferred)
 * - req.tenantSchema (set by middleware)
 * - process.env.DEFAULT_DB_SCHEMA or process.env.DB_SCHEMA (fallback)
 *
 * This function MUST NOT hardcode any schema name like `lad_dev`.
 */
function getSchemaFromRequest(req) {
  // 1. Delegate to core helper if present
  if (coreSchemaHelper) {
    if (typeof coreSchemaHelper.getSchemaFromRequest === 'function') {
      return coreSchemaHelper.getSchemaFromRequest(req);
    }

    if (typeof coreSchemaHelper.getSchema === 'function') {
      return coreSchemaHelper.getSchema(req);
    }
  }

  // 2. Use schema on authenticated user if present
  if (req && req.user && req.user.schema) {
    return req.user.schema;
  }

  // 3. Use schema set by tenant middleware if present
  if (req && req.tenantSchema) {
    return req.tenantSchema;
  }

  // 4. Environment fallbacks (feature-level, no hardcoded schema)
  if (process.env.DEFAULT_DB_SCHEMA) {
    return process.env.DEFAULT_DB_SCHEMA;
  }

  if (process.env.DB_SCHEMA) {
    return process.env.DB_SCHEMA;
  }

  // 5. If we still cannot resolve, fail fast
  throw new Error('Database schema could not be resolved for request');
}

module.exports = {
  getSchemaFromRequest,
};
