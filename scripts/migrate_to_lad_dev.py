#!/usr/bin/env python3
"""
LAD Community ROI Data Migration Script

Loads BNI network data from Excel workbook into lad_dev.community_roi_* tables
following LAD architecture patterns.

Supports:
- Multi-tenant data isolation (tenant_id)
- Proper metadata defaults
- Soft deletes (is_deleted flag)
- Standardized timestamps (created_at, updated_at)
"""

import pandas as pd
import json
from datetime import datetime
from uuid import uuid4
from pathlib import Path

# ============================================================================
# CONFIGURATION
# ============================================================================

TENANT_ID = "9ca4012a-2e02-5593-8cc1-fd5bd81483f9"  # BNI Rising Phoenix
NETWORK_NAME = "BNI Rising Phoenix"

# Excel file location
EXCEL_FILE = Path(__file__).parent.parent.parent / "POC-Sample" / "BNI_Rising_Phoenix_analysis_2025-04_to_2025-12.xlsx"

# Output SQL file
OUTPUT_SQL_FILE = Path(__file__).parent / "migrate_to_lad_dev.sql"

# Data year range (from filename)
PERIOD_START = "2025-04"
PERIOD_END = "2025-12"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def escape_sql_string(value):
    """Escape string for SQL insertion."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "NULL"
    value_str = str(value).strip()
    # Escape single quotes by doubling them
    escaped = value_str.replace("'", "''")
    return f"'{escaped}'"


def generate_uuid():
    """Generate a new UUID for records."""
    return str(uuid4())


def get_current_timestamp():
    """Get current timestamp in PostgreSQL format."""
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


# ============================================================================
# DATA EXTRACTION FUNCTIONS
# ============================================================================

def extract_members_from_excel(excel_file):
    """
    Extract member data from Excel workbook.
    
    Returns:
        dict: {member_name: {company, designation, industry, ...}}
    """
    print("📖 Extracting members from Excel...")
    
    members = {}
    
    # Try to read from Combination Matrix to get unique members
    try:
        df_combo = pd.read_excel(excel_file, sheet_name='Combination Matrix', header=1)
        
        # First column and all other column headers are member names
        for col in df_combo.columns:
            if col and isinstance(col, str) and col.strip():
                member_name = col.strip()
                if member_name not in members:
                    members[member_name] = {
                        'name': member_name,
                        'company': 'TBD',
                        'designation': 'Member',
                        'industry': 'General'
                    }
        
        # First column also contains member names (row labels)
        for idx, row in df_combo.iterrows():
            first_col = df_combo.iloc[idx, 0]
            if first_col and isinstance(first_col, str):
                member_name = first_col.strip()
                if member_name not in members:
                    members[member_name] = {
                        'name': member_name,
                        'company': 'TBD',
                        'designation': 'Member',
                        'industry': 'General'
                    }
    except Exception as e:
        print(f"⚠️  Could not read Combination Matrix: {e}")
    
    print(f"✅ Extracted {len(members)} unique members")
    return members


def extract_interactions_from_excel(excel_file):
    """
    Extract one-to-one meeting interactions from Excel.
    
    Returns:
        list: [{member_a, member_b, total_interactions, interaction_type}, ...]
    """
    print("📖 Extracting interactions (One-to-One Matrix) from Excel...")
    
    interactions = []
    
    try:
        # Read One-to-One Matrix sheet
        df_matrix = pd.read_excel(excel_file, sheet_name='One-to-One Matrix', header=1)
        
        member_col = df_matrix.columns[0]
        
        for idx, row in df_matrix.iterrows():
            member_a = str(row[member_col]).strip()
            if not member_a or member_a.lower() == 'nan':
                continue
            
            # Check each column (other members)
            for col in df_matrix.columns[1:]:
                if col is None or (isinstance(col, float) and pd.isna(col)):
                    continue
                    
                member_b = str(col).strip()
                if not member_b or member_b.lower() == 'nan':
                    continue
                
                value = row[col]
                if pd.isna(value):
                    interaction_count = 0
                else:
                    try:
                        interaction_count = max(0, int(float(value)))
                    except:
                        interaction_count = 0
                
                # Only include if there's at least 1 interaction
                if interaction_count > 0:
                    interactions.append({
                        'member_a': member_a,
                        'member_b': member_b,
                        'total_interactions': interaction_count,
                        'interaction_type': 'One-to-One'
                    })
    
    except Exception as e:
        print(f"⚠️  Could not read One-to-One Matrix: {e}")
    
    print(f"✅ Extracted {len(interactions)} interactions")
    return interactions


def extract_referrals_from_excel(excel_file):
    """
    Extract referral data from Excel.
    
    Returns:
        list: [{referrer, referral_recipient, business_location, business_value, status}, ...]
    """
    print("📖 Extracting referrals (Referral Matrix) from Excel...")
    
    referrals = []
    
    try:
        # Try Referral Matrix sheet
        df_matrix = pd.read_excel(excel_file, sheet_name='Referral Matrix', header=1)
        
        member_col = df_matrix.columns[0]
        
        for idx, row in df_matrix.iterrows():
            referrer = str(row[member_col]).strip()
            if not referrer or referrer.lower() == 'nan':
                continue
            
            # Check each column (other members)
            for col in df_matrix.columns[1:]:
                if col is None or (isinstance(col, float) and pd.isna(col)):
                    continue
                
                referral_recipient = str(col).strip()
                if not referral_recipient or referral_recipient.lower() == 'nan':
                    continue
                
                value = row[col]
                if pd.isna(value):
                    referral_count = 0
                else:
                    try:
                        referral_count = max(0, int(float(value)))
                    except:
                        referral_count = 0
                
                # Only include if there's at least 1 referral
                if referral_count > 0:
                    referrals.append({
                        'referrer': referrer,
                        'referral_recipient': referral_recipient,
                        'total_referrals': referral_count,
                        'business_location': 'UAE',  # Default
                        'total_business_value': 0,  # Not tracked in this data
                        'status': 'COMPLETED'
                    })
    
    except Exception as e:
        print(f"⚠️  Could not read Referral Matrix: {e}")
    
    print(f"✅ Extracted {len(referrals)} referrals")
    return referrals


# ============================================================================
# SQL GENERATION FUNCTIONS
# ============================================================================

def generate_members_sql(members):
    """Generate INSERT statements for community_roi_members."""
    print("\n📝 Generating members SQL...")
    
    statements = []
    
    # Map member names to generated UUIDs for cross-reference
    member_uuid_map = {}
    
    for member_name, data in members.items():
        member_id = generate_uuid()
        member_uuid_map[member_name] = member_id
        
        sql = (
            f"INSERT INTO community_roi_members "
            f"(id, tenant_id, name, company_name, designation, industry, "
            f"total_one_to_ones, total_referrals_given, total_referrals_received, "
            f"total_business_inside_aed, total_business_outside_aed, "
            f"metadata, is_deleted, created_at, updated_at) "
            f"VALUES ("
            f"{escape_sql_string(member_id)}::uuid, "
            f"{escape_sql_string(TENANT_ID)}::uuid, "
            f"{escape_sql_string(data['name'])}, "
            f"{escape_sql_string(data.get('company', 'Unknown'))}, "
            f"{escape_sql_string(data.get('designation', 'Member'))}, "
            f"{escape_sql_string(data.get('industry', 'General'))}, "
            f"0, 0, 0, 0, 0, "
            f"'{{}}'::jsonb, "
            f"false, "
            f"NOW(), NOW());"
        )
        statements.append(sql)
    
    print(f"✅ Generated {len(statements)} member INSERT statements")
    return statements, member_uuid_map


def generate_interactions_sql(interactions, member_uuid_map):
    """Generate INSERT statements for community_roi_interactions."""
    print("📝 Generating interactions SQL...")
    
    statements = []
    
    for interaction in interactions:
        member_a = interaction['member_a']
        member_b = interaction['member_b']
        total_interactions = interaction['total_interactions']
        
        # Skip if members not found (defensive)
        if member_a not in member_uuid_map or member_b not in member_uuid_map:
            print(f"⚠️  Skipping interaction: {member_a} <-> {member_b} (members not found)")
            continue
        
        interaction_id = generate_uuid()
        member_a_id = member_uuid_map[member_a]
        member_b_id = member_uuid_map[member_b]
        
        sql = (
            f"INSERT INTO community_roi_interactions "
            f"(id, tenant_id, member_a_id, member_b_id, "
            f"meeting_count, "
            f"metadata, is_deleted, created_at, updated_at) "
            f"VALUES ("
            f"{escape_sql_string(interaction_id)}::uuid, "
            f"{escape_sql_string(TENANT_ID)}::uuid, "
            f"{escape_sql_string(member_a_id)}::uuid, "
            f"{escape_sql_string(member_b_id)}::uuid, "
            f"{total_interactions}, "
            f"'{{}}'::jsonb, "
            f"false, "
            f"NOW(), NOW());"
        )
        statements.append(sql)
    
    print(f"✅ Generated {len(statements)} interaction INSERT statements")
    return statements


def generate_referrals_sql(referrals, member_uuid_map):
    """Generate INSERT statements for community_roi_referrals."""
    print("📝 Generating referrals SQL...")
    
    statements = []
    
    for referral in referrals:
        referrer = referral['referrer']
        referral_recipient = referral['referral_recipient']
        
        # Skip if members not found (defensive)
        if referrer not in member_uuid_map or referral_recipient not in member_uuid_map:
            print(f"⚠️  Skipping referral: {referrer} -> {referral_recipient} (members not found)")
            continue
        
        referral_id = generate_uuid()
        referred_by_id = member_uuid_map[referrer]
        referred_to_id = member_uuid_map[referral_recipient]
        
        sql = (
            f"INSERT INTO community_roi_referrals "
            f"(id, tenant_id, referred_by_id, referred_to_id, "
            f"referral_count, business_type, estimated_value_aed, "
            f"metadata, is_deleted, created_at, updated_at) "
            f"VALUES ("
            f"{escape_sql_string(referral_id)}::uuid, "
            f"{escape_sql_string(TENANT_ID)}::uuid, "
            f"{escape_sql_string(referred_by_id)}::uuid, "
            f"{escape_sql_string(referred_to_id)}::uuid, "
            f"{referral.get('total_referrals', 0)}, "
            f"{escape_sql_string(referral.get('business_location', 'UAE'))}, "
            f"{referral.get('total_business_value', 0)}, "
            f"'{{}}'::jsonb, "
            f"false, "
            f"NOW(), NOW());"
        )
        statements.append(sql)
    
    print(f"✅ Generated {len(statements)} referral INSERT statements")
    return statements


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main migration function."""
    print("=" * 70)
    print("🚀 LAD Community ROI Data Migration")
    print("=" * 70)
    print(f"Tenant: {NETWORK_NAME}")
    print(f"Tenant ID: {TENANT_ID}")
    print(f"Excel File: {EXCEL_FILE}")
    print(f"Output: {OUTPUT_SQL_FILE}")
    print("=" * 70)
    
    # Check if Excel file exists
    if not EXCEL_FILE.exists():
        print(f"❌ Excel file not found: {EXCEL_FILE}")
        return False
    
    # Extract data from Excel
    members = extract_members_from_excel(EXCEL_FILE)
    interactions = extract_interactions_from_excel(EXCEL_FILE)
    referrals = extract_referrals_from_excel(EXCEL_FILE)
    
    # Validate data
    if not members:
        print("❌ No members extracted from Excel")
        return False
    
    # Generate SQL statements
    print("\n" + "=" * 70)
    print("🛠️  Generating SQL Statements")
    print("=" * 70)
    
    member_sqls, member_uuid_map = generate_members_sql(members)
    interaction_sqls = generate_interactions_sql(interactions, member_uuid_map)
    referral_sqls = generate_referrals_sql(referrals, member_uuid_map)
    
    # Combine all SQL statements
    all_sqls = [
        "BEGIN TRANSACTION;",
        "",
        "-- ============================================================================",
        "-- LAD Community ROI Data Migration",
        f"-- Generated: {datetime.utcnow().isoformat()}",
        "-- ============================================================================",
        "",
        "-- Insert members",
        *member_sqls,
        "",
        "-- Insert interactions",
        *interaction_sqls,
        "",
        "-- Insert referrals",
        *referral_sqls,
        "",
        "COMMIT;",
    ]
    
    # Write to SQL file
    print("\n📝 Writing SQL file...")
    with open(OUTPUT_SQL_FILE, 'w') as f:
        f.write('\n'.join(all_sqls))
    
    # Print summary
    print("\n" + "=" * 70)
    print("✅ Migration Preparation Complete")
    print("=" * 70)
    print(f"Members: {len(member_sqls)}")
    print(f"Interactions: {len(interaction_sqls)}")
    print(f"Referrals: {len(referral_sqls)}")
    print(f"Total statements: {len(member_sqls) + len(interaction_sqls) + len(referral_sqls)}")
    print(f"\nSQL file: {OUTPUT_SQL_FILE}")
    print(f"File size: {OUTPUT_SQL_FILE.stat().st_size / 1024:.1f} KB")
    print("\n📝 Next steps:")
    print("1. Review the generated SQL file")
    print("2. Execute: psql -h 165.22.221.77 -U dbadmin -d salesmaya_agent -f migrate_to_lad_dev.sql")
    print("3. Validate data: SELECT COUNT(*) FROM community_roi_members WHERE tenant_id = $1;")
    print("=" * 70)
    
    return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
