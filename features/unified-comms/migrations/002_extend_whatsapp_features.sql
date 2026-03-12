/**
 * 002_extend_whatsapp_features.sql
 * Extends core unified-communications tables with WhatsApp-specific features:
 * - Broadcasting: Campaign management and contact tracking
 * - Message Forwarding: Rules and forwarding records
 * - Group Contacts: Member group contact synchronization
 * 
 * All tables maintain tenant isolation and follow LAD architecture patterns
 */

-- ============================================================================
-- BROADCAST FEATURE TABLES
-- ============================================================================

/**
 * whatsapp_broadcasts
 * Tracks broadcast campaigns sent to multiple contacts
 */
CREATE TABLE IF NOT EXISTS whatsapp_broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES lad_dev.tenants(id) ON DELETE CASCADE,
  campaign_id VARCHAR(255),
  contact_phone_numbers TEXT[] NOT NULL, -- Array of phone numbers
  message_content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- text, image, document, template
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional data: campaign info, tracking params
  created_by_user_id UUID,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false
);

CREATE INDEX idx_broadcasts_tenant_id ON whatsapp_broadcasts(tenant_id);
CREATE INDEX idx_broadcasts_campaign_id ON whatsapp_broadcasts(tenant_id, campaign_id);
CREATE INDEX idx_broadcasts_status ON whatsapp_broadcasts(tenant_id, status);
CREATE INDEX idx_broadcasts_created_by ON whatsapp_broadcasts(created_by_user_id);
CREATE INDEX idx_broadcasts_created_at ON whatsapp_broadcasts(created_at DESC);

/**
 * whatsapp_broadcast_contacts
 * Tracks delivery status for each contact in a broadcast campaign
 */
CREATE TABLE IF NOT EXISTS whatsapp_broadcast_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES lad_dev.tenants(id) ON DELETE CASCADE,
  broadcast_id UUID NOT NULL REFERENCES whatsapp_broadcasts(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, failed, read
  message_id VARCHAR(255), -- WhatsApp message ID
  sent_at TIMESTAMP WITH TIME ZONE,
  error TEXT, -- Error message if delivery failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(broadcast_id, phone_number)
);

CREATE INDEX idx_broadcast_contacts_tenant_id ON whatsapp_broadcast_contacts(tenant_id);
CREATE INDEX idx_broadcast_contacts_broadcast_id ON whatsapp_broadcast_contacts(broadcast_id);
CREATE INDEX idx_broadcast_contacts_status ON whatsapp_broadcast_contacts(status);

-- ============================================================================
-- MESSAGE FORWARDING FEATURE TABLES
-- ============================================================================

/**
 * whatsapp_forwarding_rules
 * Defines forwarding rules: messages from admin group forwarded to member groups
 */
CREATE TABLE IF NOT EXISTS whatsapp_forwarding_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES lad_dev.tenants(id) ON DELETE CASCADE,
  admin_group_id VARCHAR(255) NOT NULL, -- WhatsApp group ID
  member_group_ids TEXT[] NOT NULL, -- Array of member group IDs
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb, -- Rule config: filters, exclusions, etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false,
  UNIQUE(tenant_id, admin_group_id)
);

CREATE INDEX idx_forwarding_rules_tenant_id ON whatsapp_forwarding_rules(tenant_id);
CREATE INDEX idx_forwarding_rules_admin_group ON whatsapp_forwarding_rules(tenant_id, admin_group_id);
CREATE INDEX idx_forwarding_rules_enabled ON whatsapp_forwarding_rules(enabled);

/**
 * whatsapp_forwarding_records
 * Audit log for each message forwarded via a rule
 */
CREATE TABLE IF NOT EXISTS whatsapp_forwarding_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES lad_dev.tenants(id) ON DELETE CASCADE,
  forwarding_rule_id UUID NOT NULL REFERENCES whatsapp_forwarding_rules(id) ON DELETE CASCADE,
  admin_group_id VARCHAR(255) NOT NULL,
  member_group_id VARCHAR(255) NOT NULL,
  original_message_id VARCHAR(255) NOT NULL, -- Original message in admin group
  forwarded_message_id VARCHAR(255), -- Forwarded message in member group
  status VARCHAR(50) DEFAULT 'pending', -- pending, forwarded, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_forwarding_records_tenant_id ON whatsapp_forwarding_records(tenant_id);
CREATE INDEX idx_forwarding_records_rule_id ON whatsapp_forwarding_records(forwarding_rule_id);
CREATE INDEX idx_forwarding_records_admin_group ON whatsapp_forwarding_records(admin_group_id);
CREATE INDEX idx_forwarding_records_member_group ON whatsapp_forwarding_records(member_group_id);
CREATE INDEX idx_forwarding_records_status ON whatsapp_forwarding_records(status);

-- ============================================================================
-- GROUP CONTACT SYNCHRONIZATION TABLE
-- ============================================================================

/**
 * whatsapp_group_contacts
 * Maintains synchronized contact lists for member groups
 * Used to identify which contacts to forward messages to
 */
CREATE TABLE IF NOT EXISTS whatsapp_group_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES lad_dev.tenants(id) ON DELETE CASCADE,
  member_group_id VARCHAR(255) NOT NULL,
  phone_numbers TEXT[] NOT NULL, -- Array of member phone numbers
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, member_group_id)
);

CREATE INDEX idx_group_contacts_tenant_id ON whatsapp_group_contacts(tenant_id);
CREATE INDEX idx_group_contacts_member_group ON whatsapp_group_contacts(member_group_id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_broadcasts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcasts_timestamp_trigger
BEFORE UPDATE ON whatsapp_broadcasts
FOR EACH ROW
EXECUTE FUNCTION update_broadcasts_timestamp();

CREATE OR REPLACE FUNCTION update_broadcast_contacts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcast_contacts_timestamp_trigger
BEFORE UPDATE ON whatsapp_broadcast_contacts
FOR EACH ROW
EXECUTE FUNCTION update_broadcast_contacts_timestamp();

CREATE OR REPLACE FUNCTION update_forwarding_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER forwarding_rules_timestamp_trigger
BEFORE UPDATE ON whatsapp_forwarding_rules
FOR EACH ROW
EXECUTE FUNCTION update_forwarding_rules_timestamp();

CREATE OR REPLACE FUNCTION update_group_contacts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER group_contacts_timestamp_trigger
BEFORE UPDATE ON whatsapp_group_contacts
FOR EACH ROW
EXECUTE FUNCTION update_group_contacts_timestamp();

-- ============================================================================
-- SUMMARY OF NEW TABLES AND INDEXES (5 tables, 14 indexes)
-- ============================================================================
-- Tables:
--   1. whatsapp_broadcasts (6 indexes)
--   2. whatsapp_broadcast_contacts (3 indexes)
--   3. whatsapp_forwarding_rules (3 indexes)
--   4. whatsapp_forwarding_records (5 indexes)
--   5. whatsapp_group_contacts (2 indexes)
-- Total indexes added: 19
-- Total indexes in unified-communications: 38 (19 core + 19 WhatsApp)
-- ============================================================================
