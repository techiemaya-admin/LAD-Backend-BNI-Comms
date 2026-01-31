# Social Integration Feature

> **Unified social media integration for LinkedIn, Instagram, WhatsApp, and Facebook**  
> Version: 1.0.0  
> Status: ✅ Production Ready

## Overview

The Social Integration feature provides a unified API for managing social media connections and outreach across multiple platforms using the Unipile service. All platforms share the same authentication and webhook infrastructure while maintaining platform-specific functionality.

### Supported Platforms

| Platform | Status | Features | Actions |
|----------|--------|----------|---------|
| **LinkedIn** | ✅ Enabled | Connection requests, messaging, profile lookup | `send-invitation`, `send-message`, `lookup` |
| **Instagram** | ✅ Enabled | Follow requests, messaging | `send-invitation`, `send-message`, `lookup` |
| **WhatsApp** | ✅ Enabled | Direct messaging | `send-message` |
| **Facebook** | ✅ Enabled | Friend requests, messaging, profile lookup | `send-invitation`, `send-message`, `lookup` |

## Architecture

### Directory Structure

```
backend/features/social-integration/
├── manifest.js                   # Feature configuration & platform toggles
├── routes.js                     # Unified routes with :platform parameter
├── controllers/
│   └── SocialIntegrationController.js  # Main controller
├── services/
│   ├── UnipileService.js        # Base service with common functionality
│   ├── LinkedInIntegration.js   # LinkedIn-specific methods
│   ├── InstagramIntegration.js  # Instagram-specific methods
│   ├── WhatsAppIntegration.js   # WhatsApp-specific methods
│   └── FacebookIntegration.js   # Facebook-specific methods
├── utils/
│   ├── platformValidator.js     # Platform validation & cost calculation
│   └── urlParser.js             # URL parsing & identifier extraction
└── tests/
    └── social-integration-test.sh  # Comprehensive test suite
```

### Design Principles

1. **Unified Interface**: Single API with platform parameter
2. **Platform Abstraction**: Base service + platform-specific extensions
3. **Feature Toggles**: Per-client, per-platform enablement
4. **Credit-Based Billing**: Different costs per platform/action
5. **Webhook Support**: Centralized event handling for all platforms

## Configuration

### Environment Variables

**Required:**
```bash
UNIPILE_DSN=https://api17.unipile.com:14788      # Your Unipile API URL
UNIPILE_TOKEN=your_unipile_api_token_here        # Your Unipile API key
```

