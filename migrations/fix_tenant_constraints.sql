/**
 * Migration: Fix Tenant Constraints and Foreign Keys
 * 
 * PURPOSE:
 * Enforces proper tenant isolation and foreign key constraints across all feature tables
 * 
 * FIXES:
 * 1. Make tenant_id NOT NULL on all feature tables
 * 2. Add missing FK constraints to users table (created_by, uploaded_by, etc.)
 * 3. Add composite FK patterns to enforce tenant consistency
 * 4. Create unique constraints on (tenant_id, id) for parent tables
 */

-- Start transaction
BEGIN;

-- ============================================================================
-- STEP 0: Fix feature_flags tenant isolation and naming
-- ============================================================================

-- Update any existing underscore feature keys to kebab-case
UPDATE lad_dev.feature_flags SET feature_key = 'apollo-leads' WHERE feature_key = 'apollo_leads';
UPDATE lad_dev.feature_flags SET feature_key = 'voice-agent' WHERE feature_key = 'voice_agent';
UPDATE lad_dev.feature_flags SET feature_key = 'ai-icp-assistant' WHERE feature_key = 'ai_assistant';
UPDATE lad_dev.feature_flags SET feature_key = 'lead-enrichment' WHERE feature_key = 'lead_enrichment';

-- Set default tenant_id for any NULL entries (should not exist in production)
UPDATE lad_dev.feature_flags 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

-- Enforce tenant_id NOT NULL (LAD rule: all flags must be tenant-scoped)
ALTER TABLE lad_dev.feature_flags
  ALTER COLUMN tenant_id SET NOT NULL;

-- Drop old unique constraint with organization_id naming
ALTER TABLE lad_dev.feature_flags 
  DROP CONSTRAINT IF EXISTS feature_flags_feature_key_organization_id_user_id_key;

-- Add new unique constraint with proper tenant naming
ALTER TABLE lad_dev.feature_flags
  ADD CONSTRAINT feature_flags_feature_key_tenant_user_key 
  UNIQUE (feature_key, tenant_id, user_id);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant_key
  ON lad_dev.feature_flags (tenant_id, feature_key);

CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant_user_key
  ON lad_dev.feature_flags (tenant_id, user_id, feature_key)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant_enabled
  ON lad_dev.feature_flags (tenant_id, is_enabled)
  WHERE is_enabled = true;

-- Seed missing features for demo tenant (kebab-case canonical format)
INSERT INTO lad_dev.feature_flags (feature_key, tenant_id, is_enabled, config)
VALUES 
  ('apollo-leads', '00000000-0000-0000-0000-000000000001', true, '{}'),
  ('voice-agent', '00000000-0000-0000-0000-000000000001', true, '{}'),
  ('ai-icp-assistant', '00000000-0000-0000-0000-000000000001', true, '{}'),
  ('lead-enrichment', '00000000-0000-0000-0000-000000000001', true, '{}'),
  ('campaigns', '00000000-0000-0000-0000-000000000001', true, '{}')
ON CONFLICT (feature_key, tenant_id, user_id) DO UPDATE 
SET is_enabled = EXCLUDED.is_enabled, updated_at = CURRENT_TIMESTAMP;

-- Note: deals-pipeline and social-integration already exist in kebab-case

-- ============================================================================
-- STEP 0B: Standardize timestamp columns to TIMESTAMPTZ
-- ============================================================================

-- Convert campaign tables from TIMESTAMP to TIMESTAMPTZ
ALTER TABLE lad_dev.campaign_lead_activities
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE lad_dev.campaign_leads
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE lad_dev.campaign_steps
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE lad_dev.campaigns
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Convert lead tables from TIMESTAMP to TIMESTAMPTZ
ALTER TABLE lad_dev.lead_attachments
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE lad_dev.lead_bookings
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE lad_dev.lead_notes
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE lad_dev.lead_stages
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE lad_dev.lead_statuses
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Note: leads, lead_social, feature_flags, credit_transactions, domain_events,
-- memberships, tenant_features, tenant_invitations, and tenants already use TIMESTAMPTZ

-- ============================================================================
-- STEP 1: Make tenant_id NOT NULL on leads table
-- ============================================================================
ALTER TABLE lad_dev.leads 
  ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================================
-- STEP 2: Add unique constraint on leads(tenant_id, id) for composite FK
-- ============================================================================
ALTER TABLE lad_dev.leads
  ADD CONSTRAINT leads_tenant_id_key UNIQUE (tenant_id, id);

-- ============================================================================
-- STEP 3: Fix lead_notes constraints
-- ============================================================================

-- Add FK to users for created_by
ALTER TABLE lad_dev.lead_notes
  ADD CONSTRAINT lead_notes_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES lad_dev.users(id) ON DELETE RESTRICT;

-- Drop existing simple FK to leads
ALTER TABLE lad_dev.lead_notes
  DROP CONSTRAINT IF EXISTS lead_notes_lead_id_fkey;

