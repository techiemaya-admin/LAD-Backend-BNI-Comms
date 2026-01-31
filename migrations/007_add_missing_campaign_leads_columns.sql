-- Migration to add missing columns to campaign_leads table
-- This handles cases where the table was created before lead_data and snapshot were added

-- Add lead_data column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = CURRENT_SCHEMA() 
        AND table_name = 'campaign_leads' 
        AND column_name = 'lead_data'
    ) THEN
        ALTER TABLE campaign_leads ADD COLUMN lead_data JSONB DEFAULT '{}';
        COMMENT ON COLUMN campaign_leads.lead_data IS 'Full lead data including apollo_person_id, profile details, etc.';
    END IF;
END $$;

-- Add snapshot column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = CURRENT_SCHEMA() 
        AND table_name = 'campaign_leads' 
        AND column_name = 'snapshot'
    ) THEN
        ALTER TABLE campaign_leads ADD COLUMN snapshot JSONB DEFAULT '{}' NOT NULL;
        COMMENT ON COLUMN campaign_leads.snapshot IS 'Snapshot of lead data at time of campaign assignment';
    END IF;
END $$;

-- Add is_deleted column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = CURRENT_SCHEMA() 
        AND table_name = 'campaign_leads' 
        AND column_name = 'is_deleted'
    ) THEN
        ALTER TABLE campaign_leads ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
END $$;

-- Migrate existing data: copy individual fields to lead_data if they exist and lead_data is empty
UPDATE campaign_leads 
SET lead_data = jsonb_build_object(
    'first_name', first_name,
    'last_name', last_name,
    'email', email,
    'linkedin_url', linkedin_url,
    'company_name', company_name,
    'title', title,
    'phone', phone
)
WHERE lead_data = '{}' OR lead_data IS NULL;

-- Migrate existing data: copy individual fields to snapshot if snapshot is empty
UPDATE campaign_leads 
SET snapshot = jsonb_build_object(
    'first_name', first_name,
    'last_name', last_name,
    'email', email,
    'linkedin_url', linkedin_url,
    'company_name', company_name,
    'title', title,
    'phone', phone
)
WHERE snapshot = '{}' OR snapshot IS NULL;

-- Add index on lead_data for Apollo person ID lookups
CREATE INDEX IF NOT EXISTS idx_campaign_leads_apollo_person 
ON campaign_leads USING gin ((lead_data->'apollo_person_id'));