**Optional (for OAuth flows):**
```bash
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/settings/linkedin/callback

INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret

FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

### Platform Toggles

Enable/disable platforms in [manifest.js](./manifest.js):

```javascript
platforms: {
  linkedin: { enabled: true },
  instagram: { enabled: true },
  whatsapp: { enabled: true },
  facebook: { enabled: true }
}
```

## API Endpoints

Base Path: `/api/social-integration`

### General Endpoints

#### List Available Platforms
```http
GET /api/social-integration/platforms
```

**Response:**
```json
{
  "success": true,
  "platforms": [
    {
      "id": "linkedin",
      "name": "LinkedIn",
      "provider": "LINKEDIN",
      "enabled": true,
      "features": ["connect", "send-invitation", "messaging", "profile-lookup"],
      "costs": {
        "connect": 1,
        "invitation": 1,
        "message": 2,
        "lookup": 0.5
      }
    }
  ]
}
```

#### List Connected Accounts
```http
GET /api/social-integration/accounts
```

**Response:**
```json
{
  "success": true,
  "accounts": {
    "linkedin": [...],
    "instagram": [...],
    "whatsapp": [...],
    "facebook": [...]
  },
  "total": 4
}
```

### Platform-Specific Endpoints

All endpoints use `:platform` parameter: `linkedin`, `instagram`, `whatsapp`, or `facebook`

#### 1. Check Connection Status
```http
GET /api/social-integration/:platform/status
```

**Query Params:**
- `accountId` (optional): Check specific account

**Example:**
```bash
curl "http://localhost:3004/api/social-integration/linkedin/status"
```

**Response:**
```json
{
  "success": true,
  "platform": "linkedin",
  "configured": true,
  "message": "Platform is configured and ready"
}
```

#### 2. Send Invitation/Connection Request
```http
POST /api/social-integration/:platform/send-invitation
```

**Body:**
```json
{
  "profileUrl": "https://www.linkedin.com/in/johndoe",
  "accountId": "unipile_account_id_here",
  "customMessage": "Hi! Would love to connect." // Optional
}
```

**Alternative formats:**
```json
{
  "publicIdentifier": "johndoe",
  "accountId": "unipile_account_id_here"
}
```

```json
{
  "profile": {
    "name": "John Doe",
    "profile_url": "https://www.linkedin.com/in/johndoe"
  },
  "accountId": "unipile_account_id_here",
  "customMessage": "Hi John!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invitation_id": "inv_123abc",
    "status": "sent"
  },
  "profile": {
    "name": "John Doe",
    "url": "https://www.linkedin.com/in/johndoe",
    "provider_id": "encoded_provider_id"
  },
  "alreadySent": false,
  "creditsUsed": 1
}
```

#### 3. Batch Send Invitations
```http
POST /api/social-integration/:platform/batch-send-invitations
```

**Body:**
```json
{
  "profiles": [
    {
      "name": "John Doe",
      "publicIdentifier": "johndoe"
    },
    {
      "name": "Jane Smith",
      "profile_url": "https://www.linkedin.com/in/janesmith"
    }
  ],
  "accountId": "unipile_account_id_here",
  "customMessage": "Hi! Would love to connect.",
  "delayMs": 2000  // Delay between requests (default: 2000ms)
}
```

**Response:**
```json
{
  "success": true,
  "total": 2,
  "successful": 1,
  "failed": 0,
  "alreadySent": 1,
  "results": [
    {
      "profile": "John Doe",
      "success": true,
      "alreadySent": false
    },
    {
      "profile": "Jane Smith",
      "success": true,
      "alreadySent": true
    }
  ],
  "creditsUsed": 1
}
```

#### 4. Send Direct Message
```http
POST /api/social-integration/:platform/send-message
```

**For LinkedIn, Instagram, Facebook:**
```json
{
  "providerId": "encoded_provider_id_from_lookup",
  "message": "Hello! Thanks for connecting.",
  "accountId": "unipile_account_id_here"
}
```

**For WhatsApp:**
```json
{
  "phoneNumber": "+1234567890",
  "message": "Hello! This is a test message.",
  "accountId": "unipile_account_id_here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message_id": "msg_123abc",
    "status": "sent"
  },
  "creditsUsed": 2
}
```

#### 5. Look Up Profile
```http
GET /api/social-integration/:platform/lookup
```

**Query Params:**
- `profileUrl`: Full profile URL OR
- `publicIdentifier`: Username/identifier OR
- `phoneNumber`: Phone number (WhatsApp only)
- `accountId`: Unipile account ID (required)

**Example:**
```bash
curl "http://localhost:3004/api/social-integration/linkedin/lookup?publicIdentifier=johndoe&accountId=account_123"
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "providerId": "encoded_provider_id",
    "profileName": "John Doe",
    "publicIdentifier": "johndoe",
    "profileMatch": true
  },
  "creditsUsed": 0.5
}
```

#### 6. Disconnect Account
```http
POST /api/social-integration/:platform/disconnect
```

**Body:**
```json
{
  "accountId": "unipile_account_id_here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Account disconnected successfully"
  }
}
```

### Webhook Endpoint

```http
POST /api/social-integration/webhook
```

Unipile will send events to this endpoint. Configure in your Unipile dashboard:
```
https://your-domain.com/api/social-integration/webhook
```

**Example Event:**
```json
{
  "event": "connection.accepted",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "recipient": {
      "linkedin_profile_url": "https://linkedin.com/in/johndoe",
      "full_name": "John Doe"
    },
    "status": "accepted"
  }
}
```

**Supported Events:**
- `connection.accepted` - Connection request accepted
- `connection.declined` - Connection request declined
- `message.received` - New message received

## Usage Examples

### Node.js / JavaScript

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:3004/api/social-integration';
const ACCOUNT_ID = 'your_unipile_account_id';

// 1. Check LinkedIn status
async function checkLinkedInStatus() {
  const response = await axios.get(`${BASE_URL}/linkedin/status`);
  console.log('LinkedIn Status:', response.data);
}

// 2. Send LinkedIn connection request
async function sendLinkedInConnection(profileUrl, message) {
  const response = await axios.post(`${BASE_URL}/linkedin/send-invitation`, {
    profileUrl: profileUrl,
    accountId: ACCOUNT_ID,
    customMessage: message
  });
  console.log('Connection sent:', response.data);
}

// 3. Batch send connections
async function batchSendConnections(profiles) {
  const response = await axios.post(`${BASE_URL}/linkedin/batch-send-invitations`, {
    profiles: profiles,
    accountId: ACCOUNT_ID,
    customMessage: "Hi! Would love to connect.",
    delayMs: 2000
  });
  console.log('Batch results:', response.data);
}

// 4. Send Instagram follow request
async function sendInstagramFollow(username) {
  const response = await axios.post(`${BASE_URL}/instagram/send-invitation`, {
    profileUrl: `https://www.instagram.com/${username}`,
    accountId: ACCOUNT_ID
  });
  console.log('Follow request sent:', response.data);
}

