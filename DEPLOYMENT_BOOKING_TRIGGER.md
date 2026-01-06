# Database Trigger Deployment Guide

## Overview
This implements automatic Cloud Task scheduling for follow-up bookings created from ANY source (VOAG, LAD backend, direct DB inserts, etc.).

**Solution**: PostgreSQL trigger + NOTIFY/LISTEN pattern
- Database trigger sends notification immediately when booking is inserted
- Backend listener receives notification and creates Cloud Task
- Works in real-time (within milliseconds)

## Architecture

```
VOAG/Other Service → Direct INSERT to lead_bookings
                          ↓
                    PostgreSQL Trigger
                          ↓
                    pg_notify('booking_followup_created')
                          ↓
                    Backend Listener (LISTEN)
                          ↓
                    FollowUpSchedulerService
                          ↓
                    Google Cloud Tasks API
```

## Files Changed

1. **Backend Code**:
   - `/backend/server.js` - Initialize listener on startup
   - `/backend/features/deals-pipeline/services/bookingNotificationListener.js` - Already created

2. **Database Migration**:
   - `/backend/migrations/create-booking-cloud-task-trigger.sql` - Trigger definition

## Deployment Steps

### 1. Apply Database Trigger

```bash
# Connect to production database
PGPASSWORD=TechieMaya psql -h 165.22.221.77 -U dbadmin -d salesmaya_agent

# Run the migration
\i /path/to/backend/migrations/create-booking-cloud-task-trigger.sql

# Verify trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'lad_dev' 
  AND event_object_table = 'lead_bookings';

# Expected output:
# trigger_schedule_followup_cloud_task | INSERT | lead_bookings | EXECUTE FUNCTION...
```

### 2. Deploy Backend Code

```bash
cd /Users/naveenreddy/Desktop/AI-Maya/LAD

# Commit changes
git add backend/server.js
git add backend/features/deals-pipeline/services/bookingNotificationListener.js
git add backend/migrations/create-booking-cloud-task-trigger.sql
git commit -m "Add database trigger for automatic Cloud Task creation on booking insert"

# Push to trigger Cloud Build
git push origin develop

# Monitor deployment
gcloud builds list --limit=1 --project=salesmaya-pluto
```

### 3. Verify Deployment

```bash
# Check backend logs for listener startup
gcloud run services logs read lad-backend-develop \
  --region=us-central1 \
  --project=salesmaya-pluto \
  --limit=50 | grep "BookingListener"

# Expected logs:
# [BookingListener] Started listening for booking follow-up notifications
```

### 4. Test End-to-End

#### Option A: Create test booking from VOAG
Use VOAG to create a follow-up booking and verify Cloud Task is created

#### Option B: Direct database test
```sql
-- Insert a test follow-up booking directly
INSERT INTO lad_dev.lead_bookings (
  id, tenant_id, lead_id, assigned_user_id, 
  booking_type, scheduled_at, task_status, 
  created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM lad_dev.leads LIMIT 1),
  (SELECT id FROM lad_dev.users WHERE tenant_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
  'auto_followup',
  NOW() + INTERVAL '10 minutes',
  'pending',
  NOW(),
  NOW()
) RETURNING id;

-- Check if task was created (wait 2-3 seconds)
SELECT id, booking_type, task_status, task_name, scheduled_at
FROM lad_dev.lead_bookings
WHERE id = '<returned_id>';

-- Expected: task_name should be populated
-- Expected: task_status should be 'scheduled'
```

#### Option C: Check Cloud Tasks queue
```bash
# List tasks in queue
gcloud tasks list \
  --queue=follow-up-voag-calls \
  --location=us-central1 \
  --project=salesmaya-pluto

# Should see new task with name format: followup-{booking_id}-{timestamp}
```

### 5. Monitor Logs

```bash
# Watch for booking notifications
gcloud run services logs tail lad-backend-develop \
  --region=us-central1 \
  --project=salesmaya-pluto | grep "BookingListener"

# Expected log sequence when booking created:
# 1. [BookingListener] Received booking notification
# 2. [BookingListener] Successfully scheduled Cloud Task
```

