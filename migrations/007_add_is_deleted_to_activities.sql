-- Add is_deleted column to campaign_lead_activities for soft delete support
-- This ensures consistency with campaign_leads table and enables soft deletes

ALTER TABLE lad_dev.campaign_lead_activities
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Create index on is_deleted for efficient filtering
CREATE INDEX IF NOT EXISTS idx_campaign_lead_activities_deleted 
ON lad_dev.campaign_lead_activities(is_deleted) 
WHERE is_deleted = FALSE;

-- Create combined index for common queries
CREATE INDEX IF NOT EXISTS idx_campaign_lead_activities_lead_deleted 
ON lad_dev.campaign_lead_activities(campaign_lead_id, is_deleted) 
WHERE is_deleted = FALSE;

COMMENT ON COLUMN lad_dev.campaign_lead_activities.is_deleted 
IS 'Soft delete flag - when true, activity is logically deleted but retained for audit';
