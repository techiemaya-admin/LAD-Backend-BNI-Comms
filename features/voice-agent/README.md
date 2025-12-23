# Voice Agent Feature

AI-powered voice calling system with VAPI integration, batch calling, phone resolution, and recording management.

## Features

- ✅ **VAPI Integration** - AI voice calls with dynamic greetings
- ✅ **Batch Calling** - Initiate multiple calls with context priority
- ✅ **Phone Resolution** - Resolve phone numbers from company/employee caches
- ✅ **Recording Management** - Signed URLs for call recordings and voice samples
- ✅ **Multi-tenant** - Full tenant isolation with row-level security
- ✅ **JWT Authentication** - Secure user-specific endpoints
- ✅ **Call Logging** - Track all calls with status, duration, cost
- ✅ **Statistics** - Call analytics and reporting

## Architecture

```
voice-agent/
├── models/           # Database models (VoiceCallModel, VoiceAgentModel, etc.)
├── services/         # Business logic (VAPIService, CallLoggingService, RecordingService)
├── controllers/      # Request handlers (VoiceAgentController, CallController)
├── routes.js         # Express routes with JWT auth
├── index.js          # Feature entry point
└── *.md             # Documentation
```

## Quick Start

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for complete setup instructions.

### 1. Environment Variables

```env
VAPI_API_KEY=your_vapi_api_key
VAPI_ASSISTANT_ID=your_vapi_assistant_id
VAPI_PHONE_NUMBER_ID=your_vapi_phone_number_id
BASE_URL=https://your-api-domain.com
```

### 2. Register Routes

```javascript
const voiceAgentFeature = require('./features/voice-agent');
const voiceAgentRouter = voiceAgentFeature.createRouter(db, {
  jwtAuth: yourJwtMiddleware,
  tenantMiddleware: yourTenantMiddleware
});
app.use('/api/voiceagent', voiceAgentRouter);
```

### 3. Database Setup

Run migrations from `DATABASE_MIGRATION.md` and `backend/core/DATABASE_SCHEMA.md`.

## API Endpoints

### Call Management
- `POST /calls` - Initiate single call
- `POST /calls/batch` - Initiate batch calls
- `GET /calls/:id/recording-signed-url` - Get recording URL
- `GET /calls/recent` - Get recent calls
- `GET /calls/stats` - Get call statistics

### Resource Management
- `GET /user/available-agents` - User's agents (JWT)
- `GET /user/available-numbers` - User's numbers (JWT)
- `GET /voices/:id/sample-signed-url` - Voice sample URL (JWT)
- `GET /agents/:agentId/sample-signed-url` - Agent voice URL (JWT)
- `GET /all` - All agents
- `GET /agent/:name` - Agent by name
- `GET /voices` - All voices
- `GET /numbers` - All phone numbers

### Phone Resolution
- `POST /resolve-phones` - Resolve phones from caches
- `POST /update-summary` - Update sales summary

## Documentation

- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Setup and usage guide
- **[MIGRATION_STATUS.md](./MIGRATION_STATUS.md)** - Migration plan and feature details
- **[SCHEMA_MAPPING.md](./SCHEMA_MAPPING.md)** - Old to new schema mapping
- **[DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md)** - Database migration guide
- **[MODEL_GAPS_ANALYSIS.md](./MODEL_GAPS_ANALYSIS.md)** - Architecture analysis
- **[manifest.js](./manifest.js)** - Feature configuration

## Dependencies

- `axios` - HTTP client for VAPI API
- `express` - Web framework
- `pg` - PostgreSQL client (peer dependency)

## Models

- **VoiceCallModel** - Call logging and tracking
- **VoiceAgentModel** - Agent management
- **VoiceModel** - Voice profile management
- **PhoneNumberModel** - Phone number inventory
- **PhoneResolverModel** - Phone resolution from caches
- **TenantModel** - Tenant management (core)
- **UserModel** - User management (core)
- **MembershipModel** - User-tenant relationships (core)

## Services

- **VAPIService** - VAPI API integration
- **CallLoggingService** - Call tracking
- **RecordingService** - Recording URL signing

## Controllers

- **VoiceAgentController** - Resource management endpoints
- **CallController** - Call operation endpoints

## License

UNLICENSED
