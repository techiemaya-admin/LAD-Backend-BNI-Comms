# Billing System Frontend-Backend Integration Guide

## ✅ Current Status: READY FOR INTEGRATION

The LAD credit-based billing system is **fully implemented** in both backend and frontend, with backward compatibility maintained for existing UI components.

---

## Backend API Endpoints

### Core Billing Routes (New System)

All routes require authentication and are tenant-scoped:

#### 1. **GET /api/billing/pricing**
Get pricing for specific component
```
Query params: category, provider, model, unit
Response: { success: true, price: {...} }
```

#### 2. **POST /api/billing/quote**
Get cost estimate before execution
```json
Body: {
  "items": [
    {"category": "stt", "provider": "openai", "model": "whisper-1", "unit": "second", "quantity": 60}
  ]
}
Response: { success: true, quote: { totalCost, currency, items: [...] } }
```

#### 3. **GET /api/billing/wallet**
Get wallet balance
```
Response: { 
  success: true, 
  wallet: { 
    walletId, tenantId, currentBalance, reservedBalance, 
    availableBalance, currency, status 
  } 
}
```

#### 4. **POST /api/billing/topup** *(Admin only)*
Top up credits
```json
Body: {
  "amount": 100,
  "description": "Monthly allocation",
  "idempotencyKey": "topup_202512_abc"
}
Response: { success: true, transaction: {...} }
```

#### 5. **POST /api/billing/charge**
Record and charge usage
```json
Body: {
  "featureKey": "voice-agent",
  "externalReferenceId": "call_abc123",
  "idempotencyKey": "charge_call_abc123",
  "items": [
    {"category": "stt", "provider": "openai", "model": "whisper-1", "unit": "second", "quantity": 45.5}
  ],
  "metadata": { "callDuration": "45s" }
}
Response: { success: true, usageEvent: {...}, transaction: {...} }
```

#### 6. **GET /api/billing/usage**
List usage events with filtering
```
Query params: from, to, featureKey, status, limit, offset
Response: { 
  success: true, 
  usage: { 
    events: [...], 
    summary: { totalEvents, totalCost, byFeature, byStatus } 
  } 
}
```

#### 7. **GET /api/billing/usage/aggregation**
Get usage summary aggregated by feature/status
```
Query params: from, to, featureKey
Response: { success: true, aggregation: [...] }
```

#### 8. **GET /api/billing/transactions**
List ledger transactions
```
Query params: from, to, limit, offset
Response: { success: true, transactions: [...] }
```

### Legacy Compatibility Routes

These routes support existing frontend components:

#### 9. **GET /api/wallet/balance** *(Legacy)*
Compatible with `BillingDashboard.tsx` and `WalletBalance.tsx`
```json
Response: {
  "success": true,
  "credits": 100,
  "balance": 100,
  "currency": "USD",
  "lastRecharge": {
    "amount": 100,
    "credits": 100,
    "date": "2025-12-27T..."
  },
  "monthlyUsage": 25,
  "totalSpent": 150,
  "transactions": [...]
}
```

#### 10. **GET /api/wallet/packages** *(Legacy)*
Returns credit packages for purchase UI
```json
Response: {
  "success": true,
  "packages": [
    {
      "id": "starter",
      "name": "Starter Pack",
      "credits": 100,
      "price": 29,
      "pricePerCredit": 0.29,
      "savings": 0,
      "description": "Perfect for trying out the platform"
    },
    {
      "id": "professional",
      "name": "Professional Pack",
      "credits": 500,
      "price": 129,
      "pricePerCredit": 0.258,
      "savings": 11,
      "popular": true,
      "description": "Best value for regular users"
    }
  ]
}
```

---

## Frontend Integration

### New Billing Service (TypeScript)

**Location:** `/frontend/web/src/services/billingService.ts`

```typescript
import billingService from '@/services/billingService';

// Get wallet balance
const wallet = await billingService.getWalletBalance();
console.log(`Balance: $${wallet.currentBalance}`);

// Get cost quote
const quote = await billingService.getQuote({
  items: [
    { category: 'stt', provider: 'openai', model: 'whisper-1', unit: 'second', quantity: 60 }
  ]
});
console.log(`Estimated cost: $${quote.totalCost}`);

// Charge usage (for features)
const result = await billingService.chargeUsage({
  featureKey: 'voice-agent',
  idempotencyKey: `call_${callId}`,
  items: [...]
});

// Top up (admin only)
await billingService.topUpCredits({
  amount: 100,
  description: 'Monthly allocation',
  idempotencyKey: `topup_${Date.now()}`
});

// Legacy compatibility method
const legacyData = await billingService.getWalletBalanceLegacy();
// Returns data in format expected by BillingDashboard.tsx
```

