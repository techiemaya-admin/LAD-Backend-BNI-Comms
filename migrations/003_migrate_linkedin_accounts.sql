-- Migration: Migrate data from linkedin_accounts to social_linkedin_accounts
-- Purpose: Preserve existing LinkedIn connections
-- Strategy: Assign accounts to tenant owner user_id

-- 0) Add is_deleted column to old table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'lad_dev' 
    AND table_name = 'linkedin_accounts' 
    AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE linkedin_accounts ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 1) Insert rows into new table
INSERT INTO social_linkedin_accounts (
  tenant_id,
  user_id,
  provider,
  provider_account_id,
  account_name,
  session_cookies,
  status,
  default_daily_limit,
  metadata,
  created_at,
  updated_at
)
SELECT
  la.tenant_id,
  -- pick tenant owner as the "owner" of imported accounts
  (
    SELECT m.user_id
    FROM memberships m
    WHERE m.tenant_id = la.tenant_id
      AND m.role = 'owner'
      AND m.deleted_at IS NULL
    LIMIT 1
  ) AS user_id,
  'unipile' AS provider,
  la.unipile_account_id AS provider_account_id,
  la.account_name,
  la.session_cookies,
  CASE WHEN la.is_active = true THEN 'active' ELSE 'revoked' END AS status,
  la.daily_action_limit AS default_daily_limit,
  la.metadata,
  la.created_at,
  la.updated_at
FROM linkedin_accounts la
WHERE la.unipile_account_id IS NOT NULL
  AND la.is_deleted = false
ON CONFLICT (tenant_id, provider, provider_account_id)
DO UPDATE SET
  account_name = EXCLUDED.account_name,
  session_cookies = EXCLUDED.session_cookies,
  status = EXCLUDED.status,
  default_daily_limit = EXCLUDED.default_daily_limit,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- 2) Sanity check: Log tenants with no owner
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(DISTINCT tenant_id) INTO orphan_count
  FROM linkedin_accounts la
  WHERE la.unipile_account_id IS NOT NULL
    AND la.is_deleted = false
    AND NOT EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.tenant_id = la.tenant_id
        AND m.role = 'owner'
        AND m.deleted_at IS NULL
    );
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % tenants with LinkedIn accounts but no owner membership', orphan_count;
  END IF;
END $$;

COMMENT ON TABLE social_linkedin_accounts IS 'Migrated from linkedin_accounts - all accounts now owned by tenant owner';
