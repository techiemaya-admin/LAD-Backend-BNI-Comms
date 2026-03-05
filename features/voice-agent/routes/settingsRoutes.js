const express = require('express');
const SettingsController = require('../controllers/SettingsController');
const { authenticateToken } = require('../../../core/middleware/auth');

const router = express.Router();

// Initialize controller (will be passed db connection from main app)
let settingsController;

// Middleware to initialize controller with db
const initializeController = (db) => {
  if (!settingsController) {
    settingsController = new SettingsController(db);
  }
  return settingsController;
};

// Voice Agent Routes
router.get('/agents', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.getVoiceAgents(req, res);
});

router.get('/agents/:agentId', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.getVoiceAgentById(req, res);
});

router.post('/agents', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.createVoiceAgent(req, res);
});

router.put('/agents/:agentId', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.updateVoiceAgent(req, res);
});

router.delete('/agents/:agentId', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.deleteVoiceAgent(req, res);
});

router.get('/agents/search', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.searchVoiceAgents(req, res);
});

// Voice Voices Routes
router.get('/voices', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.getVoiceVoices(req, res);
});

router.get('/voices/:voiceId', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.getVoiceById(req, res);
});

router.post('/voices', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.createVoice(req, res);
});

router.put('/voices/:voiceId', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.updateVoice(req, res);
});

router.delete('/voices/:voiceId', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.deleteVoice(req, res);
});

router.get('/voices/provider/:provider', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.getVoicesByProvider(req, res);
});

router.get('/voices/search', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.searchVoiceVoices(req, res);
});

// Relationship Routes
router.get('/voices/:voiceId/agents', authenticateToken, (req, res) => {
  const controller = initializeController(req.app.get('db'));
  return controller.getAgentsByVoiceId(req, res);
});

module.exports = router;
