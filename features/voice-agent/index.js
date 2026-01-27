/**
 * Voice Agent Feature Index
 * 
 * Main entry point for the voice agent feature module
 * Exports router, models, services, and controllers
 */

const createVoiceAgentRouter = require('./routes');
const models = require('./models');
const services = require('./services');
const controllers = require('./controllers');

module.exports = {
  // Router factory
  createRouter: createVoiceAgentRouter,
  
  // Models
  models,
  
  // Services
  services,
  
  // Controllers
  controllers,
  
  // Feature metadata
  meta: {
    id: 'voice-agent',
    name: 'Voice Agent',
    version: '1.0.0',
    description: 'AI-powered voice calling with VAPI integration'
  }
};
