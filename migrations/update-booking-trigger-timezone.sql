-- Update booking trigger to include timezone field
-- This fixes the missing timezone information in booking notifications

-- Recreate the function with timezone field included
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
    
    RAISE NOTICE 'Notification sent for follow-up booking with timezone: % (timezone: %)', NEW.id, NEW.timezone;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;