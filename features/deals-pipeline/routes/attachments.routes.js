/**
 * Attachment Routes
 * /api/deals-pipeline/leads/:id/attachments
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const { jwtAuth } = require('../middleware/auth');
const attachmentController = require('../controllers/attachment.controller');
const multer = require('multer');

// Configure Multer for memory storage (files stored in memory, not disk)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// GET /api/deals-pipeline/leads/:id/notes
router.get('/notes', jwtAuth, attachmentController.listNotes);

// POST /api/deals-pipeline/leads/:id/notes
router.post('/notes', jwtAuth, attachmentController.createNote);

// DELETE /api/deals-pipeline/leads/:id/notes/:noteId
router.delete('/notes/:noteId', jwtAuth, attachmentController.deleteNote);

// GET /api/deals-pipeline/leads/:id/attachments
router.get('/attachments', jwtAuth, attachmentController.listAttachments);

// POST /api/deals-pipeline/leads/:id/attachments
// Form field name should be `file`
router.post('/attachments', jwtAuth, upload.single('file'), attachmentController.uploadAttachment);

// DELETE /api/deals-pipeline/leads/:id/attachments/:attachmentId
router.delete('/attachments/:attachmentId', jwtAuth, attachmentController.deleteAttachment);

module.exports = router;
