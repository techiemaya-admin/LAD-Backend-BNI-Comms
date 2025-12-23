# Voice Agent Feature - Integration Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install express axios
```

### 2. Environment Variables

Add to your `.env` file:

```env
# VAPI Configuration (Required for VAPI calls)
VAPI_API_KEY=your_vapi_api_key
VAPI_ASSISTANT_ID=your_vapi_assistant_id
VAPI_PHONE_NUMBER_ID=your_vapi_phone_number_id

# Base URL for recording service
BASE_URL=https://your-api-domain.com

# Optional
DEFAULT_FROM_NUMBER=+1234567890
SIGNING_ENDPOINT_URL=https://your-signing-service.com
```

### 3. Register Routes in Your Server

```javascript
// server.js or app.js
const express = require('express');
const { Pool } = require('pg');
const voiceAgentFeature = require('./features/voice-agent');

const app = express();
const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(express.json());

// Your JWT authentication middleware
const jwtAuth = (req, res, next) => {
  // Extract and verify JWT token
  const token = req.headers.authorization?.replace('Bearer ', '');
  // ... verify token
  req.user = {
    id: 'user-uuid',
    tenantId: 'tenant-uuid',
    email: 'user@example.com'
  };
  next();
};

// Your tenant middleware (optional if using JWT)
const tenantMiddleware = (req, res, next) => {
  req.tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
  if (!req.tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }
  next();
};

// Register voice agent routes
const voiceAgentRouter = voiceAgentFeature.createRouter(db, {
  jwtAuth,
  tenantMiddleware
});

app.use('/api/voiceagent', voiceAgentRouter);

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### 4. Alternative: Without Custom Middleware

If you want to use the default middleware (not recommended for production):

```javascript
const voiceAgentRouter = voiceAgentFeature.createRouter(db);
app.use('/api/voiceagent', voiceAgentRouter);
```

Then include tenant_id in requests:
- Header: `X-Tenant-Id: your-tenant-uuid`
- Query param: `?tenant_id=your-tenant-uuid`

---

## API Endpoints

### JWT-Protected Endpoints

```bash
# Get user's available agents
GET /api/voiceagent/user/available-agents
Headers: Authorization: Bearer <token>

# Get user's available phone numbers
GET /api/voiceagent/user/available-numbers
Headers: Authorization: Bearer <token>

# Get voice sample signed URL
GET /api/voiceagent/voices/:id/sample-signed-url?expiration_hours=96
Headers: Authorization: Bearer <token>

# Get agent voice sample signed URL
GET /api/voiceagent/agents/:agentId/sample-signed-url?expiration_hours=96
Headers: Authorization: Bearer <token>
```

### Public Endpoints

```bash
# Test endpoint
GET /api/voiceagent/test

# Get all agents
GET /api/voiceagent/all

# Get agent by name
GET /api/voiceagent/agent/:name

# Get all voices
GET /api/voiceagent/voices

# Get all phone numbers
GET /api/voiceagent/numbers
```

### Call Endpoints

```bash
# Initiate single call
POST /api/voiceagent/calls
Body: {
  "phoneNumber": "+1234567890",
  "leadName": "John Doe",
  "leadId": "lead-uuid",
  "agentId": "24",
  "voiceId": "voice-uuid",
  "fromNumber": "+0987654321",
  "addedContext": "Follow-up call for demo"
}

# Initiate batch calls
POST /api/voiceagent/calls/batch
Body: {
  "entries": [
    {
      "phoneNumber": "+1234567890",
      "leadName": "John Doe",
      "leadId": "lead-uuid",
      "added_context": "Demo follow-up"
    }
  ],
  "agentId": "24",
  "voiceId": "voice-uuid",
  "fromNumber": "+0987654321",
  "added_context": "Global context for all calls"
}

# Get call recording signed URL
GET /api/voiceagent/calls/:id/recording-signed-url?expiration_hours=96

# Get recent calls
GET /api/voiceagent/calls/recent?status=ended&agent_id=24

# Get call statistics
GET /api/voiceagent/calls/stats?start_date=2025-01-01&end_date=2025-01-31

# Resolve phone numbers
POST /api/voiceagent/resolve-phones
Body: {
  "ids": ["company-id-1", "company-id-2"],
  "type": "company"
}

# Update sales summary
POST /api/voiceagent/update-summary
Body: {
  "id": "company-id",
  "type": "company",
  "sales_summary": "## Updated summary"
}
```

---

## Database Migration

### Run migrations to create tables:

```bash
# See DATABASE_MIGRATION.md for complete SQL schemas
psql -h $DB_HOST -U $DB_USER -d $DB_NAME << EOF
-- Create core tables (tenants, users, memberships)
-- Create voice agent tables (voice_calls, voice_agents, voices, phone_numbers)
-- See backend/core/DATABASE_SCHEMA.md
-- See backend/features/voice-agent/DATABASE_MIGRATION.md
EOF
```

---

## Usage Examples

### Example: Initiate VAPI Call

