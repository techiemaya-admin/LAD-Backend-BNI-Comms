-- Follow-Up Calls System Migration
-- Adds columns to lead_bookings table for Cloud Tasks integration
-- Supports idempotency, retry tracking, and execution state management

-- Add follow-up call task columns to lead_bookings table
ALTER TABLE lead_bookings
  -- Cloud Tasks metadata
  ADD COLUMN IF NOT EXISTS task_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS task_scheduled_at TIMESTAMPTZ NULL,
  
  -- Task execution state
  ADD COLUMN IF NOT EXISTS task_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- task_status values: pending | scheduled | executed | cancelled | failed
  
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS execution_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_execution_error TEXT NULL,
  
  -- Idempotency
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255) NULL;

-- Add unique constraint for idempotency (tenant-scoped)
-- This prevents duplicate task executions
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_bookings_idempotency 
  ON lead_bookings(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Add index on task_status for querying pending/failed tasks
CREATE INDEX IF NOT EXISTS idx_lead_bookings_task_status 
  ON lead_bookings(tenant_id, task_status);

-- Add index on scheduled_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_lead_bookings_scheduled_at 
  ON lead_bookings(tenant_id, scheduled_at);

-- Add check constraint for task_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint 
    WHERE conname = 'chk_task_status' 
    AND connamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = current_schema())
  ) THEN
    ALTER TABLE lead_bookings
      ADD CONSTRAINT chk_task_status
      CHECK (task_status IN ('pending', 'scheduled', 'executed', 'cancelled', 'failed'));
  END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN lead_bookings.task_name IS 'Cloud Tasks task name for follow-up call';
COMMENT ON COLUMN lead_bookings.task_scheduled_at IS 'When the Cloud Task is scheduled to run';
COMMENT ON COLUMN lead_bookings.task_status IS 'Task execution state: pending | scheduled | executed | cancelled | failed';
COMMENT ON COLUMN lead_bookings.executed_at IS 'When the follow-up call was actually executed';
COMMENT ON COLUMN lead_bookings.execution_attempts IS 'Number of execution attempts (for retry tracking)';
COMMENT ON COLUMN lead_bookings.last_execution_error IS 'Last error message if execution failed';
COMMENT ON COLUMN lead_bookings.idempotency_key IS 'Unique key for preventing duplicate executions (format: followup:tenantId:bookingId:scheduledAt)';
