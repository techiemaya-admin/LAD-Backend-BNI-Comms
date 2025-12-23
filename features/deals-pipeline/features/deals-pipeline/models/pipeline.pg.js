// Pipeline-Specific Model - Optimized queries for pipeline board functionality
const { query: poolQuery } = require('../../../shared/database/connection');
const Lead = require('./lead.pg.js');

// ========================
// STAGE OPERATIONS
// ========================
async function getAllStages(organizationId) {
  const result = await poolQuery(
    `
SELECT DISTINCT ON (key)
  key,
  label,
  display_order
FROM lad_dev.lead_stages
WHERE tenant_id = $1 OR tenant_id IS NULL
ORDER BY
  key,
  tenant_id DESC NULLS LAST,
  display_order;

    `,
    [organizationId]
  );
  return result.rows;
}


async function createStage(key, label, displayOrder, organizationId) {
  const result = await poolQuery(
    'INSERT INTO lad_dev.lead_stages (key, label, display_order, tenant_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [key, label, displayOrder, organizationId]
  );
  return result.rows[0];
}

async function updateStage(key, label, displayOrder) {
  const result = await poolQuery(
    'UPDATE lad_dev.lead_stages SET label = $1, display_order = $2 WHERE key = $3 RETURNING *',
    [label, displayOrder, key]
  );
  return result.rows[0];
}

async function deleteStage(key) {
  await poolQuery('DELETE FROM lad_dev.lead_stages WHERE key = $1', [key]);
  return true;
}

// ========================
// PIPELINE-SPECIFIC LEAD QUERIES
// ========================
async function getLeadsForPipeline(organizationId) {
  // Optimized query for pipeline board - includes counts but not full related data
  const query = `
    SELECT 
      l.*,
      COUNT(DISTINCT lt.tag) as tags_count,
      COUNT(DISTINCT ln.id) as notes_count,
      COUNT(DISTINCT lc.id) as comments_count,
      COUNT(DISTINCT la.id) as attachments_count,
      ls.linkedin, ls.whatsapp, ls.instagram, ls.facebook,
      COALESCE(MAX(ln.created_at), MAX(lc.created_at), l.last_activity, l.created_at) as latest_activity
    FROM lad_dev.leads l
    LEFT JOIN lead_tags lt ON l.id = lt.lead_id
    LEFT JOIN lead_notes ln ON l.id = ln.lead_id
    LEFT JOIN lead_comments lc ON l.id = lc.lead_id
    LEFT JOIN lead_attachments la ON l.id = la.lead_id
    LEFT JOIN lead_social ls ON l.id = ls.lead_id
    WHERE l.tenant_id = $1 AND l.is_deleted = FALSE
    GROUP BY l.id, ls.linkedin, ls.whatsapp, ls.instagram, ls.facebook
    ORDER BY l.stage, l.created_at DESC
  `;
  const result = await poolQuery(query, [organizationId]);
  return result.rows;
}

// async function updateLeadStage(id, newStage) {
//   // Auto-update status based on stage for pipeline movement
//   let status = 'qualified'; // Default to 'qualified' instead of 'active'
//   if (newStage === 'won') status = 'won';
//   if (newStage === 'lost') status = 'lost';
//   if (newStage === 'new' || newStage === 'prospect') status = 'new';
//   if (newStage === 'contacted' || newStage === 'contact') status = 'contacted';

//   const result = await poolQuery(
//     'UPDATE leads SET stage = $1, status = $2, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
//     [newStage, status, id]
//   );
//   return result.rows[0];
// }


async function updateLeadStage(studentId, newStage) {
  let status = 'new';

  if (newStage === 'contact_made') status = 'contact_made';
  if (newStage === 'counselling_session_booked') status = 'in_progress';
  if (newStage === 'counselling_session_completed') status = 'qualified';
  if (newStage === 'won') status = 'won';
  if (newStage === 'abandoned') status = 'abandoned';

  const { rowCount, rows, result } = await poolQuery(
    `
    UPDATE voice_agent.students_voiceagent
    SET
      stage = $1,
      status = $2
    WHERE id = $3
    RETURNING *
    `,
    [newStage, status, studentId]
  );

  if (rowCount === 0) return null;
  return result.rows[0];
}




