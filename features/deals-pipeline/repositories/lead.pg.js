// Lead Repository for deals-pipeline - LAD Architecture Compliant
const { query } = require('../../../shared/database/connection');
const leadDTO = require('../dtos/lead.dto');

// Try core paths first, fallback to local shared
let DEFAULT_SCHEMA, logger;
try {
  ({ DEFAULT_SCHEMA } = require('../../../../core/utils/schemaHelper'));
  logger = require('../../../../core/utils/logger');
} catch (e) {
  ({ DEFAULT_SCHEMA } = require('../../../shared/utils/schemaHelper'));
  logger = require('../../../shared/utils/logger');
}

// Use DTO functions for field mapping
const mapFieldsToDB = leadDTO.toDatabase;
const mapFieldsFromDB = leadDTO.fromDatabase;

// Get all leads
async function getAllLeads(tenant_id, schema = DEFAULT_SCHEMA, filters = {}) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getAllLeads');
  }

  let sql = `
    SELECT l.*
    FROM ${schema}.leads l
    WHERE l.tenant_id = $1 AND l.is_deleted = FALSE
  `;
  let params = [tenant_id];
  let paramIndex = 2;

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
    ...mapFieldsFromDB(lead),
    tags: lead.tags || [] // Use existing tags from DB
  }));
}

// Get lead by ID
async function getLeadById(id, tenant_id, schema = DEFAULT_SCHEMA) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getLeadById');
  }

  // Get lead details
  const leadSql = `SELECT * FROM ${schema}.leads WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`;
  const leadResult = await query(leadSql, [id, tenant_id]);
  const lead = leadResult.rows[0];
  
  if (!lead) return null;

  // Get bookings for this lead
  const bookingsSql = `
    SELECT 
      id,
      booking_type,
      booking_source,
      scheduled_at,
      status,
      assigned_user_id,
      timezone,
      call_result,
      retry_count,
      parent_booking_id,
      notes,
      created_at
    FROM ${schema}.lead_bookings
    WHERE lead_id = $1 AND tenant_id = $2
    ORDER BY scheduled_at DESC
  `;
  const bookingsResult = await query(bookingsSql, [id, tenant_id]);
  
  // Separate current and past bookings
  const now = new Date();
  const bookings = bookingsResult.rows.map(b => ({
    id: b.id,
    booking_type: b.booking_type,
    booking_source: b.booking_source,
    scheduled_at: b.scheduled_at,
    status: b.status,
    assigned_user_id: b.assigned_user_id,
    timezone: b.timezone,
    call_result: b.call_result,
    retry_count: b.retry_count || 0,
    parent_booking_id: b.parent_booking_id,
    notes: b.notes,
    created_at: b.created_at,
    is_past: new Date(b.scheduled_at) < now
  }));

  const currentBookings = bookings.filter(b => !b.is_past);
  const pastBookings = bookings.filter(b => b.is_past);

  // Map lead fields and add bookings
  const mappedLead = mapFieldsFromDB(lead);
  mappedLead.bookings = {
    current: currentBookings,
    past: pastBookings
  };

  return mappedLead;
}

// Create new lead
async function createLead(leadData, tenant_id, schema = DEFAULT_SCHEMA) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for createLead');
  }

  const sql = `
    INSERT INTO ${schema}.leads (
      tenant_id, first_name, email, phone, company_name, stage, status, 
      source, priority, estimated_value
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;
  const params = [
    tenant_id,
    leadData.name || '',
    leadData.email || null,
    leadData.phone || null,
    leadData.company || null,
    leadData.stage || 'new',
    leadData.status || 'active',
    leadData.source || null,
    PRIORITY_TO_INT[leadData.priority] || 2, // Convert to integer, default to medium (2)
    leadData.value || null
  ];
  const result = await query(sql, params);
  return mapFieldsFromDB(result.rows[0]);
}

// Update lead
async function updateLead(id, tenant_id, leadData, schema = DEFAULT_SCHEMA) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for updateLead');
  }

  // Map API fields to database columns
  const mappedData = mapFieldsToDB(leadData);
  
  const fields = [];
  const params = [];
  let paramIndex = 1;

  Object.keys(mappedData).forEach(key => {
    if (mappedData[key] !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      params.push(mappedData[key]);
      paramIndex++;
    }
  });

  if (fields.length === 0) return getLeadById(id, tenant_id, schema);

  fields.push(`updated_at = NOW()`);
  params.push(id);
  const idIndex = paramIndex;
  paramIndex++;
  
  params.push(tenant_id);
  const tenantIndex = paramIndex;

  const sql = `
    UPDATE ${schema}.leads 
    SET ${fields.join(', ')}
    WHERE id = $${idIndex} AND tenant_id = $${tenantIndex} AND is_deleted = FALSE
    RETURNING *
  `;
  
  const result = await query(sql, params);
  return mapFieldsFromDB(result.rows[0]);
}

// Delete lead (soft delete)
async function deleteLead(id, tenant_id, schema = DEFAULT_SCHEMA) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for deleteLead');
  }

  const sql = `UPDATE ${schema}.leads SET is_deleted = TRUE WHERE id = $1 AND tenant_id = $2 RETURNING *`;
  const result = await query(sql, [id, tenant_id]);
  return mapFieldsFromDB(result.rows[0]);
}

// Get conversion stats
async function getLeadConversionStats(tenant_id, schema = DEFAULT_SCHEMA) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getLeadConversionStats');
  }

  const sql = `
    SELECT 
      stage,
      COUNT(*) as count,
      COALESCE(SUM(estimated_value), 0) as total_value
    FROM ${schema}.leads
    WHERE tenant_id = $1 AND is_deleted = FALSE
    GROUP BY stage
  `;
  const result = await query(sql, [tenant_id]);
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