-- Add composite FK to enforce tenant match
ALTER TABLE lad_dev.lead_notes
  ADD CONSTRAINT lead_notes_tenant_lead_fkey
  FOREIGN KEY (tenant_id, lead_id) REFERENCES lad_dev.leads(tenant_id, id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 4: Fix lead_attachments constraints
-- ============================================================================

-- Add FK to users for uploaded_by (if column has data, otherwise may fail)
ALTER TABLE lad_dev.lead_attachments
  ADD CONSTRAINT lead_attachments_uploaded_by_fkey 
  FOREIGN KEY (uploaded_by) REFERENCES lad_dev.users(id) ON DELETE SET NULL;

-- Add composite FK to enforce tenant match
ALTER TABLE lad_dev.lead_attachments
  DROP CONSTRAINT IF EXISTS lead_attachments_lead_id_fkey;

ALTER TABLE lad_dev.lead_attachments
  ADD CONSTRAINT lead_attachments_tenant_lead_fkey
  FOREIGN KEY (tenant_id, lead_id) REFERENCES lad_dev.leads(tenant_id, id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 5: Fix lead_social constraints
-- ============================================================================

-- Add tenant_id column to lead_social if missing
ALTER TABLE lad_dev.lead_social
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Populate tenant_id from leads table
UPDATE lad_dev.lead_social ls
SET tenant_id = l.tenant_id
FROM lad_dev.leads l
WHERE ls.lead_id = l.id
AND ls.tenant_id IS NULL;

-- Make tenant_id NOT NULL
ALTER TABLE lad_dev.lead_social
  ALTER COLUMN tenant_id SET NOT NULL;

-- Drop existing simple FK to leads
ALTER TABLE lad_dev.lead_social
  DROP CONSTRAINT IF EXISTS lead_social_lead_id_fkey;

-- Add composite FK to enforce tenant match
ALTER TABLE lad_dev.lead_social
  ADD CONSTRAINT lead_social_tenant_lead_fkey
  FOREIGN KEY (tenant_id, lead_id) REFERENCES lad_dev.leads(tenant_id, id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 6: Fix lead_stages constraints
-- ============================================================================

-- Check if lead_stages needs tenant constraints
DO $$
BEGIN
  -- Add tenant_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'lad_dev' 
    AND table_name = 'lead_stages' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE lad_dev.lead_stages ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
    ALTER TABLE lad_dev.lead_stages ALTER COLUMN tenant_id DROP DEFAULT;
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Fix campaigns table constraints
-- ============================================================================

-- Add unique constraint on campaigns(tenant_id, id)
ALTER TABLE lad_dev.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_tenant_id_key;
  
ALTER TABLE lad_dev.campaigns
  ADD CONSTRAINT campaigns_tenant_id_key UNIQUE (tenant_id, id);

-- Convert created_by from VARCHAR to UUID (no existing data, safe to alter)
ALTER TABLE lad_dev.campaigns
  ALTER COLUMN created_by TYPE UUID USING created_by::UUID;

-- Add FK to users for created_by
ALTER TABLE lad_dev.campaigns
  ADD CONSTRAINT campaigns_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES lad_dev.users(id) ON DELETE RESTRICT;

-- ============================================================================
-- STEP 8: Fix campaign_leads constraints
-- ============================================================================

-- Drop existing simple FKs
ALTER TABLE lad_dev.campaign_leads
  DROP CONSTRAINT IF EXISTS campaign_leads_lead_id_fkey;

ALTER TABLE lad_dev.campaign_leads
  DROP CONSTRAINT IF EXISTS campaign_leads_campaign_id_fkey;

-- Add composite FKs to enforce tenant match
ALTER TABLE lad_dev.campaign_leads
  ADD CONSTRAINT campaign_leads_tenant_lead_fkey
  FOREIGN KEY (tenant_id, lead_id) REFERENCES lad_dev.leads(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE lad_dev.campaign_leads
  ADD CONSTRAINT campaign_leads_tenant_campaign_fkey
  FOREIGN KEY (tenant_id, campaign_id) REFERENCES lad_dev.campaigns(tenant_id, id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 9: Fix campaign_steps constraints
-- ============================================================================

-- Drop existing simple FK
ALTER TABLE lad_dev.campaign_steps
  DROP CONSTRAINT IF EXISTS campaign_steps_campaign_id_fkey;

-- Add composite FK to enforce tenant match
ALTER TABLE lad_dev.campaign_steps
  ADD CONSTRAINT campaign_steps_tenant_campaign_fkey
  FOREIGN KEY (tenant_id, campaign_id) REFERENCES lad_dev.campaigns(tenant_id, id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 9B: Fix lead_bookings constraints
-- ============================================================================

-- Add FK to users for assigned_user_id
ALTER TABLE lad_dev.lead_bookings
  ADD CONSTRAINT lead_bookings_assigned_user_fkey 
  FOREIGN KEY (assigned_user_id) REFERENCES lad_dev.users(id) ON DELETE SET NULL;

-- Drop existing simple FK to leads
ALTER TABLE lad_dev.lead_bookings
  DROP CONSTRAINT IF EXISTS lead_bookings_lead_id_fkey;

-- Add composite FK to enforce tenant match
ALTER TABLE lad_dev.lead_bookings
  ADD CONSTRAINT lead_bookings_tenant_lead_fkey
  FOREIGN KEY (tenant_id, lead_id) REFERENCES lad_dev.leads(tenant_id, id) ON DELETE CASCADE;

-- Update default timezone from UTC to GST
ALTER TABLE lad_dev.lead_bookings
  ALTER COLUMN timezone SET DEFAULT 'GST';

-- ============================================================================
-- STEP 10: Create indexes for performance (with partial indexes for active rows)
-- ============================================================================

-- Leads indexes - active rows only
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id_active 
  ON lad_dev.leads(tenant_id) 
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_status_active 
  ON lad_dev.leads(tenant_id, status) 
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_leads_email_active 
  ON lad_dev.leads(email) 
  WHERE is_deleted = false AND email IS NOT NULL;

-- Lead notes indexes - no soft delete, always include
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_by 
  ON lad_dev.lead_notes(created_by);

CREATE INDEX IF NOT EXISTS idx_lead_notes_tenant_lead 
  ON lad_dev.lead_notes(tenant_id, lead_id);

-- Lead attachments indexes - active rows only  
CREATE INDEX IF NOT EXISTS idx_lead_attachments_uploaded_by_active 
  ON lad_dev.lead_attachments(uploaded_by) 
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_lead_attachments_tenant_lead_active 
  ON lad_dev.lead_attachments(tenant_id, lead_id) 
  WHERE is_deleted = false;

-- Campaigns indexes - active rows only
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id_active 
  ON lad_dev.campaigns(tenant_id) 
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_campaigns_created_by_active 
  ON lad_dev.campaigns(created_by) 
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_campaigns_status_active 
  ON lad_dev.campaigns(tenant_id, status) 
  WHERE is_deleted = false;

-- Campaign leads indexes - no soft delete, always include
CREATE INDEX IF NOT EXISTS idx_campaign_leads_tenant_campaign 
  ON lad_dev.campaign_leads(tenant_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_tenant_lead 
  ON lad_dev.campaign_leads(tenant_id, lead_id);

-- Lead social indexes (no soft delete, always active)
CREATE INDEX IF NOT EXISTS idx_lead_social_tenant_lead 
  ON lad_dev.lead_social(tenant_id, lead_id);

-- Lead bookings indexes - active rows only
CREATE INDEX IF NOT EXISTS idx_lead_bookings_tenant_lead_active 
  ON lad_dev.lead_bookings(tenant_id, lead_id) 
  WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_lead_bookings_assigned_user_active 
  ON lad_dev.lead_bookings(assigned_user_id, scheduled_at) 
  WHERE status IN ('scheduled', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_lead_bookings_scheduled_active 
  ON lad_dev.lead_bookings(tenant_id, scheduled_at) 
  WHERE status IN ('scheduled', 'confirmed');

-- Deleted rows indexes (for cleanup/audit queries) - using is_deleted boolean
CREATE INDEX IF NOT EXISTS idx_leads_deleted 
  ON lad_dev.leads(id, updated_at) 
  WHERE is_deleted = true;

CREATE INDEX IF NOT EXISTS idx_campaigns_deleted 
  ON lad_dev.campaigns(id, updated_at) 
  WHERE is_deleted = true;

CREATE INDEX IF NOT EXISTS idx_lead_attachments_deleted
  ON lad_dev.lead_attachments(id, created_at)
  WHERE is_deleted = true;

-- ============================================================================
-- Commit transaction
-- ============================================================================
COMMIT;

-- Verify constraints
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'lad_dev'
  AND tc.table_name IN ('leads', 'lead_notes', 'lead_attachments', 'lead_social', 'campaigns', 'campaign_leads', 'campaign_steps')
  AND tc.constraint_type IN ('FOREIGN KEY', 'UNIQUE')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- Verify feature_flags use kebab-case and proper tenant isolation
SELECT 
  feature_key, 
  tenant_id, 
  is_enabled,
  COUNT(*) as count
FROM lad_dev.feature_flags 
GROUP BY feature_key, tenant_id, is_enabled
ORDER BY feature_key;

-- Verify all tenant_id columns are NOT NULL
SELECT table_name, column_name, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'lad_dev' 
  AND column_name = 'tenant_id'
  AND is_nullable = 'YES'
ORDER BY table_name;
-- (Should return 0 rows if all tenant_id columns are NOT NULL)

-- Verify all timestamp columns are TIMESTAMPTZ
SELECT table_name, column_name, data_type
FROM information_schema.columns 
WHERE table_schema = 'lad_dev' 
  AND column_name IN ('created_at', 'updated_at', 'deleted_at')
  AND data_type != 'timestamp with time zone'
ORDER BY table_name, column_name;
-- (Should return 0 rows if all timestamps are standardized)

-- Verify feature_flags indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'lad_dev'
  AND tablename = 'feature_flags'
ORDER BY indexname;
