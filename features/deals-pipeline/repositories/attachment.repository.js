/**
 * Attachment Repository - LAD Architecture Compliant
 * Data access layer for lead attachments and notes
 */

const db = require('../../../shared/database/connection');

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
 * Get all notes for a lead
 */
exports.getNotesByLead = async (leadId, tenant_id, schema = DEFAULT_SCHEMA) => {
  const query = `
    SELECT * FROM ${schema}.lead_notes
    WHERE lead_id = $1 AND tenant_id = $2 AND is_deleted = FALSE
    ORDER BY created_at DESC
  `;
  const result = await db.query(query, [leadId, tenant_id]);
  return result.rows;
};

/**
 * Create a new note for a lead
 */
exports.createNote = async (leadId, noteData, tenant_id, schema = DEFAULT_SCHEMA) => {
  const { content, created_by } = noteData;
  const query = `
    INSERT INTO ${schema}.lead_notes (tenant_id, lead_id, content, created_by, created_at, metadata)
    VALUES ($1, $2, $3, $4, NOW(), '{}'::jsonb)
    RETURNING *
  `;
  const result = await db.query(query, [tenant_id, leadId, content, created_by]);
  return result.rows[0];
};

/**
 * Soft delete a note
 */
exports.deleteNote = async (noteId, leadId, tenant_id, schema = DEFAULT_SCHEMA) => {
  const query = `
    UPDATE ${schema}.lead_notes
    SET is_deleted = TRUE, updated_at = NOW()
    WHERE id = $1 AND lead_id = $2 AND tenant_id = $3
  `;
  await db.query(query, [noteId, leadId, tenant_id]);
};

/**
 * Create a new attachment record for a lead
 */
exports.createAttachment = async ({ tenant_id, schema = DEFAULT_SCHEMA, leadId, file_url, file_name, file_type, file_size, uploaded_by }) => {
  const query = `
    INSERT INTO ${schema}.lead_attachments 
    (tenant_id, lead_id, file_url, file_name, file_type, file_size, uploaded_by, created_at, metadata, is_deleted)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), '{}'::jsonb, FALSE)
    RETURNING *
  `;
  const values = [tenant_id, leadId, file_url, file_name, file_type, file_size, uploaded_by];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Get all attachments for a lead
 */
exports.getAttachmentsByLead = async (leadId, tenant_id, schema = DEFAULT_SCHEMA) => {
  const query = `
    SELECT * FROM ${schema}.lead_attachments
    WHERE lead_id = $1 AND tenant_id = $2 AND is_deleted = FALSE
    ORDER BY created_at DESC
  `;
  const result = await db.query(query, [leadId, tenant_id]);
  logger.debug('Get attachments result', { 
    leadId, 
    tenant_id, 
    count: result.rows.length,
    attachments: result.rows.map(a => ({ id: a.id, file_name: a.file_name }))
  });
  return result.rows;
};

/**
 * Soft delete an attachment
 */
exports.deleteAttachment = async (attachmentId, leadId, tenant_id, schema = DEFAULT_SCHEMA) => {
  const query = `
    UPDATE ${schema}.lead_attachments
    SET is_deleted = TRUE, updated_at = NOW()
    WHERE id = $1 AND lead_id = $2 AND tenant_id = $3
  `;
  await db.query(query, [attachmentId, leadId, tenant_id]);
};
