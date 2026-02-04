-- Check current user
SELECT id, email, password, created_at, updated_at 
FROM lad_dev.users 
WHERE id = '63cdd4e8-76ed-4cce-b56e-af348287ad16';

-- Update password
UPDATE lad_dev.users 
SET password = '$2b$10$MYg0APIsogJy4HhW7Mfkb.f5RptW7PsI2BSE92XfM3gUtRXUxmAWy', 
    updated_at = CURRENT_TIMESTAMP 
WHERE id = '63cdd4e8-76ed-4cce-b56e-af348287ad16';

-- Verify update
SELECT id, email, password, updated_at 
FROM lad_dev.users 
WHERE id = '63cdd4e8-76ed-4cce-b56e-af348287ad16';
