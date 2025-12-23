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

exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const leadId = req.params.id;
    const file = req.file;

    // Build link that your app will use to access the file
    const relativePath = file.path; // full path on disk (currently unused)
    // URL that can be used by the frontend to access the file
    const link = `/uploads/attachments/${file.filename}`;

    // Try multiple shapes for tenant info (mock vs production)
    const tenantId =
      (req.user &&
        (req.user.tenantId ||
          req.user.tenant_id ||
          (req.user.tenant && req.user.tenant.id))) ||
      (req.tenant && (req.tenant.id || req.tenant.tenant_id));

    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing tenant id on authenticated user',
        details: 'Cannot create attachment without tenant context'
      });
    }

    const attachmentRecord = await attachmentService.createAttachment({
      tenantId,
      leadId,
      link
    });

    res.status(201).json({
      success: true,
      attachment: {
        db: attachmentRecord,
        file: {
          leadId,
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          mimeType: file.mimetype
        }
      }
    });
  } catch (error) {
    console.error('[Attachment Controller] Error uploading attachment:', error);
    res.status(500).json({ error: 'Failed to upload attachment', details: error.message });
  }
};