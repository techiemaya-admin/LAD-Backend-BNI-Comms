# Credit Reconciliation API

## Overview
New endpoint to recalculate and update credits for completed voice calls based on actual call duration.

## Endpoint
**POST** `/api/voiceagents/calls/update-credits`

## Authentication
- Requires JWT authentication
- Tenant context extracted from JWT token

## Purpose
- Reconcile credit charges for completed calls
- Recalculate credits based on actual duration (3 credits per minute, rounded up)
- Fix any discrepancies between stored credits and actual call duration
- **Update billing wallet balances** (debit for undercharges, credit for overcharges)
- **Log all adjustments to billing_ledger_transactions** for complete audit trail
- Track reconciliation history in call metadata

## Credit Calculation Formula
```javascript
durationMinutes = Math.ceil(duration_seconds / 60)
creditsToDeduct = durationMinutes * 3
```

## Billing Reconciliation Flow

When a discrepancy is found, the endpoint performs these operations atomically:

### 1. Calculate Credit Difference
```javascript
creditDifference = correctCredits - currentCredits
```

### 2. Update Wallet Balance
- **If creditDifference > 0** (Undercharged):
  - Additional credits deducted from wallet
  - Transaction type: `debit`
  - Description: "Voice call credit reconciliation (additional charge)"
  
- **If creditDifference < 0** (Overcharged):
  - Credits refunded to wallet
  - Transaction type: `credit`
  - Description: "Voice call credit reconciliation (refund)"

### 3. Update Database Tables (via Credit Guard Service)

**Controller calls Credit Guard (NOT direct SQL):**
```javascript
const { deductCredits } = require('../../../shared/middleware/credit_guard');

// Update call credits
await callModel.updateCallCredits(schema, callId, tenantId, correctCredits, metadata);

// Use Credit Guard for billing (handles wallet + ledger + campaign)
await deductCredits(
  tenantId,
  'voice-agent',
  'call_credit_reconciliation_charge', // or '_refund'
  creditDifference, // Positive = debit, Negative = credit
  null, // No req object for background job
  {
    callId: call.id,
    leadId: call.lead_id,
    stepType: 'credit_adjustment',
    reconciliation: true
  }
);
```

**Credit Guard executes (in single transaction):**
```sql
BEGIN;

-- Update wallet
UPDATE billing_wallets 
SET current_balance = current_balance - $credits
WHERE tenant_id = $tenantId;

-- Log to ledger
INSERT INTO billing_ledger_transactions (
  tenant_id, wallet_id, transaction_type, amount, ...
) VALUES (...);

-- Update campaign metadata (if applicable)
UPDATE campaigns
SET metadata = jsonb_set(metadata, '{total_credits_deducted}', ...)
WHERE id = $campaignId;

COMMIT;
```

### 4. Error Handling
- Each call update wrapped in try/catch
- Credit Guard handles transaction rollback automatically
- Errors logged and call update skipped
- Processing continues with remaining calls
- Successful updates counted in response
- All billing SQL executed in Credit Guard (centralized service)

## Implementation Details

### Files Modified

#### 1. VoiceCallModel.js (Repository Layer - SQL Only)
**Methods:**
- `getCompletedCallsForTenant(schema, tenantId)`
  - Queries voice_call_logs for completed/ended calls
  - Filters: status IN ('ended', 'completed') AND duration_seconds > 0
  - Returns: id, duration_seconds, credits_charged, metadata, lead_id, status, timestamps
  
- `updateCallCredits(schema, callId, tenantId, newCredits, metadataUpdate)`
  - Updates credits_charged for specific call
  - Merges metadata with reconciliation history
  - Tenant-isolated update (WHERE id AND tenant_id)

**Note:** Billing wallet and ledger updates handled by Credit Guard (centralized billing service).

#### 2. CallController.js (Business Logic Layer - No SQL)
**Updated Method:**
- `updateCallCredits(req, res)`
  - Main controller for credit reconciliation
  - Validates tenant context
  - Fetches all completed calls (via model method)
  - Recalculates credits for each call
  - **Uses Credit Guard for billing operations:**
    - `deductCredits()` - Handles wallet updates, ledger entries, and campaign metadata
    - Passes creditDifference (positive = debit, negative = credit/refund)
    - Automatic idempotency key generation
    - Automatic campaign metadata tracking
  - Handles errors gracefully (continues with next call on failure)
  - Returns summary statistics with billing adjustments

**Architecture Compliance:**
- ✅ NO SQL in controller
- ✅ Uses centralized Credit Guard service (same as campaigns, apollo-leads)
- ✅ Business logic only (credit calculation, error handling, response formatting)
- ✅ Consistent billing behavior across all features

**Schema Resolution:**
- Uses `getSchema(req)` helper for dynamic schema resolution (no hardcoded 'lad_dev')

#### 4. Credit Guard Service (Centralized Billing)
**File:** `shared/middleware/credit_guard.js`

