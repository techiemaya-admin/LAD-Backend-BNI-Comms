/**
 * Controllers Index
 * 1.0
 * Exports all voice agent controllers
 */

const VoiceAgentController = require('./VoiceAgentController');
const CallController = require('./CallController');
const BatchCallController = require('./call-controllers/BatchCallController');
const CallInitiationController = require('./call-controllers/CallInitiationController');
const LeadTagsController = require('./LeadTagsController');
const CallCancellationController = require('./CallCancellationController');
const CallLogUpdatesController = require('./CallLogUpdatesController');

module.exports = {
  VoiceAgentController,
  CallController,
  BatchCallController,
  CallInitiationController,
  LeadTagsController,
  CallCancellationController,
  CallLogUpdatesController
};
