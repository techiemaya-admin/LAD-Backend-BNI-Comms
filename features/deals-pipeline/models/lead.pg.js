// Minimal Lead Model for deals-pipeline
const { query } = require('../../../shared/database/connection');

// Get all leads
async function getAllLeads(organizationId, filters = {}) {
  let sql = `
    SELECT l.*
    FROM leads l
    WHERE l.is_deleted = FALSE
  `;
  let params = [];
  let paramIndex = 1; 

  // Add organization filter if provided
  if (organizationId) {
    sql += ` AND l.organization_id = $${paramIndex}`;
    params.push(organizationId);
    paramIndex++;
  }

  // Add filters
  if (filters.stage) {
    sql += ` AND l.stage = $${paramIndex}`;
    params.push(filters.stage);
    paramIndex++;
  }
  if (filters.status) {
    sql += ` AND l.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  sql += ' ORDER BY l.created_at DESC';
  
  const result = await query(sql, params);
  return result.rows.map(lead => ({
    ...lead,
    tags: [] // Simple implementation for now
  }));
}

// Get lead by ID
async function getLeadById(id) {
  const sql = 'SELECT * FROM leads WHERE id = $1 AND is_deleted = FALSE';
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

module.exports = {
  getAllLeads,
  getLeadById
};