# BNI Network Data Migration Guide

## Overview

This guide provides step-by-step instructions for migrating BNI Rising Phoenix network data from the Excel analysis file to the LAD Community ROI feature database schema.

**Date**: February 11, 2026  
**Tenant**: BNI Rising Phoenix  
**Tenant ID**: `9ca4012a-2e02-5593-8cc1-fd5bd81483f9`

---

## Migration Summary

### Data Extracted

- **Members**: 93 unique members from BNI Rising Phoenix network
- **Interactions**: 1,215 one-to-one meeting records
- **Referrals**: 1,550 referral transactions

### Source Data

**Excel File**: `POC-Sample/BNI_Rising_Phoenix_analysis_2025-04_to_2025-12.xlsx`

**Sheets Used**:
- `Combination Matrix` - Member listings and interaction data
- `One-to-One Matrix` - One-to-one meeting records between pairs
- `Referral Matrix` - Referral data between members

### Target Schema

**Database**: `lad_dev` (PostgreSQL)  
**Tables**:
- `lad_dev.community_roi_members` - Member profiles
- `lad_dev.community_roi_interactions` - One-to-one meetings
- `lad_dev.community_roi_referrals` - Referral transactions
- `lad_core.tenants` - Tenant record (auto-created)

---

## Prerequisites

### System Requirements

```bash
# Check PostgreSQL is installed
psql --version
# Expected: psql (PostgreSQL) 13+

# Check Python 3 is available
python3 --version
# Expected: Python 3.8+
```

### Database Access

```bash
# Verify database exists
psql -U postgres -d lad_dev -c "SELECT version();"

# Expected output: PostgreSQL version info
```

### Python Dependencies

```bash
# Ensure openpyxl is installed
python3 -m pip install openpyxl

# Or using system package manager
# macOS: brew install python3-openpyxl
# Ubuntu: apt-get install python3-openpyxl
```

---

## Migration Process

### Step 1: Generate Migration SQL

The migration script parses the Excel file and generates SQL statements.

```bash
cd backend/scripts
python3 migrate_bni_data.py
```

**Expected Output**:
```
🚀 Starting BNI Network Data Migration
   Tenant ID: 9ca4012a-2e02-5593-8cc1-fd5bd81483f9
   Network: BNI Rising Phoenix

✓ Loaded workbook
✓ Extracted 93 members
✓ Extracted 1215 interactions
✓ Extracted 1550 referrals

✓ Generated SQL file: migrate_bni_data.sql
  Total statements: 2858

✅ Migration preparation complete!
```

**Output Files**:
- `migrate_bni_data.sql` - Generated SQL migration script

### Step 2: Review Generated SQL

```bash
# View first 50 lines
head -50 migrate_bni_data.sql

# View specific section (members)
grep "INSERT INTO lad_dev.community_roi_members" migrate_bni_data.sql | head -5

# Count statements
grep "INSERT INTO" migrate_bni_data.sql | wc -l
```

### Step 3: Execute Migration

#### Option A: Using Helper Script (Recommended)

```bash
./run_migration.sh
```

This script will:
1. Verify the SQL file exists
2. Check database connectivity
3. Display migration statistics
4. Prompt for confirmation
5. Execute the migration
6. Create a timestamped log file

#### Option B: Direct psql Command

```bash
psql -U postgres -d lad_dev -f migrate_bni_data.sql
```

#### Option C: Manual Execution

```bash
# Connect to database
psql -U postgres -d lad_dev

# Run migration from psql prompt
\i migrate_bni_data.sql

# Exit
\q
```

### Step 4: Verify Migration

After successful execution, verify the data was inserted:

```bash
# Check member count
psql -U postgres -d lad_dev -c "
SELECT COUNT(*) as member_count 
FROM lad_dev.community_roi_members 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;"
# Expected: 93

# Check interaction count
psql -U postgres -d lad_dev -c "
SELECT COUNT(*) as interaction_count 
FROM lad_dev.community_roi_interactions 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;"
# Expected: 1215

# Check referral count
psql -U postgres -d lad_dev -c "
SELECT COUNT(*) as referral_count 
FROM lad_dev.community_roi_referrals 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;"
# Expected: 1550

# Sample members
psql -U postgres -d lad_dev -c "
SELECT id, name, network_group 
FROM lad_dev.community_roi_members 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid 
LIMIT 5;"
```

