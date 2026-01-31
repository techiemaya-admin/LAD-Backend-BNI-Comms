#!/bin/bash
# Manual deployment script to test if Cloud Run deployment works

echo "This will manually deploy the latest image to Cloud Run"
echo "Run this command in Cloud Shell or with gcloud CLI configured:"
echo ""
echo "gcloud run deploy lad-backend-develop \\"
echo "  --image gcr.io/salesmaya-pluto/lad-backend:latest \\"
echo "  --region us-central1 \\"
echo "  --platform managed \\"
echo "  --project salesmaya-pluto"
echo ""
echo "This will tell us if the issue is with Cloud Build or Cloud Run itself"