### Existing Components (Already Compatible)

#### 1. **BillingDashboard.tsx** ✅
- **Location:** `/frontend/web/src/components/BillingDashboard.tsx`
- **API Used:** `GET /api/wallet/balance` (legacy endpoint)
- **Status:** ✅ **WORKING** - Backend now provides this endpoint
- **Features:**
  - Displays current credit balance
  - Shows monthly usage
  - Last recharge information
  - Credit package recommendations
  - Usage analytics integration

#### 2. **WalletBalance.tsx** ✅
- **Location:** `/frontend/web/src/components/WalletBalance.tsx`
- **API Used:** `GET /api/wallet/balance`, `GET /api/wallet/packages`
- **Status:** ✅ **WORKING** - Backend provides both endpoints
- **Features:**
  - Current wallet balance
  - Transaction history
  - Credit package purchase UI
  - Recharge modal

#### 3. **BillingSettings.tsx** ✅
- **Location:** `/frontend/web/src/components/settings/BillingSettings.tsx`
- **Status:** ✅ **WORKING** - Wraps BillingDashboard
- **Integration:** Settings page → Billing tab

---

## Feature Integration Pattern

Features should **NOT** implement billing logic. Instead, emit usage events to the billing service:

### Example: Voice Agent Feature

```javascript
// In voice-agent feature controller
const billingService = require('../../core/billing/services/billingService');

async function handleVoiceCall(req, res) {
  try {
    // 1. Execute the call
    const callResult = await executeVoiceCall(req.body);
    
    // 2. Collect usage metrics
    const items = [
      { category: 'stt', provider: 'openai', model: 'whisper-1', 
        unit: 'second', quantity: callResult.transcriptionDuration },
      { category: 'llm_prompt', provider: 'openai', model: 'gpt-4', 
        unit: 'token', quantity: callResult.llm.promptTokens },
      { category: 'llm_completion', provider: 'openai', model: 'gpt-4', 
        unit: 'token', quantity: callResult.llm.completionTokens },
      { category: 'tts', provider: 'openai', model: 'tts-1', 
        unit: 'character', quantity: callResult.synthesis.characterCount },
      { category: 'telephony', provider: 'twilio', model: 'voice', 
        unit: 'minute', quantity: callResult.duration / 60 },
      { category: 'vm_infrastructure', provider: 'runpod', model: 'gpu-t4', 
        unit: 'second', quantity: callResult.infrastructure.duration }
    ];
    
    // 3. Create and charge usage event (idempotent)
    const billing = await billingService.createAndChargeUsageEvent({
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      featureKey: 'voice-agent',
      externalReferenceId: callResult.callId,
      idempotencyKey: `call_${callResult.callId}`,
      items,
      metadata: { 
        callId: callResult.callId,
        duration: callResult.duration,
        from: callResult.from,
        to: callResult.to
      }
    });
    
    res.json({
      success: true,
      call: callResult,
      billing: {
        charged: billing.usageEvent.total_cost,
        transactionId: billing.ledgerTransaction.id
      }
    });
    
  } catch (error) {
    if (error.message.includes('Insufficient balance')) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits. Please top up your account.',
        requiredAction: 'topup'
      });
    }
    throw error;
  }
}
```

---

## Frontend Component Updates Needed

### Option 1: Update Existing Components (Minimal Changes)

**No changes required!** The existing `BillingDashboard.tsx` and `WalletBalance.tsx` components already work because we implemented the legacy `/api/wallet/*` endpoints.

### Option 2: Migrate to New Billing Service (Recommended for New Features)

For new features or major refactors, use the new `billingService`:

