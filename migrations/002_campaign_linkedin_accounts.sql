-- Migration: Create campaign_linkedin_accounts table
-- Purpose: Map LinkedIn accounts to campaigns with per-campaign limits
-- LAD Architecture: Tenant-scoped, supports multiple accounts per campaign

CREATE TABLE IF NOT EXISTS campaign_linkedin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,

  campaign_id UUID NOT NULL
    REFERENCES campaigns(id) ON DELETE CASCADE,

  linkedin_account_id UUID NOT NULL
    REFERENCES social_linkedin_accounts(id) ON DELETE CASCADE,

  -- Per-campaign rate limits
  daily_limit INT NOT NULL,
  hourly_limit INT,
  actions_today INT NOT NULL DEFAULT 0,
  last_reset_date DATE,

  -- Account priority in campaign
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 0,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_campaign_linkedin_accounts UNIQUE (tenant_id, campaign_id, linkedin_account_id)
);

-- Campaign lookup index (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_campaign_linkedin_accounts_campaign
  ON campaign_linkedin_accounts(tenant_id, campaign_id)
  WHERE is_deleted = false;

-- Account lookup index (find campaigns using an account)
CREATE INDEX IF NOT EXISTS idx_campaign_linkedin_accounts_account
  ON campaign_linkedin_accounts(tenant_id, linkedin_account_id)
  WHERE is_deleted = false;

-- Primary account index (quick lookup of primary account per campaign)
CREATE INDEX IF NOT EXISTS idx_campaign_linkedin_accounts_primary
  ON campaign_linkedin_accounts(tenant_id, campaign_id, is_primary)
  WHERE is_deleted = false AND is_primary = true;

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_campaign_linkedin_accounts_updated ON campaign_linkedin_accounts;
CREATE TRIGGER trg_campaign_linkedin_accounts_updated
BEFORE UPDATE ON campaign_linkedin_accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE campaign_linkedin_accounts IS 'LinkedIn accounts mapped to campaigns with per-campaign rate limits';
COMMENT ON COLUMN campaign_linkedin_accounts.actions_today IS 'Number of actions performed today, reset daily';
COMMENT ON COLUMN campaign_linkedin_accounts.is_primary IS 'Whether this is the primary account for the campaign';
COMMENT ON COLUMN campaign_linkedin_accounts.priority IS 'Account priority (higher = used first when multiple accounts)';