// 5. Send WhatsApp message
async function sendWhatsAppMessage(phoneNumber, message) {
  const response = await axios.post(`${BASE_URL}/whatsapp/send-message`, {
    phoneNumber: phoneNumber,
    message: message,
    accountId: ACCOUNT_ID
  });
  console.log('Message sent:', response.data);
}

// 6. Look up LinkedIn profile
async function lookupLinkedInProfile(publicIdentifier) {
  const response = await axios.get(`${BASE_URL}/linkedin/lookup`, {
    params: {
      publicIdentifier: publicIdentifier,
      accountId: ACCOUNT_ID
    }
  });
  console.log('Profile:', response.data.profile);
  return response.data.profile.providerId;
}
```

### Python

```python
import requests

BASE_URL = "http://localhost:3004/api/social-integration"
ACCOUNT_ID = "your_unipile_account_id"

# Send LinkedIn connection
def send_linkedin_connection(profile_url, message=None):
    response = requests.post(
        f"{BASE_URL}/linkedin/send-invitation",
        json={
            "profileUrl": profile_url,
            "accountId": ACCOUNT_ID,
            "customMessage": message
        }
    )
    return response.json()

# Batch send connections
def batch_send_connections(profiles):
    response = requests.post(
        f"{BASE_URL}/linkedin/batch-send-invitations",
        json={
            "profiles": profiles,
            "accountId": ACCOUNT_ID,
            "customMessage": "Hi! Would love to connect.",
            "delayMs": 2000
        }
    )
    return response.json()

# Send WhatsApp message
def send_whatsapp_message(phone_number, message):
    response = requests.post(
        f"{BASE_URL}/whatsapp/send-message",
        json={
            "phoneNumber": phone_number,
            "message": message,
            "accountId": ACCOUNT_ID
        }
    )
    return response.json()

# Example usage
result = send_linkedin_connection("https://www.linkedin.com/in/johndoe", "Hi John!")
print(f"Connection sent: {result}")
```

### cURL

```bash
# List platforms
curl -X GET http://localhost:3004/api/social-integration/platforms

# Check LinkedIn status
curl -X GET http://localhost:3004/api/social-integration/linkedin/status

# Send LinkedIn connection
curl -X POST http://localhost:3004/api/social-integration/linkedin/send-invitation \
  -H "Content-Type: application/json" \
  -d '{
    "profileUrl": "https://www.linkedin.com/in/johndoe",
    "accountId": "your_account_id",
    "customMessage": "Hi! Would love to connect."
  }'

# Batch send connections
curl -X POST http://localhost:3004/api/social-integration/linkedin/batch-send-invitations \
  -H "Content-Type: application/json" \
  -d '{
    "profiles": [
      {"name": "John Doe", "publicIdentifier": "johndoe"},
      {"name": "Jane Smith", "publicIdentifier": "janesmith"}
    ],
    "accountId": "your_account_id",
    "customMessage": "Hi! Would love to connect.",
    "delayMs": 2000
  }'

# Send WhatsApp message
curl -X POST http://localhost:3004/api/social-integration/whatsapp/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "message": "Hello from API!",
    "accountId": "your_account_id"
  }'

# Look up profile
curl -X GET "http://localhost:3004/api/social-integration/linkedin/lookup?publicIdentifier=johndoe&accountId=your_account_id"

# List all accounts
curl -X GET http://localhost:3004/api/social-integration/accounts
```

## Credit System

Each action consumes credits based on platform and action type:

| Platform | Action | Credits |
|----------|--------|---------|
| LinkedIn | Connect account | 1 |
| LinkedIn | Send invitation | 1 |
| LinkedIn | Send message | 2 |
| LinkedIn | Profile lookup | 0.5 |
| Instagram | Connect account | 1 |
| Instagram | Follow request | 0.5 |
| Instagram | Send message | 2 |
| Instagram | Profile lookup | 0.5 |
| WhatsApp | Connect account | 1 |
| WhatsApp | Send message | 3 |
| Facebook | Connect account | 1 |
| Facebook | Friend request | 1 |
| Facebook | Send message | 2 |
| Facebook | Profile lookup | 0.5 |

Credits are automatically calculated and deducted after successful actions.

## Testing

### Run Test Suite

```bash
cd backend/features/social-integration/tests
./social-integration-test.sh
```

The test suite covers:
- ✅ Platform listing
- ✅ Status checks for all platforms
- ✅ Invitation sending (all platforms)
- ✅ Message sending
- ✅ Profile lookups
- ✅ Batch operations
- ✅ Account management
- ✅ Webhook handling
- ✅ Validation and error handling

### Manual Testing

1. **Check configuration:**
```bash
curl http://localhost:3004/api/social-integration/platforms
```

2. **Test LinkedIn integration:**
```bash
# Get your Unipile account ID first from Unipile dashboard
ACCOUNT_ID="your_account_id"

