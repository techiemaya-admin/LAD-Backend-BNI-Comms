/**
 * Attachment Controller
 * Handles HTTP requests for lead attachments and notes
 * Routes → Controllers → Services → Models
 */

const attachmentService = require('../services/attachment.service');

/**
 * Get all notes for a lead
 * GET /api/deals-pipeline/leads/:id/notes
 */
exports.listNotes = async (req, res) => {
  try {
    const notes = await attachmentService.getNotes(req.params.id);
    res.json(notes);
  } catch (error) {
    console.error('[Attachment Controller] Error listing notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes', details: error.message });
  }
};

/**
 * Create a new note for a lead
 * POST /api/deals-pipeline/leads/:id/notes
 */
exports.createNote = async (req, res) => {
  try {
    const note = await attachmentService.createNote(req.params.id, req.body);
    res.status(201).json(note);
  } catch (error) {
    console.error('[Attachment Controller] Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note', details: error.message });
  }
};

/**
 * Delete a note
 * DELETE /api/deals-pipeline/leads/:id/notes/:noteId
 */
exports.deleteNote = async (req, res) => {
  try {
    await attachmentService.deleteNote(req.params.id, req.params.noteId);
    res.status(204).send();
  } catch (error) {
    console.error('[Attachment Controller] Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note', details: error.message });
  }
};