```javascript
const axios = require('axios');

const response = await axios.post(
  'https://your-api.com/api/voiceagent/calls',
  {
    phoneNumber: '+1234567890',
    leadName: 'John Doe',
    agentId: '24', // VAPI agent
    addedContext: 'Follow-up call regarding the demo'
  },
  {
    headers: {
      'X-Tenant-Id': 'your-tenant-uuid',
      'Content-Type': 'application/json'
    }
  }
);

console.log('Call initiated:', response.data);
// {
//   success: true,
//   message: 'Call initiated via VAPI',
//   data: {
//     callId: 'call-uuid',
//     vapiCallId: 'vapi-call-id',
//     status: 'queued',
//     phoneNumber: '+1234567890',
//     leadName: 'John Doe'
//   }
// }
```

### Example: Batch Calls

```javascript
const response = await axios.post(
  'https://your-api.com/api/voiceagent/calls/batch',
  {
    entries: [
      {
        phoneNumber: '+1111111111',
        leadName: 'Alice',
        added_context: 'Product demo follow-up'
      },
      {
        phoneNumber: '+2222222222',
        leadName: 'Bob',
        summary: 'Interested in enterprise plan'
      }
    ],
    agentId: '24',
    added_context: 'Q4 outreach campaign'
  },
  {
    headers: {
      'X-Tenant-Id': 'your-tenant-uuid'
    }
  }
);

console.log('Batch results:', response.data);
```

### Example: Resolve Phone Numbers

```javascript
const response = await axios.post(
  'https://your-api.com/api/voiceagent/resolve-phones',
  {
    ids: ['apollo-org-123', 'apollo-org-456'],
    type: 'company'
  },
  {
    headers: {
      'X-Tenant-Id': 'your-tenant-uuid'
    }
  }
);

console.log('Resolved phones:', response.data);
// {
//   success: true,
//   data: [
//     {
//       requested_id: 'apollo-org-123',
//       phone: '+1234567890',
//       name: 'Company A',
//       sales_summary: '## Previous notes',
//       source: 'company_search_cache'
//     }
//   ]
// }
```

---

## Using Models Directly

If you need to use models in other parts of your application:

```javascript
const { models } = require('./features/voice-agent');
const { VoiceCallModel, VoiceAgentModel, TenantModel } = models;

// Initialize with your DB pool
const callModel = new VoiceCallModel(db);

// Use methods
const recentCalls = await callModel.getRecentCalls(tenantId, 10);
const callStats = await callModel.getCallStats(tenantId, { 
  startDate: new Date('2025-01-01') 
});
```

---

## Using Services Directly

```javascript
const { services } = require('./features/voice-agent');
const { VAPIService, CallLoggingService } = services;

// Initialize VAPI service
const vapiService = new VAPIService({
  apiKey: process.env.VAPI_API_KEY,
  assistantId: process.env.VAPI_ASSISTANT_ID,
  phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID
});

// Initiate a call
const result = await vapiService.initiateCall({
  phoneNumber: '+1234567890',
  leadName: 'John Doe',
  agentId: '24',
  addedContext: 'Follow-up call'
});

console.log('VAPI result:', result);
```

---

## Feature Flags

Check if voice agent feature is enabled for a tenant:

```javascript
const { TenantModel } = require('./core/models');
const tenantModel = new TenantModel(db);

const isEnabled = await tenantModel.isFeatureEnabled(
  tenantId,
  'voice_calls'
);

if (isEnabled?.feature_value?.enabled) {
  // Feature is enabled
  console.log('Limit:', isEnabled.feature_value.limit);
}
```

---

## Testing

```bash
# Test the API
curl http://localhost:3000/api/voiceagent/test

# Test with tenant ID
curl http://localhost:3000/api/voiceagent/all \
  -H "X-Tenant-Id: your-tenant-uuid"

# Test call initiation
curl -X POST http://localhost:3000/api/voiceagent/calls \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: your-tenant-uuid" \
  -d '{
    "phoneNumber": "+1234567890",
    "leadName": "Test Lead",
    "agentId": "24",
    "addedContext": "Test call"
  }'
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description"
}
```

Common status codes:
- `400` - Bad request (missing/invalid parameters)
- `401` - Unauthorized (JWT required)
- `404` - Resource not found
- `500` - Internal server error
- `501` - Not implemented (e.g., custom agents)

---

## Next Steps

1. ✅ Set up database tables (run migrations)
2. ✅ Configure environment variables
3. ✅ Integrate JWT authentication
4. ✅ Register routes in your server
5. ✅ Test endpoints
6. ⏭️ Set up VAPI webhooks for call status updates
7. ⏭️ Implement custom agent logic (if needed)
8. ⏭️ Add monitoring and logging

---

## Support

For issues or questions:
- Check `MIGRATION_STATUS.md` for feature details
- Check `SCHEMA_MAPPING.md` for database mapping
- Check `MODEL_GAPS_ANALYSIS.md` for architecture details

