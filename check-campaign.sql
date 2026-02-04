-- Check campaign configuration
SELECT 
  id,
  name,
  status,
  campaign_start_date,
  campaign_end_date,
  config,
  created_at
FROM lad_dev.campaigns
WHERE id = 'c066bb18-a707-4ccf-8387-41172414f44d';

-- Check campaign steps (especially linkedin_connect)
SELECT 
  id,
  step_type,
  step_order,
  config,
  delay_amount,
  delay_unit
FROM lad_dev.campaign_steps
WHERE campaign_id = 'c066bb18-a707-4ccf-8387-41172414f44d'
ORDER BY step_order;
