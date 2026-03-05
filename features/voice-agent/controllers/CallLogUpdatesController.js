const CallLogUpdatesService = require('../services/CallLogUpdatesService');
const logger = require('../../../core/utils/logger');
const { getSchema, sanitizeSchema } = require('../../../core/utils/schemaHelper');

class CallLogUpdatesController {
  constructor(options = {}) {
    this.logger = options.logger || logger;
    this.service = options.service || new CallLogUpdatesService({ logger: this.logger });
  }

  async streamCallLogUpdates(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const schema = sanitizeSchema(getSchema(req));

      if (!tenantId) {
        return res.status(401).json({
          success: false,
          error: 'Tenant context required'
        });
      }

      await this.service.start();

      this.logger.info('[CallLogUpdatesController] SSE client connected', {
        tenantId,
        schema
      });

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      res.flushHeaders?.();

      this.service.addSseClient(tenantId, schema, res);

      res.on('close', () => {
        this.logger.info('[CallLogUpdatesController] SSE client disconnected', {
          tenantId,
          schema
        });
      });

    } catch (error) {
      this.logger.error('[CallLogUpdatesController] streamCallLogUpdates failed', {
        error: error.message
      });

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: 'Failed to start updates stream'
        });
      }

      try {
        res.end();
      } catch {
        // ignore
      }
    }
  }
}

module.exports = CallLogUpdatesController;
