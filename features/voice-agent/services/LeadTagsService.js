const LeadTagsRepository = require('../repositories/leadTagsRepository');

class LeadTagsService {
  constructor(db) {
    this.repo = new LeadTagsRepository(db);
  }

  async replaceLeadTagsByCallId({ schema, tenantId, callId, tags }) {
    if (!tenantId) {
      const err = new Error('Tenant context required');
      err.code = 'TENANT_CONTEXT_MISSING';
      throw err;
    }

    const leadId = await this.repo.getLeadIdByCallId({ schema, tenantId, callId });
    if (!leadId) {
      const err = new Error('Call log not found or lead not associated');
      err.code = 'CALL_LOG_NOT_FOUND';
      throw err;
    }

    const updated = await this.repo.replaceLeadTags({ schema, tenantId, leadId, tags });
    if (!updated) {
      const err = new Error('Lead not found');
      err.code = 'LEAD_NOT_FOUND';
      throw err;
    }

    return { leadId, tags: updated.tags, updatedAt: updated.updated_at };
  }
}

module.exports = LeadTagsService;
