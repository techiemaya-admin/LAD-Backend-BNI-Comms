-- Migration to add enrichment columns to campaign_leads table
-- Stores enriched email and LinkedIn URL when visit profile step enriches the lead

BEGIN;

-- Add enriched_email column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaign_leads' 
        AND column_name = 'enriched_email'
    ) THEN
        ALTER TABLE campaign_leads ADD COLUMN enriched_email VARCHAR(255) DEFAULT NULL;
        COMMENT ON COLUMN campaign_leads.enriched_email IS 'Email address enriched from Apollo API during visit profile step';
    END IF;
END $$;

-- Add enriched_linkedin_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaign_leads' 
        AND column_name = 'enriched_linkedin_url'
    ) THEN
        ALTER TABLE campaign_leads ADD COLUMN enriched_linkedin_url VARCHAR(1024) DEFAULT NULL;
        COMMENT ON COLUMN campaign_leads.enriched_linkedin_url IS 'LinkedIn URL enriched from Apollo API during visit profile step';
    END IF;
END $$;

-- Add enriched_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaign_leads' 
        AND column_name = 'enriched_at'
    ) THEN
        ALTER TABLE campaign_leads ADD COLUMN enriched_at TIMESTAMP DEFAULT NULL;
        COMMENT ON COLUMN campaign_leads.enriched_at IS 'Timestamp when lead was enriched from Apollo API';
    END IF;
END $$;

COMMIT;
