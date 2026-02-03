#!/bin/bash

# Deploy Campaign Scheduler Cloud Tasks Queue
# Run this script to create/update the queue in GCP

set -e

PROJECT_ID="salesmaya-pluto"
LOCATION="us-central1"
QUEUE_NAME="campaign-scheduler-task"

echo "=========================================="
echo "Cloud Tasks Queue Configuration"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Location: $LOCATION"
echo "Queue: $QUEUE_NAME"
echo "=========================================="
echo ""

# Check if queue exists
if gcloud tasks queues describe $QUEUE_NAME --location=$LOCATION --project=$PROJECT_ID &> /dev/null; then
  echo "✓ Queue '$QUEUE_NAME' already exists"
  echo ""
  echo "Updating queue configuration..."
  
  gcloud tasks queues update $QUEUE_NAME \
    --location=$LOCATION \
    --project=$PROJECT_ID \
    --max-dispatches-per-second=10 \
    --max-concurrent-dispatches=5 \
    --max-attempts=3 \
    --min-backoff=60s \
    --max-backoff=3600s
  
  echo "✓ Queue updated successfully"
else
  echo "Creating new queue '$QUEUE_NAME'..."
  
  gcloud tasks queues create $QUEUE_NAME \
    --location=$LOCATION \
    --project=$PROJECT_ID \
    --max-dispatches-per-second=10 \
    --max-concurrent-dispatches=5 \
    --max-attempts=3 \
    --min-backoff=60s \
    --max-backoff=3600s
  
  echo "✓ Queue created successfully"
fi

echo ""
echo "=========================================="
echo "Queue Details:"
echo "=========================================="
gcloud tasks queues describe $QUEUE_NAME \
  --location=$LOCATION \
  --project=$PROJECT_ID

echo ""
echo "=========================================="
echo "✓ Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Deploy backend with: gcloud builds submit --config cloudbuild.yaml"
echo "2. Test scheduling: curl -X POST https://lad-backend-741719885039.us-central1.run.app/api/campaigns/{campaignId}/schedule-daily"
echo ""
