/**
 * Calendar Integration Routes
 * Handles Google Calendar OAuth flow via VOAG service
 * 
 * LAD Architecture Compliant:
 * - Auth middleware on protected routes
 * - Tenant context from req.user (via JWT)
 * - Proxies requests to VOAG service
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('../../../core/middleware/auth');
const logger = require('../../../core/utils/logger');

// VOAG service base URL - use BASE_URL from .env
const VOAG_BASE_URL = process.env.BASE_URL || 'https://voag.techiemaya.com';
const VOAG_API_KEY = process.env.BASE_URL_FRONTEND_APIKEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://lad-frontend-develop-741719885039.us-central1.run.app';

/**
 * Start Google Calendar OAuth flow
 * POST /api/social-integration/calendar/google/start
 */
router.post('/google/start', authenticateToken, async (req, res) => {
  try {
    const { user_id, frontend_id } = req.body;
    const userId = user_id || req.user?.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    logger.info('[Calendar] Starting Google OAuth flow', { userId });

    // Build redirect URI for OAuth callback
    const redirectUri = `${FRONTEND_URL}/settings?google=connected`;

    // Call VOAG service to initiate OAuth
    const voagResponse = await axios.post(
      `${VOAG_BASE_URL}/auth/google/start?user_id=${userId}&frontend_id=${frontend_id || 'settings'}&redirect_uri=${encodeURIComponent(redirectUri)}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || '',
          'X-Frontend-ID': frontend_id || 'settings',
          'X-API-Key': VOAG_API_KEY
        },
        timeout: 10000
      }
    );

    logger.info('[Calendar] VOAG OAuth response', { 
      status: voagResponse.status,
      hasUrl: !!voagResponse.data?.url 
    });

    res.json(voagResponse.data);
  } catch (error) {
    logger.error('[Calendar] Error starting Google OAuth', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to start Google OAuth flow',
      message: error.message
    });
  }
});

/**
 * Check Google Calendar connection status
 * POST /api/social-integration/calendar/google/status
 */
router.post('/google/status', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.body;
    const userId = user_id || req.user?.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Call VOAG service to check status
    const voagResponse = await axios.get(
      `${VOAG_BASE_URL}/auth/google/status?user_id=${userId}`,
      {
        headers: {
          'Authorization': req.headers.authorization || '',
          'X-Frontend-ID': 'settings',
          'X-API-Key': VOAG_API_KEY
        },
        timeout: 10000
      }
    );

    res.json(voagResponse.data);
  } catch (error) {
    logger.error('[Calendar] Error checking Google status', {
      error: error.message,
      response: error.response?.data
    });

    // Return disconnected status on error instead of failing
    res.json({
      connected: false,
      email: null,
      error: error.message
    });
  }
});

/**
 * Disconnect Google Calendar
 * POST /api/social-integration/calendar/google/disconnect
 */
router.post('/google/disconnect', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.body;
    const userId = user_id || req.user?.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    logger.info('[Calendar] Disconnecting Google Calendar', { userId });

    // Call VOAG service to disconnect
    const voagResponse = await axios.post(
      `${VOAG_BASE_URL}/auth/google/disconnect?user_id=${userId}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || '',
          'X-Frontend-ID': 'settings',
          'X-API-Key': VOAG_API_KEY
        },
        timeout: 10000
      }
    );

    res.json(voagResponse.data);
  } catch (error) {
    logger.error('[Calendar] Error disconnecting Google', {
      error: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to disconnect Google Calendar',
      message: error.message
    });
  }
});

module.exports = router;
