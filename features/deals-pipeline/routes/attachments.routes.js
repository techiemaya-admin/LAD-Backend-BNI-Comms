/**
 * Attachment Routes
 * /api/deals-pipeline/leads/:id/attachments
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const { jwtAuth } = require('../middleware/auth');
const attachmentController = require('../controllers/attachment.controller');

// GET /api/deals-pipeline/leads/:id/notes
router.get('/notes', jwtAuth, attachmentController.listNotes);

// POST /api/deals-pipeline/leads/:id/notes
router.post('/notes', jwtAuth, attachmentController.createNote);

// DELETE /api/deals-pipeline/leads/:id/notes/:noteId
router.delete('/notes/:noteId', jwtAuth, attachmentController.deleteNote);

module.exports = router;
