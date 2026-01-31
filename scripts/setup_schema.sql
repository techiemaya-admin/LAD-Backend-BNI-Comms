-- LAD LAD Schema Setup
-- Creates new schema and copies essential tables for Apollo feature

-- 1. Create new schema
CREATE SCHEMA IF NOT EXISTS lad_LAD;

-- Set search path for this session
SET search_path TO lad_LAD, public;

-- 2. Create essential tables for Apollo feature

-- Users table (core authentication and user data)
CREATE TABLE IF NOT EXISTS lad_LAD.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    organization_id UUID,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone VARCHAR(50),
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON lad_LAD.users(email);
CREATE INDEX idx_users_organization ON lad_LAD.users(organization_id);
CREATE INDEX idx_users_role ON lad_LAD.users(role);

-- Organizations (multi-tenant support)
CREATE TABLE IF NOT EXISTS lad_LAD.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free', -- free, starter, professional, enterprise
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, cancelled
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_slug ON lad_LAD.organizations(slug);
CREATE INDEX idx_organizations_plan ON lad_LAD.organizations(plan);

-- User Capabilities (permissions system)
CREATE TABLE IF NOT EXISTS lad_LAD.user_capabilities (
    user_id UUID NOT NULL REFERENCES lad_LAD.users(id) ON DELETE CASCADE,
    capability_key VARCHAR(100) NOT NULL,
    PRIMARY KEY (user_id, capability_key)
);

CREATE INDEX idx_user_capabilities_key ON lad_LAD.user_capabilities(capability_key);

-- Credit System (for pay-per-use features)
CREATE TABLE IF NOT EXISTS lad_LAD.user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES lad_LAD.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES lad_LAD.organizations(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0.00,
    total_purchased DECIMAL(10,2) DEFAULT 0.00,
    total_used DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_credits_user ON lad_LAD.user_credits(user_id);
CREATE INDEX idx_user_credits_org ON lad_LAD.user_credits(organization_id);

-- Credit Transactions (audit trail for credits)
CREATE TABLE IF NOT EXISTS lad_LAD.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES lad_LAD.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES lad_LAD.organizations(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(50) NOT NULL, -- purchase, usage, refund, adjustment
    feature VARCHAR(100), -- apollo-leads, linkedin-scraper, etc.
    description TEXT,
    metadata JSONB DEFAULT '{}',
    balance_before DECIMAL(10,2),
    balance_after DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_transactions_user ON lad_LAD.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_org ON lad_LAD.credit_transactions(organization_id);
CREATE INDEX idx_credit_transactions_type ON lad_LAD.credit_transactions(type);
CREATE INDEX idx_credit_transactions_feature ON lad_LAD.credit_transactions(feature);
CREATE INDEX idx_credit_transactions_created ON lad_LAD.credit_transactions(created_at);

-- Feature Flags (control feature access per client/organization)
CREATE TABLE IF NOT EXISTS lad_LAD.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key VARCHAR(100) NOT NULL,
    organization_id UUID REFERENCES lad_LAD.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES lad_LAD.users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}', -- feature-specific configuration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(feature_key, organization_id, user_id)
);

CREATE INDEX idx_feature_flags_key ON lad_LAD.feature_flags(feature_key);
CREATE INDEX idx_feature_flags_org ON lad_LAD.feature_flags(organization_id);
CREATE INDEX idx_feature_flags_user ON lad_LAD.feature_flags(user_id);
CREATE INDEX idx_feature_flags_enabled ON lad_LAD.feature_flags(is_enabled);

-- Feature Usage Tracking
CREATE TABLE IF NOT EXISTS lad_LAD.feature_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL REFERENCES lad_LAD.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES lad_LAD.organizations(id) ON DELETE CASCADE,
    endpoint VARCHAR(255),
    credits_used DECIMAL(10,2) DEFAULT 0,
    request_data JSONB,
    response_status INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feature_usage_feature ON lad_LAD.feature_usage(feature_key);
CREATE INDEX idx_feature_usage_user ON lad_LAD.feature_usage(user_id);
CREATE INDEX idx_feature_usage_org ON lad_LAD.feature_usage(organization_id);
CREATE INDEX idx_feature_usage_created ON lad_LAD.feature_usage(created_at);

-- 3. Apollo-specific tables

-- Apollo Search Cache (avoid duplicate API calls)
CREATE TABLE IF NOT EXISTS lad_LAD.apollo_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES lad_LAD.users(id) ON DELETE CASCADE,
    search_query VARCHAR(500) NOT NULL,
    filters JSONB DEFAULT '{}',
    result_count INTEGER,
    results JSONB, -- cached Apollo API response
    credits_used DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days')
);

CREATE INDEX idx_apollo_searches_user ON lad_LAD.apollo_searches(user_id);
CREATE INDEX idx_apollo_searches_query ON lad_LAD.apollo_searches(search_query);
CREATE INDEX idx_apollo_searches_created ON lad_LAD.apollo_searches(created_at);

