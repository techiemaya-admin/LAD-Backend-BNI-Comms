# Campaign Daily Scheduler - Cloud Tasks Setup

## Prerequisites

1. Google Cloud Project with Cloud Tasks API enabled
2. Cloud Run service deployed
3. Service account with permissions:
   - `cloudtasks.queues.get`
   - `cloudtasks.tasks.create`

## Environment Variables

Add to Cloud Run or `.env`:

```bash
# Required
GOOGLE_CLOUD_PROJECT=your-project-id
CLOUD_RUN_SERVICE_URL=https://your-service.run.app
CLOUD_TASKS_LOCATION=us-central1

# Optional (uses defaults)
# GCP_PROJECT_ID=your-project-id  # Alternative to GOOGLE_CLOUD_PROJECT
# SERVICE_URL=https://your-service.run.app  # Alternative to CLOUD_RUN_SERVICE_URL
```

## Create Cloud Tasks Queue

```bash
gcloud tasks queues create campaign-daily-queue \
  --location=us-central1 \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=5 \
  --max-attempts=3 \
  --min-backoff=60s \
  --max-backoff=3600s
```

## Database Schema Updates

Run migration to add required columns:

```sql
-- Add start_date, end_date, last_run_date to campaigns table
ALTER TABLE lad_dev.campaigns 
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_run_date TIMESTAMP WITH TIME ZONE;

-- Add index for daily scheduler queries
CREATE INDEX IF NOT EXISTS idx_campaigns_daily_scheduler 
  ON lad_dev.campaigns(status, last_run_date) 
  WHERE is_deleted = FALSE;

-- Optional: Create execution log table for monitoring
CREATE TABLE IF NOT EXISTS lad_dev.campaign_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES lad_dev.campaigns(id),
  tenant_id UUID NOT NULL,
  execution_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'skipped'
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaign_execution_log_campaign 
  ON lad_dev.campaign_execution_log(campaign_id, execution_date DESC);
```

## NPM Dependencies

```bash
npm install @google-cloud/tasks
```

## Testing

### 1. Manual schedule trigger

```bash
curl -X POST https://your-service.run.app/api/campaigns/{campaignId}/schedule-daily \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Direct task execution (simulate Cloud Tasks)

```bash
curl -X POST https://your-service.run.app/api/campaigns/run-daily \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "uuid-here",
    "tenantId": "uuid-here",
    "scheduledFor": "2026-02-03T00:00:00.000Z",
    "retryCount": 0
  }'
```

## Monitoring

View Cloud Tasks queue:

```bash
# List tasks
gcloud tasks list --queue=campaign-daily-queue --location=us-central1

# View queue details
gcloud tasks queues describe campaign-daily-queue --location=us-central1
```

View logs in Cloud Run:

```bash
gcloud logging read "resource.type=cloud_run_revision AND textPayload=~CampaignDailyScheduler" \
  --limit 50 \
  --format json
```

## Production Checklist

- [ ] Cloud Tasks queue created in production
- [ ] Environment variables set in Cloud Run
- [ ] Database migrations applied
- [ ] Service account has Cloud Tasks permissions
- [ ] Queue retry policy configured
- [ ] Monitoring alerts configured
- [ ] Test campaign scheduled successfully
- [ ] Verify idempotency (campaign doesn't run twice)
- [ ] Test end_date completion flow
- [ ] Error handling tested (network failures, DB issues)

## Architecture

```
Campaign Creation → Schedule First Task (start_date)
                          ↓
                    Cloud Tasks Queue
                          ↓
                    POST /run-daily
                          ↓
                Execute Campaign Logic
                          ↓
                Update last_run_date
                          ↓
        Check: current_date < end_date?
                ↙              ↘
              YES              NO
Schedule Next Day       Mark Complete
```

## Self-Rescheduling Pattern

Each task execution:
1. Runs campaign workflow
2. Updates `last_run_date`
3. Checks if should continue (`current_date <= end_date`)
4. If yes: schedules next day task
5. If no: marks campaign complete

No cron jobs needed - fully event-driven.
