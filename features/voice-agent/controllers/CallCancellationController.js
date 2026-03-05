/**
 * Call Cancellation Controller
 * 1.0
 * Unified endpoint for cancelling single calls and batches
 * Forwards requests to external voice agent service (BASE_URL)
 * 
 * Endpoints:
 * - POST /calls/cancel - Cancel single call or batch (auto-detects type)
 * - GET /calls/status/:resource_id - Get status of call or batch
 */

const axios = require('axios');
let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  const loggerAdapter = require('../../utils/logger');
  logger = loggerAdapter.getLogger();
}

class CallCancellationController {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get external service configuration from environment
   * @returns {Object} Configuration object with baseUrl, headers
   */
  _getExternalServiceConfig() {
    const baseUrl = process.env.BASE_URL;
    const frontendId = process.env.BASE_URL_FRONTEND_HEADER || 'settings';
    const apiKey = process.env.BASE_URL_FRONTEND_APIKEY || '';

    if (!baseUrl) {
      throw new Error('BASE_URL is not configured for call cancellation');
    }

    return {
      baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-Frontend-ID': frontendId,
        'X-API-Key': apiKey
      }
    };
  }

  /**
   * Detect resource type based on ID format
   * - batch-xxx -> batch
   * - UUID -> call
   * 
   * @param {string} resourceId - Resource ID to check
   * @returns {string} 'batch' or 'call'
   */
  _detectResourceType(resourceId) {
    if (typeof resourceId !== 'string') {
      return 'call';
    }
    if (resourceId.startsWith('batch-')) {
      return 'batch';
    }
    return 'call';
  }

  /**
   * Normalize resource_id to array
   * @param {string|string[]} resourceId - Single ID or array of IDs
   * @returns {string[]} Array of resource IDs
   */
  _normalizeResourceIds(resourceId) {
    if (Array.isArray(resourceId)) {
      return resourceId;
    }
    return [resourceId];
  }

  /**
   * POST /calls/cancel
   * Unified cancellation endpoint for single calls and batches
   * 
   * Request Body:
   * - resource_id: string or string[] - One or more resource IDs
   * - force: boolean (default false) - When true, terminates ringing/in-progress calls
   * 
   * Response:
   * - results: array of per-resource results
   * - total_cancelled: total count of cancelled items
   */
  async cancelCalls(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const { resource_id, force = false } = req.body;

      logger.info('[CallCancellationController] Cancel calls request', {
        tenantId,
        resourceId: resource_id,
        force
      });

      // Validate required fields
      if (!resource_id) {
        return res.status(400).json({
          success: false,
          error: 'resource_id is required'
        });
      }

      // Normalize to array
      const resourceIds = this._normalizeResourceIds(resource_id);

      if (resourceIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one resource_id is required'
        });
      }

      // Validate each resource ID
      for (const id of resourceIds) {
        if (typeof id !== 'string' || id.trim() === '') {
          return res.status(400).json({
            success: false,
            error: 'All resource_ids must be non-empty strings'
          });
        }
      }

      // Get external service configuration
      const { baseUrl, headers } = this._getExternalServiceConfig();

      // Forward to external cancellation endpoint
      const payload = {
        resource_id: resource_id,
        force: force === true
      };

      logger.info('[CallCancellationController] Forwarding to external service', {
        url: `${baseUrl}/calls/cancel`,
        resourceCount: resourceIds.length
      });

      const response = await axios.post(`${baseUrl}/calls/cancel`, payload, { headers });

      logger.info('[CallCancellationController] External service response', {
        status: response.status,
        totalCancelled: response.data?.total_cancelled
      });

      return res.json({
        success: true,
        ...response.data
      });

    } catch (error) {
      logger.error('[CallCancellationController] Cancel calls failed', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      // Handle specific error cases
      if (error.message.includes('BASE_URL is not configured')) {
        return res.status(500).json({
          success: false,
          error: 'Call cancellation service not configured'
        });
      }

      if (error.response?.status === 401 || error.response?.status === 403) {
        return res.status(502).json({
          success: false,
          error: 'External service authentication failed',
          message: error.response?.data?.message || 'Authentication error'
        });
      }

      if (error.response?.status === 503) {
        return res.status(503).json({
          success: false,
          error: 'Database temporarily unavailable',
          message: 'Please retry the request'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to cancel calls',
        message: error.response?.data?.message || error.message
      });
    }
  }

  /**
   * GET /calls/status/:resource_id
   * Get status of a call or batch
   * 
   * Works for both:
   * - Call UUIDs: /calls/status/a1b2c3d4-e5f6-7890-abcd-ef1234567890
   * - Batch IDs: /calls/status/batch-abc123def456
   */
  async getCallStatus(req, res) {
    try {
      const { resource_id } = req.params;
      const tenantId = req.tenantId || req.user?.tenantId;

      logger.info('[CallCancellationController] Get call status request', {
        tenantId,
        resourceId: resource_id
      });

      if (!resource_id) {
        return res.status(400).json({
          success: false,
          error: 'resource_id is required'
        });
      }

      // Detect resource type for logging
      const resourceType = this._detectResourceType(resource_id);

      // Get external service configuration
      const { baseUrl, headers } = this._getExternalServiceConfig();

      logger.info('[CallCancellationController] Forwarding status request to external service', {
        url: `${baseUrl}/calls/status/${resource_id}`,
        resourceType
      });

      const response = await axios.get(`${baseUrl}/calls/status/${resource_id}`, { headers });

      logger.info('[CallCancellationController] External service status response', {
        status: response.status,
        hasData: !!response.data
      });

      return res.json({
        success: true,
        ...response.data
      });

    } catch (error) {
      logger.error('[CallCancellationController] Get call status failed', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        resourceId: req.params.resource_id
      });

      // Handle specific error cases
      if (error.message.includes('BASE_URL is not configured')) {
        return res.status(500).json({
          success: false,
          error: 'Call status service not configured'
        });
      }

      if (error.response?.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
          resource_id: req.params.resource_id
        });
      }

      if (error.response?.status === 401 || error.response?.status === 403) {
        return res.status(502).json({
          success: false,
          error: 'External service authentication failed'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to get call status',
        message: error.response?.data?.message || error.message
      });
    }
  }
}

module.exports = CallCancellationController;