## How It Works

1. **Any service creates a booking** (VOAG, LAD, manual INSERT)
   - `INSERT INTO lad_dev.lead_bookings (...) VALUES (...)`

2. **PostgreSQL trigger fires** (`trigger_schedule_followup_cloud_task`)
   - Checks if `booking_type` is in follow-up list
   - Checks if `task_status = 'pending'`
   - Sends notification via `pg_notify('booking_followup_created', ...)`

3. **Backend listener receives notification** (within milliseconds)
   - `bookingNotificationListener.js` handles the event
   - Parses booking data from notification payload

4. **Cloud Task is scheduled**
   - Calls `FollowUpSchedulerService.scheduleFollowUpCall()`
   - Creates task in `follow-up-voag-calls` queue
   - Updates booking record with `task_name` and `task_status='scheduled'`

5. **Cloud Task executes at scheduled time**
   - Sends HTTP POST to execution endpoint
   - Endpoint triggers the follow-up call/action

## Booking Types That Trigger Cloud Tasks

The trigger handles these booking types (case-insensitive):
- `follow_up`
- `follow-up`
- `auto-follow-up`
- `followup`
- `auto_follow_up`
- `auto_followup`
- `manual_followup`
- `manual_follow_up`
- `scheduled_call`

## Advantages Over Batch Job

| Batch Job (Cron) | Database Trigger |
|------------------|------------------|
| Runs every X minutes | Immediate (milliseconds) |
| Checks all bookings | Only new bookings |
| Higher database load | Minimal overhead |
| Delay in scheduling | Real-time scheduling |
| Extra code to track processed bookings | Automatic via trigger |

## Troubleshooting

### Listener not starting
```bash
# Check backend logs
gcloud run services logs read lad-backend-develop --limit=100 | grep "BookingListener"

# Common issues:
# 1. Database connection error - check POSTGRES_* env vars
# 2. Permission error - check database user permissions
```

### Notifications not received
```sql
-- Test notification manually
SELECT pg_notify('booking_followup_created', '{"booking_id":"test-123"}');

-- Check if backend receives it (should see log within 1 second)
```

### Cloud Task not created
```bash
# Check scheduler logs
gcloud run services logs read lad-backend-develop --limit=50 | grep "FollowUpScheduler"

# Common issues:
# 1. Missing GCP_CLOUD_TASKS_SERVICE_ACCOUNT env var
# 2. Service account lacks cloudtasks.tasks.create permission
# 3. Queue doesn't exist
```

### Trigger not firing
```sql
-- Check if trigger exists
\df lad_dev.schedule_followup_cloud_task

-- Check trigger definition
SELECT * FROM pg_trigger WHERE tgname = 'trigger_schedule_followup_cloud_task';

-- Test trigger manually
INSERT INTO lad_dev.lead_bookings (...) VALUES (...);
-- Should see NOTICE: Notification sent for follow-up booking: <id>
```

## Rollback Plan

If issues occur after deployment:

```sql
-- Disable trigger (keeps it for later)
ALTER TABLE lad_dev.lead_bookings 
  DISABLE TRIGGER trigger_schedule_followup_cloud_task;

-- Or remove completely
DROP TRIGGER IF EXISTS trigger_schedule_followup_cloud_task ON lad_dev.lead_bookings;
DROP FUNCTION IF EXISTS lad_dev.schedule_followup_cloud_task();
```

Backend listener will gracefully handle missing notifications.

## Performance Considerations

- **Database overhead**: Minimal - trigger only fires on INSERT
- **Backend overhead**: One listener connection, handles events asynchronously
- **Network overhead**: Notification is ~500 bytes JSON, negligible
- **Latency**: Typical delay from INSERT to Cloud Task creation: 50-200ms

## Future Enhancements

1. **Retry logic**: If Cloud Task creation fails, retry with exponential backoff
2. **Dead letter queue**: Track failed scheduling attempts
3. **Monitoring**: Add metrics for notification rate and success rate
4. **Circuit breaker**: Temporarily disable if Cloud Tasks API is down
