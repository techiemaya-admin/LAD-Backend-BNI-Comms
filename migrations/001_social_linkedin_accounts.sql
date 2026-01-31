-- Migration: Create social_linkedin_accounts table
-- Purpose: Store LinkedIn accounts connected via social-integration feature
-- LAD Architecture: Tenant-scoped, follows naming conventions

CREATE TABLE IF NOT EXISTS social_linkedin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  provider VARCHAR(50) NOT NULL DEFAULT 'unipile',
  provider_account_id VARCHAR(255) NOT NULL,        -- was unipile_account_id

  account_name VARCHAR(255),

  -- auth/session artifacts (encrypt at rest in production)
  session_cookies TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- operational status
  status VARCHAR(30) NOT NULL DEFAULT 'active',     -- active|expired|revoked|error
  last_verified_at TIMESTAMPTZ,

  -- optional defaults (campaign can override)
  default_daily_limit INT,
  default_hourly_limit INT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_social_linkedin_accounts UNIQUE (tenant_id, provider, provider_account_id)
);

-- Tenant-scoped index (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_social_linkedin_accounts_tenant
  ON social_linkedin_accounts(tenant_id)
  WHERE is_deleted = false;

-- User-scoped index (user's accounts)
CREATE INDEX IF NOT EXISTS idx_social_linkedin_accounts_user
  ON social_linkedin_accounts(tenant_id, user_id)
  WHERE is_deleted = false;

-- Provider lookup index
CREATE INDEX IF NOT EXISTS idx_social_linkedin_accounts_provider
  ON social_linkedin_accounts(provider, provider_account_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_social_linkedin_accounts_updated ON social_linkedin_accounts;
CREATE TRIGGER trg_social_linkedin_accounts_updated
BEFORE UPDATE ON social_linkedin_accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE social_linkedin_accounts IS 'LinkedIn accounts connected via social-integration feature, tenant and user scoped';
COMMENT ON COLUMN social_linkedin_accounts.provider_account_id IS 'External provider account ID (e.g., Unipile account ID)';
COMMENT ON COLUMN social_linkedin_accounts.status IS 'Account status: active, expired, revoked, error';
