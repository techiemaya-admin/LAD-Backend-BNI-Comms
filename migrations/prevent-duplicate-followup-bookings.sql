-- Prevent rapid duplicate follow-up bookings for the same lead
-- This allows multiple legitimate follow-ups at different times
-- but prevents system errors that create duplicates within short time windows

-- Prevent duplicate bookings with same scheduled time (within 1 minute window)  
-- This allows multiple callbacks but prevents system glitches creating identical bookings
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_bookings_prevent_rapid_duplicates
ON lad_dev.lead_bookings (tenant_id, lead_id, date_trunc('minute', scheduled_at))
WHERE booking_type IN ('auto_followup', 'manual_followup', 'follow_up', 'scheduled_followup')
  AND task_status IN ('pending', 'scheduled')
  AND status IN ('scheduled', 'confirmed');

COMMENT ON INDEX idx_lead_bookings_prevent_rapid_duplicates IS 
'Prevents duplicate follow-up bookings for same lead within the same minute while allowing legitimate multiple callbacks at different times';