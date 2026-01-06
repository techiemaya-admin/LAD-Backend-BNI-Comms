-- Rollback Migration for Follow-Up Calls System
-- Removes follow-up task columns and constraints from lead_bookings table

-- Drop indexes
DROP INDEX IF EXISTS idx_lead_bookings_idempotency;
DROP INDEX IF EXISTS idx_lead_bookings_task_status;
DROP INDEX IF EXISTS idx_lead_bookings_scheduled_at;

-- Drop constraint
ALTER TABLE lead_bookings
  DROP CONSTRAINT IF EXISTS chk_task_status;

-- Drop columns
ALTER TABLE lead_bookings
  DROP COLUMN IF EXISTS task_name,
  DROP COLUMN IF EXISTS task_scheduled_at,
  DROP COLUMN IF EXISTS task_status,
  DROP COLUMN IF EXISTS executed_at,
  DROP COLUMN IF EXISTS execution_attempts,
  DROP COLUMN IF EXISTS last_execution_error,
  DROP COLUMN IF EXISTS idempotency_key;
