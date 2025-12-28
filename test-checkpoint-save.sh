#!/bin/bash

# Test LinkedIn Connection with Checkpoint Save
# This script tests the checkpoint saving functionality

BACKEND_URL="http://localhost:3004"

echo "🧪 Testing LinkedIn Connection with Checkpoint Save"
echo "=================================================="
echo ""

# Step 1: Get authentication token
echo "Step 1: Getting authentication token..."
TOKEN=$(curl -s -X POST ${BACKEND_URL}/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123"}' \
  | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get authentication token"
  echo "Please check your credentials or register a user first"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:30}..."
echo ""

# Step 2: Test LinkedIn connect (replace with your actual credentials)
echo "Step 2: Testing LinkedIn connection..."
echo ""
echo "⚠️  Please provide your LinkedIn credentials below:"
echo ""
read -p "LinkedIn Email: " LINKEDIN_EMAIL
read -sp "LinkedIn Password: " LINKEDIN_PASSWORD
echo ""
echo ""

# Test connection using credentials method
echo "Sending connection request..."
RESPONSE=$(curl -s -X POST ${BACKEND_URL}/api/social-integration/linkedin/connect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"method\": \"credentials\",
    \"email\": \"${LINKEDIN_EMAIL}\",
    \"password\": \"${LINKEDIN_PASSWORD}\"
  }")

echo ""
echo "Response:"
echo "$RESPONSE" | jq '.'

echo ""
echo "=================================================="
echo "📋 What to check:"
echo ""
echo "1. If checkpoint_required is true, check if database_account_id is present"
echo "2. Check backend logs for any database save errors"
echo "3. Verify the account was saved to the database with status='checkpoint'"
echo ""
echo "To check backend logs, run:"
echo "  tail -f /tmp/backend.log | grep -i checkpoint"
echo ""

