/**
 * Deals Pipeline Feature Manifest
 * 
 * PURPOSE:
 * Complete pipeline management system for deal tracking, stages, and sales flow.
 * Refactored to follow Canonical LAD architecture.
 * 
 * FEATURE CAPABILITIES:
 * - Deal/Lead management (CRUD)
 * - Pipeline stages and board visualization
 * - Lead statuses, priorities, and sources
 * - Stage reordering and customization
 * - Lead attachments and notes
 * - Multi-tenant isolation
 */

module.exports = {
  key: 'deals-pipeline',
  name: 'Deals Pipeline',
  version: '2.0.0',
  description: 'Complete pipeline management for deal tracking and sales flow',
  
  // Feature availability
  plans: ['professional', 'enterprise'],
  alwaysAvailable: true,
  
  // Base path (CRITICAL: Changed from /api/leads to /api/deals-pipeline)
  basePath: '/api/deals-pipeline',
  
  // Routes this feature handles
  routes: [
    // Leads
    '/leads',
    '/leads/:id',
    '/leads/stats',
    
    // Stages
    '/stages',
    '/stages/:key',
    '/stages/reorder',
    
    // Pipeline
    '/pipeline/board',
    '/pipeline/leads/:id/stage',
    '/pipeline/leads/:id/status',
    
    // Reference data
    '/reference/statuses',
    '/reference/sources',
    '/reference/priorities',
    
    // Attachments
    '/leads/:id/notes',
    '/leads/:id/notes/:noteId',

      // Bookings
  '/bookings',
  '/bookings/counsellor/:counsellorId',
  '/bookings/student/:studentId',
  '/bookings/range',
  '/bookings/availability',
  ],
  
  // Database schema
  database: {
    schema: 'lad_dev',
    tables: [
      'leads',
      'lead_stages',
      'lead_statuses',
      'lead_notes'
    ]
  },
  
  // Dependencies (mock these in isolated workspace)
  dependencies: {
    internal: [],
    external: ['pg']
  },
  
  // Architecture
  architecture: {
    pattern: 'Routes → Controllers → Services → Models',
    layers: {
      routes: 'HTTP request handling',
      controllers: 'Request/response coordination',
      services: 'Business logic',
      models: 'Data access'
    }
  },
  
  // File structure
  files: {
    routes: [
      'routes/leads.routes.js',
      'routes/stages.routes.js',
      'routes/pipeline.routes.js',
      'routes/reference.routes.js',
      'routes/attachments.routes.js',
      'routes/booking.routes.js',
      'routes/index.js'
    ],
    controllers: [
      'controllers/lead.controller.js',
      'controllers/stage.controller.js',
      'controllers/pipeline.controller.js',
      'controllers/reference.controller.js',
      'controllers/attachment.controller.js',
      'controllers/booking.controller.js'
    ],
    services: [
      'services/lead.service.js',
      'services/stage.service.js',
      'services/pipeline.service.js',
      'services/reference.service.js',
      'services/attachment.service.js',
      'services/booking.service.js'
    ],
    models: [
      'models/lead.pg.js',
      'models/leadStage.pg.js',
      'models/leadStatus.pg.js',
      'models/booking.pg.js'
    ]
  },
  
  // LAD compliance
  compliance: {
    maxFileSize: 400,
    noDirectFeatureCalls: true,
    tenantIsolation: true,
    noFrontendLogic: true,
    noCrossingLayers: true
  }
};
