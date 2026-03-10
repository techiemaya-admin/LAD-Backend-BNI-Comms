-- Update community_roi_relationship_scores with meeting and referral data
-- This script calculates combination_type and updates counts based on interactions and referrals

-- Step 1: Reset counts and combination_type
UPDATE ${schema}.community_roi_relationship_scores
SET 
  one_to_one_count = 0,
  referral_count = 0,
  both_count = 0,
  combination_type = NULL,
  updated_at = NOW()
WHERE tenant_id = $1;

-- Step 2: Update with Meeting data (M)
-- Only meetings, no referrals
WITH meeting_pairs AS (
  SELECT 
    i.tenant_id,
    i.member_a_id,
    i.member_b_id,
    COUNT(*) as meeting_count
  FROM ${schema}.community_roi_interactions i
  WHERE 
    i.tenant_id = $1
    AND i.interaction_type = 'meeting'
    AND i.is_deleted = false
  GROUP BY i.tenant_id, i.member_a_id, i.member_b_id
),
referral_check AS (
  SELECT DISTINCT
    r.tenant_id,
    r.referred_by_id as member_a_id,
    r.referred_to_id as member_b_id
  FROM ${schema}.community_roi_referrals r
  WHERE 
    r.tenant_id = $1
    AND r.is_deleted = false
)
UPDATE ${schema}.community_roi_relationship_scores rs
SET 
  one_to_one_count = mp.meeting_count,
  combination_type = 'M',
  color_code = '#EF4444', -- Red for Meeting only
  updated_at = NOW()
FROM meeting_pairs mp
WHERE 
  rs.tenant_id = mp.tenant_id
  AND rs.member_a_id = mp.member_a_id
  AND rs.member_b_id = mp.member_b_id
  AND NOT EXISTS (
    SELECT 1 FROM referral_check rc
    WHERE rc.tenant_id = mp.tenant_id
      AND rc.member_a_id = mp.member_a_id
      AND rc.member_b_id = mp.member_b_id
  );

-- Step 3: Update with Referral data only (R)
-- Only referrals, no meetings
WITH referral_pairs AS (
  SELECT 
    r.tenant_id,
    r.referred_by_id as member_a_id,
    r.referred_to_id as member_b_id,
    COUNT(*) as referral_count
  FROM ${schema}.community_roi_referrals r
  WHERE 
    r.tenant_id = $1
    AND r.is_deleted = false
  GROUP BY r.tenant_id, r.referred_by_id, r.referred_to_id
),
meeting_check AS (
  SELECT DISTINCT
    i.tenant_id,
    i.member_a_id,
    i.member_b_id
  FROM ${schema}.community_roi_interactions i
  WHERE 
    i.tenant_id = $1
    AND i.interaction_type = 'meeting'
    AND i.is_deleted = false
)
UPDATE ${schema}.community_roi_relationship_scores rs
SET 
  referral_count = rp.referral_count,
  combination_type = 'R',
  color_code = '#EAB308', -- Yellow for Referral only
  updated_at = NOW()
FROM referral_pairs rp
WHERE 
  rs.tenant_id = rp.tenant_id
  AND rs.member_a_id = rp.member_a_id
  AND rs.member_b_id = rp.member_b_id
  AND NOT EXISTS (
    SELECT 1 FROM meeting_check mc
    WHERE mc.tenant_id = rp.tenant_id
      AND mc.member_a_id = rp.member_a_id
      AND mc.member_b_id = rp.member_b_id
  );

-- Step 4: Update with Both Meeting and Referral (MR)
WITH meeting_data AS (
  SELECT 
    i.tenant_id,
    i.member_a_id,
    i.member_b_id,
    COUNT(*) as meeting_count
  FROM ${schema}.community_roi_interactions i
  WHERE 
    i.tenant_id = $1
    AND i.interaction_type = 'meeting'
    AND i.is_deleted = false
  GROUP BY i.tenant_id, i.member_a_id, i.member_b_id
),
referral_data AS (
  SELECT 
    r.tenant_id,
    r.referred_by_id as member_a_id,
    r.referred_to_id as member_b_id,
    COUNT(*) as referral_count
  FROM ${schema}.community_roi_referrals r
  WHERE 
    r.tenant_id = $1
    AND r.is_deleted = false
  GROUP BY r.tenant_id, r.referred_by_id, r.referred_to_id
),
both_pairs AS (
  SELECT 
    m.tenant_id,
    m.member_a_id,
    m.member_b_id,
    m.meeting_count,
    r.referral_count,
    (m.meeting_count + r.referral_count) as total_count
  FROM meeting_data m
  INNER JOIN referral_data r
    ON m.tenant_id = r.tenant_id
    AND m.member_a_id = r.member_a_id
    AND m.member_b_id = r.member_b_id
)
UPDATE ${schema}.community_roi_relationship_scores rs
SET 
  one_to_one_count = bp.meeting_count,
  referral_count = bp.referral_count,
  both_count = bp.total_count,
  combination_type = 'MR',
  color_code = '#10B981', -- Green for Both
  updated_at = NOW()
FROM both_pairs bp
WHERE 
  rs.tenant_id = bp.tenant_id
  AND rs.member_a_id = bp.member_a_id
  AND rs.member_b_id = bp.member_b_id;

-- Step 5: Insert missing relationship pairs
-- Create relationship scores for pairs that don't exist yet
INSERT INTO ${schema}.community_roi_relationship_scores (
  tenant_id,
  member_a_id,
  member_b_id,
  one_to_one_count,
  referral_count,
  both_count,
  combination_type,
  color_code,
  created_at,
  updated_at
)
SELECT DISTINCT
  i.tenant_id,
  i.member_a_id,
  i.member_b_id,
  0,
  0,
  0,
  NULL,
  NULL,
  NOW(),
  NOW()
FROM ${schema}.community_roi_interactions i
WHERE 
  i.tenant_id = $1
  AND i.is_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM ${schema}.community_roi_relationship_scores rs
    WHERE rs.tenant_id = i.tenant_id
      AND rs.member_a_id = i.member_a_id
      AND rs.member_b_id = i.member_b_id
  )
ON CONFLICT (tenant_id, member_a_id, member_b_id) DO NOTHING;

-- Return summary
SELECT 
  combination_type,
  color_code,
  COUNT(*) as pair_count,
  SUM(one_to_one_count) as total_meetings,
  SUM(referral_count) as total_referrals,
  SUM(both_count) as total_both
FROM ${schema}.community_roi_relationship_scores
WHERE tenant_id = $1
GROUP BY combination_type, color_code
ORDER BY combination_type;
