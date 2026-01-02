/**
 * Attachment Service - LAD Architecture Compliant
 * Business logic for lead attachments and notes
 * Controllers → Services → Repositories
 */

const attachmentRepository = require('../repositories/attachment.repository');

// Try core paths first, fallback to local shared
let logger;
try {
  logger = require('../../../../core/utils/logger');
} catch (e) {
  logger = require('../../../shared/utils/logger');
}

const DEFAULT_SCHEMA = process.env.DB_SCHEMA || 'lad_dev';

/**
 * Get all notes for a lead
 */
exports.getNotes = async (leadId, tenant_id, schema = DEFAULT_SCHEMA) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getNotes');
  }
  return await attachmentRepository.getNotesByLead(leadId, tenant_id, schema);
};

/**
 * Create a new note for a lead
 */
exports.createNote = async (leadId, noteData, tenant_id, schema = DEFAULT_SCHEMA) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for createNote');
  }
  return await attachmentRepository.createNote(leadId, noteData, tenant_id, schema);
};

/**
 * Delete a note (soft delete)
 */
exports.deleteNote = async (leadId, noteId, tenant_id, schema = DEFAULT_SCHEMA) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for deleteNote');
  }
  await attachmentRepository.deleteNote(noteId, leadId, tenant_id, schema);
};

/**
 * Create a new attachment record for a lead
 */
exports.createAttachment = async ({ tenant_id, schema = DEFAULT_SCHEMA, leadId, file_url, file_name, file_type, file_size, uploaded_by }) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for createAttachment');
  }
  return await attachmentRepository.createAttachment({ 
    tenant_id, schema, leadId, file_url, file_name, file_type, file_size, uploaded_by 
  });
};

/**
 * Get all attachments for a lead
 */
exports.getAttachments = async (leadId, tenant_id, schema = DEFAULT_SCHEMA) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getAttachments');
  }
  return await attachmentRepository.getAttachmentsByLead(leadId, tenant_id, schema);
};

/**
 * Delete an attachment (soft delete)
 */
exports.deleteAttachment = async (leadId, attachmentId, tenant_id, schema = DEFAULT_SCHEMA) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for deleteAttachment');
  }
  await attachmentRepository.deleteAttachment(attachmentId, leadId, tenant_id, schema);
};