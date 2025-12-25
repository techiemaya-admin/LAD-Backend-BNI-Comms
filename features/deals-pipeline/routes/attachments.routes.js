/**
 * Attachment Routes
 * /api/deals-pipeline/leads/:id/attachments
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const { jwtAuth } = require('../middleware/auth');
const attachmentController = require('../controllers/attachment.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer storage for lead attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', '..', '..', 'uploads', 'attachments');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '');
    cb(null, `lead-${req.params.id || 'unknown'}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ storage });

// GET /api/deals-pipeline/leads/:id/notes
router.get('/notes', jwtAuth, attachmentController.listNotes);

// POST /api/deals-pipeline/leads/:id/notes
router.post('/notes', jwtAuth, attachmentController.createNote);

// DELETE /api/deals-pipeline/leads/:id/notes/:noteId
router.delete('/notes/:noteId', jwtAuth, attachmentController.deleteNote);

// POST /api/deals-pipeline/leads/:id/attachments
// Form field name should be `file`
router.post('/attachments', jwtAuth, upload.single('file'), attachmentController.uploadAttachment);

module.exports = router;
