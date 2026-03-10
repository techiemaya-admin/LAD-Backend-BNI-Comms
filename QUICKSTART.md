# LAD Backend - Quick Deployment Guide

## 🚀 Quick Start (3 Steps)

### Step 1: Setup GCP Secrets (One-time setup)
```bash
cd LAD_backend
./setup-secrets.sh
```

This will create the following secrets in Google Secret Manager:
- `POSTGRES_PASSWORD` (from your .env file or prompt)
- `JWT_SECRET` (auto-generated or from .env)
- `GEMINI_API_KEY` (from your .env file or prompt)

### Step 2: Deploy to Cloud Run
```bash
./deploy-develop.sh
```

This script will:
1. ✅ Verify gcloud CLI installation
2. ✅ Set project to `lad-develop`
3. ✅ Enable required APIs
4. ✅ Build Docker image
5. ✅ Push to Google Container Registry
6. ✅ Deploy to Cloud Run
7. ✅ Return service URL

### Step 3: Test Your Deployment
```bash
# The script will output the service URL, test it:
curl https://your-service-url/health
```

---

## 📋 Prerequisites Checklist

- [ ] **Google Cloud SDK** installed (`gcloud --version`)
- [ ] **Docker** installed (`docker --version`)
- [ ] **Access to LAD-Develop** GCP project
- [ ] **Authenticated with gcloud** (`gcloud auth login`)
- [ ] **Docker authenticated** (`gcloud auth configure-docker`)

### Install Prerequisites

**macOS:**
```bash
# Install gcloud SDK
brew install --cask google-cloud-sdk

# Install Docker Desktop
brew install --cask docker
```

**Or download manually:**
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

## 🔄 Alternative Deployment Methods

### Method A: Using Cloud Build (CI/CD)
```bash
# Deploy to development
gcloud builds submit \
  --config=cloudbuild-develop.yaml \
  --project=lad-develop

# Deploy to production
gcloud builds submit \
  --config=cloudbuild-production.yaml \
  --project=lad-develop
```

### Method B: Manual Steps
```bash
# 1. Build
docker build -t gcr.io/lad-develop/lad-backend:latest .

# 2. Push
docker push gcr.io/lad-develop/lad-backend:latest

# 3. Deploy
gcloud run deploy lad-backend-develop \
  --image=gcr.io/lad-develop/lad-backend:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated
```

---

## 🔍 Testing & Verification

### Local Docker Test
```bash
# Build and test locally before deploying
docker build -t lad-backend:test .
docker run -p 8080:8080 --env-file .env -e PORT=8080 lad-backend:test

# Test in another terminal
curl http://localhost:8080/health
```

### Test Deployed Service
```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe lad-backend-develop \
  --platform=managed \
  --region=us-central1 \
  --format='value(status.url)')

# Health check
curl $SERVICE_URL/health

# Test API endpoints
curl $SERVICE_URL/api/features
curl $SERVICE_URL/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

---

## 📊 Deployment Configuration

### Development Environment
```yaml
Project:       lad-develop
Service:       lad-backend-develop
Region:        us-central1
Memory:        512Mi
CPU:           1
Min Instances: 0 (scales to zero)
Max Instances: 10
Port:          8080
Schema:        lad_dev
```

### Production Environment
```yaml
Project:       lad-develop
Service:       lad-backend-production
Region:        us-central1
Memory:        1Gi
CPU:           2
Min Instances: 1 (always running)
Max Instances: 50
Port:          8080
Schema:        public
```

---

## 🔧 Common Commands

### View Logs
```bash
# Real-time logs
gcloud run services logs tail lad-backend-develop \
  --project=lad-develop

# Recent logs
gcloud run services logs read lad-backend-develop \
  --limit=100 \
  --project=lad-develop
```

### Update Environment Variables
```bash
gcloud run services update lad-backend-develop \
  --update-env-vars="NEW_VAR=value" \
  --region=us-central1
```

### Update Secrets
```bash
# Update a secret
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Force redeployment to pick up new secret
gcloud run services update lad-backend-develop \
  --region=us-central1
```

### Rollback Deployment
```bash
# List revisions
gcloud run revisions list \
  --service=lad-backend-develop \
  --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic lad-backend-develop \
  --to-revisions=REVISION_NAME=100 \
  --region=us-central1
```

---

## 🐛 Troubleshooting

### Issue: Build fails with "permission denied"
```bash
# Re-authenticate
gcloud auth login
gcloud auth configure-docker
```

### Issue: Deployment fails with "access denied"
```bash
# Check project access
gcloud projects get-iam-policy lad-develop

# Ensure you have roles/run.admin
```

### Issue: Service crashes on startup
```bash
# Check logs
gcloud run services logs read lad-backend-develop --limit=50

# Common causes:
# - Missing secrets
# - Database connection issues
# - Invalid environment variables
```

### Issue: Can't connect to database
```bash
# Verify secrets exist
gcloud secrets list --project=lad-develop

# Check secret values (be careful!)
gcloud secrets versions access latest --secret=POSTGRES_PASSWORD

# Test database connection locally
psql -h 165.22.221.77 -U dbadmin -d salesmaya_bni
```

---

## 📁 Created Files

Your LAD_backend directory now contains:

```
LAD_backend/
├── Dockerfile                    # Multi-stage Docker build
├── .dockerignore                 # Optimize build
├── cloudbuild-develop.yaml       # CI/CD for dev
├── cloudbuild-production.yaml    # CI/CD for prod
├── deploy-develop.sh            # Quick deploy script
├── setup-secrets.sh             # Secret setup script
├── DEPLOYMENT.md                # Detailed guide
└── QUICKSTART.md               # This file
```

---

## 🎯 Next Steps

1. ✅ Run `./setup-secrets.sh` (one-time)
2. ✅ Run `./deploy-develop.sh`
3. ✅ Test the deployed service
4. 📱 Update your frontend to use the new backend URL
5. 🔄 Set up Cloud Build triggers for auto-deployment

---

## 🆘 Support

- **Documentation**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed info
- **GCP Console**: https://console.cloud.google.com/run?project=lad-develop
- **Cloud Build**: https://console.cloud.google.com/cloud-build?project=lad-develop
- **Logs**: https://console.cloud.google.com/logs?project=lad-develop

---

## 🎉 Success Indicators

After deployment, you should see:

```
✓ Docker image built successfully
✓ Image pushed to GCR
✓ Service deployed to Cloud Run
✓ Health check returns 200 OK
✓ Service URL is accessible

Service URL: https://lad-backend-develop-xxxxx-uc.a.run.app
```

**You're ready to go! 🚀**
