/**
 * Call Logging Service1.0
 * 
 * Handles call log creation and management
 * Works with VoiceCallModel to track all voice call activity
 */

const { VoiceCallModel } = require('../models');
const { getSchemaFromRequest } = require('../utils/schemaHelper');

class CallLoggingService {
  constructor(db) {
    this.callModel = new VoiceCallModel(db);
  }

  /**
   * Create call log from VAPI response
   * 
   * @param {Object} params - Call log parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.voiceId - Voice ID
   * @param {number} params.agentId - Agent ID
   * @param {string} params.fromNumber - From number
   * @param {string} params.toNumber - To number
   * @param {string} params.leadId - Lead ID
   * @param {string} params.initiatedBy - User who initiated
   * @param {string} params.addedContext - Context
   * @param {Object} params.vapiResponse - VAPI API response
   * @returns {Promise<Object>} Created call log
   */
  async createCallLog({
    tenantId,
    voiceId,
    agentId,
    fromNumber,
    toNumber,
    leadId,
    initiatedBy,
    addedContext,
    vapiResponse
  }) {
    const schema = getSchemaFromRequest({ user: { tenant_id: tenantId } });
    const callLog = await this.callModel.createCallLog({
      schema,
      tenantId,
      voiceId,
      agentId,
      fromNumber,
      toNumber,
      status: vapiResponse?.status || 'calling',
      addedContext,
      leadId,
      initiatedBy,
      recordingUrl: null // Will be updated later
    });

    return callLog;
  }

  /**
   * Create batch call logs
   * 
   * @param {Object} params - Batch parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {Array} params.entries - Call entries
   * @param {Array} params.vapiResults - VAPI batch results
   * @param {string} params.agentId - Agent ID
   * @param {string} params.voiceId - Voice ID
   * @param {string} params.fromNumber - From number
   * @param {string} params.initiatedBy - User who initiated
   * @returns {Promise<Array>} Created call logs
   */
  async createBatchCallLogs({
    tenantId,
    entries,
    vapiResults,
    agentId,
    voiceId,
    fromNumber,
    initiatedBy
  }) {
    const callLogs = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const vapiResult = vapiResults[i];

      if (!vapiResult.success) {
        // Log failed calls too
        continue;
      }

    const schema = getSchemaFromRequest({ user: { tenant_id: tenantId } });
      const callLog = await this.callModel.createCallLog({
        schema,
        tenantId,
        voiceId,
        agentId,
        fromNumber,
        toNumber: entry.phoneNumber,
        status: 'calling',
        addedContext: entry.added_context || entry.summary,
        leadId: entry.leadId,
        initiatedBy
      });

      callLogs.push(callLog);
    }

    return callLogs;
  }

  /**
   * Update call status based on VAPI webhook/status
   * 
   * @param {string} callId - Call log ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} vapiData - VAPI status data
   * @returns {Promise<Object>} Updated call log
   */
  async updateCallFromVAPI(callId, tenantId, vapiData) {
    const updates = {
      recordingUrl: vapiData.recordingUrl
    };

    if (vapiData.endedAt) {
      updates.endedAt = new Date(vapiData.endedAt);
    }

    const schema = getSchemaFromRequest({ user: { tenant_id: tenantId } });
    return this.callModel.updateCallStatus(
      schema,
      callId,
      tenantId,
      vapiData.status,
      updates
    );
  }

  /**
   * Get call log with full details
   * 
   * @param {string} callId - Call log ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Call log
   */
  async getCallLog(callId, tenantId) {
    const schema = getSchemaFromRequest({ user: { tenant_id: tenantId } });
    return this.callModel.getCallById(schema, callId, tenantId);
  }

  /**
   * Get calls for a lead
   * 
   * @param {string} leadId - Lead ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>} Call logs
   */
  async getCallsForLead(leadId, tenantId) {
    const schema = getSchemaFromRequest({ user: { tenant_id: tenantId } });
    return this.callModel.getCallsForLead(schema, leadId, tenantId);
  }

  /**
   * Get recent calls for tenant
   * 
   * @param {string} tenantId - Tenant ID
   * @param {Object} filters - Filters
   * @returns {Promise<Array>} Call logs
   */
  async getRecentCalls(tenantId, filters = {}) {
    const schema = getSchemaFromRequest({ user: { tenant_id: tenantId } });
    return this.callModel.getRecentCalls(schema, tenantId, 50, filters);
  }

  async getCallLogs(tenantId, filters = {}, limit = 50) {
    const schema = getSchemaFromRequest({ user: { tenant_id: tenantId } });
    return this.callModel.getCallLogs(schema, tenantId, filters, limit);
  }

  /**
   * Get call statistics
   * 
   * @param {string} tenantId - Tenant ID
   * @param {Object} dateRange - Date range
   * @returns {Promise<Object>} Statistics
   */
  async getCallStats(tenantId, dateRange = {}) {
    const schema = getSchemaFromRequest({ user: { tenant_id: tenantId } });
    return this.callModel.getCallStats(schema, tenantId, dateRange);
  }
}

module.exports = CallLoggingService;
