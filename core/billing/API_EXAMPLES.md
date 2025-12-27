# LAD Billing System - API Examples

## Overview
The LAD credit-based billing system is now fully operational with:
- ✅ Pricing catalog with tenant overrides
- ✅ Credit wallets with atomic transactions
- ✅ Immutable ledger for audit trail
- ✅ Usage event tracking with idempotency
- ✅ Multi-component billing (STT, LLM, TTS, telephony, VM)

## Quick Start

### 1. Get Current Pricing

```bash
curl http://localhost:3004/api/billing/pricing?category=stt&provider=openai&model=whisper-1&unit=second \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "price": {
    "category": "stt",
    "provider": "openai",
    "model": "whisper-1",
    "unit": "second",
    "unitPrice": "0.0001",
    "description": "OpenAI Whisper STT"
  }
}
```

### 2. Get Cost Quote (Before Execution)

```bash
curl -X POST http://localhost:3004/api/billing/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "items": [
      {"category": "stt", "provider": "openai", "model": "whisper-1", "unit": "second", "quantity": 60},
      {"category": "llm", "provider": "openai", "model": "gpt-4", "unit": "token", "quantity": 500},
      {"category": "tts", "provider": "openai", "model": "tts-1", "unit": "character", "quantity": 200},
      {"category": "telephony", "provider": "twilio", "model": "voice", "unit": "minute", "quantity": 1}
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "quote": {
    "totalCost": "0.037",
    "currency": "USD",
    "items": [
      {"category": "stt", "quantity": 60, "unitPrice": "0.0001", "totalCost": "0.006"},
      {"category": "llm", "quantity": 500, "unitPrice": "0.00003", "totalCost": "0.015"},
      {"category": "tts", "quantity": 200, "unitPrice": "0.000015", "totalCost": "0.003"},
      {"category": "telephony", "quantity": 1, "unitPrice": "0.013", "totalCost": "0.013"}
    ]
  }
}
```

### 3. Check Wallet Balance

```bash
curl http://localhost:3004/api/billing/wallet \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "wallet": {
    "id": "wallet-uuid",
    "tenantId": "tenant-uuid",
    "currentBalance": "29.9865",
    "reservedBalance": "0",
    "currency": "USD",
    "status": "active"
  }
}
```

### 4. Top Up Credits (Admin Only)

```bash
curl -X POST http://localhost:3004/api/billing/topup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -d '{
    "amount": 100,
    "description": "Monthly credit allocation",
    "idempotencyKey": "topup_202512_abc123"
  }'
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "id": "ledger-tx-uuid",
    "type": "topup",
    "amount": "100",
    "balanceBefore": "29.9865",
    "balanceAfter": "129.9865",
    "description": "Monthly credit allocation",
    "createdAt": "2025-12-27T..."
  }
}
```

### 5. Record and Charge Usage (Feature Integration)

```bash
curl -X POST http://localhost:3004/api/billing/charge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "featureKey": "voice-agent",
    "externalReferenceId": "call_abc123",
    "idempotencyKey": "charge_call_abc123",
    "items": [
      {"category": "stt", "provider": "openai", "model": "whisper-1", "unit": "second", "quantity": 45.5},
      {"category": "llm_prompt", "provider": "openai", "model": "gpt-4", "unit": "token", "quantity": 350},
      {"category": "llm_completion", "provider": "openai", "model": "gpt-4", "unit": "token", "quantity": 150},
      {"category": "tts", "provider": "openai", "model": "tts-1", "unit": "character", "quantity": 180},
      {"category": "telephony", "provider": "twilio", "model": "voice", "unit": "minute", "quantity": 0.75},
      {"category": "vm_infrastructure", "provider": "runpod", "model": "gpu-t4", "unit": "second", "quantity": 60}
    ],
    "metadata": {
      "callDuration": "45s",
      "callFrom": "+1234567890",
      "callTo": "+0987654321"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "usageEvent": {
    "id": "usage-event-uuid",
    "featureKey": "voice-agent",
    "status": "charged",
    "totalCost": "0.0278",
    "chargedAt": "2025-12-27T..."
  },
  "transaction": {
    "id": "ledger-tx-uuid",
    "type": "debit",
    "amount": "-0.0278",
    "balanceBefore": "129.9865",
    "balanceAfter": "129.9587"
  }
}
```

### 6. Get Usage History

