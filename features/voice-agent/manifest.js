/**
 * Voice Agent Feature Manifest 2.0.2
 * 
 * AI-powered voice calling system with VAPI integration
 * Supports single calls, batch calling, recording management, and multi-agent support
 */

module.exports = {
  id: 'voice-agent',
  key: 'voice-agent',
  name: 'Voice Agent',
  version: '1.0.0',
  category: 'communication',
  
  // Routes this feature handles
  routes: [
    '/user/available-agents',
    '/user/available-numbers',
    '/voices/:id/sample-signed-url',
    '/agents/:agentId/sample-signed-url',
    '/test',
    '/all',
    '/agent/:name',
    '/calls',
    '/calls/batch',
    '/calls/:id/recording-signed-url',
    '/calls/recent',
    '/calls/stats',
    '/calllogs',
    '/calllogs/:call_log_id',
    '/resolve-phones',
    '/update-summary',
    '/settings',
    '/numbers',
    // V2 API routes
    '/calls/start-call',
    '/batch/trigger-batch-call',
    '/calls/job/:job_id',
    '/batch/batch-status/:id',
    '/batch/batch-cancel/:id'
  ],
  
  description: 'AI-powered voice calling system. Initiate single or batch calls, manage voice agents, retrieve recordings, and handle call logging.',
  
  // Feature status
  enabled: true,
  beta: false,
  
  // Supported providers
  providers: {
    vapi: {
      enabled: true,
      name: 'VAPI',
      agentId: '24',
      description: 'Primary AI voice agent provider',
      features: ['outbound-calls', 'assistant-overrides', 'dynamic-greetings', 'metadata']
    },
    custom: {
      enabled: true,
      name: 'Custom Voice Agents',
      description: 'Internal voice agents with custom voices',
      features: ['outbound-calls', 'batch-calls', 'voice-selection']
    }
  },
  
  // API Configuration
  api: {
    basePath: '/api/voice-agent',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100
    }
  },
  
  // Environment variables required
  requiredEnv: [
    'VAPI_API_KEY',           // VAPI API key for call initiation
    'VAPI_ASSISTANT_ID',      // Default VAPI assistant ID
    'VAPI_PHONE_NUMBER_ID',   // VAPI phone number to call from
    'BASE_URL',               // Base URL for external API calls
  ],
  
  // Optional environment variables
  optionalEnv: [
    'DEFAULT_FROM_NUMBER',    // Default caller ID (if not VAPI)
    'BASE_URL_FRONTEND_HEADER', // Custom header for external API auth
    'BASE_URL_FRONTEND_APIKEY', // API key for external API auth
    'SIGNING_ENDPOINT_URL',   // GCS signed URL generation endpoint
  ],
  
  // Database tables used
  database: {
    schema: 'voice_agent',
    tables: [
      'agents_voiceagent',              // Voice agents configuration
      'voices_voiceagent',              // Voice samples and metadata
      'numbers_voiceagent',             // Phone numbers pool
      'call_logs_voiceagent',           // Call history and recordings
      'leads_voiceagent',               // Voice agent leads (separate from main leads)
      'v_user_available_agents',        // View: user's available agents
      'v_user_available_numbers',       // View: user's available phone numbers
    ],
    external: [
      'public.leads',                   // Main leads table
      'public.company_search_cache',    // Company data with phone numbers
      'public.employees_cache',         // Employee data with phone numbers
      'organization_settings',          // Organization default agents
    ]
  },
  
  // Feature capabilities
  features: {
    singleCalls: {
      enabled: true,
      description: 'Initiate single outbound calls',
      credits: 1,
      vapi: true,
      customAgents: true
    },
    batchCalls: {
      enabled: true,
      description: 'Initiate multiple calls in batch',
      credits: 'per call',
      perEntryContext: true,
      customAgents: true
    },
    recordingManagement: {
      enabled: true,
      description: 'Retrieve call recordings with signed URLs',
      gcsIntegration: true,
      urlExpiration: '96 hours default'
    },
    voiceSelection: {
      enabled: true,
      description: 'Choose from multiple voice profiles',
      voiceSamples: true
    },
    dynamicGreeting: {
      enabled: true,
      description: 'Time-based greetings (morning/afternoon/evening)',
      vapiOnly: true
    },
    leadManagement: {
      enabled: true,
      description: 'Auto-create leads in voice_agent.leads_voiceagent',
      syncWithMainLeads: true
    },
    phoneResolution: {
      enabled: true,
      description: 'Resolve phone numbers from company/employee caches',
      sources: ['company_search_cache', 'employees_cache']
    },
    salesSummary: {
      enabled: true,
      description: 'Update sales summaries for companies/employees',
      types: ['company', 'employee']
    }
  },
  
  // Endpoints
  endpoints: [
    {
      method: 'GET',
      path: '/test',
      description: 'Test endpoint to verify feature is working',
      auth: false
    },
    {
      method: 'GET',
      path: '/user/available-agents',
      description: 'Get user\'s available voice agents',
      auth: true,
      params: {
        query: {
          voice_agent_user_id: 'string (optional, from JWT or query)'
        }
      }
    },
    {
      method: 'GET',
      path: '/user/available-numbers',
      description: 'Get user\'s available phone numbers',
      auth: true,
      params: {
        query: {
          voice_agent_user_id: 'string (optional, from JWT or query)'
        }
      }
    },
    {
      method: 'GET',
      path: '/voices/:id/sample-signed-url',
      description: 'Get signed URL for voice sample',
      auth: true,
      params: {
        path: { id: 'string (voice ID)' },
        query: { expiration_hours: 'number (default: 96)' }
      }
    },
    {
      method: 'GET',
      path: '/agents/:agentId/sample-signed-url',
      description: 'Get signed URL for agent\'s voice sample',
      auth: true,
      params: {
        path: { agentId: 'string (agent ID)' },
        query: { expiration_hours: 'number (default: 96)' }
      }
    },
    {
      method: 'GET',
      path: '/all',
      description: 'Get all voice agents (admin)',
      auth: false
    },
    {
      method: 'GET',
      path: '/',
      description: 'Get all voices (legacy endpoint)',
      auth: false
    },
    {
      method: 'GET',
      path: '/numbers',
      description: 'Get all available phone numbers',
      auth: false
    },
    {
      method: 'GET',
      path: '/agent/:name',
      description: 'Get agent details by name',
      auth: false,
      params: {
        path: { name: 'string (agent name)' }
      }
    },
    {
      method: 'GET',
      path: '/voices',
      description: 'Get all voice profiles',
      auth: false
    },
    {
      method: 'POST',
      path: '/calls',
      description: 'Initiate a single outbound call',
      auth: false,
      params: {
        body: {
          agent_id: 'string|number (agent ID, use "24" or "VAPI" for VAPI)',
          voice_id: 'string (optional, resolved from agent_id)',
          to_number: 'string (required, phone number to call)',
          from_number: 'string (optional, defaults to DEFAULT_FROM_NUMBER)',
          added_context: 'string (required, context for the call)',
          lead_name: 'string (optional, lead name for greeting)',
          initiated_by: 'string (optional, who initiated the call)'
        }
      },
      vapi: {
        routing: 'agent_id === "24" or "VAPI" triggers VAPI',
        assistantId: 'VAPI_ASSISTANT_ID from env',
        phoneNumberId: 'VAPI_PHONE_NUMBER_ID from env',
        dynamicGreeting: 'Time-based (morning/afternoon/evening)',
        firstMessage: 'Hi {lead_name}. {greeting}. This is Nithya from Pluto Travels...'
      }
    },
    {
      method: 'POST',
      path: '/calls/batch',
      description: 'Initiate batch outbound calls',
      auth: false,
      params: {
        body: {
          agent_id: 'string|number (required, agent ID)',
          voice_id: 'string (optional, resolved from agent_id)',
          from_number: 'string (optional, defaults to DEFAULT_FROM_NUMBER)',
          added_context: 'string (optional, fallback context)',
          initiated_by: 'string (optional, who initiated the batch)',
          entries: 'array (required, call entries)',
          'entries[].to_number': 'string (required, phone number)',
          'entries[].lead_name': 'string (optional, lead name)',
          'entries[].added_context': 'string (optional, per-entry context)',
          'entries[].summary': 'string (optional, fallback to this if no added_context)'
        }
      },
      notes: [
        'Per-entry context: entries[].added_context > entries[].summary > body.added_context',
        'Forwards to BASE_URL/calls/batch',
        'Requires voice_id resolution from agent_id'
      ]
    },
    {
      method: 'GET',
      path: '/calls/:id/recording-signed-url',
      description: 'Get signed URL for call recording',
      auth: false,
      params: {
        path: { id: 'string (call log ID)' },
        query: { expiration_hours: 'number (optional, default: 96)' }
      },
      notes: [
        'Fetches recording URL from call_logs_voiceagent',
        'Generates GCS signed URL via BASE_URL/recordings/calls/:id/signed-url',
        'Returns publicly accessible URL valid for specified hours'
      ]
    },
    {
      method: 'GET',
      path: '/calllogs',
      description: 'Get list of call logs',
      auth: true,
      params: {
        query: {
          page: 'number (optional, default: 1)',
          limit: 'number (optional, default: 20)',
          status: 'string (optional, filter by status)',
          date_from: 'string (optional, ISO date)',
          date_to: 'string (optional, ISO date)'
        }
      }
    },
    {
      method: 'GET',
      path: '/calllogs/:call_log_id',
      description: 'Get specific call log by ID',
      auth: true,
      params: {
        path: {
          call_log_id: 'string (required, call log ID)'
        }
      }
    },
    {
      method: 'POST',
      path: '/resolve-phones',
      description: 'Resolve phone numbers from company/employee caches',
      auth: false,
      params: {
        body: {
          ids: 'array (required, company/employee IDs)',
          type: 'string (required, "company" or "employee")'
        }
      },
      response: {
        data: [
          {
            requested_id: 'string (original ID)',
            cache_row_id: 'string (cache table row ID)',
            phone: 'string (resolved phone number)',
            name: 'string (company/employee name)',
            sales_summary: 'string (sales summary if available)',
            source: 'string (source table)',
            raw: 'object (raw data)'
          }
        ]
      }
    },
    {
      method: 'POST',
      path: '/update-summary',
      description: 'Update sales summary for company/employee',
      auth: false,
      params: {
        body: {
          type: 'string (required, "company" or "employee")',
          summary: 'string (required, sales summary text)',
          cache_row_id: 'string (optional, cache row ID)',
          apollo_organization_id: 'string (optional, for company)',
          company_data_id: 'string (optional, for company)',
          apollo_person_id: 'string (optional, for employee)',
          employee_data_id: 'string (optional, for employee)'
        }
      },
      notes: [
        'Requires at least one identifier',
        'Updates company_search_cache or employees_cache',
        'Returns number of rows updated'
      ]
    }
  ],
  
  // VAPI Configuration
  vapi: {
    agentId: '24',
    apiEndpoint: 'https://api.vapi.ai/call',
    authentication: 'Bearer token',
    features: {
      assistantOverrides: true,
      customMetadata: true,
      dynamicGreeting: true,
      firstMessageCustomization: true
    },
    greetings: {
      morning: 'Good morning',        // 0:00 - 11:59
      afternoon: 'Good afternoon',    // 12:00 - 16:59
      evening: 'Good evening'         // 17:00 - 23:59
    }
  },
  
  // Call logging
  callLogging: {
    enabled: true,
    table: 'voice_agent.call_logs_voiceagent',
    fields: [
      'voice_id',
      'from_number',
      'to_number',
      'started_at',
      'status (calling, ongoing, ended, declined, failed)',
      'added_context',
      'agent_id',
      'target (lead_id from voice_agent.leads_voiceagent)',
      'recording_url (gs:// URL)',
      'initiated_by'
    ]
  },
  
  // Integration points
  integrations: {
    mainLeads: {
      description: 'Syncs with public.leads table',
      fields: ['name', 'email', 'company']
    },
    companyCache: {
      description: 'Resolves phone numbers from company_search_cache',
      table: 'company_search_cache'
    },
    employeeCache: {
      description: 'Resolves phone numbers from employees_cache',
      table: 'employees_cache'
    },
    gcsStorage: {
      description: 'Stores call recordings in Google Cloud Storage',
      urlFormat: 'gs://bucket/path/to/recording.wav'
    }
  },
  
  // Feature flags
  featureFlags: {
    vapiIntegration: true,        // Use VAPI for AI calls
    customAgents: true,           // Support custom voice agents
    batchCalling: true,           // Enable batch calls
    recordingStorage: true,       // Store call recordings
    leadAutoCreation: true,       // Auto-create leads in voice_agent schema
    phoneResolution: true,        // Resolve phones from caches
    salesSummaryUpdates: true,    // Update sales summaries
    dynamicGreeting: true,        // Time-based greetings
  }
};
