# Campaign Scheduler from AI Messages - Implementation Summary

## Overview
Implemented campaign scheduling functionality that reads schedule parameters from `ai_messages` table and creates Cloud Tasks based on working days and campaign duration.

## Architecture Compliance ✅

### Proper Layering (LAD Standards)
1. **Repository Layer** (`repositories/AIMessageRepository.js`)
   - Contains all SQL queries for ai_messages table
   - Tenant-scoped queries using `organization_id`
   - No business logic

2. **Service Layer** (`services/AIMessageDataFetcher.js`, `services/CampaignMultiDateScheduler.js`)
   - Business logic and orchestration
   - Calls Repository for data access
   - Validates tenant context from JWT
   - No direct SQL queries

3. **Utility Layer** (`utils/campaignScheduleUtil.js`)
   - Pure functions for date calculations
   - No database access
   - No business logic

4. **Controller Layer** (`controllers/CampaignCRUDController.js`)
   - Accepts `conversationId` in request body
   - Calls services for business logic
   - Returns HTTP responses

## How It Works

### 1. Campaign Creation Flow
```javascript
POST /api/campaigns
Body: {
  name: "Campaign Name",
  conversationId: "uuid-of-conversation",
  // ... other fields
}
```

### 2. Data Flow
```
Controller → AIMessageDataService → AIMessageRepository → Database
                ↓
          CampaignScheduleUtil (calculates dates)
                ↓
          CampaignSchedulingService → Cloud Tasks
```

### 3. Schedule Calculation
From `message_data` JSONB field:
- **timestamp**: `"2026-02-03T18:44:05.883Z"` - Base timestamp
- **working_days**: `"Monday-Friday (Weekdays only)"` - Which days to run
- **campaign_days**: `"7"` - Total number of working days

Example: For 7 weekdays starting 2026-02-03T18:44:05.883Z
- Calculates: 2026-02-04 (Wed), 2026-02-05 (Thu), 2026-02-06 (Fri), 2026-02-09 (Mon), 2026-02-10 (Tue), 2026-02-11 (Wed), 2026-02-12 (Thu)
- Skips: Weekends (Sat, Sun)
- Creates Cloud Task for each date at 18:44:05.883Z

## Files Created/Modified

### New Files (Architecture-Compliant)
1. `/features/campaigns/repositories/AIMessageRepository.js`
   - SQL queries for ai_messages table
   - Tenant-scoped with organization_id validation

2. `/features/campaigns/services/AIMessageDataFetcher.js` (refactored)
   - Service layer for fetching message data
   - Calls AIMessageRepository
   - Validates tenant ownership

3. `/features/campaigns/services/CampaignMultiDateScheduler.js` (renamed to CampaignSchedulingService)
   - Orchestrates Cloud Tasks creation
   - Validates inputs (campaignId, tenantId)

4. `/features/campaigns/utils/campaignScheduleUtil.js`
   - Pure utility functions
   - Date calculations
   - Working days parsing

### Modified Files
1. `/features/campaigns/controllers/CampaignCRUDController.js`
   - Added `conversationId` parameter handling
   - Fetches message_data from ai_messages
   - Calculates schedule dates
   - Creates Cloud Tasks for all dates
   - Stores scheduling results in campaign config

## Testing

Run test:
```bash
cd LAD-Backend
node test-campaign-schedule.js
```

Expected output:
- 7 weekday dates calculated
- Starts from day after timestamp
- Skips weekends
- Maintains same time (18:44:05.883Z)

## Database Schema

Uses existing `ai_messages` table:
```sql
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES ai_conversations(id),
  role VARCHAR(20), -- 'user' or 'assistant'
  content TEXT,
  message_data JSONB, -- Contains schedule parameters
  created_at TIMESTAMP
);
```

Query joins with `ai_conversations` to validate tenant:
```sql
JOIN ai_conversations c ON m.conversation_id = c.id
WHERE c.organization_id = $tenantId
```

## Security & Multi-Tenancy ✅

1. **Tenant Validation**: All queries validate `organization_id` from JWT
2. **No Hardcoded Schema**: Uses `${schema}` from `getSchema()`
3. **Input Validation**: Services validate required parameters
4. **Tenant Ownership**: Verifies conversation belongs to requesting tenant

## Error Handling

- Falls back to provided dates if message_data fetch fails
- Logs errors but continues campaign creation
- Tasks can be rescheduled later if scheduling fails
- Stores scheduling results in campaign config

## Configuration Storage

Campaign config stores:
```javascript
{
  conversationId: "uuid",
  working_days: "Monday-Friday (Weekdays only)",
  total_schedule_dates: 7,
  campaign_start_date: "2026-02-04T18:44:05.883Z",
  campaign_end_date: "2026-02-12T18:44:05.883Z",
  scheduling_result: {
    totalScheduled: 7,
    totalFailed: 0,
    scheduledAt: "2026-02-04T10:00:00.000Z"
  }
}
```

## Next Steps (Optional Enhancements)

1. Add endpoint to manually reschedule failed tasks
2. Add validation for message_data structure
3. Support custom working hours (not just working days)
4. Add timezone handling for international campaigns
5. Create migration to add index on ai_messages.message_data for faster queries
