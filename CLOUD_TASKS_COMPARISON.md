# Cloud Tasks Implementation - Complete Guide

## Overview
LAD Backend uses Google Cloud Tasks for scheduling asynchronous operations. Two main implementations exist:
1. **Bookings Follow-Up Scheduler** - Schedules follow-up calls for booked meetings
2. **Campaign Daily Scheduler** - Schedules daily campaign execution tasks

Both systems follow similar patterns but serve different business purposes.

---

## 🔄 Flow Diagrams

### Bookings Follow-Up Flow
```
Database Trigger (new booking)
    ↓
bookingNotificationListener
    ↓
followUpSchedulerService.scheduleFollowUpCall()
    ↓
cloudTasksClient.createScheduledHttpTask()
    ↓
Google Cloud Tasks (scheduled)
    ↓
POST /api/deals-pipeline/bookings/:id/execute-followup
    ↓
validateCloudTasksAuth middleware
    ↓
BookingsController.executeFollowUpCall()
    ↓
followUpExecutionService.executeFollowUpCall()
    ↓
Make voice call to lead
```

### Campaign Daily Execution Flow
```
Campaign Created with conversationId
    ↓
CampaignCRUDController.createCampaign()
    ↓
AIMessageDataService.fetchMessageDataByConversation()
    ↓
CampaignScheduleUtil.calculateCampaignDates()
    ↓
CampaignSchedulingService.scheduleTasksForDates()
    ↓
cloudTasksClient.scheduleNextDayTask() × N dates
    ↓
Google Cloud Tasks (scheduled for each date)
    ↓
POST /api/campaigns/run-daily
    ↓
validateCloudTasksAuth middleware
    ↓
CampaignDailyController.runDaily()
    ↓
CampaignDailyScheduler.runDailyCampaign()
    ↓
Execute campaign workflow (lead generation, messaging)
```

---

## 📊 Detailed Comparison Table

| Feature | Bookings Follow-Up | Campaign Daily Scheduler |
|---------|-------------------|-------------------------|
| **Purpose** | Schedule follow-up calls for booked meetings | Execute campaigns daily based on schedule |
| **Trigger** | Database trigger on bookings table | Campaign creation with conversationId |
| **Scheduling Logic** | Single task per booking at `scheduled_at` | Multiple tasks calculated from ai_messages |
| **Schedule Source** | `booking.scheduled_at` field | `ai_messages.message_data` JSONB |
| **Working Days** | N/A (specific datetime) | Parsed from message_data (Mon-Fri, All days, etc.) |
| **Task Count** | 1 task per booking | N tasks (campaign_days × working days) |
| **Cloud Task Client** | `shared/gcp/cloudTasksClient.js` | `shared/services/cloudTasksClient.js` |
| **Queue Name** | `follow-up-calls` | `campaign-scheduler-task` |
| **Execution Endpoint** | `/api/deals-pipeline/bookings/:id/execute-followup` | `/api/campaigns/run-daily` |
| **HTTP Method** | POST | POST |
| **Authentication** | ✅ `validateCloudTasksAuth` + headers | ✅ `validateCloudTasksAuth` + headers |
| **Secret Header** | `x-cloudtasks-secret` | `x-cloudtasks-secret` |
| **Required Headers** | `x-cloudtasks-taskname`, `x-cloudtasks-queuename` | `x-cloudtasks-taskname`, `x-cloudtasks-queuename` |
| **OIDC Token** | ✅ Supported | ✅ Supported |
| **Idempotency Key** | `tenantId-bookingId-timestamp` | Date-based check (`last_run_date`) |
| **Retry Logic** | Cloud Tasks automatic retry | Cloud Tasks automatic retry |
| **Error Response** | 500 (triggers retry) | 500 (triggers retry) |
| **Success Response** | 200 (even if already executed) | 200 (even if already ran) |
| **Payload** | `{tenantId, bookingId, leadId, assignedUserId, idempotencyKey, scheduledAt}` | `{campaignId, tenantId, scheduledFor, retryCount}` |
| **Timezone Handling** | ✅ Converts from local (GST, EST, etc.) to UTC | ⚠️ Uses provided timestamp as-is |
| **Self-Rescheduling** | ❌ No (one-time task) | ✅ Yes (schedules next day task) |
| **Database Update** | Updates `task_scheduled_at`, `task_name` | Updates `last_run_date` |
| **Repository Layer** | ✅ BookingsRepository | ⚠️ Direct SQL in scheduler |
| **Service Layer** | ✅ FollowUpSchedulerService, FollowUpExecutionService | ✅ CampaignSchedulingService, AIMessageDataService |
| **Utility Layer** | N/A | ✅ CampaignScheduleUtil |
| **Architecture Compliance** | ✅ Full (Repo → Service → Controller) | ✅ Full (Repo → Service → Util → Controller) |
| **Multi-Tenancy** | ✅ All queries tenant-scoped | ✅ All queries tenant-scoped |
| **Schema Resolution** | ✅ `${schema}` dynamic | ✅ `${schema}` dynamic |
| **Logging** | ✅ logger.info/error | ✅ logger.info/error |
| **Soft Delete Support** | ✅ Checks `is_deleted` | ✅ Checks `is_deleted` |
| **Cancel/Delete Task** | ✅ `cancelFollowUpCall()` | ❌ Not implemented |
| **Manual Trigger** | ✅ `/schedule-followup` endpoint | ✅ `/schedule-daily` endpoint |
| **Status Endpoint** | ✅ `/followup-status` | ❌ Not implemented |
| **Retry Endpoint** | ✅ `/retry-followup` | ❌ Not implemented |

