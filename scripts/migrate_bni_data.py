#!/usr/bin/env python3
"""
BNI Network Data Migration Script
Migrates data from BNI_Rising_Phoenix_analysis Excel file to community_roi_* tables
"""

import openpyxl
import uuid
from datetime import datetime
import re
from decimal import Decimal
import sys
import os

# Path to Excel file  
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
# Project root is 2 levels up from scripts (scripts -> backend -> lad-feature-community-roi)
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '../..'))
EXCEL_FILE = os.path.join(PROJECT_ROOT, 'POC-Sample/BNI_Rising_Phoenix_analysis_2025-04_to_2025-12.xlsx')

# Tenant ID - using a fixed UUID for BNI Rising Phoenix
TENANT_ID = str(uuid.uuid5(uuid.NAMESPACE_DNS, 'bni-rising-phoenix.example.com'))
NETWORK_GROUP = 'BNI Rising Phoenix'

class DataMigration:
    def __init__(self):
        self.member_map = {}  # Maps member name to UUID
        self.sql_statements = []
        self.errors = []
        
    def clean_member_name(self, name):
        """Extract member name and remove network group suffix"""
        if not name:
            return None
        # Remove " (BNI Rising Phoenix)" suffix
        return name.replace(' (BNI Rising Phoenix)', '').strip()
    
    def load_workbook(self):
        """Load Excel workbook"""
        if not os.path.exists(EXCEL_FILE):
            self.errors.append(f"Excel file not found: {EXCEL_FILE}")
            return False
        try:
            self.wb = openpyxl.load_workbook(EXCEL_FILE)
            return True
        except Exception as e:
            self.errors.append(f"Failed to load Excel: {e}")
            return False
    
    def extract_members_from_matrix(self):
        """Extract unique member names from Combination Matrix"""
        if 'Combination Matrix' not in self.wb.sheetnames:
            self.errors.append("Sheet 'Combination Matrix' not found")
            return False
        
        ws = self.wb['Combination Matrix']
        members_set = set()
        
        # Row 1 has header with member names in columns
        # Column A has member names in rows
        for row in ws.iter_rows(min_row=2, max_col=1, values_only=True):
            member_name = row[0]
            if member_name:
                clean_name = self.clean_member_name(member_name)
                if clean_name:
                    members_set.add(clean_name)
        
        # Create SQL for inserting members
        for member_name in sorted(members_set):
            member_id = str(uuid.uuid4())
            self.member_map[member_name] = member_id
            
            sql = f"""
INSERT INTO community_roi_members 
(id, tenant_id, name, company_name, designation, industry, network_group, 
 total_one_to_ones, total_referrals_given, total_referrals_received,
 total_business_inside_aed, total_business_outside_aed, metadata, is_deleted, created_at, updated_at)
VALUES (
    '{member_id}'::uuid,
    '{TENANT_ID}'::uuid,
    '{self.escape_sql(member_name)}',
    '',
    '',
    '',
    '{NETWORK_GROUP}',
    0,
    0,
    0,
    0,
    0,
    '{{}}',
    false,
    NOW(),
    NOW()
);"""
            self.sql_statements.append(sql.strip())
        
        print(f"✓ Extracted {len(members_set)} members")
        return True
    
    def extract_interactions(self):
        """Extract one-to-one interactions from One-to-One Matrix"""
        if 'One-to-One Matrix' not in self.wb.sheetnames:
            print("⚠ Sheet 'One-to-One Matrix' not found, skipping interactions")
            return True
        
        ws = self.wb['One-to-One Matrix']
        
        # Build member list from headers (row 1, starting column B)
        members_row = []
        for col in range(2, ws.max_column + 1):
            cell_value = ws.cell(row=2, column=col).value
            if cell_value:
                members_row.append(self.clean_member_name(cell_value))
        
        interaction_count = 0
        # Read data rows (starting from row 3)
        for row_idx in range(3, ws.max_row + 1):
            member_a_name = self.clean_member_name(ws.cell(row=row_idx, column=1).value)
            
            if not member_a_name or member_a_name not in self.member_map:
                continue
            
            member_a_id = self.member_map[member_a_name]
            
            # Read columns (starting from column B)
            for col_idx, member_b_name in enumerate(members_row, start=2):
                if member_b_name not in self.member_map:
                    continue
                
                meeting_count = ws.cell(row=row_idx, column=col_idx).value
                if meeting_count and int(meeting_count) > 0:
                    member_b_id = self.member_map[member_b_name]
                    
                    # Avoid duplicates by ensuring member_a_id < member_b_id lexicographically
                    if member_a_id < member_b_id:
                        interaction_id = str(uuid.uuid4())
                        meeting_month = '2025-09'  # Use middle of range as default
                        
                        sql = f"""
INSERT INTO community_roi_interactions
(id, tenant_id, member_a_id, member_b_id, meeting_month, meeting_count, metadata, is_deleted, created_at, updated_at)
VALUES (
    '{interaction_id}'::uuid,
    '{TENANT_ID}'::uuid,
    '{member_a_id}'::uuid,
    '{member_b_id}'::uuid,
    '{meeting_month}',
    {int(meeting_count)},
    '{{}}',
    false,
    NOW(),
    NOW()
);"""
                        self.sql_statements.append(sql.strip())
                        interaction_count += 1
        
        print(f"✓ Extracted {interaction_count} interactions")
        return True
    
    def extract_referrals(self):
        """Extract referrals from Referral Matrix"""
        if 'Referral Matrix' not in self.wb.sheetnames:
            print("⚠ Sheet 'Referral Matrix' not found, skipping referrals")
            return True
        
        ws = self.wb['Referral Matrix']
        
        # Build member list from headers (row 1, starting column B)
        members_row = []
        for col in range(2, ws.max_column + 1):
            cell_value = ws.cell(row=2, column=col).value
            if cell_value:
                members_row.append(self.clean_member_name(cell_value))
        
        referral_count = 0
        # Read data rows (starting from row 3)
        for row_idx in range(3, ws.max_row + 1):
            referred_by_name = self.clean_member_name(ws.cell(row=row_idx, column=1).value)
            
            if not referred_by_name or referred_by_name not in self.member_map:
                continue
            
            referred_by_id = self.member_map[referred_by_name]
            
            # Read columns (starting from column B)
            for col_idx, referred_to_name in enumerate(members_row, start=2):
                if referred_to_name not in self.member_map:
                    continue
                
                referral_cnt = ws.cell(row=row_idx, column=col_idx).value
                if referral_cnt and int(referral_cnt) > 0:
                    referred_to_id = self.member_map[referred_to_name]
                    
                    referral_id = str(uuid.uuid4())
                    referral_month = '2025-09'  # Use middle of range as default
                    
                    sql = f"""
INSERT INTO community_roi_referrals
(id, tenant_id, referred_by_id, referred_to_id, referral_month, referral_count, business_type, estimated_value_aed, metadata, is_deleted, created_at, updated_at)
VALUES (
    '{referral_id}'::uuid,
    '{TENANT_ID}'::uuid,
    '{referred_by_id}'::uuid,
    '{referred_to_id}'::uuid,
    '{referral_month}',
    {int(referral_cnt)},
    'Network Business',
    NULL,
    '{{}}',
    false,
    NOW(),
    NOW()
);"""
                    self.sql_statements.append(sql.strip())
                    referral_count += 1
        
        print(f"✓ Extracted {referral_count} referrals")
        return True
    
    def escape_sql(self, value):
        """Escape single quotes in SQL strings"""
        if not value:
            return ''
        return value.replace("'", "''")
    
    def generate_output(self):
        """Generate SQL file output"""
        output_dir = SCRIPT_DIR if '__file__' in globals() else os.getcwd()
        output_file = os.path.join(output_dir, 'migrate_bni_data.sql')
        
        with open(output_file, 'w') as f:
            f.write("-- BNI Network Data Migration SQL\n")
            f.write(f"-- Generated: {datetime.now().isoformat()}\n")
            f.write(f"-- Tenant ID: {TENANT_ID}\n")
            f.write("-- Network: BNI Rising Phoenix\n\n")
            f.write("BEGIN TRANSACTION;\n\n")
            
            # Add tenant verification
            f.write(f"""-- Verify tenant exists
SELECT 1 FROM lad_core.tenants WHERE id = '{TENANT_ID}'::uuid
OR (INSERT INTO lad_core.tenants (id, name, created_at, updated_at) 
    VALUES ('{TENANT_ID}'::uuid, 'BNI Rising Phoenix', NOW(), NOW()));

""")
            
            f.write("-- Insert members\n")
            for sql in self.sql_statements:
                if 'community_roi_members' in sql:
                    f.write(sql + '\n\n')
            
            f.write("-- Insert interactions\n")
            for sql in self.sql_statements:
                if 'community_roi_interactions' in sql:
                    f.write(sql + '\n\n')
            
            f.write("-- Insert referrals\n")
            for sql in self.sql_statements:
                if 'community_roi_referrals' in sql:
                    f.write(sql + '\n\n')
            
            f.write("COMMIT;\n")
        
        print(f"\n✓ Generated SQL file: {output_file}")
        print(f"  Total statements: {len(self.sql_statements)}")
        return output_file
    
    def migrate(self):
        """Run the migration"""
        print(f"\n🚀 Starting BNI Network Data Migration")
        print(f"   Tenant ID: {TENANT_ID}")
        print(f"   Network: {NETWORK_GROUP}\n")
        
        if not self.load_workbook():
            return False
        
        print(f"✓ Loaded workbook: {EXCEL_FILE}\n")
        
        if not self.extract_members_from_matrix():
            return False
        
        if not self.extract_interactions():
            return False
        
        if not self.extract_referrals():
            return False
        
        output_file = self.generate_output()
        
        if self.errors:
            print("\n⚠ Warnings:")
            for error in self.errors:
                print(f"  - {error}")
        
        print("\n✅ Migration preparation complete!")
        print(f"   SQL file: {output_file}")
        print(f"   Next steps:")
        print(f"   1. Review the SQL file")
        print(f"   2. Run: psql -U postgres -d -f {output_file}")
        
        return True


if __name__ == '__main__':
    migration = DataMigration()
    success = migration.migrate()
    sys.exit(0 if success else 1)