-- Apollo Companies (enriched company data)
CREATE TABLE IF NOT EXISTS lad_LAD.apollo_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apollo_id VARCHAR(255) UNIQUE,
    name VARCHAR(500) NOT NULL,
    domain VARCHAR(255),
    industry VARCHAR(255),
    company_size VARCHAR(100),
    location VARCHAR(500),
    country VARCHAR(100),
    state VARCHAR(100),
    city VARCHAR(100),
    phone VARCHAR(50),
    website VARCHAR(500),
    linkedin_url VARCHAR(500),
    facebook_url VARCHAR(500),
    twitter_url VARCHAR(500),
    revenue_range VARCHAR(100),
    employee_count INTEGER,
    founded_year INTEGER,
    description TEXT,
    technologies JSONB,
    keywords JSONB,
    raw_data JSONB, -- full Apollo API response
    user_id UUID REFERENCES lad_LAD.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_apollo_companies_apollo_id ON lad_LAD.apollo_companies(apollo_id);
CREATE INDEX idx_apollo_companies_domain ON lad_LAD.apollo_companies(domain);
CREATE INDEX idx_apollo_companies_name ON lad_LAD.apollo_companies(name);
CREATE INDEX idx_apollo_companies_user ON lad_LAD.apollo_companies(user_id);

-- Apollo Contacts (people from Apollo)
CREATE TABLE IF NOT EXISTS lad_LAD.apollo_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apollo_id VARCHAR(255) UNIQUE,
    company_id UUID REFERENCES lad_LAD.apollo_companies(id) ON DELETE SET NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    title VARCHAR(255),
    seniority VARCHAR(100),
    department VARCHAR(100),
    linkedin_url VARCHAR(500),
    twitter_url VARCHAR(500),
    facebook_url VARCHAR(500),
    location VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    raw_data JSONB, -- full Apollo API response
    user_id UUID REFERENCES lad_LAD.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_apollo_contacts_apollo_id ON lad_LAD.apollo_contacts(apollo_id);
CREATE INDEX idx_apollo_contacts_email ON lad_LAD.apollo_contacts(email);
CREATE INDEX idx_apollo_contacts_company ON lad_LAD.apollo_contacts(company_id);
CREATE INDEX idx_apollo_contacts_user ON lad_LAD.apollo_contacts(user_id);

-- Leads (unified leads table)
CREATE TABLE IF NOT EXISTS lad_LAD.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES lad_LAD.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES lad_LAD.organizations(id) ON DELETE CASCADE,
    source VARCHAR(100), -- apollo, linkedin, google, etc.
    source_id VARCHAR(255), -- ID from source system
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    company_name VARCHAR(500),
    company_domain VARCHAR(255),
    title VARCHAR(255),
    linkedin_url VARCHAR(500),
    location VARCHAR(500),
    status VARCHAR(50) DEFAULT 'new', -- new, contacted, qualified, converted, lost
    priority INTEGER DEFAULT 0,
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    notes TEXT,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_contacted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_leads_user ON lad_LAD.leads(user_id);
CREATE INDEX idx_leads_org ON lad_LAD.leads(organization_id);
CREATE INDEX idx_leads_source ON lad_LAD.leads(source);
CREATE INDEX idx_leads_email ON lad_LAD.leads(email);
CREATE INDEX idx_leads_status ON lad_LAD.leads(status);
CREATE INDEX idx_leads_created ON lad_LAD.leads(created_at);

-- 4. Create default data

-- Insert default organization
INSERT INTO lad_LAD.organizations (id, name, slug, plan, status)
VALUES 
    ('00000000-0000-0000-0000-000000000001'::uuid, 'Demo Organization', 'demo', 'enterprise', 'active'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'Free Tier Test', 'free-test', 'free', 'active'),
    ('00000000-0000-0000-0000-000000000003'::uuid, 'Premium Test', 'premium-test', 'professional', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert test users (password: 'password123' hashed with bcrypt)
INSERT INTO lad_LAD.users (id, email, password_hash, name, role, organization_id, is_active)
VALUES 
    ('00000000-0000-0000-0000-000000000001'::uuid, 'admin@demo.com', '$2a$10$X3LwZ.gKZ7YGz9YQH6XqaOY7J8z9wXrYmJGZ3qE4fJ5tZ7mZ9wZ7m', 'Demo Admin', 'admin', '00000000-0000-0000-0000-000000000001'::uuid, true),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'user@demo.com', '$2a$10$X3LwZ.gKZ7YGz9YQH6XqaOY7J8z9wXrYmJGZ3qE4fJ5tZ7mZ9wZ7m', 'Demo User', 'user', '00000000-0000-0000-0000-000000000001'::uuid, true),
    ('00000000-0000-0000-0000-000000000003'::uuid, 'free@test.com', '$2a$10$X3LwZ.gKZ7YGz9YQH6XqaOY7J8z9wXrYmJGZ3qE4fJ5tZ7mZ9wZ7m', 'Free User', 'user', '00000000-0000-0000-0000-000000000002'::uuid, true),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'premium@test.com', '$2a$10$X3LwZ.gKZ7YGz9YQH6XqaOY7J8z9wXrYmJGZ3qE4fJ5tZ7mZ9wZ7m', 'Premium User', 'user', '00000000-0000-0000-0000-000000000003'::uuid, true)
