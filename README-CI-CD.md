# LAD Backend - Automated CI/CD Deployment

## 🎯 Overview

The LAD backend is configured for **automatic deployment** to Google Cloud Run using Cloud Build triggers. Every push to the `develop` branch automatically triggers a build and deployment.

## 🔄 Automated Deployment Flow

```
GitHub Push (develop branch)
    ↓
Cloud Build Trigger Activated
    ↓
Docker Image Build (multi-stage, cached)
    ↓
Push to Container Registry (tagged: commit-sha, branch, latest)
    ↓
Deploy to Cloud Run (automatic)
    ↓
Service Live & Healthy
```

## 📋 Current Configuration

### Cloud Build Trigger Settings
- **Repository**: Connected to your GitHub repository
- **Branch**: `develop` (auto-deployment enabled)
- **Build Config**: `backend/cloudbuild.yaml`
- **Project**: `salesmaya-pluto`
- **Region**: `us-central1`
- **Service**: `lad-backend`

### Service Configuration
- **Memory**: 1 GiB
- **CPU**: 1 vCPU
- **Min Instances**: 0 (scales to zero)
- **Max Instances**: 10
- **Concurrency**: 80 requests/instance
- **Timeout**: 300 seconds
- **Port**: 3004

## 🚀 How to Deploy

### Automatic Deployment (Primary Method)

Simply push your code to the `develop` branch:

```bash
git add .
git commit -m "feat: your feature description"
git push origin develop
```

**That's it!** Cloud Build will:
1. Detect the push
2. Build the Docker image
3. Run tests (if configured)
4. Deploy to Cloud Run
5. Update the service

### Manual Deployment (Optional)

If you need to deploy manually:

```bash
cd backend
./deploy.sh
```

Select option 2 for manual deployment.

## 📊 Monitoring Deployments

### View Build Status

1. **Cloud Console**: 
   - https://console.cloud.google.com/cloud-build/builds?project=salesmaya-pluto

2. **Command Line**:
   ```bash
   # List recent builds
   gcloud builds list --limit=10
   
   # View specific build
   gcloud builds describe BUILD_ID
   
   # Stream build logs
   gcloud builds log BUILD_ID --stream
   ```

### View Service Status

```bash
# Check service details
gcloud run services describe lad-backend --region=us-central1

# List recent revisions
gcloud run revisions list --service=lad-backend --region=us-central1 --limit=5

# View service logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=lad-backend" --limit=50
```

### Using the Deploy Script

```bash
cd backend
./deploy.sh

# Options:
# 1 - Setup/update secrets
# 2 - Manual deployment
# 3 - View deployment status
# 4 - View service logs
# 5 - Exit
```

## 🔐 Secrets Management

Secrets are stored in Google Secret Manager and automatically injected into the service.

### Required Secrets

| Secret Name | Description | Status |
|-------------|-------------|--------|
| `database-url` | PostgreSQL connection string | ✅ Required |
| `jwt-secret` | JWT token signing key | ✅ Required |
| `openai-api-key` | OpenAI API access | 🔹 Optional |
| `gemini-api-key` | Google Gemini API | 🔹 Optional |
| `apollo-api-key` | Apollo.io API | 🔹 Optional |
| `unipile-api-key` | Unipile integration | 🔹 Optional |
| `stripe-secret-key` | Stripe payments | 🔹 Optional |
| `stripe-webhook-secret` | Stripe webhooks | 🔹 Optional |

### Managing Secrets

**Update a secret:**
```bash
echo -n "new-secret-value" | gcloud secrets versions add SECRET_NAME --data-file=-
```

**View secret metadata:**
```bash
gcloud secrets describe SECRET_NAME
```

**Grant access to Cloud Run:**
```bash
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 🏷️ Image Tagging Strategy

Each build creates multiple tags for better version management:

- `gcr.io/PROJECT_ID/lad-backend:COMMIT_SHA` - Full commit hash
- `gcr.io/PROJECT_ID/lad-backend:SHORT_SHA` - Short commit hash (7 chars)
- `gcr.io/PROJECT_ID/lad-backend:BRANCH_NAME` - Branch name (e.g., develop)
- `gcr.io/PROJECT_ID/lad-backend:latest` - Latest build

### Rollback to Previous Version

```bash
# List available images
gcloud container images list-tags gcr.io/salesmaya-pluto/lad-backend --limit=10

# Deploy specific version
gcloud run deploy lad-backend \
  --image=gcr.io/salesmaya-pluto/lad-backend:SHORT_SHA \
  --region=us-central1
