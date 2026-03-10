-- Migration: Create Unified Communications Tables
-- Version: 001
-- Date: 2026-01-31
-- Description: Create core tables for omni-channel conversations

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  lead_id UUID,
  campaign_id UUID,
  channel VARCHAR(30) NOT NULL CHECK (channel IN ('linkedin', 'whatsapp', 'email', 'instagram', 'voice')),
  external_thread_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived', 'pending')),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_thread_per_tenant UNIQUE (tenant_id, channel, external_thread_id)
);

-- Create indexes on conversations
CREATE INDEX idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX idx_conversations_tenant_lead ON conversations(tenant_id, lead_id);
CREATE INDEX idx_conversations_tenant_campaign ON conversations(tenant_id, campaign_id);
CREATE INDEX idx_conversations_tenant_channel ON conversations(tenant_id, channel);
CREATE INDEX idx_conversations_last_message_at ON conversations(tenant_id, last_message_at DESC);
CREATE INDEX idx_conversations_status ON conversations(tenant_id, status) WHERE is_deleted = false;
CREATE INDEX idx_conversations_external_thread ON conversations(tenant_id, external_thread_id);

-- Create conversation_messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('lead', 'ai', 'user', 'system')),
  sender_id UUID,
  channel VARCHAR(30) NOT NULL CHECK (channel IN ('linkedin', 'whatsapp', 'email', 'instagram', 'voice')),
  message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('text', 'voice', 'attachment', 'image', 'video')),
  content TEXT,
  content_html TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  provider_message_id VARCHAR(255),
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_conversation_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT unique_provider_message UNIQUE (tenant_id, channel, provider_message_id)
);

-- Create indexes on conversation_messages
CREATE INDEX idx_conversation_messages_tenant_id ON conversation_messages(tenant_id);
CREATE INDEX idx_conversation_messages_conversation ON conversation_messages(tenant_id, conversation_id);
CREATE INDEX idx_conversation_messages_sender ON conversation_messages(conversation_id, sender_type);
CREATE INDEX idx_conversation_messages_created_at ON conversation_messages(conversation_id, created_at DESC);
CREATE INDEX idx_conversation_messages_ai_generated ON conversation_messages(conversation_id, ai_generated);
CREATE INDEX idx_conversation_messages_provider_message ON conversation_messages(tenant_id, channel, provider_message_id);

-- Create conversation_participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  participant_type VARCHAR(20) NOT NULL CHECK (participant_type IN ('lead', 'user', 'ai')),
  participant_id UUID,
  participant_email VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_conversation_participants_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT unique_participant UNIQUE (conversation_id, participant_type, participant_id)
);

-- Create indexes on conversation_participants
CREATE INDEX idx_conversation_participants_tenant_id ON conversation_participants(tenant_id);
CREATE INDEX idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_participant ON conversation_participants(participant_type, participant_id);

-- Create conversation_ai_insights table
CREATE TABLE IF NOT EXISTS conversation_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
  intent VARCHAR(50),
  lead_score NUMERIC(5, 2),
  summary TEXT,
  extracted_entities JSONB DEFAULT '{}',
  key_topics JSONB DEFAULT '{}',
  recommended_action VARCHAR(255),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_conversation_ai_insights_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Create indexes on conversation_ai_insights
CREATE INDEX idx_conversation_ai_insights_tenant_id ON conversation_ai_insights(tenant_id);
CREATE INDEX idx_conversation_ai_insights_conversation ON conversation_ai_insights(conversation_id);
CREATE INDEX idx_conversation_ai_insights_sentiment ON conversation_ai_insights(tenant_id, sentiment);
CREATE INDEX idx_conversation_ai_insights_created_at ON conversation_ai_insights(conversation_id, created_at DESC);

-- Create trigger function to auto-update updated_at on conversations
CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update conversations.updated_at
CREATE TRIGGER conversations_updated_at_trigger
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_conversations_updated_at();

-- Create trigger function to auto-update updated_at on conversation_ai_insights
CREATE OR REPLACE FUNCTION update_conversation_ai_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update conversation_ai_insights.updated_at
CREATE TRIGGER conversation_ai_insights_updated_at_trigger
BEFORE UPDATE ON conversation_ai_insights
FOR EACH ROW
EXECUTE FUNCTION update_conversation_ai_insights_updated_at();
