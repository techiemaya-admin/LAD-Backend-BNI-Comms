// PostgreSQL Lead Statuses Model - LAD Architecture Compliant
const { query: poolQuery } = require('../../../shared/database/connection');

// Try core paths first, fallback to local shared
let DEFAULT_SCHEMA, logger;
try {
  ({ DEFAULT_SCHEMA } = require('../../../../core/utils/schemaHelper'));
  logger = require('../../../../core/utils/logger');
} catch (e) {
  ({ DEFAULT_SCHEMA } = require('../../../shared/utils/schemaHelper'));
  logger = require('../../../shared/utils/logger');
}

async function getAllLeadStatuses(tenant_id, schema = DEFAULT_SCHEMA) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getAllLeadStatuses');
  }

  const result = await poolQuery(
    `SELECT key, label FROM ${schema}.lead_statuses WHERE tenant_id = $1 OR tenant_id IS NULL ORDER BY label`,
    [tenant_id]
  );
  return result.rows;
}

module.exports = {
  getAllLeadStatuses,
};
