# Voice Call Validation Architecture

## LAD Architecture Compliance ✅

This document outlines the complete validation pipeline for voice call initiation (`initiateCallV2`).

---

## 🔐 Complete Validation Pipeline

### Route Configuration
**File:** `/features/voice-agent/routes/index.js`

```javascript
router.post(
  '/calls/start-call',
  authenticateToken,                    // ① Authentication
  requireFeature('voice-agent'),        // ② Feature Access
  validateVoiceCallPrerequisites,       // ③④⑤ Business Hours + Credits + Rate Limits
  CallInitiationController.initiateCallV2  // ⑥ Execute Call
);
```

---

## ① Authentication Middleware

**File:** `/core/middleware/auth.js` (authenticateToken)

**Validates:**
- ✅ JWT token present in headers
- ✅ Token is valid and not expired
- ✅ Extracts `tenantId` and `userId` from token

**Failure Response:**
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "Please provide a valid authentication token"
}
```

**Request Context Added:**
```javascript
req.user = {
  userId: "uuid",
  tenantId: "uuid",
  email: "user@example.com"
}
```

---

## ② Feature Access Check

**File:** `/shared/middleware/feature_guard.js` (requireFeature)

**Validates:**
- ✅ Tenant has `voice-agent` feature enabled
- ✅ Feature not expired or disabled
- ✅ Subscription plan includes voice calling

**Database Check:**
```sql
SELECT enabled FROM tenant_features 
WHERE tenant_id = $1 AND feature_key = 'voice-agent'
```

**Failure Response:**
```json
{
  "success": false,
  "error": "Feature not available",
  "message": "The voice-agent feature is not enabled for your account",
  "feature": "voice-agent",
  "upgrade_required": true
}
```

**Request Context Added:**
```javascript
req.feature = {
  key: 'voice-agent',
  tenantId: "uuid",
  userId: "uuid"
}
```

---

## ③④⑤ Voice Call Prerequisites Validation

**File:** `/features/voice-agent/middleware/voiceCallValidation.js`

### ③ Business Hours Check

**Validates:**
- ✅ Current day is within allowed calling days (e.g., Mon-Fri)
- ✅ Current time is within configured hours (e.g., 9 AM - 6 PM)
- ✅ Timezone-aware checking

**Configuration:**
```javascript
{
  start: '09:00',
  end: '18:00',
  timezone: 'America/New_York',
  days: [1, 2, 3, 4, 5] // Mon-Fri
}
```

**Failure Response:**
```json
{
  "success": false,
  "error": "Outside business hours",
  "message": "Calls are only allowed between 09:00 and 18:00 (America/New_York). Current time: 20:15",
  "business_hours": {
    "start": "09:00",
    "end": "18:00",
    "timezone": "America/New_York",
    "allowed_days": [1, 2, 3, 4, 5]
  }
}
```

### ④ Credit Availability Check

**Validates:**
- ✅ Tenant has minimum 3 credits available
- ✅ Voice calls cost 3 credits per minute
- ✅ Minimum call duration = 1 minute

**Database Check:**
```sql
SELECT current_balance 
FROM billing_wallets 
WHERE tenant_id = $1
```

**Failure Response:**
```json
{
  "success": false,
  "error": "Insufficient credits",
  "message": "Voice calls require at least 3 credits (1 minute minimum). Your current balance: 1 credits.",
  "credits_required": 3,
  "credits_available": 1,
  "credits_needed": 2,
  "action": "Please add credits to your account to make calls"
}
```

### ⑤ Rate Limiting (Future Implementation)

**Validates:**
- ✅ Max calls per hour not exceeded
- ✅ Max calls per day not exceeded
- ✅ Prevents abuse and spam

**Future Database Check:**
```sql
SELECT COUNT(*) FROM call_logs 
WHERE tenant_id = $1 
  AND created_at > NOW() - INTERVAL '1 hour'
  AND status != 'failed'
```

**Future Failure Response:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Maximum 50 calls per hour. Please try again later.",
  "limit": 50,
  "current": 51,
  "reset_at": "2026-02-15T15:00:00Z"
}
```

**Request Context Added:**
```javascript
req.callValidation = {
  tenantId: "uuid",
  userId: "uuid",
  creditBalance: 150,
  businessHoursChecked: true,
  validatedAt: "2026-02-15T14:30:00Z"
}
```

---

## ⑥ Call Execution

**File:** `/features/voice-agent/controllers/call-controllers/CallInitiationController.js`

**Process:**
1. Extract validated context from `req.user` and `req.callValidation`
2. Validate phone number format (E.164)
3. Build call payload
4. Forward to voice service (BASE_URL)
5. Log call initiation
6. Return response

**Success Response:**
```json
{
  "success": true,
  "message": "Call initiated successfully",
  "data": {
    "call_id": "uuid",
    "status": "initiated",
    "to_number": "+1234567890",
    "estimated_cost": 3
  }
}
```

---

## 🔍 Validation Sequence Diagram

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /api/voice-agent/calls/start-call
       │ { to_number: "+1234567890", voice_id: "default" }
       ▼
