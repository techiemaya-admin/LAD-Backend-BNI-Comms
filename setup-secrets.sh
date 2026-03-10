#!/bin/bash

###############################################################################
# Setup Google Cloud Secrets for LAD Backend
# Project: LAD-Develop
# Run this once before first deployment
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="lad-develop"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         GCP Secret Manager Setup for LAD Backend      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Set project
echo -e "${YELLOW}Setting project to ${PROJECT_ID}...${NC}"
gcloud config set project ${PROJECT_ID}
echo ""

# Enable Secret Manager API
echo -e "${YELLOW}Enabling Secret Manager API...${NC}"
gcloud services enable secretmanager.googleapis.com --project=${PROJECT_ID}
echo -e "${GREEN}✓ API enabled${NC}"
echo ""

# Get project number for IAM binding
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo -e "${BLUE}Project Number: ${PROJECT_NUMBER}${NC}"
echo -e "${BLUE}Service Account: ${SERVICE_ACCOUNT}${NC}"
echo ""

# Function to create or update secret
create_or_update_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    
    echo -e "${YELLOW}Processing secret: ${SECRET_NAME}${NC}"
    
    # Check if secret exists
    if gcloud secrets describe ${SECRET_NAME} --project=${PROJECT_ID} &> /dev/null; then
        echo -e "  Secret already exists. Adding new version..."
        echo -n "${SECRET_VALUE}" | gcloud secrets versions add ${SECRET_NAME} --data-file=- --project=${PROJECT_ID}
    else
        echo -e "  Creating new secret..."
        echo -n "${SECRET_VALUE}" | gcloud secrets create ${SECRET_NAME} --data-file=- --project=${PROJECT_ID}
    fi
    
    # Grant access to the service account
    echo -e "  Granting access to Cloud Run service account..."
    gcloud secrets add-iam-policy-binding ${SECRET_NAME} \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" \
        --project=${PROJECT_ID} &> /dev/null
    
    echo -e "${GREEN}  ✓ Secret ${SECRET_NAME} configured${NC}"
    echo ""
}

# Read secrets from .env file if it exists
if [ -f .env ]; then
    echo -e "${YELLOW}Reading values from .env file...${NC}"
    source .env
    echo -e "${GREEN}✓ .env loaded${NC}"
    echo ""
fi

# Create secrets
echo -e "${BLUE}Creating/Updating secrets...${NC}"
echo ""

# POSTGRES_PASSWORD
if [ -z "$POSTGRES_PASSWORD" ]; then
    read -sp "Enter POSTGRES_PASSWORD: " POSTGRES_PASSWORD
    echo ""
fi
create_or_update_secret "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"

# JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    echo -e "${YELLOW}Generating random JWT_SECRET...${NC}"
    JWT_SECRET=$(openssl rand -base64 32)
    echo -e "${GREEN}✓ JWT_SECRET generated${NC}"
fi
create_or_update_secret "JWT_SECRET" "$JWT_SECRET"

# GEMINI_API_KEY
if [ -z "$GEMINI_API_KEY" ]; then
    read -sp "Enter GEMINI_API_KEY: " GEMINI_API_KEY
    echo ""
fi
create_or_update_secret "GEMINI_API_KEY" "$GEMINI_API_KEY"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            Secrets Setup Complete! 🎉                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Created/Updated secrets:${NC}"
echo "  • POSTGRES_PASSWORD"
echo "  • JWT_SECRET"
echo "  • GEMINI_API_KEY"
echo ""
echo -e "${BLUE}Service account granted access:${NC}"
echo "  ${SERVICE_ACCOUNT}"
echo ""
echo -e "${GREEN}✓ You can now deploy your application!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Run: ./deploy-develop.sh"
echo "  2. Or use Cloud Build: gcloud builds submit --config=cloudbuild-develop.yaml"
echo ""
