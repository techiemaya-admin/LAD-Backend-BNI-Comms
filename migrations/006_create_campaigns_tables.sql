-- Campaign Feature Migration
-- Migrated from pluto_v8/sts-service/migrations/001_create_campaigns_tables.sql
-- Enhanced with tenant_id for multi-tenancy

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, running, paused, completed, stopped
    created_by VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}', -- Campaign configuration (leads_per_day, lead_gen_offset, last_lead_gen_date, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_campaigns_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Campaign steps table (workflow builder)
CREATE TABLE IF NOT EXISTS campaign_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL, -- linkedin_visit, linkedin_follow, linkedin_connect, linkedin_message, email_send, delay, condition, lead_generation, etc.
    "order" INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}', -- Step-specific configuration
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_campaign_steps_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_campaign_steps_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Campaign leads table
CREATE TABLE IF NOT EXISTS campaign_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    lead_id UUID NOT NULL, -- Internal UUID for lead
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    linkedin_url TEXT,
    company_name VARCHAR(255),
    title VARCHAR(255),
    phone VARCHAR(50),
    lead_data JSONB DEFAULT '{}', -- Full lead data including apollo_person_id
    status VARCHAR(50) DEFAULT 'pending', -- pending, active, completed, stopped, error
    current_step_order INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_campaign_leads_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_campaign_leads_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Campaign lead activities table (tracks all actions)
CREATE TABLE IF NOT EXISTS campaign_lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    campaign_lead_id UUID NOT NULL,
    step_id UUID, -- Reference to campaign_steps
    step_type VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL, -- pending, sent, delivered, opened, clicked, connected, replied, failed, skipped, error
    channel VARCHAR(50), -- linkedin, email, whatsapp, voice, instagram, campaign
    message_content TEXT,
    subject VARCHAR(500),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_campaign_lead_activities_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_campaign_lead_activities_lead FOREIGN KEY (campaign_lead_id) REFERENCES campaign_leads(id) ON DELETE CASCADE,
    CONSTRAINT fk_campaign_lead_activities_step FOREIGN KEY (step_id) REFERENCES campaign_steps(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status ON campaigns(tenant_id, status) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_campaign_steps_tenant ON campaign_steps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign ON campaign_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_order ON campaign_steps(campaign_id, "order");

CREATE INDEX IF NOT EXISTS idx_campaign_leads_tenant ON campaign_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON campaign_leads(status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_email ON campaign_leads(email);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_apollo ON campaign_leads((lead_data->>'apollo_person_id'));

CREATE INDEX IF NOT EXISTS idx_campaign_lead_activities_tenant ON campaign_lead_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_lead_activities_lead ON campaign_lead_activities(campaign_lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_lead_activities_status ON campaign_lead_activities(status);
CREATE INDEX IF NOT EXISTS idx_campaign_lead_activities_step ON campaign_lead_activities(step_id);
CREATE INDEX IF NOT EXISTS idx_campaign_lead_activities_created ON campaign_lead_activities(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_campaigns_timestamp ON campaigns;
CREATE TRIGGER update_campaigns_timestamp BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_campaigns_updated_at();

DROP TRIGGER IF EXISTS update_campaign_steps_timestamp ON campaign_steps;
CREATE TRIGGER update_campaign_steps_timestamp BEFORE UPDATE ON campaign_steps
    FOR EACH ROW EXECUTE FUNCTION update_campaigns_updated_at();

DROP TRIGGER IF EXISTS update_campaign_leads_timestamp ON campaign_leads;
CREATE TRIGGER update_campaign_leads_timestamp BEFORE UPDATE ON campaign_leads
    FOR EACH ROW EXECUTE FUNCTION update_campaigns_updated_at();

DROP TRIGGER IF EXISTS update_campaign_lead_activities_timestamp ON campaign_lead_activities;
CREATE TRIGGER update_campaign_lead_activities_timestamp BEFORE UPDATE ON campaign_lead_activities
    FOR EACH ROW EXECUTE FUNCTION update_campaigns_updated_at();

-- Comments
COMMENT ON TABLE campaigns IS 'Campaign management - main table for multichannel outreach campaigns';
COMMENT ON TABLE campaign_steps IS 'Campaign workflow steps - defines the sequence of actions';
COMMENT ON TABLE campaign_leads IS 'Campaign leads - people enrolled in campaigns';
COMMENT ON TABLE campaign_lead_activities IS 'Campaign activities - tracks all actions taken for each lead';

COMMENT ON COLUMN campaigns.config IS 'Campaign configuration: leads_per_day (daily limit), lead_gen_offset (total leads processed), last_lead_gen_date (last generation date)';
COMMENT ON COLUMN campaign_steps.config IS 'Step configuration: message, subject, delay times, conditions, filters, etc.';
COMMENT ON COLUMN campaign_leads.lead_data IS 'Full lead data including apollo_person_id, profile details, etc.';
COMMENT ON COLUMN campaign_leads.status IS 'Lead status: pending (not started), active (in progress), completed (all steps done), stopped (condition not met), error (execution failed)';
COMMENT ON COLUMN campaign_lead_activities.status IS 'Activity status: sent (initiated), delivered (confirmed), connected (LinkedIn accepted), replied (response received), opened (email), clicked (link), error (failed)';