---

## Data Mapping

### Members Table

| Column | Source | Value |
|--------|--------|-------|
| `id` | Generated | UUID |
| `tenant_id` | Fixed | `9ca4012a-2e02-5593-8cc1-fd5bd81483f9` |
| `name` | Excel | Member name (from matrix row/column headers) |
| `company_name` | Default | Empty string (not in Excel) |
| `designation` | Default | Empty string (not in Excel) |
| `industry` | Default | Empty string (not in Excel) |
| `network_group` | Fixed | `BNI Rising Phoenix` |
| `total_one_to_ones` | Default | 0 (calculated separately) |
| `total_referrals_given` | Default | 0 (calculated separately) |
| `total_referrals_received` | Default | 0 (calculated separately) |
| `total_business_inside_aed` | Default | 0 |
| `total_business_outside_aed` | Default | 0 |
| `metadata` | Default | `{}` |
| `is_deleted` | Default | `false` |
| `created_at` | Default | `NOW()` |
| `updated_at` | Default | `NOW()` |

### Interactions Table

| Column | Source | Logic |
|--------|--------|-------|
| `id` | Generated | UUID |
| `tenant_id` | Fixed | `9ca4012a-2e02-5593-8cc1-fd5bd81483f9` |
| `member_a_id` | Excel | Row member UUID |
| `member_b_id` | Excel | Column member UUID |
| `meeting_month` | Default | `2025-09` (middle of range) |
| `meeting_count` | Excel | One-to-One Matrix value |
| `metadata` | Default | `{}` |
| `is_deleted` | Default | `false` |

### Referrals Table

| Column | Source | Logic |
|--------|--------|-------|
| `id` | Generated | UUID |
| `tenant_id` | Fixed | `9ca4012a-2e02-5593-8cc1-fd5bd81483f9` |
| `referred_by_id` | Excel | Row member UUID |
| `referred_to_id` | Excel | Column member UUID |
| `referral_month` | Default | `2025-09` |
| `referral_count` | Excel | Referral Matrix value |
| `business_type` | Default | `Network Business` |
| `estimated_value_aed` | Default | `NULL` |
| `metadata` | Default | `{}` |
| `is_deleted` | Default | `false` |

---

## Troubleshooting

### Issue: SQL File Not Generated

**Solution**:
```bash
# Check if Excel file exists
ls -la ../../POC-Sample/BNI_Rising_Phoenix_analysis_2025-04_to_2025-12.xlsx

# Check Python dependencies
python3 -c "import openpyxl; print(openpyxl.__version__)"

# Run with verbose output
python3 -u migrate_bni_data.py
```

### Issue: Database Connection Failed

**Solution**:
```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Check database exists
psql -U postgres -l | grep lad_dev

# Verify user has permissions
psql -U postgres -d lad_dev -c "SELECT 1"
```

### Issue: Migration Failed Midway

**Solution**:
```bash
# Check what was inserted
psql -U postgres -d lad_dev -c "SELECT COUNT(*) FROM lad_dev.community_roi_members WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;"

# Rollback and retry (if transaction was used)
# The script uses BEGIN TRANSACTION; ... COMMIT; so either all succeeds or all fails

# Check log file
cat migration_*.log
```

### Issue: Duplicate Key Errors

**Solution**:
```bash
# Check if data already exists
psql -U postgres -d lad_dev -c "
SELECT COUNT(*) FROM lad_dev.community_roi_members 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;"

# If yes, delete old data first
DELETE FROM lad_dev.community_roi_referrals WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;
DELETE FROM lad_dev.community_roi_interactions WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;
DELETE FROM lad_dev.community_roi_members WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;

# Then retry migration
psql -U postgres -d lad_dev -f migrate_bni_data.sql
```

---

## Validation Queries

### Verify Data Integrity