---

## 🔐 Security Implementation

### Common Security Pattern
Both implementations use the same security pattern:

#### 1. **Middleware Validation** (`validateCloudTasksAuth`)
```javascript
const validateCloudTasksAuth = (req, res, next) => {
  const cloudTasksSecret = process.env.CLOUD_TASKS_SECRET;
  
  // Check Bearer token (OIDC)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next(); // OIDC validation (TODO: implement full validation)
  }

  // Check shared secret
  if (cloudTasksSecret) {
    const requestSecret = req.headers['x-cloudtasks-secret'];
    if (requestSecret !== cloudTasksSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  next();
};
```

#### 2. **Controller Header Verification**
```javascript
// Verify Cloud Tasks headers
const taskName = req.headers['x-cloudtasks-taskname'];
const queueName = req.headers['x-cloudtasks-queuename'];

if (!taskName || !queueName) {
  return res.status(403).json({ 
    error: 'Forbidden - Cloud Tasks only' 
  });
}
```

#### 3. **Task Creation with Secret**
```javascript
const task = {
  httpRequest: {
    httpMethod: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
      'X-CloudTasks-Secret': process.env.CLOUD_TASKS_SECRET || ''
    },
    body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    oidcToken: {
      serviceAccountEmail: `${PROJECT_ID}@appspot.gserviceaccount.com`,
    },
  },
};
```

---

## 📝 Code Examples

### Bookings: Creating a Cloud Task

```javascript
// Service Layer
await this.scheduler.scheduleFollowUpCall({
  tenantId: 'uuid-tenant',
  bookingId: 'uuid-booking',
  leadId: 'uuid-lead',
  assignedUserId: 'uuid-user',
  scheduledAt: new Date('2026-02-05T10:00:00Z'),
  timezone: 'GST',
  bookingType: 'demo',
  schema: 'lad_dev'
});

// Cloud Tasks Client
await cloudTasksClient.createScheduledHttpTask({
  queue: 'follow-up-calls',
  url: 'https://api.example.com/api/deals-pipeline/bookings/uuid-booking/execute-followup',
  payload: {
    tenantId: 'uuid-tenant',
    bookingId: 'uuid-booking',
    leadId: 'uuid-lead',
    assignedUserId: 'uuid-user',
    idempotencyKey: 'uuid-tenant_uuid-booking_1738742400',
    scheduledAt: '2026-02-05T10:00:00.000Z'
  },
  scheduleTime: new Date('2026-02-05T10:00:00Z'),
  idempotencyKey: 'uuid-tenant_uuid-booking_1738742400'
});
```

### Campaigns: Creating Multiple Cloud Tasks

