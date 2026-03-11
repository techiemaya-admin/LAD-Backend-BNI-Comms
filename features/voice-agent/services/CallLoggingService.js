/**
 * Call Logging Service1.0
 * 
 * Handles call log creation and management
 * Works with VoiceCallModel to track all voice call activity
 */

const { VoiceCallModel } = require('../models');

class CallLoggingService {
  constructor(db) {
    this.callModel = new VoiceCallModel(db);
  }

  /**
   * Create call log from VAPI response
   * 
   * @param {Object} params - Call log parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.voiceId - Voice ID (deprecated - not used in schema)
   * @param {number} params.agentId - Agent ID
   * @param {string} params.fromNumber - From number (deprecated)
   * @param {string} params.fromNumberId - From number ID (UUID)
   * @param {string} params.toNumber - To number (will be parsed)
   * @param {string} params.leadId - Lead ID
   * @param {string} params.initiatedBy - User who initiated (deprecated)
   * @param {string} params.initiatedByUserId - User ID who initiated
   * @param {string} params.addedContext - Context (deprecated)
   * @param {Object} params.vapiResponse - VAPI API response
   * @returns {Promise<Object>} Created call log
   */
  async createCallLog({
    schema,
    tenantId,
    voiceId, // deprecated
    agentId,
    fromNumber, // deprecated
    fromNumberId,
    toNumber,
    leadId,
    initiatedBy, // deprecated
    initiatedByUserId,
    addedContext, // deprecated
    vapiResponse
  }) {
    // Parse phone number into country code and base number
    // Format: +12345678900 -> country_code: +1, base_number: 2345678900
    const phoneMatch = toNumber.match(/^(\+\d{1,4})(\d+)$/);
    const toCountryCode = phoneMatch ? phoneMatch[1] : '+1';
    const toBaseNumber = phoneMatch ? phoneMatch[2] : toNumber.replace(/\D/g, '');

    const callLog = await this.callModel.createCallLog({
      schema,
      tenantId,
      agentId,
      fromNumberId: fromNumberId || null,
      toCountryCode,
      toBaseNumber,
      status: vapiResponse?.status || 'calling',
      leadId,
      initiatedByUserId: initiatedByUserId || initiatedBy || null,
      recordingUrl: null, // Will be updated later
      direction: 'outbound',
      metadata: {
        vapiCallId: vapiResponse?.id || null,
        vapiStatus: vapiResponse?.status || null,
        vapiAssistantId: vapiResponse?.assistantId || null,
        vapiPhoneNumberId: vapiResponse?.phoneNumberId || null,
        createdVia: 'vapi'
      }
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
   * @param {string} params.voiceId - Voice ID (deprecated)
   * @param {string} params.fromNumber - From number (deprecated)
   * @param {string} params.fromNumberId - From number ID (UUID)
   * @param {string} params.initiatedBy - User who initiated (deprecated)
   * @param {string} params.initiatedByUserId - User ID who initiated
   * @returns {Promise<Array>} Created call logs
   */
  async createBatchCallLogs({
    schema,
    tenantId,
    entries,
    vapiResults,
    agentId,
    voiceId, // deprecated
    fromNumber, // deprecated
    fromNumberId,
    initiatedBy, // deprecated
    initiatedByUserId
  }) {
    const callLogs = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const vapiResult = vapiResults[i];
      if (!vapiResult.success) {
        // Log failed calls too
        continue;
      }

      // Parse phone number
      const phoneMatch = entry.phoneNumber.match(/^(\+\d{1,4})(\d+)$/);
      const toCountryCode = phoneMatch ? phoneMatch[1] : '+1';
      const toBaseNumber = phoneMatch ? phoneMatch[2] : entry.phoneNumber.replace(/\D/g, '');

      const callLog = await this.callModel.createCallLog({
        schema,
        tenantId,
        agentId,
        fromNumberId: fromNumberId || null,
        toCountryCode,
        toBaseNumber,
        status: 'calling',
        leadId: entry.leadId,
        initiatedByUserId: initiatedByUserId || initiatedBy || null,
        direction: 'outbound'
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
    return this.callModel.updateCallStatus(
      vapiData.schema,
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
  async getCallLog(schema, callId, tenantId) {
    return this.callModel.getCallById(schema, callId, tenantId);
  }

  /**
   * Get the lead linked to a specific call log
   *
   * @param {string} schema - Schema name
   * @param {string} callLogId - Call log ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object|null>} Lead row or null
   */
  async getLeadByCallLogId(schema, callLogId, tenantId) {
    return this.callModel.getLeadByCallLogId(schema, callLogId, tenantId);
  }

  /**
   * Get calls for a lead
   * 
   * @param {string} leadId - Lead ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>} Call logs
   */
  async getCallsForLead(schema, leadId, tenantId) {
    return this.callModel.getCallsForLead(schema, leadId, tenantId);
  }

  /**
   * Get recent calls for tenant
   * 
   * @param {string} tenantId - Tenant ID
   * @param {Object} filters - Filters
   * @returns {Promise<Array>} Call logs
   */
  async getRecentCalls(schema, tenantId, filters = {}) {
    return this.callModel.getCallLogs(schema, tenantId, filters, 50);
  }

  async getCallLogs(schema, tenantId, filters = {}, limit = 50, offset = 0) {
    const calls = await this.callModel.getCallLogs(schema, tenantId, filters, limit, offset);
    const total = await this.callModel.getCallLogsCount(schema, tenantId, filters);
    return { calls, total };
  }

  /**
   * Get call statistics
   * 
   * @param {string} tenantId - Tenant ID
   * @param {Object} dateRange - Date range
   * @returns {Promise<Object>} Statistics
   */
  async getCallStats(schema, tenantId, dateRange = {}) {
    return this.callModel.getCallStats(schema, tenantId, dateRange);
  }

  /**
   * Parse capabilities from various formats
   * 
   * @private
   * @param {*} value - Capabilities value (array, string, etc.)
   * @returns {Array<string>} Parsed capabilities
   */
  _parseCapabilities(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
    }
    return [];
  }

  /**
   * Get user permission keys (capabilities + tenant features)
   * 
   * @param {Object} user - User object
   * @returns {Array<string>} Merged permission keys
   */
  getUserPermissionKeys(user) {
    // Some APIs call these "capabilities", others return tenant feature keys
    // in "tenantFeatures" (or similar). We merge them so access logic works
    // regardless of which shape the caller provides.
    const merged = [
      ...this._parseCapabilities(user?.capabilities),
      ...this._parseCapabilities(user?.tenantFeatures),
      ...this._parseCapabilities(user?.tenant_features),
      ...this._parseCapabilities(user?.tenantFeatureKeys),
    ];

    return Array.from(new Set(merged.filter(Boolean)));
  }

  /**
   * Check if user can view all call logs
   * 
   * @param {Object} user - User object with role and capabilities
   * @returns {boolean} True if user can view all logs
   */
  canViewAllCallLogs(user) {
    const keys = this.getUserPermissionKeys(user);

    // Explicit "view all" permissions always win.
    if (keys.includes('viewAll') || keys.includes('leads_view_all')) return true;

    // If the user is assigned-only, do NOT treat owner/admin as view-all.
    // This matches: "even if owner, if leads_view_assigned then only show initiated_by_user_id".
    if (keys.includes('leads_view_assigned')) return false;

    const role = String(user?.role || '').toLowerCase();
    return role === 'admin' || role === 'owner';
  }

  /**
   * Check if call logs should be restricted to initiator only
   * 
   * @param {Object} user - User object with id and capabilities
   * @returns {boolean} True if logs should be restricted to initiator
   */
  shouldRestrictToInitiator(user) {
    if (!user?.id) return false;
    const keys = this.getUserPermissionKeys(user);

    // If user can view all, never restrict.
    if (keys.includes('viewAll') || keys.includes('leads_view_all')) return false;

    // Restrict whenever the user is assigned-only, regardless of role.
    return keys.includes('leads_view_assigned');
  }
}

module.exports = CallLoggingService;
