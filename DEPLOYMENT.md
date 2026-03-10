# LAD Backend Deployment Guide

This guide covers deploying the LAD Backend to Google Cloud Run.

## Prerequisites

1. **Google Cloud SDK** installed and configured
   ```bash
   # Install gcloud CLI
   # https://cloud.google.com/sdk/docs/install
   
   # Authenticate
   gcloud auth login
   gcloud auth configure-docker
   ```

2. **Docker** installed
   ```bash
   docker --version
   ```

3. **GCP Project Access**: You need appropriate permissions in the `LAD-Develop` project

4. **Secrets configured** in Google Secret Manager:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET`
   - `GEMINI_API_KEY`

## Deployment Methods

### Method 1: Quick Deploy Script (Recommended for Development)

```bash
# Make script executable
chmod +x deploy-develop.sh

# Deploy to development
./deploy-develop.sh
```

### Method 2: Cloud Build (Recommended for CI/CD)

**For Development Environment:**
```bash
gcloud builds submit --config=cloudbuild-develop.yaml --project=lad-develop
```

**For Production Environment:**
```bash
gcloud builds submit --config=cloudbuild-production.yaml --project=lad-develop
```

### Method 3: Manual Deployment

```bash
# 1. Set project
gcloud config set project lad-develop

# 2. Build image
docker build -t gcr.io/lad-develop/lad-backend:latest .

# 3. Push to GCR
docker push gcr.io/lad-develop/lad-backend:latest

# 4. Deploy to Cloud Run
gcloud run deploy lad-backend-develop \
  --image=gcr.io/lad-develop/lad-backend:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --set-env-vars="NODE_ENV=development,PORT=8080" \
  --set-secrets="POSTGRES_PASSWORD=POSTGRES_PASSWORD:latest,JWT_SECRET=JWT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

## Setting Up Secrets

If secrets don't exist yet, create them:

```bash
# Set project
gcloud config set project lad-develop

# Create secrets
echo -n "YOUR_POSTGRES_PASSWORD" | gcloud secrets create POSTGRES_PASSWORD --data-file=-
echo -n "YOUR_JWT_SECRET" | gcloud secrets create JWT_SECRET --data-file=-
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-

# Grant Cloud Run service account access to secrets
PROJECT_NUMBER=$(gcloud projects describe lad-develop --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding POSTGRES_PASSWORD \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding JWT_SECRET \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Environment Configuration

### Development Environment
- **Project**: LAD-Develop
- **Service Name**: lad-backend-develop  
- **Region**: us-central1
- **Memory**: 512Mi
- **CPU**: 1
- **Min Instances**: 0
- **Max Instances**: 10
- **Database Schema**: lad_dev

### Production Environment
- **Project**: LAD-Develop (or LAD-Production)
- **Service Name**: lad-backend-production
- **Region**: us-central1
- **Memory**: 1Gi
- **CPU**: 2
- **Min Instances**: 1
- **Max Instances**: 50
- **Database Schema**: public

## Post-Deployment

### 1. Test the deployment

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe lad-backend-develop \
  --platform=managed \
  --region=us-central1 \
  --format='value(status.url)')

# Test health endpoint
curl $SERVICE_URL/health

# Test with authentication
curl $SERVICE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### 2. View logs

```bash
# Stream logs
gcloud run services logs tail lad-backend-develop --project=lad-develop

# View in Cloud Console
# https://console.cloud.google.com/run?project=lad-develop
```

### 3. Update environment variables

```bash
gcloud run services update lad-backend-develop \
  --update-env-vars="NEW_VAR=value" \
  --region=us-central1
```

## Continuous Deployment

### Set up Cloud Build Trigger

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click "Create Trigger"
3. Configure:
   - **Name**: `deploy-lad-backend-develop`
   - **Event**: Push to branch
   - **Branch**: `^develop$`
   - **Build Configuration**: `cloudbuild-develop.yaml`
   - **Location**: `LAD_backend/cloudbuild-develop.yaml`

## Troubleshooting

### Build fails
```bash
# Check build logs
gcloud builds list --limit=5
gcloud builds log [BUILD_ID]
```

### Service not starting
```bash
# Check service logs
gcloud run services logs read lad-backend-develop --limit=50

# Check service details
gcloud run services describe lad-backend-develop --region=us-central1
```

### Database connection issues
- Verify database credentials in Secret Manager
- Check if Cloud Run service account has Secret Manager access
- Verify database allows connections from Cloud Run IPs

### Memory/CPU issues
```bash
# Update resources
gcloud run services update lad-backend-develop \
  --memory=1Gi \
  --cpu=2 \
  --region=us-central1
```

## Rollback

```bash
# List revisions
gcloud run revisions list --service=lad-backend-develop

# Rollback to previous revision
gcloud run services update-traffic lad-backend-develop \
  --to-revisions=[REVISION_NAME]=100 \
  --region=us-central1
```

## Cost Optimization

- **Development**: Uses min-instances=0 to scale to zero when idle
- **Production**: Uses min-instances=1 for faster cold starts
- Monitor usage in [Cloud Console](https://console.cloud.google.com/run)

## Support

For issues or questions, contact the DevOps team or check:
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
