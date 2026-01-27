/**
 * Services Index 1.0
 * 
 * Exports all voice agent services
 */

const VAPIService = require('./VAPIService');
const CallLoggingService = require('./CallLoggingService');
const RecordingService = require('./RecordingService');

module.exports = {
  VAPIService,
  CallLoggingService,
  RecordingService
};