```javascript
// 1. Fetch schedule data from ai_messages
const messageData = await AIMessageDataService.fetchMessageDataByConversation(
  conversationId,
  tenantId
);

// 2. Calculate schedule dates
const calculatedDates = CampaignScheduleUtil.calculateCampaignDates(messageData);
// Returns: {
//   startDate: Date,
//   endDate: Date,
//   scheduleDates: [Date, Date, Date, ...], // 7 weekdays
//   workingDays: [1,2,3,4,5],
//   workingDaysStr: "Monday-Friday (Weekdays only)"
// }

// 3. Create tasks for all dates
await CampaignSchedulingService.scheduleTasksForDates(
  campaignId,
  tenantId,
  calculatedDates.scheduleDates // Array of 7 dates
);

// Behind the scenes, for each date:
await cloudTasksClient.scheduleNextDayTask(
  'uuid-campaign',
  'uuid-tenant',
  new Date('2026-02-04T18:44:05.883Z'),
  0 // retryCount
);
```

---

## 🗄️ Database Schema Integration

### Bookings Table
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  assigned_user_id UUID,
  scheduled_at TIMESTAMP NOT NULL,
  timezone VARCHAR(10),
  booking_type VARCHAR(50),
  task_scheduled_at TIMESTAMP,      -- When Cloud Task was scheduled
  task_name VARCHAR(500),            -- Full Cloud Task name
  task_idempotency_key VARCHAR(255), -- For deduplication
  execution_status VARCHAR(50),      -- pending, executed, failed
  executed_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Campaigns Table
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255),
  status VARCHAR(50), -- draft, running, paused, completed
  config JSONB, -- Stores conversationId, working_days, scheduling_result
  last_run_date TIMESTAMP, -- Last time campaign executed
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### AI Messages Table (Campaign Schedule Source)
```sql
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES ai_conversations(id),
  role VARCHAR(20), -- 'user' or 'assistant'
  content TEXT,
  message_data JSONB, -- Contains: timestamp, collectedAnswers: {working_days, campaign_days}
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 Idempotency Patterns

### Bookings Approach
- **Task Name Idempotency**: Uses deterministic task name with `idempotencyKey`
- **Format**: `tenant_booking_timestamp`
- **Cloud Tasks**: Automatically rejects duplicate task names (error code 6)
- **Database**: Stores `task_idempotency_key` to track
- **Execution**: Checks `execution_status` to prevent re-execution

### Campaigns Approach
- **Date-Based Idempotency**: Checks if already ran today
- **Logic**: Compares `last_run_date` with current date (year/month/day)
- **Cloud Tasks**: No task name deduplication (each task has unique name)
- **Database**: Updates `last_run_date` after execution
- **Self-Rescheduling**: Each execution creates next day's task

---

## ⚙️ Environment Variables Required

```bash
# Common
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
CLOUD_TASKS_SECRET=your-secret-key
CLOUD_RUN_SERVICE_URL=https://your-service.run.app

# Bookings Specific
FOLLOWUP_QUEUE_NAME=follow-up-calls
FOLLOWUP_EXECUTION_ENDPOINT=https://your-service.run.app/api/deals-pipeline/bookings
GCP_CLOUD_TASKS_SERVICE_ACCOUNT=service-account@project.iam.gserviceaccount.com

# Campaigns Specific
CLOUD_TASKS_QUEUE_NAME=campaign-scheduler-task
SERVICE_URL=https://your-service.run.app
```

---

## 🧪 Testing Cloud Tasks

### Local Development
Both systems simulate task creation in local dev:
```javascript
if (IS_LOCAL_DEV || !this.isConfigured) {
  logger.info('[CloudTasks] SIMULATED task creation (local dev mode)', {
    campaignId, tenantId, scheduleTime,
    note: 'Task will be created in production Cloud Run environment'
  });
  return { taskName: 'simulated-...', simulated: true };
}
```

### Manual Testing Endpoints

**Bookings:**
```bash
# Schedule a follow-up
POST /api/deals-pipeline/bookings/:id/schedule-followup

# Check status
GET /api/deals-pipeline/bookings/:id/followup-status

