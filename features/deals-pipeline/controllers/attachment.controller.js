/**
 * Attachment Controller
 * Handles HTTP requests for lead attachments and notes
 * Routes → Controllers → Services → Models
 */

const attachmentService = require('../services/attachment.service');

// Try core paths first, fallback to local shared
let getTenantContext, logger;
try {
  ({ getTenantContext } = require('../../../../core/utils/schemaHelper'));
  logger = require('../../../../core/utils/logger');
} catch (e) {
  ({ getTenantContext } = require('../../../shared/utils/schemaHelper'));
  logger = require('../../../shared/utils/logger');
}

const gcpStorage = require('../utils/gcp-storage');
const path = require('path');

/**
 * Get all notes for a lead
 * GET /api/deals-pipeline/leads/:id/notes
 */
exports.listNotes = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const notes = await attachmentService.getNotes(req.params.id, tenant_id, schema);
    res.json(notes);
  } catch (error) {
    logger.error('Error listing notes', error, { leadId: req.params.id });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch notes', details: error.message });
  }
};

/**
 * Create a new note for a lead
 * POST /api/deals-pipeline/leads/:id/notes
 */
exports.createNote = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const noteData = {
      content: req.body.content,
      created_by: req.user.id
    };
    
    const note = await attachmentService.createNote(req.params.id, noteData, tenant_id, schema);
    res.status(201).json(note);
  } catch (error) {
    logger.error('Error creating note', error, { leadId: req.params.id });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create note', details: error.message });
  }
};

/**
 * Delete a note
 * DELETE /api/deals-pipeline/leads/:id/notes/:noteId
 */
exports.deleteNote = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    await attachmentService.deleteNote(req.params.id, req.params.noteId, tenant_id, schema);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting note', error, { leadId: req.params.id, noteId: req.params.noteId });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete note', details: error.message });
  }
};

/**
 * List all attachments for a lead with signed URLs
 * GET /api/deals-pipeline/leads/:id/attachments
 */
exports.listAttachments = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const attachments = await attachmentService.getAttachments(req.params.id, tenant_id, schema);
    
    // Generate signed URLs for each attachment
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        try {
          const filename = gcpStorage.extractFilename(attachment.file_url);
          const signedUrl = await gcpStorage.getSignedUrl(filename, 60); // 60 minutes expiry
          return {
            ...attachment,
            signed_url: signedUrl
          };
        } catch (error) {
          logger.warn('Failed to generate signed URL', { attachmentId: attachment.id, error: error.message });
          return {
            ...attachment,
            signed_url: null,
            error: 'Failed to generate download URL'
          };
        }
      })
    );
    
    res.json(attachmentsWithUrls);
  } catch (error) {
    logger.error('Error listing attachments', error, { leadId: req.params.id });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch attachments', details: error.message });
  }
};

exports.uploadAttachment = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const leadId = req.params.id;
    const file = req.file;

    // Generate unique filename for GCS
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '');
    const gcsFilename = `leads/${leadId}/attachments/${uniqueSuffix}${ext}`;

    // Upload to GCS
    const gcsUri = await gcpStorage.uploadFile(
      file.buffer,
      gcsFilename,
      file.mimetype,
      {
        leadId,
        tenantId: tenant_id,
        uploadedBy: req.user.id,
        originalName: file.originalname
      }
    );

    // Save record to database
    const attachmentRecord = await attachmentService.createAttachment({
      tenant_id,
      schema,
      leadId,
      file_url: gcsUri,
      file_name: file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      uploaded_by: req.user.id
    });

    // Generate signed URL for immediate access
    const signedUrl = await gcpStorage.getSignedUrl(gcsFilename, 60);

    res.status(201).json({
      success: true,
      attachment: {
        ...attachmentRecord,
        signed_url: signedUrl
      }
    });
  } catch (error) {
    logger.error('Error uploading attachment', error, { leadId: req.params.id });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to upload attachment', details: error.message });
  }
};

/**
 * Delete an attachment
 * DELETE /api/deals-pipeline/leads/:id/attachments/:attachmentId
 */
exports.deleteAttachment = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    logger.debug('Delete attachment request', { 
      leadId: req.params.id, 
      attachmentId: req.params.attachmentId 
    });
    
    // Get attachment details first to verify it exists
    const attachments = await attachmentService.getAttachments(req.params.id, tenant_id, schema);
    const attachment = attachments.find(a => a.id === req.params.attachmentId);
    
    logger.debug('Attachment lookup', { 
      attachmentId: req.params.attachmentId,
      found: !!attachment,
      totalAttachments: attachments.length,
      attachmentIds: attachments.map(a => a.id)
    });
    
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    // Soft delete in database
    await attachmentService.deleteAttachment(req.params.id, req.params.attachmentId, tenant_id, schema);
    
    // Optionally delete from GCS (commented out for soft delete approach)
    // const filename = gcpStorage.extractFilename(attachment.file_url);
    // await gcpStorage.deleteFile(filename);
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting attachment', error, { 
      leadId: req.params.id, 
      attachmentId: req.params.attachmentId 
    });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete attachment', details: error.message });
  }
};

module.exports = exports;