# Send test invitation
curl -X POST http://localhost:3004/api/social-integration/linkedin/send-invitation \
  -H "Content-Type: application/json" \
  -d "{
    \"profileUrl\": \"https://www.linkedin.com/in/test-user\",
    \"accountId\": \"$ACCOUNT_ID\",
    \"customMessage\": \"Hi! Test invitation.\"
  }"
```

## Error Handling

### Common Error Codes

| Status Code | Meaning | Solution |
|-------------|---------|----------|
| 400 | Bad Request | Check required parameters |
| 401 | Unauthorized | Verify authentication token |
| 403 | Forbidden | Check platform is enabled |
| 404 | Not Found | Verify endpoint and platform name |
| 409 | Conflict | Invitation already sent (treated as success) |
| 422 | Validation Error | Check payload format and constraints |
| 500 | Server Error | Check backend logs |

### Example Error Response

```json
{
  "success": false,
  "error": "Platform instagram is not enabled",
  "errors": ["Platform not enabled in feature manifest"]
}
```

## Rate Limiting

- **Window**: 15 minutes
- **Max Requests**: 100 per window
- **Batch Operations**: Automatic delay between requests (configurable via `delayMs` parameter)

### Recommended Delays

- LinkedIn: 2000ms (2 seconds)
- Instagram: 2000ms (2 seconds)
- Facebook: 2000ms (2 seconds)
- WhatsApp: 3000ms (3 seconds)

## Best Practices

1. **Use Batch Operations**: For multiple invitations, use batch endpoints to leverage automatic delays and retry logic

2. **Handle Already Sent**: 409 and "already invited" errors are treated as success - don't retry these

3. **Profile Lookup First**: For messaging, look up `providerId` first before sending messages

4. **Validate URLs**: Use platform-specific URL validators before making requests

5. **Monitor Credits**: Track credit usage to avoid running out mid-campaign

6. **Webhook Configuration**: Set up webhooks to track connection acceptances and responses

7. **Error Handling**: Implement retry logic for 5xx errors, but not for 4xx errors

## Integration with Existing Features

This feature integrates with:

- **Lead Enrichment**: Automatically send LinkedIn invitations to enriched leads
- **Apollo Leads**: Connect with Apollo-discovered prospects on LinkedIn
- **AI ICP Assistant**: Send invitations to ICP-matched profiles

## Troubleshooting

### Issue: "Unipile is not configured"

**Solution**: Ensure `UNIPILE_DSN` and `UNIPILE_TOKEN` are set in environment variables

```bash
# Check if variables are set
echo $UNIPILE_DSN
echo $UNIPILE_TOKEN

# Add to .env file
UNIPILE_DSN=https://api17.unipile.com:14788
UNIPILE_TOKEN=your_token_here

# Restart backend
```

### Issue: "Account ID is required"

**Solution**: Get your account ID from Unipile:
1. Log in to Unipile dashboard
2. Connect your social media account
3. Copy the account ID from the connected accounts list

### Issue: "Invalid LinkedIn URL format"

**Solution**: Ensure URL matches format:
- ✅ `https://www.linkedin.com/in/username`
- ✅ `username` (just the identifier)
- ❌ `https://linkedin.com/in/username/details`

### Issue: Rate limiting (422 errors)

**Solution**: Increase `delayMs` in batch operations or reduce request frequency

## Migration from sts-service

If migrating from the old sts-service implementation:

1. **Update environment variables**: Same UNIPILE_DSN and UNIPILE_TOKEN
2. **Update endpoints**: Change base path from `/api/linkedin` to `/api/social-integration/linkedin`
3. **Update payload structure**: New format uses unified schema across platforms
4. **Batch operations**: New batch endpoints with automatic delay handling

## Support

For issues or questions:
- Check backend logs: `tail -f backend/backend.log`
- Review test output: `./tests/social-integration-test.sh`
- Verify Unipile status: `https://status.unipile.com`

## License

Internal use only - Part of LAD Backend System
