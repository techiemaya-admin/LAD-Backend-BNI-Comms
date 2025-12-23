/**
 * Attachment Service
 * Business logic for lead attachments and notes
 * Controllers → Services → Models
 */

const db = require('../../../shared/database/connection');

/**
 * Get all notes for a lead
 */
exports.getNotes = async (leadId) => {
  const query = `
    SELECT * FROM lead_notes
    WHERE lead_id = $1
    ORDER BY created_at DESC
  `;
  const result = await db.query(query, [leadId]);
  return result.rows;
};

/**
 * Create a new note for a lead
 */
exports.createNote = async (leadId, noteData) => {
  const { content, created_by } = noteData;
  const query = `
    INSERT INTO lead_notes (lead_id, content, created_by, created_at)
    VALUES ($1, $2, $3, NOW())
    RETURNING *
  `;
  const result = await db.query(query, [leadId, content, created_by]);
  return result.rows[0];
};

/**
 * Delete a note
 */
exports.deleteNote = async (leadId, noteId) => {
  const query = `
    DELETE FROM lead_notes
    WHERE id = $1 AND lead_id = $2
  `;
  await db.query(query, [noteId, leadId]);
};
