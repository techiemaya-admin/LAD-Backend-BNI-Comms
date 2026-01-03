# Voice Agent V2 API Implementation

## Overview
This document describes the V2 API implementation for the voice-agent feature, which adds UUID support and new endpoints while maintaining backward compatibility with V1.

## Implementation Date
January 3, 2026

## New V2 Endpoints

### Single Call API
- **Endpoint**: `POST /api/voice-agent/calls/start-call`
- **Controller**: `CallInitiationController.initiateCallV2()`
- **Changes from V1**:
  - `initiated_by`: Now accepts UUID string (was integer)
  - `lead_id`: Now accepts UUID string (was integer)
  - Added validation for E.164 phone number format
  - Added support for `knowledge_base_store_ids` array

### Batch Call API
- **Endpoint**: `POST /api/voice-agent/batch/trigger-batch-call`
- **Controller**: `BatchCallController.batchInitiateCallsV2()`
- **Changes from V1**:
  - `initiated_by`: Now accepts UUID string (was integer)
  - Per-entry `lead_id`: Now accepts UUID string (was integer)
  - Per-entry `knowledge_base_store_ids`: New field supporting array of strings
  - Enhanced validation for all entries

### Get Job by ID
- **Endpoint**: `GET /api/voice-agent/calls/job/:job_id`
- **Controller**: `CallController.getCallLogByJobId()`
- **Purpose**: Retrieve call log by job ID (V2 naming convention)

### Batch Status
- **Endpoint**: `GET /api/voice-agent/batch/batch-status/:id`
- **Controller**: `BatchCallController.getBatchStatusV2()`
- **Purpose**: Get batch status with V2 endpoint structure

### Cancel Batch
- **Endpoint**: `POST /api/voice-agent/batch/batch-cancel/:id`
- **Controller**: `BatchCallController.cancelBatchV2()`
- **Purpose**: Cancel batch execution with V2 endpoint structure

## Request/Response Formats

### Single Call Request (V2)
```json
{
  "voice_id": "string, required",
  "to_number": "string, required (E.164)",
  "from_number": "string | null",
  "added_context": "string | null",
  "llm_provider": "string | null",
  "llm_model": "string | null",
  "initiated_by": "string | null (UUID)",
  "agent_id": "int | null",
  "lead_name": "string | null",
  "lead_id": "string | null (UUID)",
  "knowledge_base_store_ids": ["string"] | null
}
```

### Batch Call Request (V2)
```json
{
  "voice_id": "string, required",
  "from_number": "string | null",
  "added_context": "string | null",
  "initiated_by": "string | null (UUID)",
  "agent_id": "int | null",
  "llm_provider": "string | null",
  "llm_model": "string | null",
  "knowledge_base_store_ids": ["string"] | null,
  "entries": [
    {
      "to_number": "string, required (E.164)",
      "lead_name": "string | null",
      "added_context": "string | null",
      "lead_id": "string | null (UUID)",
      "knowledge_base_store_ids": ["string"] | null
    }
  ]
}
```

## Breaking Changes from V1

### Type Changes
1. **initiated_by**
   - V1: `int | null`
   - V2: `string (UUID) | null`
   - Migration: Convert user ID to UUID string

2. **lead_id**
   - V1: `int | null`
   - V2: `string (UUID) | null`
   - Migration: Convert lead ID to UUID string

### New Fields
1. **knowledge_base_store_ids** (per-entry in batch calls)
   - Type: `string[] | null`
   - Purpose: Support per-entry knowledge base selection

## LAD Architecture Compliance

### ✅ Follows LAD Rules
1. **Centralized Logging**: Uses `core/utils/logger` for all logging
2. **Repository Pattern**: Maintains separation of concerns with services and controllers
3. **Feature Isolation**: All V2 code is contained within voice-agent feature
4. **Tenant Scoping**: Properly extracts and validates tenant context
5. **Error Handling**: Comprehensive try-catch with proper error responses
6. **Naming Convention**: Uses snake_case for API/HTTP layer, camelCase internally

### Controller Structure
- **CallInitiationController**: Handles single call initiation
- **BatchCallController**: Handles batch call operations
- **CallController**: Handles call log retrieval and management

### Middleware
- **tenantMiddleware**: Validates tenant context for all V2 endpoints
- **jwtAuth**: Authentication for user-specific operations (future enhancement)

## Backward Compatibility

### V1 Endpoints (Maintained)
- `POST /api/voice-agent/calls` - V1 single call
- `POST /api/voice-agent/calls/batch` - V1 batch calls
- `GET /api/voice-agent/calls/:id` - V1 get call log

### Migration Strategy
- V1 and V2 endpoints coexist
- Frontend updated to use V2 endpoints
- Backend services handle both UUID strings and integers gracefully
- No database schema changes required (UUID stored as strings in existing VARCHAR fields)

## External Service Integration

### Configuration
V2 endpoints forward requests to external voice agent service when not using VAPI:
- **BASE_URL**: External service base URL
- **BASE_URL_FRONTEND_HEADER**: Frontend identifier header
- **BASE_URL_FRONTEND_APIKEY**: API key for authentication

### Request Flow
1. Frontend → LAD Backend V2 endpoint
2. LAD Backend validates request
3. LAD Backend forwards to external service (BASE_URL)
4. External service processes call
5. Response returned to frontend

## Testing

### Syntax Validation
All controllers and routes have been validated with Node.js syntax checker:
- ✅ routes/index.js
- ✅ CallInitiationController.js
- ✅ BatchCallController.js
- ✅ CallController.js

### Manual Testing Checklist
- [ ] Single call with UUID initiated_by
- [ ] Batch call with UUID lead_ids
- [ ] Get call log by job_id
- [ ] Batch status retrieval
- [ ] Batch cancellation
- [ ] Error handling for invalid UUIDs
- [ ] E.164 phone number validation

## Files Modified

### Routes
- `features/voice-agent/routes/index.js` - Added V2 route definitions
- `features/voice-agent/manifest.js` - Added V2 routes to feature manifest

### Controllers
- `features/voice-agent/controllers/call-controllers/CallInitiationController.js` - Added `initiateCallV2()`
- `features/voice-agent/controllers/call-controllers/BatchCallController.js` - Added `batchInitiateCallsV2()`, `getBatchStatusV2()`, `cancelBatchV2()`
- `features/voice-agent/controllers/CallController.js` - Added `getCallLogByJobId()`

## Dependencies
- **axios**: Already present in package.json (^1.13.2)
- No new dependencies required

## Next Steps
1. Deploy to staging environment
2. Test with actual voice agent service
3. Monitor logs for any issues
4. Update frontend to use V2 endpoints exclusively
5. Consider deprecation timeline for V1 endpoints (after stable V2 adoption)

## Support
For issues or questions, refer to:
- LAD Architecture Documentation: `lad-docs/LAD Architecture training guide.md`
- Feature Developer Playbook: `lad-docs/lad-feature-developer-playbook.md`
- Voice Agent Integration: `BACKEND_INTEGRATION.md`