```

## 🎛️ Environment Variables

The following environment variables are automatically set during deployment:

| Variable | Value | Source |
|----------|-------|--------|
| `NODE_ENV` | `production` | Build config |
| `PORT` | `3004` | Build config |
| `BRANCH` | `develop` | Git branch |
| `COMMIT_SHA` | Auto | Git commit |
| `BUILD_ID` | Auto | Cloud Build |
| `DATABASE_URL` | Secret | Secret Manager |
| `JWT_SECRET` | Secret | Secret Manager |
| Other API keys | Secret | Secret Manager |

## 📈 Build Optimization

### Current Optimizations

1. **Docker Layer Caching**: Speeds up subsequent builds
2. **BuildKit**: Modern Docker build features
3. **Multi-tag Strategy**: Better version management
4. **Production-only Dependencies**: Smaller image size
5. **Alpine Base**: Minimal footprint (~50MB vs ~200MB)

### Build Performance

- **Cold Build**: ~3-5 minutes (first build)
- **Cached Build**: ~1-2 minutes (subsequent builds)
- **Image Size**: ~120MB (production)

## 🔍 Troubleshooting

### Build Failures

**Check build logs:**
```bash
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

**Common issues:**
- Missing secrets → Run `./deploy.sh` and select option 1
- Insufficient permissions → Check Cloud Build service account roles
- Docker build errors → Check Dockerfile syntax

### Deployment Issues

**Service won't start:**
```bash
# Check service logs
gcloud logs read "resource.type=cloud_run_revision" --limit=100

# Check health endpoint
curl https://YOUR_SERVICE_URL/health
```

**Service unreachable:**
- Verify Cloud Run service is deployed: `gcloud run services list`
- Check IAM permissions: Service should allow unauthenticated requests
- Verify firewall rules aren't blocking traffic

### Secret Access Issues

```bash
# Verify secrets exist
gcloud secrets list

# Check IAM bindings
gcloud secrets get-iam-policy SECRET_NAME

# Grant access to Cloud Run service account
PROJECT_NUMBER=$(gcloud projects describe salesmaya-pluto --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 🔒 Security Best Practices

### Current Security Measures

✅ **Non-root Container**: Application runs as user `nodeuser`  
✅ **Secret Manager**: All secrets stored securely, not in code  
✅ **HTTPS Only**: Enforced by Cloud Run  
✅ **Alpine Base**: Minimal attack surface  
✅ **Health Checks**: Container health monitoring  
✅ **Resource Limits**: Memory and CPU constraints  

### Additional Recommendations

1. **Enable VPC Connector** for private database access
2. **Set up Cloud Armor** for DDoS protection
3. **Configure Cloud Monitoring** alerts
4. **Regular security updates** of dependencies
5. **Implement rate limiting** in application

## 📊 Cost Optimization

### Current Setup

- **Min Instances**: 0 (scales to zero when idle)
- **Max Instances**: 10 (prevents runaway costs)
- **CPU**: 1 (sufficient for most workloads)
- **Memory**: 1Gi (balanced for Node.js)

### Estimated Monthly Cost

Based on typical usage:
- **Request Charges**: $0.40 per million requests
- **CPU Time**: $0.00001800 per vCPU-second
- **Memory Time**: $0.00000200 per GiB-second
- **Estimated**: $5-20/month for light-moderate traffic

### Cost Saving Tips

1. Set minimum instances to 0 (already configured)
2. Optimize response times to reduce CPU usage
3. Implement caching to reduce database calls
4. Monitor and optimize cold start times
5. Use Cloud CDN for static assets

## 🔗 Useful Links

- **Cloud Build Dashboard**: https://console.cloud.google.com/cloud-build
- **Cloud Run Console**: https://console.cloud.google.com/run
- **Secret Manager**: https://console.cloud.google.com/security/secret-manager
- **Logs**: https://console.cloud.google.com/logs
- **Service URL**: Will be displayed after first deployment

## 📞 Support

For deployment issues:
1. Check build logs in Cloud Build console
2. Review service logs using `./deploy.sh` (option 4)
3. Verify secrets are properly configured
4. Ensure Cloud Build service account has required permissions

## 🎉 Quick Start Checklist

- [ ] Cloud Build trigger configured for `develop` branch
- [ ] All required secrets created in Secret Manager
- [ ] Cloud Build service account has necessary permissions
- [ ] First deployment completed successfully
- [ ] Health check endpoint responding: `/health`
- [ ] Service URL accessible and functional

## 🔄 Continuous Improvement

Recommended next steps:
1. Add automated testing to build pipeline
2. Implement staging environment
3. Set up monitoring and alerting
4. Configure custom domain
5. Add performance profiling
6. Implement blue-green deployments