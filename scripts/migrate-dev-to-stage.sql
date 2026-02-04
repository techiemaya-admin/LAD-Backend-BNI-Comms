-- Migration script: Sync lad_stage schema with latest lad_dev changes
-- Date: 2026-02-03
-- Purpose: Add missing tables, columns, and indexes from lad_dev to lad_stage

BEGIN;

\echo '================================================'
\echo 'Migrating lad_dev changes to lad_stage'
\echo '================================================'
\echo ''

-- ================================================
-- 1. Add missing columns to campaign_leads table
-- ================================================
\echo 'Adding enrichment columns to campaign_leads...'

ALTER TABLE lad_stage.campaign_leads
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS enriched_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS enriched_linkedin_url VARCHAR(500);

COMMENT ON COLUMN lad_stage.campaign_leads.enriched_at IS 'Timestamp when lead data was enriched';
COMMENT ON COLUMN lad_stage.campaign_leads.enriched_email IS 'Email obtained through enrichment services';
COMMENT ON COLUMN lad_stage.campaign_leads.enriched_linkedin_url IS 'LinkedIn profile URL obtained through enrichment';

\echo '✓ Enrichment columns added to campaign_leads'

-- ================================================
-- 2. Add missing columns to campaigns table
-- ================================================
\echo 'Adding campaign scheduling columns...'

ALTER TABLE lad_stage.campaigns
ADD COLUMN IF NOT EXISTS campaign_duration_days INTEGER,
ADD COLUMN IF NOT EXISTS campaign_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS campaign_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS days_executed INTEGER DEFAULT 0;

COMMENT ON COLUMN lad_stage.campaigns.campaign_duration_days IS 'Total duration of campaign in days';
COMMENT ON COLUMN lad_stage.campaigns.campaign_start_date IS 'Scheduled start date for campaign';
COMMENT ON COLUMN lad_stage.campaigns.campaign_end_date IS 'Scheduled end date for campaign';
COMMENT ON COLUMN lad_stage.campaigns.days_executed IS 'Number of days campaign has been running';

\echo '✓ Campaign scheduling columns added'

-- ================================================
-- 3. Create missing indexes on campaign_leads
-- ================================================
\echo 'Creating indexes on campaign_leads...'

CREATE INDEX IF NOT EXISTS idx_campaign_leads_apollo_person_id 
ON lad_stage.campaign_leads USING gin ((lead_data->'apollo_person_id'));

CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_data_gin 
ON lad_stage.campaign_leads USING gin (lead_data);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_phone 
ON lad_stage.campaign_leads (phone);

\echo '✓ campaign_leads indexes created'

-- ================================================
-- 4. Create missing indexes on campaigns
-- ================================================
\echo 'Creating indexes on campaigns...'

CREATE INDEX IF NOT EXISTS idx_campaigns_completion_check 
ON lad_stage.campaigns (id, status, campaign_end_date) 
WHERE is_deleted = false AND status = 'running';

CREATE INDEX IF NOT EXISTS idx_campaigns_end_date 
ON lad_stage.campaigns (campaign_end_date) 
WHERE campaign_end_date IS NOT NULL AND is_deleted = false;

