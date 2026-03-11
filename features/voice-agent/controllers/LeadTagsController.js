const { getTenantContext } = require('../../../core/utils/schemaHelper');
const LeadTagsService = require('../services/LeadTagsService');
const { validateUpdateLeadTagsRequest } = require('../validators/updateLeadTagsValidator');
const logger = require('../../../core/utils/logger');

class LeadTagsController {
  constructor(db) {
    this.service = new LeadTagsService(db);
  }

  async replaceLeadTagsByCallId(req, res) {
    try {
      const { tenant_id: tenantId, schema } = getTenantContext(req);
      const { callId, tags } = validateUpdateLeadTagsRequest(req);

      const result = await this.service.replaceLeadTagsByCallId({
        schema,
        tenantId,
        callId,
        tags
      });

      return res.status(200).json({
        success: true,
        data: {
          call_id: callId,
          lead_id: result.leadId,
          tags: result.tags,
          updated_at: result.updatedAt
        }
      });
    } catch (error) {
      const status = error.status || (error.code === 'CALL_LOG_NOT_FOUND' ? 404 : error.code === 'LEAD_NOT_FOUND' ? 404 : error.code === 'TENANT_CONTEXT_MISSING' ? 400 : 500);
      logger.error('[LeadTagsController] replaceLeadTagsByCallId failed', { error: error.message, code: error.code });
      return res.status(status).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }
  }
}

module.exports = LeadTagsController;
