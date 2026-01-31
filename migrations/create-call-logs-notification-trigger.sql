-- Create trigger to notify on voice_call_logs changes
-- Uses existing notify_calllogs_update() function
-- Sends notifications on INSERT, UPDATE, DELETE operations

-- Create trigger for call logs notifications
CREATE OR REPLACE TRIGGER trigger_notify_call_logs_update
    AFTER INSERT OR UPDATE OR DELETE ON lad_dev.voice_call_logs
    FOR EACH ROW
    EXECUTE FUNCTION notify_calllogs_update();

-- Verify trigger was created
SELECT 
    trigger_name, 
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'lad_dev' 
  AND event_object_table = 'voice_call_logs'
  AND trigger_name = 'trigger_notify_call_logs_update';