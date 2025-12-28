-- Migration: Replace linkedin_accounts table with backward-compatible view
-- Purpose: Maintain backward compatibility while using new architecture
-- Strategy: Rename old table, create view pointing to new table

-- 1) Rename existing table to legacy
ALTER TABLE IF EXISTS linkedin_accounts RENAME TO linkedin_accounts_legacy;

-- 2) Create view with same structure as old table
CREATE OR REPLACE VIEW linkedin_accounts AS
SELECT
  sla.id,
  sla.tenant_id,
  sla.account_name,
  sla.provider_account_id AS unipile_account_id,
  sla.session_cookies,
  (sla.status = 'active') AS is_active,
  COALESCE(sla.default_daily_limit, 100) AS daily_action_limit,
  0::int AS actions_today,
  NULL::date AS last_reset_date,
  sla.metadata,
  sla.created_at,
  sla.updated_at,
  sla.is_deleted
FROM social_linkedin_accounts sla
WHERE sla.provider = 'unipile';

COMMENT ON VIEW linkedin_accounts IS 'Backward-compatible view of social_linkedin_accounts for legacy code';

-- 3) Optional: Create an INSTEAD OF trigger if you need write operations through the view
-- (Currently not implemented - prefer direct use of social_linkedin_accounts for writes)