```typescript
// In your React component
import { useEffect, useState } from 'react';
import billingService from '@/services/billingService';

export function NewBillingComponent() {
  const [wallet, setWallet] = useState(null);
  const [usage, setUsage] = useState([]);
  
  useEffect(() => {
    loadBillingData();
  }, []);
  
  async function loadBillingData() {
    try {
      const [walletData, usageData] = await Promise.all([
        billingService.getWalletBalance(),
        billingService.listUsage({ limit: 10 })
      ]);
      
      setWallet(walletData);
      setUsage(usageData.events);
    } catch (error) {
      console.error('Error loading billing data:', error);
    }
  }
  
  async function handleTopUp(amount: number) {
    try {
      await billingService.topUpCredits({
        amount,
        description: 'Manual top-up',
        idempotencyKey: `topup_${Date.now()}`
      });
      
      // Reload wallet
      await loadBillingData();
    } catch (error) {
      console.error('Top-up failed:', error);
    }
  }
  
  return (
    <div>
      <h2>Balance: ${wallet?.currentBalance || 0}</h2>
      {/* Rest of UI */}
    </div>
  );
}
```

---

## Testing the Integration

### 1. Start Backend
```bash
cd /Users/naveenreddy/Desktop/AI-Maya/LAD/backend
npm start
# Server runs on http://localhost:3004
```

### 2. Test Backend API
```bash
# Get auth token first
TOKEN=$(curl -s -X POST http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@glinks.com","password":"password123"}' \
  | jq -r '.token')

# Test wallet balance (legacy endpoint)
curl http://localhost:3004/api/wallet/balance \
  -H "Authorization: Bearer $TOKEN" | jq

# Test new billing wallet endpoint
curl http://localhost:3004/api/billing/wallet \
  -H "Authorization: Bearer $TOKEN" | jq

# Test quote
curl -X POST http://localhost:3004/api/billing/quote \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"category":"stt","provider":"openai","model":"whisper-1","unit":"second","quantity":60}
    ]
  }' | jq
```

### 3. Test Frontend
```bash
cd /Users/naveenreddy/Desktop/AI-Maya/LAD/frontend/web
npm run dev
# Open http://localhost:3000

# Navigate to:
# - /settings → Billing tab
# - /billing
# - /wallet (if exists)
```

---

## Database Verification

Check that billing tables exist and have data:

```sql
-- Connect to database
psql postgresql://dbadmin:TechieMaya@165.22.221.77:5432/salesmaya_agent

-- Set schema
SET search_path TO lad_dev;

-- Check tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'lad_dev' 
AND tablename LIKE 'billing%';

-- Check Glinks wallet
SELECT * FROM billing_wallets 
WHERE tenant_id = '926070b5-189b-4682-9279-ea10ca090b84';

-- Check ledger transactions
SELECT * FROM billing_ledger_transactions 
WHERE tenant_id = '926070b5-189b-4682-9279-ea10ca090b84' 
ORDER BY created_at DESC LIMIT 5;

-- Check pricing catalog
SELECT category, provider, model, unit_price 
FROM billing_pricing_catalog 
WHERE tenant_id IS NULL 
ORDER BY category, provider 
LIMIT 10;
```

---

## Migration Checklist

- [x] Backend billing tables created (`billing_wallets`, `billing_ledger_transactions`, `billing_usage_events`)
- [x] Backend billing service implemented (`billingService.js`)
- [x] Backend billing repository implemented (`billingRepo.js`)
- [x] Backend billing routes implemented (`/api/billing/*`)
- [x] Legacy routes for backward compatibility (`/api/wallet/*`)
- [x] Frontend billing service created (`billingService.ts`)
- [x] Existing frontend components compatible (`BillingDashboard.tsx`, `WalletBalance.tsx`)
- [x] Test script validated all operations
- [x] Documentation complete

## Next Steps (Optional Enhancements)

1. **Stripe Integration**
   - Add Stripe payment processing
   - Handle webhook events
   - Sync topups with Stripe charges

2. **Usage Analytics Dashboard**
   - Create detailed usage charts
   - Break down costs by feature
   - Show usage trends over time

3. **Low Balance Alerts**
   - Email notifications when balance < threshold
   - In-app notifications
   - Auto-topup option

4. **Budget Controls**
   - Set spending limits per feature
   - Daily/monthly caps
   - Approval workflows for large charges

5. **Invoice Generation**
   - Monthly invoice PDFs
   - Email delivery
   - Downloadable from UI

---

## Summary

✅ **Backend Fully Implemented** - All APIs working and tested  
✅ **Frontend Service Created** - TypeScript service with type safety  
✅ **Backward Compatible** - Existing UI components work without changes  
✅ **Production Ready** - Atomic transactions, idempotency, audit trail  

**The billing system is ready for integration. No breaking changes to existing frontend code.**
