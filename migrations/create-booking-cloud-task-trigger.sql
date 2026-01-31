-- Migration: Create trigger to automatically schedule Cloud Tasks for follow-up bookings
-- Purpose: When a booking with follow-up type is inserted, automatically create a Cloud Task
-- This works regardless of which service creates the booking (VOAG or LAD backend)

-- Create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION lad_dev.schedule_followup_cloud_task()
RETURNS TRIGGER AS $$
DECLARE
  followup_types TEXT[] := ARRAY['follow_up', 'follow-up', 'auto-follow-up', 'followup', 
                                  'auto_follow_up', 'auto_followup', 'manual_followup', 
                                  'manual_follow_up', 'scheduled_call'];
BEGIN
  -- Check if this booking type requires a follow-up Cloud Task
  IF LOWER(NEW.booking_type) = ANY(followup_types) AND NEW.task_status = 'pending' THEN
    -- Call the backend API endpoint to schedule the Cloud Task
    -- Using pg_notify to send a notification that our backend will listen to
    PERFORM pg_notify(
      'booking_followup_created',
      json_build_object(
        'booking_id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'lead_id', NEW.lead_id,
        'assigned_user_id', NEW.assigned_user_id,
        'scheduled_at', NEW.scheduled_at,
        'timezone', NEW.timezone,
        'booking_type', NEW.booking_type,
        'created_at', NEW.created_at
      )::text
    );
    
    RAISE NOTICE 'Notification sent for follow-up booking: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires AFTER INSERT on lead_bookings
DROP TRIGGER IF EXISTS trigger_schedule_followup_cloud_task ON lad_dev.lead_bookings;

CREATE TRIGGER trigger_schedule_followup_cloud_task
  AFTER INSERT ON lad_dev.lead_bookings
  FOR EACH ROW
  EXECUTE FUNCTION lad_dev.schedule_followup_cloud_task();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION lad_dev.schedule_followup_cloud_task() TO dbadmin;

COMMENT ON FUNCTION lad_dev.schedule_followup_cloud_task() IS 
  'Automatically notifies backend to schedule Cloud Task when follow-up booking is created';
COMMENT ON TRIGGER trigger_schedule_followup_cloud_task ON lad_dev.lead_bookings IS 
  'Triggers Cloud Task scheduling for follow-up bookings regardless of which service creates them';
