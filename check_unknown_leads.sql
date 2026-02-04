-- Check the lead data for "Unknown" leads
SELECT 
  cl.id,
  cl.name,
  cl.first_name,
  cl.last_name,
  cl.email,
  cl.title,
  cl.company_name,
  cl.lead_data->>'is_enriched' as is_enriched,
  cl.lead_data->>'enrichment_error' as enrichment_error,
  cl.lead_data->>'source' as source,
  cl.lead_data->>'apollo_person_id' as apollo_person_id,
  cl.lead_data->>'id' as lead_id,
  cl.created_at
FROM lad_dev.campaign_leads cl
WHERE cl.name IS NULL OR cl.name = '' OR cl.first_name IS NULL
ORDER BY cl.created_at DESC
LIMIT 10;
