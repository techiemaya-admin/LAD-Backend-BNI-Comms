-- Rollback Migration: Drop Unified Communications Tables
-- Version: 001_rollback
-- Date: 2026-01-31

-- Drop triggers first
DROP TRIGGER IF EXISTS conversation_ai_insights_updated_at_trigger ON conversation_ai_insights;
DROP TRIGGER IF EXISTS conversations_updated_at_trigger ON conversations;

-- Drop trigger functions
DROP FUNCTION IF EXISTS update_conversation_ai_insights_updated_at();
DROP FUNCTION IF EXISTS update_conversations_updated_at();

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS conversation_ai_insights CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
