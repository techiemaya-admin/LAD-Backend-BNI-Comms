/**
 * Controllers Index
 * 1.0
 * Exports all voice agent controllers
 */

const VoiceAgentController = require('./VoiceAgentController');
const LeadBookingController = require('./LeadBooking.controller');

module.exports = {
  VoiceAgentController,
  LeadBookingController
};
