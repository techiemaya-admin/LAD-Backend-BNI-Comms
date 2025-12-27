/**
 * Schema Helper - Dynamic schema resolution for multi-tenant support
 * 
 * Usage:
 *   const { getSchema } = require('../../../../core/utils/schemaHelper');
 *   const schema = getSchema(req);
 *   await pool.query(`SELECT * FROM ${schema}.campaigns WHERE id = $1`, [id]);
 */

/**
 * Get the database schema for the current request/context
 * Priority: req.user.schema > tenant.schema > env variable > default
 * 
 * @param {Object} req - Express request object (optional)
 * @param {Object} options - Override options
 * @returns {string} Schema name
 */
function getSchema(req = null, options = {}) {
  // 1. Check explicit override
  if (options.schema) {
    return options.schema;
  }

  // 2. Check request user object (most common in authenticated routes)
  if (req?.user?.schema) {
    return req.user.schema;
  }

  // 3. Check tenant object (if passed separately)
  if (req?.tenant?.schema) {
    return req.tenant.schema;
  }

  // 4. Check environment variable
  if (process.env.DB_SCHEMA) {
    return process.env.DB_SCHEMA;
  }

  // 5. Default to lad_dev for development
  return 'lad_dev';
}

/**
 * Build a table reference with schema
 * 
 * @param {string} tableName - Table name without schema
 * @param {Object} req - Express request object (optional)
 * @returns {string} Fully qualified table name (schema.table)
 */
function getTable(tableName, req = null) {
  const schema = getSchema(req);
  return `${schema}.${tableName}`;
}

/**
 * Sanitize schema name to prevent SQL injection
 * 
 * @param {string} schema - Schema name to sanitize
 * @returns {string} Sanitized schema name
 */
function sanitizeSchema(schema) {
  // Only allow alphanumeric and underscore
  return schema.replace(/[^a-zA-Z0-9_]/g, '');
}

module.exports = {
  getSchema,
  getTable,
  sanitizeSchema
};
