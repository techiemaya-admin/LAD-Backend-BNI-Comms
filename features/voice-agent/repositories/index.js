/**
 * Repository Index
 * Exports all repositories
 */

const LeadBookingRepository = require('./LeadBooking.repository');
const VoiceCallRepository = require('./VoiceCall.repository');
const UserRepository = require('./User.repository');

module.exports = {
  LeadBookingRepository,
  VoiceCallRepository,
  UserRepository
};