ON CONFLICT (id) DO NOTHING;

-- Set up credits for test users
INSERT INTO lad_LAD.user_credits (user_id, organization_id, balance, total_purchased)
VALUES 
    ('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 10000.00, 10000.00),
    ('00000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 1000.00, 1000.00),
    ('00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 0.00, 0.00),
    ('00000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 500.00, 500.00)
ON CONFLICT DO NOTHING;

-- Enable Apollo feature for enterprise and professional plans
INSERT INTO lad_LAD.feature_flags (feature_key, organization_id, is_enabled, config)
VALUES 
    ('apollo-leads', '00000000-0000-0000-0000-000000000001'::uuid, true, '{"credits_per_search": 1, "credits_per_email": 1, "credits_per_phone": 8}'::jsonb),
    ('apollo-leads', '00000000-0000-0000-0000-000000000003'::uuid, true, '{"credits_per_search": 1, "credits_per_email": 1, "credits_per_phone": 8}'::jsonb)
ON CONFLICT (feature_key, organization_id, user_id) DO NOTHING;

-- Grant capabilities to test users
INSERT INTO lad_LAD.user_capabilities (user_id, capability_key)
VALUES 
    ('00000000-0000-0000-0000-000000000001'::uuid, 'apollo.search'),
    ('00000000-0000-0000-0000-000000000001'::uuid, 'apollo.email_reveal'),
    ('00000000-0000-0000-0000-000000000001'::uuid, 'apollo.phone_reveal'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'apollo.search'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'apollo.email_reveal'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'apollo.search'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'apollo.email_reveal'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'apollo.phone_reveal')
ON CONFLICT (user_id, capability_key) DO NOTHING;

-- 5. Create updated_at trigger function
CREATE OR REPLACE FUNCTION lad_LAD.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON lad_LAD.users
    FOR EACH ROW EXECUTE FUNCTION lad_LAD.update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON lad_LAD.organizations
    FOR EACH ROW EXECUTE FUNCTION lad_LAD.update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON lad_LAD.user_credits
    FOR EACH ROW EXECUTE FUNCTION lad_LAD.update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON lad_LAD.feature_flags
    FOR EACH ROW EXECUTE FUNCTION lad_LAD.update_updated_at_column();

CREATE TRIGGER update_apollo_companies_updated_at BEFORE UPDATE ON lad_LAD.apollo_companies
    FOR EACH ROW EXECUTE FUNCTION lad_LAD.update_updated_at_column();

CREATE TRIGGER update_apollo_contacts_updated_at BEFORE UPDATE ON lad_LAD.apollo_contacts
    FOR EACH ROW EXECUTE FUNCTION lad_LAD.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON lad_LAD.leads
    FOR EACH ROW EXECUTE FUNCTION lad_LAD.update_updated_at_column();

-- Grant permissions
GRANT USAGE ON SCHEMA lad_LAD TO dbadmin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA lad_LAD TO dbadmin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA lad_LAD TO dbadmin;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ LAD LAD Schema setup complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Created tables:';
    RAISE NOTICE '  - users (with 4 test users)';
    RAISE NOTICE '  - organizations (3 test orgs: demo, free-test, premium-test)';
    RAISE NOTICE '  - user_capabilities';
    RAISE NOTICE '  - user_credits (with test balances)';
    RAISE NOTICE '  - credit_transactions';
    RAISE NOTICE '  - feature_flags (Apollo enabled for enterprise & professional)';
    RAISE NOTICE '  - feature_usage';
    RAISE NOTICE '  - apollo_searches';
    RAISE NOTICE '  - apollo_companies';
    RAISE NOTICE '  - apollo_contacts';
    RAISE NOTICE '  - leads';
    RAISE NOTICE '';
    RAISE NOTICE '👤 Test Users:';
    RAISE NOTICE '  - admin@demo.com (Enterprise plan, 10000 credits)';
    RAISE NOTICE '  - user@demo.com (Enterprise plan, 1000 credits)';
    RAISE NOTICE '  - free@test.com (Free plan, 0 credits)';
    RAISE NOTICE '  - premium@test.com (Professional plan, 500 credits)';
    RAISE NOTICE '  Password for all: password123';
    RAISE NOTICE '';
END $$;