```bash
# 1. Check all members have unique names
psql -U postgres -d lad_dev -c "
SELECT COUNT(DISTINCT name), COUNT(*) 
FROM lad_dev.community_roi_members 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;"
# Both counts should be 93

# 2. Check no invalid foreign keys
psql -U postgres -d lad_dev -c "
SELECT COUNT(*) FROM lad_dev.community_roi_interactions i
WHERE i.member_a_id NOT IN (SELECT id FROM lad_dev.community_roi_members)
AND i.tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;"
# Should be 0

# 3. Check for self-interactions (invalid)
psql -U postgres -d lad_dev -c "
SELECT COUNT(*) FROM lad_dev.community_roi_interactions
WHERE member_a_id = member_b_id
AND tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;"
# Should be 0

# 4. Sample member details
psql -U postgres -d lad_dev -c "
SELECT 
  id, name, network_group, 
  total_one_to_ones, total_referrals_given, total_referrals_received
FROM lad_dev.community_roi_members
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid
LIMIT 10;"
```

---

## Next Steps After Migration

### 1. Calculate Contribution Scores

```bash
# Run contribution score calculations for all members
psql -U postgres -d lad_dev -c "
INSERT INTO lad_dev.community_roi_contribution_scores 
(id, tenant_id, member_id, total_oto, unique_oto_partners, total_referrals_given, 
 total_referrals_received, inside_network_business_aed, outside_network_business_aed,
 total_business_aed, avg_referrals_per_month, avg_value_per_referral_aed, calculated_at)
SELECT 
  gen_random_uuid(), m.tenant_id, m.id,
  COALESCE(m.total_one_to_ones, 0),
  0,  -- unique_oto_partners - calculate separately if needed
  COALESCE(m.total_referrals_given, 0),
  COALESCE(m.total_referrals_received, 0),
  0, 0, 0,
  0, 0, NOW()
FROM lad_dev.community_roi_members m
WHERE m.tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid
AND NOT EXISTS (
  SELECT 1 FROM lad_dev.community_roi_contribution_scores cs
  WHERE cs.member_id = m.id AND cs.tenant_id = m.tenant_id
);"
```

### 2. Build Relationship Scores

```bash
# Materialize relationship scores from interaction and referral data
# This requires executing the database views/functions
```

### 3. Test Frontend Integration

```bash
# Start backend server on port 3004
cd backend && npm start

# Verify API endpoints work with BNI data
curl http://localhost:3004/api/community-roi/members \
  -H "X-Tenant-Id: 9ca4012a-2e02-5593-8cc1-fd5bd81483f9" \
  -H "Authorization: Bearer <token>"

# Expected: List of 93 BNI members
```

### 4. Refresh Materialized Views

```bash
# Refresh performance views
psql -U postgres -d lad_dev -c "
REFRESH MATERIALIZED VIEW CONCURRENTLY lad_dev.mv_community_roi_member_analytics;
REFRESH MATERIALIZED VIEW CONCURRENTLY lad_dev.mv_community_roi_relationship_matrix;"
```

---

## Rollback Procedure

If you need to remove the migrated data:

```bash
# Delete all BNI data
psql -U postgres -d lad_dev << 'SQL'
BEGIN TRANSACTION;

DELETE FROM lad_dev.community_roi_referrals 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;

DELETE FROM lad_dev.community_roi_interactions 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;

DELETE FROM lad_dev.community_roi_members 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;

DELETE FROM lad_dev.community_roi_relationship_scores 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;

DELETE FROM lad_dev.community_roi_contribution_scores 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;

DELETE FROM lad_dev.community_roi_events 
WHERE tenant_id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;

-- Optionally delete tenant
DELETE FROM lad_core.tenants 
WHERE id = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9'::uuid;

COMMIT;
SQL
```

---

## Support & Questions

For issues or questions regarding this migration:

1. Check the [troubleshooting section](#troubleshooting) above
2. Review the generated SQL file: `migrate_bni_data.sql`
3. Check migration logs: `migration_*.log`
4. Review [ARCHITECTURE.md](../../../Docs/ARCHITECTURE.md) for schema details

---

## Files in This Directory

| File | Purpose |
|------|---------|
| `migrate_bni_data.py` | Python script to parse Excel and generate SQL |
| `migrate_bni_data.sql` | Generated SQL migration script (created by Python script) |
| `run_migration.sh` | Interactive bash script to execute migration |
| `MIGRATION_GUIDE.md` | This file |

---

**Last Updated**: February 11, 2026  
**Version**: 1.0