-- Note: idx_campaigns_recurring_active skipped (recurring column doesn't exist in lad_stage)

\echo '✓ campaigns indexes created'

-- ================================================
-- 5. Create missing conversation tables
-- ================================================
\echo 'Creating conversation tables...'

CREATE TABLE IF NOT EXISTS lad_stage.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES lad_stage.tenants(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- 'whatsapp', 'email', 'sms', etc.
    external_id VARCHAR(255), -- Channel-specific conversation ID
    lead_id UUID REFERENCES lad_stage.leads(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'closed', 'archived'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON lad_stage.conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead ON lad_stage.conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON lad_stage.conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_external ON lad_stage.conversations(external_id);

COMMENT ON TABLE lad_stage.conversations IS 'Unified conversation storage across all channels';

CREATE TABLE IF NOT EXISTS lad_stage.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES lad_stage.conversations(id) ON DELETE CASCADE,
    direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
    content TEXT,
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'file', etc.
    external_message_id VARCHAR(255),
    sender_id UUID REFERENCES lad_stage.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation ON lad_stage.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created ON lad_stage.conversation_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conv_messages_sender ON lad_stage.conversation_messages(sender_id);

COMMENT ON TABLE lad_stage.conversation_messages IS 'Messages within conversations';

CREATE TABLE IF NOT EXISTS lad_stage.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES lad_stage.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES lad_stage.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'agent', -- 'agent', 'customer', 'observer'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_conversation ON lad_stage.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON lad_stage.conversation_participants(user_id);

COMMENT ON TABLE lad_stage.conversation_participants IS 'Users participating in conversations';

CREATE TABLE IF NOT EXISTS lad_stage.conversation_ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES lad_stage.conversations(id) ON DELETE CASCADE,
    insight_type VARCHAR(100) NOT NULL, -- 'sentiment', 'intent', 'summary', etc.
    insight_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_ai_insights_conversation ON lad_stage.conversation_ai_insights(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_ai_insights_type ON lad_stage.conversation_ai_insights(insight_type);

COMMENT ON TABLE lad_stage.conversation_ai_insights IS 'AI-generated insights from conversations';

\echo '✓ Conversation tables created'

-- ================================================
-- 6. Create phone_numbers table
-- ================================================
\echo 'Creating phone_numbers table...'

CREATE TABLE IF NOT EXISTS lad_stage.phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES lad_stage.tenants(id) ON DELETE CASCADE,
    e164 VARCHAR(20) NOT NULL, -- Phone number in E.164 format
    label VARCHAR(100),
    provider VARCHAR(50), -- 'twilio', 'vapi', etc.
    provider_sid VARCHAR(255),
    capabilities JSONB DEFAULT '{}', -- voice, sms, mms capabilities
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    UNIQUE(tenant_id, e164)
);

CREATE INDEX IF NOT EXISTS idx_phone_numbers_tenant ON lad_stage.phone_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_e164 ON lad_stage.phone_numbers(e164);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_provider ON lad_stage.phone_numbers(provider);

COMMENT ON TABLE lad_stage.phone_numbers IS 'Phone numbers owned by tenants';

\echo '✓ phone_numbers table created'

-- ================================================
-- 7. Create social_whatsapp_conversations table
-- ================================================
\echo 'Creating social_whatsapp_conversations table...'

CREATE TABLE IF NOT EXISTS lad_stage.social_whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES lad_stage.conversations(id) ON DELETE CASCADE,
    whatsapp_id VARCHAR(255) NOT NULL, -- WhatsApp conversation ID
    phone_number VARCHAR(20),
    contact_name VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_conversation ON lad_stage.social_whatsapp_conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_whatsapp_id ON lad_stage.social_whatsapp_conversations(whatsapp_id);

COMMENT ON TABLE lad_stage.social_whatsapp_conversations IS 'WhatsApp-specific conversation data';

\echo '✓ social_whatsapp_conversations table created'

-- ================================================
-- 8. Grant permissions
-- ================================================
\echo 'Granting permissions...'

GRANT ALL ON ALL TABLES IN SCHEMA lad_stage TO dbadmin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA lad_stage TO dbadmin;

\echo '✓ Permissions granted'

-- ================================================
-- Summary
-- ================================================
\echo ''
\echo '================================================'
\echo 'Migration Summary'
\echo '================================================'
SELECT 
    'lad_stage' as schema,
    COUNT(*) as table_count,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'lad_stage') as column_count,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'lad_stage') as index_count
FROM information_schema.tables
WHERE table_schema = 'lad_stage'
  AND table_type = 'BASE TABLE';

\echo ''
\echo '✅ Migration completed successfully!'
\echo ''

COMMIT;
