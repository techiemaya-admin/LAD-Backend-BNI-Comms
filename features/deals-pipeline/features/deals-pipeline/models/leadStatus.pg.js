// PostgreSQL Lead Statuses Model
const { query: poolQuery } = require('../../../shared/database/connection');

async function getAllLeadStatuses() {
  const result = await poolQuery('SELECT key, label FROM lead_statuses');
  return result.rows;
}

module.exports = {
  getAllLeadStatuses,
};
