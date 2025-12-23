// Minimal Lead Model for deals-pipeline
const { query } = require('../../../shared/database/connection');

// Get all leads
async function getAllLeads(organizationId, filters = {}) {
  let sql = `
    SELECT l.*
    FROM lad_dev.leads l
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
  const sql = 'SELECT * FROM lad_dev.leads WHERE id = $1 AND is_deleted = FALSE';
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

// Create new lead
async function createLead(leadData) {
  const sql = `
    INSERT INTO lad_dev.leads (name, email, phone, company, stage, status, source, priority, value)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  const params = [
    leadData.name,
    leadData.email || null,
    leadData.phone || null,
    leadData.company || null,
    leadData.stage || 'new',
    leadData.status || 'active',
    leadData.source || null,
    leadData.priority || 'medium',
    leadData.value || null
  ];
  const result = await query(sql, params);
  return result.rows[0];
}

// Update lead
async function updateLead(id, leadData) {
  const fields = [];
  const params = [];
  let paramIndex = 1;

  Object.keys(leadData).forEach(key => {
    if (leadData[key] !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      params.push(leadData[key]);
      paramIndex++;
    }
  });

  if (fields.length === 0) return getLeadById(id);

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const sql = `
    UPDATE lad_dev.leads 
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex} AND is_deleted = FALSE
    RETURNING *
  `;
  
  const result = await query(sql, params);
  return result.rows[0];
}

// Delete lead (soft delete)
async function deleteLead(id) {
  const sql = 'UPDATE lad_dev.leads SET is_deleted = TRUE WHERE id = $1 RETURNING *';
  const result = await query(sql, [id]);
  return result.rows[0];
}

// Get conversion stats
async function getLeadConversionStats() {
  const sql = `
    SELECT 
      stage,
      COUNT(*) as count,
      SUM(value) as total_value
    FROM lad_dev.leads
    WHERE is_deleted = FALSE
    GROUP BY stage
  `;
  const result = await query(sql);
  return result.rows;
}

module.exports = {
  getAllLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getLeadConversionStats
};