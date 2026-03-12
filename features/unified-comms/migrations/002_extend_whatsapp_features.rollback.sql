/**
 * 002_extend_whatsapp_features.rollback.sql
 * Rollback migration for WhatsApp feature extension
 * Safely drops all WhatsApp-specific tables and triggers
 */

-- Drop triggers first (dependencies)
DROP TRIGGER IF EXISTS group_contacts_timestamp_trigger ON whatsapp_group_contacts;
DROP FUNCTION IF EXISTS update_group_contacts_timestamp();

DROP TRIGGER IF EXISTS forwarding_records_timestamp_trigger ON whatsapp_forwarding_records;
DROP FUNCTION IF EXISTS update_forwarding_records_timestamp();

DROP TRIGGER IF EXISTS forwarding_rules_timestamp_trigger ON whatsapp_forwarding_rules;
DROP FUNCTION IF EXISTS update_forwarding_rules_timestamp();

DROP TRIGGER IF EXISTS broadcast_contacts_timestamp_trigger ON whatsapp_broadcast_contacts;
DROP FUNCTION IF EXISTS update_broadcast_contacts_timestamp();

DROP TRIGGER IF EXISTS broadcasts_timestamp_trigger ON whatsapp_broadcasts;
DROP FUNCTION IF EXISTS update_broadcasts_timestamp();

-- Drop tables (foreign key constraints handled by ON DELETE CASCADE)
DROP TABLE IF EXISTS whatsapp_group_contacts;
DROP TABLE IF EXISTS whatsapp_forwarding_records;
DROP TABLE IF EXISTS whatsapp_forwarding_rules;
DROP TABLE IF EXISTS whatsapp_broadcast_contacts;
DROP TABLE IF EXISTS whatsapp_broadcasts;

-- ============================================================================
-- ROLLBACK COMPLETE
-- All WhatsApp-specific tables, indexes, and triggers removed
-- Core unified-communications tables remain intact
-- ============================================================================