// async function updateLeadStatus(id, newStatus) {
//   // Validate status exists in lead_statuses table
//   const statusCheck = await poolQuery('SELECT key FROM lead_statuses WHERE key = $1', [newStatus]);
//   if (statusCheck.result.rows.length === 0) {
//     throw new Error(`Invalid status: ${newStatus}`);
//   }

//   const result = await poolQuery(
//     'UPDATE leads SET status = $1, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
//     [newStatus, id]
//   );
//   return result.rows[0];
// }


async function updateLeadStatus(studentId, newStatus) {
  const check = await poolQuery(
    `SELECT 1 FROM lad_dev.lead_statuses WHERE key = $1`,
    [newStatus]
  );

  if (!check.rowCount) {
    throw new Error('Invalid status');
  }

  const { rowCount, rows, result} = await poolQuery(
    `
    UPDATE voice_agent.students_voiceagent
    SET status = $1
    WHERE id = $2
    RETURNING *
    `,
    [newStatus, studentId]
  );

  if (rowCount === 0) return null;
  return result.rows[0];
}




async function getPipelineOverview(organizationId) {
  // Get stages with lead counts and values
  const query = `
    SELECT 
      ls.key, 
      ls.label, 
      ls.display_order,
      COUNT(l.id) as lead_count,
      COALESCE(SUM(l.amount), 0) as total_value,
      COALESCE(AVG(l.amount), 0) as avg_value
    FROM lad_dev.lead_stages ls
    LEFT JOIN lad_dev.leads l ON ls.key = l.stage AND l.tenant_id = $1 AND l.is_deleted = FALSE
    WHERE ls.tenant_id = $1 OR ls.tenant_id IS NULL
    GROUP BY ls.key, ls.label, ls.display_order
    ORDER BY ls.display_order
  `;
  const result = await poolQuery(query, [organizationId]);
  return result.rows;
}


// ========================
// PIPELINE BOARD COMPLETE DATA
// ========================
async function getPipelineBoard(organizationId) {
  // Get stages and leads together for complete pipeline board
  const [stages, leads] = await Promise.all([
    getAllStages(organizationId),
    getLeadsForPipeline(organizationId)
  ]);

  // Group leads by stage
  const leadsByStage = leads.reduce((acc, lead) => {
    if (!acc[lead.stage]) acc[lead.stage] = [];
    acc[lead.stage].push(lead);
    return acc;
  }, {});

  // Combine stages with their leads
  const pipeline = stages.map(stage => ({
    ...stage,
    leads: leadsByStage[stage.key] || [],
    count: (leadsByStage[stage.key] || []).length,
    total_value: (leadsByStage[stage.key] || []).reduce((sum, lead) => sum + (lead.amount || 0), 0)
  }));

  return {
    stages: pipeline,
    summary: {
      total_leads: leads.length,
      total_value: leads.reduce((sum, lead) => sum + (lead.amount || 0), 0),
      active_deals: leads.filter(l => l.status === 'active').length,
      won_deals: leads.filter(l => l.status === 'won').length
    }
  };
}

// ========================
// MASTER DATA FOR DROPDOWNS
// ========================
async function getAllStatuses() {
  const result = await poolQuery(
    `
    SELECT key, label
    FROM lad_dev.lead_statuses
    ORDER BY label
    `
  );
  return result.rows;
}


async function getAllSources() {
  const result = await poolQuery('SELECT key, label FROM lad_dev.lead_sources ORDER BY label');
  return result.rows;
}

async function getAllPriorities() {
  const result = await poolQuery('SELECT key, label FROM lad_dev.lead_priorities ORDER BY key');
  return result.rows;
}

module.exports = {
  // Stage management
  getAllStages,
  createStage,
  updateStage,
  deleteStage,
  
  // Pipeline-specific lead operations
  getLeadsForPipeline,
  updateLeadStage,
  updateLeadStatus,
  getPipelineOverview,
  getPipelineBoard,
  
  // Master data
  getAllStatuses,
  getAllSources,
  getAllPriorities,
  
  // Re-export lead operations for convenience
  createLead: Lead.createLead,
  updateLead: Lead.updateLead,
  deleteLead: Lead.deleteLead,
  getLeadById: Lead.getLeadById
};