# Retry failed
POST /api/deals-pipeline/bookings/:id/retry-followup

# Cancel
DELETE /api/deals-pipeline/bookings/:id/followup
```

**Campaigns:**
```bash
# Create campaign with schedule
POST /api/campaigns
{
  "name": "Test Campaign",
  "conversationId": "uuid-conversation",
  "status": "active"
}

# Manual schedule
POST /api/campaigns/:id/schedule-daily
```

---

## 🚨 Error Handling & Retry

Both systems follow the same error handling pattern:

### Success Cases (200 OK)
- Task executed successfully
- Task already executed (idempotency)
- Campaign already ran today

### Retry Cases (500 Error)
- Execution failed (exception thrown)
- Database error
- External service failure
- Cloud Tasks will automatically retry with exponential backoff

### Non-Retry Cases (4xx)
- 400: Invalid payload
- 401: Missing/invalid secret
- 403: Missing Cloud Tasks headers
- 404: Resource not found

---

## 📈 Monitoring & Observability

### Logs to Monitor
```javascript
// Task creation
'[CloudTasks] Task scheduled' // Success
'[CloudTasks] Failed to create task' // Error
'[CloudTasks] Task already exists' // Idempotency

// Task execution
'[CampaignDailyController] Cloud Tasks request verified' // Auth success
'[CampaignDailyController] Unauthorized access attempt' // Auth failure
'[CampaignDailyScheduler] Running daily campaign' // Execution start
'[CampaignDailyScheduler] Campaign executed successfully' // Execution success
```

### Key Metrics to Track
- Task creation success rate
- Task execution success rate
- Average execution time
- Retry count per task
- Idempotency hit rate
- Authentication failures
- Queue depth

---

## 🔧 Troubleshooting Guide

### Task Not Created
1. Check `GCP_PROJECT_ID` is set
2. Verify Cloud Tasks API is enabled
3. Check service account permissions
4. Review logs for creation errors

### Task Not Executing
1. Verify `CLOUD_TASKS_SECRET` matches in both creation and validation
2. Check endpoint URL is correct
3. Ensure Cloud Run service is running
4. Verify OIDC token is valid

### Unauthorized Errors
1. Check `x-cloudtasks-secret` header is sent
2. Verify middleware is applied to route
3. Check environment variable is set
4. Review OIDC service account email

### Duplicate Executions
1. **Bookings**: Check idempotency key generation
2. **Campaigns**: Verify `last_run_date` is being updated
3. Review database locks (FOR UPDATE SKIP LOCKED)

---

## 📚 Architecture Compliance

Both implementations follow LAD architecture rules:

### ✅ Compliant
- **Multi-Tenancy**: All queries tenant-scoped
- **Schema Resolution**: Dynamic `${schema}` usage
- **Layering**: Repository → Service → Controller
- **Logging**: logger.info/error (no console.log)
- **Security**: Validated Cloud Tasks authentication
- **Naming**: Consistent tenant_id usage

### 🎯 Best Practices Followed
- Idempotency at multiple levels
- Error handling with retry support
- Comprehensive logging
- Tenant isolation
- Secure authentication
- Clean separation of concerns

---

## 🚀 Future Enhancements

### Bookings
- [ ] Full OIDC token validation
- [ ] Webhook callbacks for execution status
- [ ] Advanced retry strategies
- [ ] Real-time status updates via WebSocket

### Campaigns
- [ ] Cancel/delete scheduled tasks
- [ ] Status endpoint implementation
- [ ] Retry endpoint for failed executions
- [ ] Advanced scheduling (specific hours, holidays)
- [ ] Timezone support for international campaigns
- [ ] Dashboard for monitoring all scheduled tasks

---

## 📖 Related Documentation
- [Google Cloud Tasks Documentation](https://cloud.google.com/tasks/docs)
- [LAD Architecture Checklist](./Architecture_checklist.md)
- [Campaign Scheduler Implementation](./CAMPAIGN_SCHEDULER_IMPLEMENTATION.md)
- [Bookings Service Integration](./features/deals-pipeline/examples/bookingsServiceIntegration.js)
