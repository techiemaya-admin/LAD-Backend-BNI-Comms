# Backend Integration Guide

## Route Mounting

The Voice Agent feature **MUST** be mounted at `/api/voice-agent` (with hyphen) in the main LAD backend.

### Correct Integration

```javascript
// In your main backend (server.js, app.js, or features loader)
const voiceAgentFeature = require('./features/voice-agent');

// Mount the router at the correct path
app.use('/api/voice-agent', voiceAgentFeature.createRouter(db, {
  jwtAuth: jwtAuthMiddleware,
  tenantMiddleware: tenantExtractionMiddleware
}));
```

### ❌ Common Mistake

```javascript
// WRONG - Do not use this path
app.use('/api/voiceagent', voiceAgentFeature.createRouter(...));
```

### Why It Matters

- **Manifest Definition:** The `manifest.js` declares `basePath: '/api/voice-agent'`
- **Frontend SDK:** Expects routes at `/api/voice-agent/*`
- **CORS Issues:** Wrong path causes 404 errors that bypass CORS headers
- **API Documentation:** All docs reference `/api/voice-agent`

### Verification

After deployment, test the endpoint:

```bash
# Should return 200 or 401 (auth required)
curl https://your-backend.run.app/api/voice-agent/all \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should NOT return 404
```

### Production Checklist

- [ ] Main backend mounts at `/api/voice-agent`
- [ ] CORS is configured for voice-agent routes
- [ ] Environment variables are set (see `.env.example`)
- [ ] Database migrations are applied
- [ ] JWT authentication middleware is connected
- [ ] Tenant middleware is connected

## Environment Variables

Refer to `.env.example` for required configuration.

## Database Setup

Ensure all tables exist in the tenant schema:
- `voice_agents`
- `voice_agent_voices`
- `voice_agent_numbers`
- `voice_call_logs`

See database migration files for schema details.
