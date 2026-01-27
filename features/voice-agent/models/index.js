/**
 * Voice Agent Models Index1.0
 * 
 * Exports all voice agent models for easy import
 * Also re-exports core models for convenience
 */

const VoiceCallModel = require('./VoiceCallModel');
const VoiceAgentModel = require('./VoiceAgentModel');
const VoiceModel = require('./VoiceModel');
const PhoneNumberModel = require('./PhoneNumberModel');
const PhoneResolverModel = require('./PhoneResolverModel');

// Core models (from backend/core/models)
// const { TenantModel, UserModel, MembershipModel } = require('../../../core/models');

module.exports = {
  // Voice agent models
  VoiceCallModel,
  VoiceAgentModel,
  VoiceModel,
  PhoneNumberModel,
  PhoneResolverModel,
  
  // Core models (re-exported for convenience)
  // TenantModel,
  // UserModel,
  // MembershipModel
};
