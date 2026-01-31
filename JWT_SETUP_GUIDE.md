# LAD Backend - JWT & Authentication Setup Guide

## Problem: 401 Unauthorized Errors in Deployed Version

If you're seeing 401 errors on protected API endpoints in your deployed Cloud Run service, this guide will help you resolve authentication issues.

## Root Cause

The backend uses JWT (JSON Web Tokens) to authenticate API requests. The same `JWT_SECRET` must be used for:
1. **Token Generation** (during login)
2. **Token Verification** (for API requests)

If these secrets don't match, all tokens will be rejected with a 401 error.

## Solution: Configure JWT_SECRET in Google Cloud

### Step 1: Create the JWT Secret in Google Cloud Secret Manager

```bash
# Set your project ID
export PROJECT_ID="your-gcp-project-id"
gcloud config set project $PROJECT_ID

# Generate a strong random secret (or use your own)
JWT_SECRET=$(openssl rand -base64 32)
echo "Generated JWT_SECRET: $JWT_SECRET"

# Create the secret in Google Cloud Secret Manager
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-

# Verify the secret was created
gcloud secrets list | grep jwt-secret
```

### Step 2: Verify Secret Manager API is Enabled

```bash
gcloud services enable secretmanager.googleapis.com
```

### Step 3: Grant Cloud Run Service Access to the Secret

```bash
# Get the Cloud Run service account email
SERVICE_ACCOUNT="lad-backend@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant Secret Accessor role
gcloud secrets add-iam-policy-binding jwt-secret \
  --member=serviceAccount:$SERVICE_ACCOUNT \
  --role=roles/secretmanager.secretAccessor
```

### Step 4: Update Cloud Run Service

The `cloudbuild.yaml` should already have the secret reference. If needed, manually update:

```bash
gcloud run deploy lad-backend \
  --region us-central1 \
  --set-secrets JWT_SECRET=jwt-secret:latest \
  --image gcr.io/$PROJECT_ID/lad-backend:latest
```

### Step 5: Verify Deployment

```bash
# Check Cloud Run service environment variables
gcloud run services describe lad-backend --region us-central1

# Check the service logs for JWT configuration
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=lad-backend" --limit 50 | grep -i jwt
```

## Testing Authentication

Once configured, test the authentication flow:

### 1. Login to Get Token

```bash
curl -X POST https://lad-backend-develop-741719885039.us-central1.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password"
  }'
```

### 2. Use Token for Protected Endpoint

```bash
TOKEN="<token-from-login-response>"

curl -X GET https://lad-backend-develop-741719885039.us-central1.run.app/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### Symptom: Still Getting 401 Errors

1. **Check Secret Exists**
   ```bash
   gcloud secrets describe jwt-secret
   ```

2. **Check Service Account Permissions**
   ```bash
   gcloud secrets get-iam-policy jwt-secret
   ```

3. **View Service Logs**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=lad-backend AND jsonPayload.message=~'JWT'" --limit 20
   ```

4. **Check Environment Variables in Cloud Run**
   ```bash
   gcloud run services describe lad-backend --region us-central1 --format='value(spec.template.spec.containers[0].env)'
   ```

### Symptom: Secret Access Denied Error

Make sure the Cloud Run service account has the `Secret Accessor` role:

```bash
gcloud secrets add-iam-policy-binding jwt-secret \
  --member=serviceAccount:lad-backend@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

### Symptom: Service Won't Start

If the service fails to start after setting secrets:

1. Check service logs:
   ```bash
   gcloud run services describe lad-backend --region us-central1
   ```

2. View recent logs:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision" --limit 30
   ```

3. Redeploy if needed:
   ```bash
   gcloud builds submit --config cloudbuild.yaml .
   ```

## Other Required Secrets

While you're setting up, configure these additional secrets as well:

```bash
# Database URL
echo -n "postgresql://user:password@host:5432/database" | \
  gcloud secrets create database-url --data-file=-

# Stripe (if using billing)
echo -n "sk_test_..." | gcloud secrets create stripe-secret-key --data-file=-

# API Keys (if using external services)
echo -n "your-openai-key" | gcloud secrets create openai-api-key --data-file=-
echo -n "your-gemini-key" | gcloud secrets create gemini-api-key --data-file=-
echo -n "your-apollo-key" | gcloud secrets create apollo-api-key --data-file=-

# Grant all permissions
gcloud secrets add-iam-policy-binding database-url \
  --member=serviceAccount:lad-backend@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
# ... repeat for other secrets
```

## How Authentication Works

```
User Login Request
       ↓
[Generate JWT with JWT_SECRET]
       ↓
Return Token to Frontend
       ↓
Frontend stores token in cookies/localStorage
       ↓
API Request with Authorization header
       ↓
[Verify token with JWT_SECRET]
       ↓
✓ Token Valid → Allow request (200)
✗ Token Invalid → Reject request (401)
```

## Important Notes

- **Same Secret Required**: The same `JWT_SECRET` must be used for both signing and verification
- **Production Security**: Never use the default secret in production
- **Rotation**: If you need to rotate the secret, users will need to re-login
- **Multi-Region**: If deploying to multiple regions, ensure they all use the same secret
