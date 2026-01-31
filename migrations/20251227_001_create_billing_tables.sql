-- Migration: Create Credit-Based Billing Tables
-- Date: 2025-12-27
-- Description: Implements credit wallets, ledger transactions, and usage events for multi-tenant billing

-- =============================================================================
-- 1. BILLING WALLETS
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = tenant wallet
    
    -- Balance tracking
    current_balance NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (current_balance >= 0),
    reserved_balance NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
    
    -- Low balance alerts
    low_balance_threshold NUMERIC(18,6),
    low_balance_notified_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tenant_id, user_id), -- One wallet per tenant/user combo
    CHECK ((user_id IS NULL) OR (tenant_id IS NOT NULL)) -- User wallet must have tenant
);

CREATE INDEX idx_billing_wallets_tenant_id ON billing_wallets(tenant_id);
CREATE INDEX idx_billing_wallets_user_id ON billing_wallets(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_billing_wallets_status ON billing_wallets(status) WHERE status != 'active';

COMMENT ON TABLE billing_wallets IS 'Credit wallets for tenants and users. Balance is cached; ledger is source of truth.';
COMMENT ON COLUMN billing_wallets.reserved_balance IS 'Credits reserved for pending operations (e.g., quoted but not charged)';

-- =============================================================================
-- 2. BILLING LEDGER TRANSACTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing_ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES billing_wallets(id) ON DELETE CASCADE,
    
    -- Transaction details
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
        'topup',        -- Admin adds credits
        'debit',        -- Usage charge
        'credit',       -- Refund
        'adjustment',   -- Manual correction
        'reservation',  -- Hold credits (quote)
        'release'       -- Release reservation
    )),
    
    amount NUMERIC(18,6) NOT NULL, -- Positive for credit, negative for debit
    
    -- Balance snapshot (for audit)
    balance_before NUMERIC(18,6) NOT NULL,
    balance_after NUMERIC(18,6) NOT NULL,
    
    -- Reference tracking
    reference_type VARCHAR(50), -- 'usage_event', 'invoice', 'manual', 'stripe_payment', etc.
    reference_id UUID,
    
    -- Idempotency
    idempotency_key VARCHAR(255) NOT NULL,
    
    -- Authorization
    created_by UUID REFERENCES users(id), -- Who performed the transaction
    
    -- Description and metadata
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tenant_id, idempotency_key),
    CHECK (balance_after = balance_before + amount)
);

CREATE INDEX idx_billing_ledger_tenant_id ON billing_ledger_transactions(tenant_id, created_at DESC);
CREATE INDEX idx_billing_ledger_wallet_id ON billing_ledger_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_billing_ledger_reference ON billing_ledger_transactions(reference_type, reference_id);
CREATE INDEX idx_billing_ledger_idempotency ON billing_ledger_transactions(tenant_id, idempotency_key);
CREATE INDEX idx_billing_ledger_created_at ON billing_ledger_transactions(created_at DESC);

COMMENT ON TABLE billing_ledger_transactions IS 'Immutable ledger of all credit transactions. Source of truth for balances.';

-- =============================================================================
-- 3. BILLING USAGE EVENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Feature tracking
    feature_key VARCHAR(100) NOT NULL, -- 'voice-agent', 'campaigns', etc.
    
    -- Usage details (array of line items)
    usage_items JSONB NOT NULL, -- [{category, provider, model, unit, quantity, unit_price, cost}]
    
    -- Computed totals
    total_quantity NUMERIC(18,6) NOT NULL,
    total_cost NUMERIC(18,6) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',   -- Created but not charged
        'charged',   -- Successfully charged
        'voided',    -- Cancelled
        'failed'     -- Charge failed
    )),
    
    -- Ledger reference (set when charged)
    ledger_transaction_id UUID REFERENCES billing_ledger_transactions(id),
    charged_at TIMESTAMPTZ,
    
    -- Idempotency (external reference from feature)
    idempotency_key VARCHAR(255) NOT NULL,
    external_reference_id VARCHAR(255), -- e.g., call_id, campaign_id
    
    -- Error handling
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tenant_id, idempotency_key),
    CHECK (total_cost >= 0)
);