┌─────────────────────────────────────────────────────┐
│  Step 1: Authentication (authenticateToken)         │
│  ✓ JWT valid?                                       │
│  ✓ Extract tenantId, userId                         │
└──────────────────────┬──────────────────────────────┘
                       │ req.user = { tenantId, userId }
                       ▼
┌─────────────────────────────────────────────────────┐
│  Step 2: Feature Access (requireFeature)            │
│  ✓ voice-agent feature enabled?                     │
│  ✓ Check tenant_features table                      │
└──────────────────────┬──────────────────────────────┘
                       │ req.feature = { key: 'voice-agent' }
                       ▼
┌─────────────────────────────────────────────────────┐
│  Step 3: Business Hours (validateVoiceCall...)      │
│  ✓ Within allowed days? (Mon-Fri)                   │
│  ✓ Within allowed hours? (9 AM - 6 PM)              │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Step 4: Credit Check (validateVoiceCall...)        │
│  ✓ Balance >= 3 credits?                            │
│  ✓ Query billing_wallets table                      │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Step 5: Rate Limits (validateVoiceCall...)         │
│  ✓ < 50 calls/hour?                                 │
│  ✓ Check call_logs table (future)                   │
└──────────────────────┬──────────────────────────────┘
                       │ req.callValidation = { creditBalance, ... }
                       ▼
┌─────────────────────────────────────────────────────┐
│  Step 6: Execute Call (initiateCallV2)              │
│  ✓ Validate E.164 format                            │
│  ✓ Forward to voice service                         │
│  ✓ Log call initiation                              │
│  ✓ Return response                                  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
                ┌─────────────┐
                │   Success   │
                └─────────────┘
```

---

## 📂 File Structure

```
LAD-Backend/
├── core/
│   └── middleware/
│       └── auth.js                           # ① authenticateToken
├── shared/
│   └── middleware/
│       ├── feature_guard.js                  # ② requireFeature
│       └── credit_guard.js                   # Credit utilities (getCreditBalance)
└── features/
    └── voice-agent/
        ├── middleware/
        │   └── voiceCallValidation.js        # ③④⑤ validateVoiceCallPrerequisites
        ├── controllers/
        │   └── call-controllers/
        │       └── CallInitiationController.js  # ⑥ initiateCallV2
        └── routes/
            └── index.js                      # Route registration
```

---

## 🧪 Testing the Pipeline

### Test 1: Missing Authentication
```bash
curl -X POST http://localhost:3004/api/voice-agent/calls/start-call \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1234567890", "voice_id": "default"}'

# Expected: 401 Authentication required
```

### Test 2: Feature Not Enabled
```bash
curl -X POST http://localhost:3004/api/voice-agent/calls/start-call \
  -H "Authorization: Bearer <valid-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1234567890", "voice_id": "default"}'

# Expected: 403 Feature not available (if voice-agent disabled)
```

### Test 3: Outside Business Hours
```bash
# Run at 8 PM (outside 9 AM - 6 PM)
curl -X POST http://localhost:3004/api/voice-agent/calls/start-call \
  -H "Authorization: Bearer <valid-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1234567890", "voice_id": "default"}'

# Expected: 403 Outside business hours
```

### Test 4: Insufficient Credits
```bash
# When tenant has < 3 credits
curl -X POST http://localhost:3004/api/voice-agent/calls/start-call \
  -H "Authorization: Bearer <valid-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1234567890", "voice_id": "default"}'

# Expected: 402 Insufficient credits
```

### Test 5: Successful Call
```bash
# Valid JWT, feature enabled, business hours, sufficient credits
curl -X POST http://localhost:3004/api/voice-agent/calls/start-call \
  -H "Authorization: Bearer <valid-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1234567890", "voice_id": "default"}'

# Expected: 200 Call initiated successfully
```

---

## 🛠️ Configuration

### Environment Variables

```bash
# Business Hours (optional - disable check)
BUSINESS_HOURS_DISABLED=false

# Voice Service URL
BASE_URL=https://voice-service.example.com

# Feature Flags
FEATURE_FLAGS_ENABLED=true
```

### Database Configuration

#### Tenant Features Table
```sql
CREATE TABLE tenant_features (
  tenant_id UUID NOT NULL,
  feature_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  PRIMARY KEY (tenant_id, feature_key)
);
```

#### Billing Wallets Table
```sql
CREATE TABLE billing_wallets (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  current_balance NUMERIC(10, 2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📝 Notes

1. **LAD Architecture Compliant**: All validations follow
 LAD middleware pattern
2. **Defense in Depth**: Multiple layers of validation prevent unauthorized access
3. **Fail Secure**: All checks fail closed (deny by default)
4. **Audit Trail**: All validations logged for debugging
5. **Extensible**: Easy to add more checks (e.g., VPN requirements, IP whitelist)

---

## 🚀 Future Enhancements

- [ ] Rate limiting implementation (calls per hour/day)
- [ ] Per-tenant business hours configuration in database
- [ ] Timezone-aware business hours (using moment-timezone)
- [ ] Call queue when outside business hours
- [ ] Pre-authorized phone numbers bypass
- [ ] Emergency override capability
- [ ] Webhook notifications for validation failures

---

**Last Updated:** February 15, 2026  
**Version:** 1.0  
**Author:** LAD Architecture Team
