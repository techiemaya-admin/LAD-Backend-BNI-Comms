#!/bin/bash

# LAD Backend - Manual Deployment & Secret Management Script
# Note: Auto-deployment is configured via Cloud Build trigger on develop branch
# This script is for manual deployments and secret management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"salesmaya-pluto"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"lad-backend"}

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  LAD Backend - Deployment & Secret Management Tool${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Note: Auto-deployment is active on 'develop' branch${NC}"
echo -e "${YELLOW}This script is for manual deployments and secret setup${NC}"
echo ""

# Menu
echo "Choose an option:"
echo "  1) Setup secrets only (required for first deployment)"
echo "  2) Manual deployment (build and deploy now)"
echo "  3) View deployment status"
echo "  4) View service logs"
echo "  5) Exit"
echo ""
read -p "Enter option (1-5): " option

case $option in
  1)
    echo -e "${GREEN}📋 Setting up secrets...${NC}"
    ;;
  2)
    echo -e "${GREEN}🚀 Starting manual deployment...${NC}"
    ;;
  3)
    echo -e "${GREEN}📊 Checking deployment status...${NC}"
    gcloud run services describe $SERVICE_NAME --region=$REGION --format="table(status.url,status.conditions[0].status,spec.template.metadata.name)"
    echo ""
    gcloud run revisions list --service=$SERVICE_NAME --region=$REGION --limit=5
    exit 0
    ;;
  4)
    echo -e "${GREEN}📜 Fetching service logs...${NC}"
    gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" --limit=50 --format="table(timestamp,severity,textPayload)"
    exit 0
    ;;
  5)
    echo -e "${YELLOW}👋 Goodbye!${NC}"
    exit 0
    ;;
  *)
    echo -e "${RED}Invalid option${NC}"
    exit 1
    ;;
esac

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    echo "Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 > /dev/null; then
    echo -e "${RED}❌ You are not authenticated with gcloud. Please run: gcloud auth login${NC}"
    exit 1
fi

# Set project
echo -e "${YELLOW}📋 Setting project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}🔧 Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com \
    secretmanager.googleapis.com

# Create secrets (if they don't exist)
echo -e "${YELLOW}🔐 Setting up secrets in Secret Manager...${NC}"

# Function to create secret if it doesn't exist
create_secret_if_not_exists() {
    local secret_name=$1
    local secret_value=$2
    
    if ! gcloud secrets describe $secret_name > /dev/null 2>&1; then
        echo "Creating secret: $secret_name"
        echo -n "$secret_value" | gcloud secrets create $secret_name --data-file=-
    else
        echo "Secret $secret_name already exists, updating..."
        echo -n "$secret_value" | gcloud secrets versions add $secret_name --data-file=-
    fi
}

# Prompt for secrets if not set as environment variables
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}Please enter your DATABASE_URL:${NC}"
    read -s DATABASE_URL
fi

if [ -z "$JWT_SECRET" ]; then
    echo -e "${YELLOW}Please enter your JWT_SECRET:${NC}"
    read -s JWT_SECRET
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}Please enter your OPENAI_API_KEY (optional):${NC}"
    read -s OPENAI_API_KEY
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${YELLOW}Please enter your GEMINI_API_KEY (optional):${NC}"
    read -s GEMINI_API_KEY
fi

if [ -z "$APOLLO_API_KEY" ]; then
    echo -e "${YELLOW}Please enter your APOLLO_API_KEY (optional):${NC}"
    read -s APOLLO_API_KEY
fi

if [ -z "$UNIPILE_API_KEY" ]; then
    echo -e "${YELLOW}Please enter your UNIPILE_API_KEY (optional):${NC}"
    read -s UNIPILE_API_KEY
fi

if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo -e "${YELLOW}Please enter your STRIPE_SECRET_KEY (optional):${NC}"
    read -s STRIPE_SECRET_KEY
fi

if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
    echo -e "${YELLOW}Please enter your STRIPE_WEBHOOK_SECRET (optional):${NC}"
    read -s STRIPE_WEBHOOK_SECRET
fi

# Create secrets
create_secret_if_not_exists "database-url" "$DATABASE_URL"
create_secret_if_not_exists "jwt-secret" "$JWT_SECRET"

if [ -n "$OPENAI_API_KEY" ]; then
    create_secret_if_not_exists "openai-api-key" "$OPENAI_API_KEY"
fi

if [ -n "$GEMINI_API_KEY" ]; then
    create_secret_if_not_exists "gemini-api-key" "$GEMINI_API_KEY"
fi

if [ -n "$APOLLO_API_KEY" ]; then
    create_secret_if_not_exists "apollo-api-key" "$APOLLO_API_KEY"
fi

if [ -n "$UNIPILE_API_KEY" ]; then
    create_secret_if_not_exists "unipile-api-key" "$UNIPILE_API_KEY"
fi

if [ -n "$STRIPE_SECRET_KEY" ]; then
    create_secret_if_not_exists "stripe-secret-key" "$STRIPE_SECRET_KEY"
fi

if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
    create_secret_if_not_exists "stripe-webhook-secret" "$STRIPE_WEBHOOK_SECRET"
fi

# Trigger Cloud Build (only if option 2 selected)
if [ "$option" = "2" ]; then
    echo -e "${YELLOW}🏗️  Triggering manual Cloud Build deployment...${NC}"
    gcloud builds submit --config cloudbuild.yaml . \
        --substitutions=BRANCH_NAME=manual-deploy,_SERVICE_NAME=$SERVICE_NAME,_REGION=$REGION
    
    echo ""
    echo -e "${GREEN}✅ Manual deployment triggered!${NC}"
    echo -e "${YELLOW}⏳ Note: It may take a few minutes for the service to be ready${NC}"
fi

fi

# Get service URL and display info
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deployment Information${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" 2>/dev/null || echo "Not deployed yet")
echo -e "${GREEN}🔗 Service URL:${NC} $SERVICE_URL"
echo -e "${GREEN}🏥 Health Check:${NC} $SERVICE_URL/health"
echo -e "${GREEN}📍 Region:${NC} $REGION"
echo -e "${GREEN}📦 Project:${NC} $PROJECT_ID"
echo ""
echo -e "${YELLOW}💡 Auto-deployment info:${NC}"
echo -e "   - Trigger: Push to 'develop' branch"
echo -e "   - Repository: Connected via Cloud Build trigger"
echo -e "   - View builds: https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
echo ""