CREATE INDEX idx_billing_usage_tenant_id ON billing_usage_events(tenant_id, created_at DESC);
CREATE INDEX idx_billing_usage_user_id ON billing_usage_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_billing_usage_feature ON billing_usage_events(feature_key, created_at DESC);
CREATE INDEX idx_billing_usage_status ON billing_usage_events(status, created_at DESC);
CREATE INDEX idx_billing_usage_idempotency ON billing_usage_events(tenant_id, idempotency_key);
CREATE INDEX idx_billing_usage_external_ref ON billing_usage_events(external_reference_id) WHERE external_reference_id IS NOT NULL;
CREATE INDEX idx_billing_usage_charged_at ON billing_usage_events(charged_at DESC) WHERE charged_at IS NOT NULL;

COMMENT ON TABLE billing_usage_events IS 'Idempotent usage events from features. Supports multi-component charging.';
COMMENT ON COLUMN billing_usage_events.usage_items IS 'Array of {category, provider, model, unit, quantity, unit_price, cost, description}';

-- =============================================================================
-- 4. BILLING INVOICES (Stub for future)
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    invoice_number VARCHAR(50) NOT NULL,
    
    -- Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Amounts
    subtotal NUMERIC(18,6) NOT NULL,
    tax NUMERIC(18,6) NOT NULL DEFAULT 0,
    total NUMERIC(18,6) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending', 'paid', 'voided', 'overdue'
    )),
    
    -- Payment
    paid_at TIMESTAMPTZ,
    payment_method VARCHAR(50),
    
    -- Metadata
    line_items JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX idx_billing_invoices_tenant_id ON billing_invoices(tenant_id, created_at DESC);
CREATE INDEX idx_billing_invoices_status ON billing_invoices(status, due_at);

COMMENT ON TABLE billing_invoices IS 'Invoice generation (stub for future implementation)';

-- =============================================================================
-- 5. BILLING FEATURE ENTITLEMENTS (Optional - for plan limits)
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing_feature_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    feature_key VARCHAR(100) NOT NULL,
    
    -- Limits
    enabled BOOLEAN NOT NULL DEFAULT true,
    monthly_quota NUMERIC(18,6), -- NULL = unlimited
    daily_quota NUMERIC(18,6),
    
    -- Overages
    allow_overages BOOLEAN NOT NULL DEFAULT false,
    overage_rate NUMERIC(18,10), -- Price per unit over quota
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, feature_key)
);

CREATE INDEX idx_billing_entitlements_tenant ON billing_feature_entitlements(tenant_id);

COMMENT ON TABLE billing_feature_entitlements IS 'Feature quotas and overage rules per tenant';

-- =============================================================================
-- 6. UPDATE TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_billing_wallets_updated_at
    BEFORE UPDATE ON billing_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_usage_events_updated_at
    BEFORE UPDATE ON billing_usage_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_invoices_updated_at
    BEFORE UPDATE ON billing_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_entitlements_updated_at
    BEFORE UPDATE ON billing_feature_entitlements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 7. SEED DATA (Example)
-- =============================================================================

-- Insert global default pricing if pricing catalog is empty
-- (Only run if billing_pricing_catalog exists and is empty)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_pricing_catalog') THEN
        -- Voice Agent STT pricing
        INSERT INTO billing_pricing_catalog (tenant_id, category, provider, model, unit, unit_price, description, is_active)
        VALUES 
            (NULL, 'stt', 'openai', 'whisper-1', 'second', 0.0001, 'OpenAI Whisper STT per second', true),
            (NULL, 'llm', 'openai', 'gpt-4', 'token', 0.00003, 'OpenAI GPT-4 per token', true),
            (NULL, 'llm', 'openai', 'gpt-3.5-turbo', 'token', 0.000002, 'OpenAI GPT-3.5 Turbo per token', true),
            (NULL, 'tts', 'openai', 'tts-1', 'character', 0.000015, 'OpenAI TTS per character', true),
            (NULL, 'tts', 'openai', 'tts-1-hd', 'character', 0.00003, 'OpenAI TTS HD per character', true),
            (NULL, 'telephony', 'twilio', 'voice', 'minute', 0.013, 'Twilio voice per minute', true),
            (NULL, 'telephony', 'twilio', 'sms', 'message', 0.0075, 'Twilio SMS per message', true),
            (NULL, 'vm_infrastructure', 'runpod', 'cpu-basic', 'second', 0.0002, 'RunPod CPU instance per second', true),
            (NULL, 'enrichment', 'apollo', 'contact', 'record', 0.02, 'Apollo contact enrichment per record', true),
            (NULL, 'enrichment', 'apollo', 'company', 'record', 0.05, 'Apollo company enrichment per record', true)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Migration complete