Handles all billing operations:
- `deductCredits(tenantId, featureKey, usageType, credits, req, options)`
  - Updates billing_wallets.current_balance
  - Creates billing_ledger_transactions entry
  - Updates campaign metadata (if campaignId provided)
  - Handles both debits (positive credits) and refunds (negative credits)
  - Automatic idempotency key generation
  - Atomic transaction with BEGIN/COMMIT/ROLLBACK

**Why Credit Guard?**
- ✅ Centralized billing logic (used by campaigns, apollo-leads, voice-agent)
- ✅ Consistent billing behavior across features
- ✅ No code duplication
- ✅ Built-in error handling and rollback
- ✅ Automatic audit trail
- ✅ Campaign metadata tracking
**Updated:**
- Added `'metadata'` to allowedFields in `update()` method
- Enables campaign metadata updates via repository
- Handles JSONB serialization: `JSON.stringify(value)` with `::jsonb` cast

#### 4. routes/index.js
**New Route:**
```javascript
router.post(
  '/calls/update-credits',
  jwtAuth,
  (req, res) => callController.updateCallCredits(req, res)
);
```

## Request

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Body
None required (tenant extracted from JWT)

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Successfully recalculated credits for 5 calls",
  "stats": {
    "total_calls_checked": 150,
    "calls_updated": 5,
    "credits_recalculated": 45,
    "credits_adjusted": 12,
    "discrepancies_found": 5
  },
  "billing": {
    "wallet_debits": 15,
    "wallet_credits": 3,
    "net_adjustment": 12
  },
  "updated_calls": [
    {
      "call_id": "uuid-1234",
      "old_credits": 6,
      "new_credits": 9,
      "duration_seconds": 150,
      "duration_minutes": 3,
      "credit_adjustment": 3,
      "billing_updated": true
    }
    // ... up to 10 calls shown
  ]
}
```

### No Updates Response (200 OK)
```json
{
  "success": true,
  "message": "No completed calls found to update",
  "stats": {
    "total_calls_checked": 0,
    "calls_updated": 0,
    "credits_recalculated": 0,
    "discrepancies_found": 0
  }
}
```

### Error Response (400 Bad Request)
```json
{
  "success": false,
  "error": "Tenant context required"
}
```

### Error Response (500 Internal Server Error)
```json
{
  "success": false,
  "error": "Failed to update call credits",
  "message": "Database connection error"
}
```

## Metadata Tracking

### Call Metadata
Each updated call gets reconciliation metadata:
```json
{
  "credit_recalculation": {
    "performed_at": "2025-01-15T10:30:00.000Z",
    "old_credits": 6,
    "new_credits": 9,
    "duration_seconds": 150,
    "duration_minutes": 3,
    "difference": 3
  }
}
```

### Billing Ledger Entry
Each credit adjustment creates an audit entry in `billing_ledger_transactions`:
```json
{
  "tenant_id": "uuid",
  "wallet_id": "uuid",
  "transaction_type": "debit",
  "amount": 3,
  "balance_after": 997,
  "reference_type": "voice_call",
  "reference_id": "call-uuid",
  "description": "Voice call credit reconciliation (additional charge)",
  "metadata": {
    "call_id": "uuid",
    "duration_seconds": 150,
    "duration_minutes": 3,
    "old_credits": 6,
    "new_credits": 9,
    "reconciliation_type": "automatic",
    "timestamp": "2025-01-15T10:30:00.000Z"
  },
  "idempotency_key": "call_credit_recon_uuid_timestamp"
}
```

## Use Cases

### 1. Post-Deployment Reconciliation
After deploying credit calculation fixes, run this endpoint to correct historical data.

### 2. Audit & Compliance
Verify credit charges match actual call durations.

### 3. Billing Verification
Before generating invoices, ensure credit charges are accurate.

### 4. Troubleshooting
When users report incorrect credit charges, run reconciliation to fix discrepancies.

## Security & Compliance

✅ **Multi-Tenancy:** All queries are tenant-isolated
✅ **Authentication:** JWT required, no anonymous access
✅ **SQL Injection:** Uses parameterized queries ($1, $2, etc.)
✅ **Schema Resolution:** Dynamic schema via getSchema(req)
✅ **Logging:** Centralized logger (no console.log)
✅ **No Hardcoded Schemas:** ALL queries use ${schema}.table_name
✅ **LAD Architecture:** Call SQL in VoiceCallModel, billing SQL in Credit Guard
✅ **Clean Layering:** Controller has NO SQL, only business logic
✅ **Centralized Billing:** Uses Credit Guard (consistent with campaigns/apollo-leads)
✅ **Transaction Safety:** Credit Guard handles BEGIN/COMMIT/ROLLBACK
✅ **Idempotency:** Automatic unique keys prevent duplicate ledger entries
✅ **Billing Integrity:** All billing operations use centralized service

## LAD Architecture Compliance

| Rule | Status | Notes |
|------|--------|-------|
| Multi-tenancy | ✅ | All queries tenant-scoped |
| Dynamic schema | ✅ | Uses getSchema(req) |
| **SQL in repositories only** | ✅ | **Call SQL in VoiceCallModel, billing SQL in Credit Guard** |
| **No SQL in controllers** | ✅ | **Controller calls services/repositories only** |
| **Centralized billing** | ✅ | **Uses Credit Guard (same as campaigns/apollo-leads)** |
| Layering (Model → Controller) | ✅ | Clean separation |
| Logging (no console) | ✅ | Uses logger.info/error |
| Naming (tenant_id) | ✅ | Consistent naming |
| No code duplication | ✅ | Reuses Credit Guard billing logic |

## Testing

### cURL Example
```bash
curl -X POST https://your-domain.com/api/voiceagents/calls/update-credits \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Expected Behavior
1. Authenticates request via JWT
2. Extracts tenantId and schema from token
3. Queries all completed calls (via `callModel.getCompletedCallsForTenant()`)
4. For each call with discrepancy:
   - Recalculates credits using Math.ceil(duration/60) * 3
   - **Calls `callModel.updateCallCredits()`** - Updates call record in voice_call_logs
   - **Calls `deductCredits()` (Credit Guard)** - Handles wallet + ledger + campaign metadata
   - Credit Guard automatically:
     - Updates billing_wallets.current_balance
     - Creates billing_ledger_transactions entry
     - Updates campaign metadata (if campaignId in options)
     - Generates idempotency key
     - Wraps in transaction with rollback
   - Handles errors gracefully
