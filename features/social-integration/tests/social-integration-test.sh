#!/bin/bash

# Social Integration Feature Test Suite
# Tests all platforms: LinkedIn, Instagram, WhatsApp, Facebook

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3004"
API_BASE="/api/social-integration"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Print test header
print_header() {
    echo ""
    echo "============================================"
    echo "  $1"
    echo "============================================"
}

# Print test result
print_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        if [ ! -z "$3" ]; then
            echo -e "${YELLOW}  Error: $3${NC}"
        fi
    fi
}

# Test helper function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$API_BASE$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$API_BASE$endpoint")
    fi
    
    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n1)
    # Extract body (all except last line)
    body=$(echo "$response" | sed '$d')
    
    # Check if status code is 2xx
    if [[ $status_code =~ ^2[0-9]{2}$ ]]; then
        print_result 0 "$description (HTTP $status_code)"
        echo "  Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body)"
        return 0
    else
        print_result 1 "$description (HTTP $status_code)" "$body"
        return 1
    fi
}

# Main test execution
main() {
    print_header "Social Integration Feature Test Suite"
    echo "Testing backend at: $BASE_URL"
    echo "Started: $(date)"
    
    # Test 1: List available platforms
    print_header "Test 1: List Available Platforms"
    test_endpoint "GET" "/platforms" "" "List all available platforms"
    
    # Test 2: LinkedIn endpoints
    print_header "Test 2: LinkedIn Integration"
    
    # Check LinkedIn status
    test_endpoint "GET" "/linkedin/status" "" "Check LinkedIn configuration status"
    
    # Test LinkedIn invitation (will fail without real credentials, but tests routing)
    linkedin_invitation_data='{
        "profileUrl": "https://www.linkedin.com/in/test-user",
        "accountId": "test-account-123",
        "customMessage": "Hi! Would love to connect."
    }'
    test_endpoint "POST" "/linkedin/send-invitation" "$linkedin_invitation_data" "Send LinkedIn connection request (dry run)"
    
    # Test LinkedIn lookup
    test_endpoint "GET" "/linkedin/lookup?publicIdentifier=test-user&accountId=test-account-123" "" "Lookup LinkedIn profile (dry run)"
    
    # Test 3: Instagram endpoints
    print_header "Test 3: Instagram Integration"
    
    # Check Instagram status
    test_endpoint "GET" "/instagram/status" "" "Check Instagram configuration status"
    
    # Test Instagram follow request
    instagram_follow_data='{
        "profileUrl": "https://www.instagram.com/testuser",
        "accountId": "test-account-123"
    }'
    test_endpoint "POST" "/instagram/send-invitation" "$instagram_follow_data" "Send Instagram follow request (dry run)"
    
    # Test 4: WhatsApp endpoints
    print_header "Test 4: WhatsApp Integration"
    
    # Check WhatsApp status
    test_endpoint "GET" "/whatsapp/status" "" "Check WhatsApp configuration status"
    
    # Test WhatsApp message
    whatsapp_message_data='{
        "phoneNumber": "+1234567890",
        "message": "Hello from test suite",
        "accountId": "test-account-123"
    }'
    test_endpoint "POST" "/whatsapp/send-message" "$whatsapp_message_data" "Send WhatsApp message (dry run)"
    
    # Test 5: Facebook endpoints
    print_header "Test 5: Facebook Integration"
    
    # Check Facebook status
    test_endpoint "GET" "/facebook/status" "" "Check Facebook configuration status"
    
    # Test Facebook friend request
    facebook_friend_data='{
        "profileUrl": "https://www.facebook.com/testuser",
        "accountId": "test-account-123"
    }'
    test_endpoint "POST" "/facebook/send-invitation" "$facebook_friend_data" "Send Facebook friend request (dry run)"
    
    # Test 6: Batch operations
    print_header "Test 6: Batch Operations"
    
    # Test batch LinkedIn invitations
    batch_linkedin_data='{
        "profiles": [
            {"name": "John Doe", "publicIdentifier": "johndoe"},
            {"name": "Jane Smith", "publicIdentifier": "janesmith"}
        ],
        "accountId": "test-account-123",
        "customMessage": "Hi! Would love to connect.",
        "delayMs": 1000
    }'
    test_endpoint "POST" "/linkedin/batch-send-invitations" "$batch_linkedin_data" "Batch send LinkedIn invitations (dry run)"
    
    # Test 7: List accounts
    print_header "Test 7: Account Management"
    test_endpoint "GET" "/accounts" "" "List all connected accounts"
    
    # Test 8: Webhook handling
    print_header "Test 8: Webhook Handling"
    
    webhook_data='{
        "event": "connection.accepted",
        "timestamp": "2024-01-01T00:00:00Z",
        "data": {
            "recipient": {
                "linkedin_profile_url": "https://linkedin.com/in/test",
                "full_name": "Test User"
            },
            "status": "accepted"
        }
    }'
    test_endpoint "POST" "/webhook" "$webhook_data" "Handle webhook event"
    
    # Test 9: Validation tests
    print_header "Test 9: Validation Tests"
    
    # Test invalid platform
    test_endpoint "GET" "/invalidplatform/status" "" "Invalid platform should fail gracefully"
    
    # Test missing required fields
    invalid_invitation_data='{
        "profileUrl": "https://www.linkedin.com/in/test-user"
    }'
    test_endpoint "POST" "/linkedin/send-invitation" "$invalid_invitation_data" "Missing accountId should fail"
    
    # Print summary
    print_header "Test Summary"
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}All tests passed! ✓${NC}"
        exit 0
    else
        echo -e "\n${RED}Some tests failed. Please review the output above.${NC}"
        exit 1
    fi
}

# Check if backend is running
check_backend() {
    echo "Checking if backend is running..."
    if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        echo -e "${RED}Error: Backend is not running at $BASE_URL${NC}"
        echo "Please start the backend with: cd backend && npm start"
        exit 1
    fi
    echo -e "${GREEN}Backend is running${NC}"
}

# Run tests
check_backend
main
