SELECT feature_key, is_enabled, config, updated_at
FROM feature_flags
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid
ORDER BY feature_key;