5. Returns summary statistics with billing adjustments

**Architecture:** Call SQL in VoiceCallModel, billing SQL in Credit Guard (centralized service used by all features)

## Performance Considerations

- Query filters on indexed columns: tenant_id, status
- Call record SQL in VoiceCallModel repository
- All billing operations via Credit Guard service
- Credit Guard uses atomic transactions (BEGIN/COMMIT/ROLLBACK)
- Error handling: Credit Guard auto-rollback on failures
- Sequential updates for data consistency
- Response limited to first 10 updated calls for readability
- Full stats always returned
- Idempotency keys prevent duplicate ledger entries (handled by Credit Guard)

## Future Enhancements

### Recommended (from Architecture Review)
1. **Add Rate Limiting:** Prevent abuse of expensive reconciliation queries
2. **Admin-Only Access:** Restrict to users with 'billing.reconcile' capability
3. ⚠️ **Campaign Metadata Aggregation (Partial):** Currently updates billing_wallets and billing_ledger_transactions. Still needs: Aggregate credits by campaign_id and update campaigns.metadata.total_credits_deducted
4. **Scheduled Job:** Automatic daily reconciliation via cron/Cloud Scheduler
5. **Dry-Run Mode:** Add `?dryRun=true` to preview changes without updating

### Compliance Status
✅ **Implemented:** Billing wallet and ledger transaction updates (v1.1.0)
⚠️ **Pending:** Campaign-level credit aggregation (future enhancement)
⚠️ **Pending:** Rate limiting middleware
⚠️ **Pending:** Admin capability check

## Changelog

### v1.2.0 (2025-02-15)
- ✅ **Refactored to use Credit Guard** - Centralized billing service
- ✅ **Removed duplicate billing code** - Eliminated ~100 lines of SQL
- ✅ **Consistent with other features** - Same billing logic as campaigns/apollo-leads
- ✅ **Better error handling** - Credit Guard's built-in transaction rollback
- ✅ **Automatic campaign tracking** - Credit Guard handles metadata updates

**Architecture Changes:**
- Removed `VoiceCallModel.updateBillingWallet()` - Now uses Credit Guard
- Removed `VoiceCallModel.createBillingLedgerEntry()` - Now uses Credit Guard
- Added `deductCredits()` import from credit_guard.js
- Simplified controller logic - single call to Credit Guard for all billing

### v1.1.0 (2025-02-15)
- ✅ **Added billing wallet updates** - Automatically adjusts tenant credit balance
- ✅ **Added billing ledger logging** - Complete audit trail in billing_ledger_transactions
- ✅ **Handles overcharges** - Automatically refunds credits when calls were overcharged
- ✅ **Handles undercharges** - Automatically debits additional credits when calls were undercharged
- ✅ **Enhanced response** - Added billing adjustment summary
- ✅ **LAD Architecture Compliance** - Moved ALL SQL to repository layer (VoiceCallModel.js)
- ✅ **Clean Separation** - Controller contains NO SQL, only business logic

### v1.0.0 (2025-01-15)
- Initial implementation
- Tenant-scoped credit reconciliation
- Metadata tracking for audit trail
- LAD architecture compliant
- Fixed schema resolution (uses getSchema helper)
