# LAD Backend - Google Cloud Run Deployment

This directory contains the configuration files needed to deploy the LAD backend to Google Cloud Run using Google Cloud Build.

## Files Overview

- `Dockerfile` - Multi-stage Docker build optimized for production
- `cloudbuild.yaml` - Google Cloud Build configuration
- `.dockerignore` - Files to exclude from Docker build
- `deploy.sh` - Automated deployment script
- `README-DEPLOYMENT.md` - This file

## Prerequisites

1. **Google Cloud CLI** installed and configured
   ```bash
   # Install gcloud CLI
   # Visit: https://cloud.google.com/sdk/docs/install
   
   # Authenticate
   gcloud auth login
   
   # Set your project
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Required APIs enabled** (the deploy script will enable these automatically)
   - Cloud Build API
   - Cloud Run API
   - Container Registry API
   - Secret Manager API

3. **Environment Variables/Secrets**
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - Secret for JWT token signing
   - `OPENAI_API_KEY` - OpenAI API key (optional)
   - `GEMINI_API_KEY` - Google Gemini API key (optional)
   - `APOLLO_API_KEY` - Apollo.io API key (optional)
   - `UNIPILE_API_KEY` - Unipile API key (optional)
   - `STRIPE_SECRET_KEY` - Stripe secret key (optional)
   - `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (optional)

## Quick Deployment

### Option 1: Automated Script (Recommended)

```bash
# Navigate to backend directory
cd backend

# Run the deployment script
./deploy.sh
```

The script will:
- Enable required Google Cloud APIs
- Set up secrets in Secret Manager
- Build and deploy using Cloud Build
- Provide the service URL

### Option 2: Manual Deployment

```bash
# Navigate to backend directory
cd backend

# Set your project ID
export PROJECT_ID="your-project-id"

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com secretmanager.googleapis.com

# Create secrets in Secret Manager
echo -n "your-database-url" | gcloud secrets create database-url --data-file=-
echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-
# ... repeat for other secrets

# Submit build
gcloud builds submit --config cloudbuild.yaml .
```

## Configuration Options

### Cloud Build Configuration (`cloudbuild.yaml`)

The build process includes:
- Docker image build with multi-layer caching
- Image push to Container Registry
- Deployment to Cloud Run with optimized settings

Key settings:
- **Memory**: 1Gi
- **CPU**: 1 vCPU
- **Min instances**: 0 (scales to zero)
- **Max instances**: 10
- **Concurrency**: 80 requests per instance
- **Timeout**: 300 seconds

### Docker Configuration (`Dockerfile`)

Optimized for production:
- Node.js 18 Alpine base image
- Multi-layer caching for dependencies
- Non-root user for security
- Health check endpoint
- Minimal production image

## Environment Variables

The service will be deployed with these environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Set to `production` | Yes |
| `PORT` | Service port (3004) | Yes |
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `OPENAI_API_KEY` | OpenAI API access | No |
| `GEMINI_API_KEY` | Google Gemini API | No |
| `APOLLO_API_KEY` | Apollo.io API | No |
| `UNIPILE_API_KEY` | Unipile API | No |
| `STRIPE_SECRET_KEY` | Stripe payments | No |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks | No |

## Monitoring & Health Checks

### Health Check Endpoint

The service provides a health check endpoint:
- **URL**: `/health`
- **Method**: GET
- **Response**: JSON with status, timestamp, version, environment

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### Logging

All logs are automatically sent to Google Cloud Logging. Access them via:
```bash
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=lad-backend" --limit 50
```

## Scaling & Performance

### Auto-scaling Configuration

- **Min instances**: 0 (cost-effective, scales to zero)
- **Max instances**: 10 (adjust based on expected load)
- **Concurrency**: 80 requests per instance

### Resource Limits

- **Memory**: 1Gi (sufficient for Node.js application)
- **CPU**: 1 vCPU (can be adjusted in cloudbuild.yaml)
- **Timeout**: 300 seconds for long-running requests

## Security

### Container Security
- Non-root user execution
- Minimal Alpine Linux base
- Only production dependencies

### Network Security
- HTTPS enforced by Cloud Run
- CORS configured for frontend domain
- Authentication middleware on all routes

### Secret Management
- All sensitive data stored in Secret Manager
- Environment variables automatically injected
- No secrets in container images or code

## Troubleshooting

### Build Failures

1. **Check build logs**:
   ```bash
   gcloud builds log $(gcloud builds list --limit=1 --format="value(id)")
   ```

2. **Common issues**:
   - Missing required APIs
   - Insufficient permissions
   - Invalid secret references

### Runtime Issues

1. **Check service logs**:
   ```bash
   gcloud logs read "resource.type=cloud_run_revision" --limit 50
   ```

2. **Test health endpoint**:
   ```bash
   curl https://your-service-url/health
   ```

### Permission Issues

Ensure your Cloud Build service account has required permissions:
```bash
# Get Cloud Build service account
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Add required roles
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
```

## Cost Optimization

### Pricing Considerations

Cloud Run pricing is based on:
- **Request charges**: $0.40 per million requests
- **CPU time**: $0.00001800 per vCPU-second
- **Memory time**: $0.00000200 per GiB-second
- **Storage**: $0.000140 per GiB-month

### Optimization Tips

1. **Scale to zero**: Min instances = 0 for development
2. **Right-size resources**: Monitor usage and adjust CPU/memory
3. **Request efficiency**: Optimize response times
4. **Caching**: Implement appropriate caching strategies

## Advanced Configuration

### Custom Domain

To use a custom domain:
```bash
gcloud run domain-mappings create --service lad-backend --domain your-domain.com --region us-central1
```

### SSL Certificates

Cloud Run provides managed SSL certificates automatically for custom domains.

### Multiple Environments

Create separate services for different environments:
```bash
# Deploy to staging
gcloud builds submit --config cloudbuild.yaml --substitutions _SERVICE_NAME=lad-backend-staging .

# Deploy to production  
gcloud builds submit --config cloudbuild.yaml --substitutions _SERVICE_NAME=lad-backend-prod .
```

## Support

For issues related to:
- **Google Cloud**: [Cloud Run Documentation](https://cloud.google.com/run/docs)
- **Application**: Check application logs and health endpoint
- **Build Process**: Review Cloud Build logs and configuration