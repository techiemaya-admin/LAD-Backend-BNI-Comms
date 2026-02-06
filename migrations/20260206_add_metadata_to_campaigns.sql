-- Migration: Add metadata column to campaigns table
-- Date: 2026-02-06
-- Purpose: Add metadata JSONB column to track campaign-level metrics including credit usage
-- LAD Architecture: Follows LAD standards with JSONB NOT NULL DEFAULT '{}'

-- Note: Replace 'lad_dev' with your actual schema name if different
-- The schema can be set via PGOPTIONS environment variable: PGOPTIONS='--search_path=your_schema'

-- Add metadata column to campaigns table
ALTER TABLE lad_dev.campaigns 
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- Create GIN index for metadata JSONB queries (improves performance for metadata searches)
CREATE INDEX IF NOT EXISTS idx_campaigns_metadata ON lad_dev.campaigns USING GIN (metadata);

-- Create specific index for credit tracking queries (if needed frequently)
CREATE INDEX IF NOT EXISTS idx_campaigns_metadata_credits ON lad_dev.campaigns ((metadata->>'total_credits_deducted')) 
WHERE metadata->>'total_credits_deducted' IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN lad_dev.campaigns.metadata IS 'Campaign metadata including total_credits_deducted, last_credit_update, and other campaign-level metrics';

-- Populate existing campaigns with credit usage data from billing_ledger_transactions
-- This calculates total credits deducted for each campaign and stores it in metadata
DO $$
DECLARE
    campaign_record RECORD;
    credit_total NUMERIC;
BEGIN
    -- Loop through all campaigns
    FOR campaign_record IN 
        SELECT DISTINCT id, tenant_id 
        FROM lad_dev.campaigns 
        WHERE is_deleted = FALSE
    LOOP
        -- Calculate total credits for this campaign
        SELECT COALESCE(SUM(blt.amount), 0)
        INTO credit_total
        FROM lad_dev.billing_ledger_transactions blt
        WHERE blt.reference_id = campaign_record.id
        AND blt.tenant_id = campaign_record.tenant_id
        AND blt.transaction_type = 'debit';
        
        -- Only update if credits were found
        IF credit_total > 0 THEN
            UPDATE lad_dev.campaigns
            SET 
                metadata = jsonb_set(
                    jsonb_set(
                        COALESCE(metadata, '{}'::jsonb),
                        '{total_credits_deducted}',
                        to_jsonb(credit_total)
                    ),
                    '{last_credit_update}',
                    to_jsonb(NOW())
                ),
                updated_at = NOW()
            WHERE id = campaign_record.id;
            
            RAISE NOTICE 'Updated campaign % with % credits', campaign_record.id, credit_total;
        END IF;
    END LOOP;
END $$;

-- Example queries after migration:

-- Query campaigns with credit usage
-- SELECT 
--   id, 
--   name, 
--   status,
--   metadata->>'total_credits_deducted' as credits_used,
--   metadata->>'last_credit_update' as last_update
-- FROM campaigns
-- WHERE tenant_id = '<your-tenant-id>'
-- ORDER BY (metadata->>'total_credits_deducted')::numeric DESC;

-- Query campaigns that have used credits
-- SELECT * FROM campaigns 
-- WHERE metadata->>'total_credits_deducted' IS NOT NULL
-- AND tenant_id = '<your-tenant-id>';
