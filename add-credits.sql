-- Check current wallet
SELECT 
  id, 
  tenant_id, 
  current_balance, 
  reserved_balance,
  currency,
  status,
  updated_at
FROM lad_dev.billing_wallets 
WHERE tenant_id = 'b35d373b-dc74-4b95-b8aa-1ec1ab094a11' 
  AND user_id IS NULL;

-- Add 1000 credits ($99)
INSERT INTO lad_dev.billing_wallets (tenant_id, current_balance, reserved_balance, currency, status, created_at, updated_at)
VALUES ('b35d373b-dc74-4b95-b8aa-1ec1ab094a11', 1000, 0, 'USD', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (tenant_id, user_id) 
DO UPDATE SET 
  current_balance = billing_wallets.current_balance + 1000,
  updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- Verify new balance
SELECT 
  id, 
  tenant_id, 
  current_balance, 
  reserved_balance,
  currency,
  status,
  updated_at
FROM lad_dev.billing_wallets 
WHERE tenant_id = 'b35d373b-dc74-4b95-b8aa-1ec1ab094a11' 
  AND user_id IS NULL;