```bash
curl "http://localhost:3004/api/billing/usage?from=2025-12-01&to=2025-12-31&featureKey=voice-agent" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "usage": {
    "events": [
      {
        "id": "usage-event-uuid",
        "featureKey": "voice-agent",
        "totalCost": "0.0278",
        "status": "charged",
        "createdAt": "2025-12-27T...",
        "chargedAt": "2025-12-27T..."
      }
    ],
    "summary": {
      "totalEvents": 15,
      "totalCost": "2.456",
      "byFeature": {
        "voice-agent": {"events": 12, "cost": "2.156"},
        "campaigns": {"events": 3, "cost": "0.300"}
      },
      "byStatus": {
        "charged": {"events": 13, "cost": "2.456"},
        "pending": {"events": 2, "cost": "0.024"}
      }
    }
  }
}
```

## Feature Integration Pattern

Features should **NOT** implement their own billing logic. Instead, emit usage to the core billing service:

### Example: Voice Agent Integration

```javascript
// In your voice-agent feature code
const billingService = require('../../core/billing/services/billingService');

async function handleVoiceCall(callData) {
  // 1. Execute the call
  const callResult = await executeCall(callData);
  
  // 2. Collect usage metrics
  const usage = {
    sttSeconds: callResult.transcription.duration,
    llmPromptTokens: callResult.llm.promptTokens,
    llmCompletionTokens: callResult.llm.completionTokens,
    ttsCharacters: callResult.synthesis.characterCount,
    telephonyMinutes: callResult.call.duration / 60,
    vmSeconds: callResult.infrastructure.duration
  };
  
  // 3. Create and charge usage event
  const items = [
    {category: 'stt', provider: 'openai', model: 'whisper-1', unit: 'second', quantity: usage.sttSeconds},
    {category: 'llm_prompt', provider: 'openai', model: 'gpt-4', unit: 'token', quantity: usage.llmPromptTokens},
    {category: 'llm_completion', provider: 'openai', model: 'gpt-4', unit: 'token', quantity: usage.llmCompletionTokens},
    {category: 'tts', provider: 'openai', model: 'tts-1', unit: 'character', quantity: usage.ttsCharacters},
    {category: 'telephony', provider: 'twilio', model: 'voice', unit: 'minute', quantity: usage.telephonyMinutes},
    {category: 'vm_infrastructure', provider: 'runpod', model: 'gpu-t4', unit: 'second', quantity: usage.vmSeconds}
  ];
  
  try {
    const result = await billingService.createAndChargeUsageEvent({
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      featureKey: 'voice-agent',
      externalReferenceId: callResult.callId,
      idempotencyKey: `call_${callResult.callId}`,
      items,
      metadata: {
        callId: callResult.callId,
        duration: callResult.call.duration,
        from: callResult.call.from,
        to: callResult.call.to
      }
    });
    
    return { success: true, callResult, billing: result };
  } catch (error) {
    if (error.message.includes('Insufficient balance')) {
      throw new Error('Insufficient credits. Please top up your account.');
    }
    throw error;
  }
}
```

## Database Schema

### Tables Created
- `billing_wallets` - Credit wallets per tenant/user
- `billing_ledger_transactions` - Immutable audit trail
- `billing_usage_events` - Metered usage records
- `billing_pricing_catalog` - Pricing with tenant overrides (existing)

### Key Features
- ✅ **Atomic Operations**: All wallet updates use SELECT FOR UPDATE
- ✅ **Idempotency**: Duplicate charges prevented via idempotency keys
- ✅ **Audit Trail**: Every credit change recorded in ledger
- ✅ **Tenant Isolation**: All operations are tenant-scoped
- ✅ **Concurrency Safe**: No race conditions on balances
- ✅ **Multi-Component**: Single usage event can have multiple line items

## Test Results

```
✅ Price Resolution
✅ Quote Generation
✅ Wallet Top-up
✅ Usage Event Creation
✅ Charging with Ledger
✅ Idempotency Protection
✅ Usage History
✅ Transaction Ledger
✅ Create and Charge (one-step)

Final Balance: $29.9865
Total Usage: 4 events, $0.0375
```

## Access Control

### Capabilities Required
- `billing.admin` - Can top up credits, view all usage
- `billing.view` - Can view wallet and usage (read-only)
- Default (tenant members) - Can view their tenant's wallet balance

### Implementation in Routes
```javascript
const checkCapability = require('../middleware/checkCapability');

router.post('/topup', 
  checkCapability('billing.admin'), 
  billingController.topup
);
```

## Next Steps

1. **Stripe Integration**: Add payment processing webhook
2. **Invoices**: Generate monthly invoices from ledger
3. **Alerts**: Low balance notifications
4. **Budgets**: Set spending limits per feature
5. **Reserved Credits**: Lock credits for quoted operations
6. **Rate Limiting**: Prevent abuse based on credit balance

## Support

For billing issues:
- Check wallet balance first
- Review usage history for unexpected charges
- Verify idempotency keys are unique per operation
- Contact support with transaction IDs for refunds
