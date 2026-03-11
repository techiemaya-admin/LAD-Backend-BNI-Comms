/**
 * Social Integration Feature Manifest
 * 
 * Unified social media integration using Unipile API
 * Supports: LinkedIn, Instagram, WhatsApp, Facebook
 * 
 * Platform Toggles: Enable/disable per-client access to specific platforms
 * Credit System: Different costs per platform and action type
 */

module.exports = {
  id: 'social-integration',
  key: 'social-integration',
  name: 'Social Integration',
  version: '1.0.0',
  category: 'social-media',
  
  // Routes this feature handles
  routes: [
    '/:platform/status',
    '/:platform/connect',
    '/:platform/disconnect',
    '/:platform/reconnect',
    '/:platform/send-invitation',
    '/:platform/send-message',
    '/:platform/verify-otp',
    '/:platform/solve-checkpoint',
    '/:platform/checkpoint-status'
  ],
  
  description: 'Unified social media integration for LinkedIn, Instagram, WhatsApp, and Facebook. Connect accounts, send invitations, manage connections, and automate outreach across multiple platforms.',
  
  // Feature status
  enabled: true,
  beta: false,
  
  // Supported platforms with individual toggles
  platforms: {
    linkedin: {
      enabled: true,
      name: 'LinkedIn',
      provider: 'LINKEDIN',
      features: ['connect', 'send-invitation', 'messaging', 'profile-lookup'],
      costPerAction: {
        connect: 1,           // Credits per account connection
        invitation: 1,        // Credits per connection request sent
        message: 2,           // Credits per message sent
        lookup: 0.5,          // Credits per profile lookup
      }
    },
    instagram: {
      enabled: true,
      name: 'Instagram',
      provider: 'INSTAGRAM',
      features: ['connect', 'messaging', 'follow'],
      costPerAction: {
        connect: 1,
        follow: 0.5,
        message: 2,
        lookup: 0.5,
      }
    },
    whatsapp: {
      enabled: true,
      name: 'WhatsApp',
      provider: 'WHATSAPP',
      features: ['connect', 'messaging'],
      costPerAction: {
        connect: 1,
        message: 3,           // Higher cost due to direct messaging
      }
    },
    facebook: {
      enabled: true,
      name: 'Facebook',
      provider: 'FACEBOOK',
      features: ['connect', 'messaging', 'friend-request'],
      costPerAction: {
        connect: 1,
        friendRequest: 1,
        message: 2,
        lookup: 0.5,
      }
    }
  },
  
  // API Configuration
  api: {
    basePath: '/api/social-integration',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100
    }
  },
  
  // Environment variables required
  requiredEnv: [
    'UNIPILE_DSN',        // Unipile API base URL
    'UNIPILE_TOKEN',      // Unipile API authentication token
  ],
  
  // Optional environment variables
  optionalEnv: [
    'LINKEDIN_CLIENT_ID',     // For OAuth flow
    'LINKEDIN_CLIENT_SECRET',
    'LINKEDIN_REDIRECT_URI',
    'INSTAGRAM_APP_ID',
    'INSTAGRAM_APP_SECRET',
    'FACEBOOK_APP_ID',
    'FACEBOOK_APP_SECRET',
  ],
  
  // Database tables used
  database: {
    tables: [
      'users_voiceagent',          // User authentication
      'social_accounts',           // Connected social accounts (to be created)
      'social_invitations',        // Invitation tracking (to be created)
      'credit_transactions',       // Credit usage tracking
    ]
  },
  
  // Feature permissions
  permissions: {
    admin: ['all'],
    user: ['connect', 'send-invitation', 'messaging', 'view-status'],
    viewer: ['view-status']
  },
  
  // Endpoints exposed
  endpoints: [
    {
      method: 'GET',
      path: '/platforms',
      description: 'List available platforms and their status',
      auth: true
    },
    {
      method: 'POST',
      path: '/:platform/connect',
      description: 'Connect a social media account',
      auth: true,
      params: ['platform']
    },
    {
      method: 'GET',
      path: '/:platform/status',
      description: 'Check connection status for a platform',
      auth: true,
      params: ['platform']
    },
    {
      method: 'POST',
      path: '/:platform/disconnect',
      description: 'Disconnect a social media account',
      auth: true,
      params: ['platform']
    },
    {
      method: 'POST',
      path: '/:platform/send-invitation',
      description: 'Send connection request/invitation',
      auth: true,
      params: ['platform']
    },
    {
      method: 'POST',
      path: '/:platform/batch-send-invitations',
      description: 'Batch send invitations with automatic delays',
      auth: true,
      params: ['platform']
    },
    {
      method: 'POST',
      path: '/:platform/send-message',
      description: 'Send direct message',
      auth: true,
      params: ['platform']
    },
    {
      method: 'GET',
      path: '/:platform/lookup',
      description: 'Look up profile information',
      auth: true,
      params: ['platform']
    },
    {
      method: 'GET',
      path: '/:platform/invitations',
      description: 'Get status of sent invitations',
      auth: true,
      params: ['platform']
    },
    {
      method: 'GET',
      path: '/:platform/messages',
      description: 'Get messages for an account',
      auth: true,
      params: ['platform']
    },
    {
      method: 'GET',
      path: '/:platform/conversations',
      description: 'Get conversations for an account',
      auth: true,
      params: ['platform']
    },
    {
      method: 'GET',
      path: '/accounts',
      description: 'List all connected social accounts',
      auth: true
    },
    {
      method: 'POST',
      path: '/webhook',
      description: 'Unipile webhook for platform events (connection accepted/declined, messages, account status)',
      auth: false,
      events: [
        'new_relation - Primary event when connection request is accepted',
        'connection.accepted / invitation.accepted - Alternative acceptance events',
        'connection.sent / invitation.sent - Connection request sent',
        'connection.declined / invitation.declined - Connection request declined',
        'AccountStatus - Account state changes (OK, ERROR, STOPPED, CREDENTIALS, etc.)',
        'message.received - New message received'
      ],
      timing: {
        best: '1-5 seconds (active sync)',
        normal: '5-30 seconds (most notifications)',
        typical: '30-60 seconds (average)',
        delayed: '1-2 minutes (high load)',
        veryDelayed: '15-30 minutes (inactive account, waiting for sync cycle)'
      },
      automated: {
        leadUpdates: 'Automatically updates lead status when connections accepted',
        phoneReveal: 'Triggers phone number reveal via Apollo when LinkedIn connections accepted',
        autoCall: 'Can trigger automatic voice calls after connections (configurable via LINKEDIN_AUTO_CALL_ENABLED)'
      }
    },
    {
      method: 'GET',
      path: '/webhook/test',
      description: 'Test endpoint to verify webhook accessibility',
      auth: false
    }
  ],
  
  // Feature flags for gradual rollout
  featureFlags: {
    batchInvitations: true,      // Send invitations in batch
    autoRetry: true,             // Auto-retry failed invitations
    webhookSupport: true,        // Handle Unipile webhooks
    analyticsTracking: true,     // Track success/failure metrics
    autoCallOnAccept: true,      // Automatically call leads when connection accepted
    phoneReveal: true,           // Automatically reveal phone numbers via Apollo
  },
  
  // Webhook configuration
  webhook: {
    url: '/api/social-integration/webhook',
    testUrl: '/api/social-integration/webhook/test',
    supportedEvents: [
      'new_relation',
      'connection.accepted',
      'connection.sent',
      'connection.declined',
      'AccountStatus',
      'message.received'
    ],
    features: {
      duplicatePrevention: true,   // Prevents duplicate event processing
      autoLeadCreation: true,       // Auto-creates leads from connections
      leadStatusUpdates: true,      // Updates lead statuses based on events
      phoneReveal: true,            // Triggers phone reveal via Apollo
      autoCall: true,               // Triggers automatic calls (configurable)
      batchMode: false              // Batch mode for scheduled calls vs immediate
    }
  },
  
  // Client-specific overrides (can be set per tenant)
  clientSettings: {
    // Example: clientId => { platforms: { linkedin: { enabled: false } } }
  }
};
