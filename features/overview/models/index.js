/**
 * Voice Agent Models Index (DEPRECATED)
 * 
 * This file is kept for backward compatibility.
 * All data access has been moved to repositories/
 * 
 * Use: const { VoiceCallRepository, LeadBookingRepository } = require('../repositories');
 */

const VoiceCallModel = require('./CallLogModal');
const LeadBookingModel = require('./LeadBooking.pg');

// Core models (from backend/core/models)
// const { TenantModel, UserModel, MembershipModel } = require('../../../core/models');

module.exports = {
  VoiceCallModel,
  LeadBookingModel
};
