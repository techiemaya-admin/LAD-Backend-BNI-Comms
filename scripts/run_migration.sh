#!/usr/bin/env bash

# BNI Network Data Migration Guide
# This script prepares and executes the migration of BNI data to lad_dev schema

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SQL_FILE="$SCRIPT_DIR/migrate_bni_data.sql"
LOG_FILE="$SCRIPT_DIR/migration_$(date +%Y%m%d_%H%M%S).log"

echo "======================================"
echo "  BNI Data Migration Setup"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if SQL file exists
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}✗ SQL file not found: $SQL_FILE${NC}"
    echo ""
    echo "Step 1: Generate SQL file"
    echo "Run: python3 migrate_bni_data.py"
    exit 1
fi

echo -e "${GREEN}✓ SQL file found${NC}"
echo "  Location: $SQL_FILE"
echo ""

# Display migration statistics
echo "Migration Statistics:"
MEMBER_COUNT=$(grep -c "INSERT INTO lad_dev.community_roi_members" "$SQL_FILE" || echo "0")
INTERACTION_COUNT=$(grep -c "INSERT INTO lad_dev.community_roi_interactions" "$SQL_FILE" || echo "0")
REFERRAL_COUNT=$(grep -c "INSERT INTO lad_dev.community_roi_referrals" "$SQL_FILE" || echo "0")

echo "  Members:      $MEMBER_COUNT"
echo "  Interactions: $INTERACTION_COUNT"
echo "  Referrals:    $REFERRAL_COUNT"
echo ""

# Extract tenant ID from SQL
TENANT_ID=$(grep "^-- Tenant ID:" "$SQL_FILE" | awk '{print $NF}')
echo "  Tenant ID:    $TENANT_ID"
echo ""

# Check database connection
echo "Step 2: Verify database connection"
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠ psql not found in PATH${NC}"
    echo "  Please ensure PostgreSQL client is installed"
    echo ""
    echo "  To connect and run migration manually:"
    echo "  psql -U postgres -d lad_dev -f $SQL_FILE"
    exit 1
fi

echo -e "${GREEN}✓ psql found${NC}"
echo ""

# Show database connection string (without password)
echo "Step 3: Database configuration"
echo "  Host: localhost (default)"
echo "  Port: 5432 (default)"
echo "  Database: lad_dev"
echo "  User: postgres"
echo ""

# Test connection
echo "Testing database connection..."
if psql -U postgres -d lad_dev -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
    echo ""
    
    # Ask for confirmation
    echo "Ready to execute migration?"
    echo "This will:"
    echo "  1. Create BNI Rising Phoenix tenant"
    echo "  2. Insert $MEMBER_COUNT members"
    echo "  3. Insert $INTERACTION_COUNT interactions"
    echo "  4. Insert $REFERRAL_COUNT referrals"
    echo ""
    echo "Confirm? (yes/no):"
    read -r CONFIRM
    
    if [ "$CONFIRM" = "yes" ]; then
        echo ""
        echo "Executing migration..."
        psql -U postgres -d lad_dev -f "$SQL_FILE" 2>&1 | tee "$LOG_FILE"
        
        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            echo ""
            echo -e "${GREEN}✅ Migration completed successfully!${NC}"
            echo ""
            echo "Next steps:"
            echo "  1. Verify data: SELECT COUNT(*) FROM lad_dev.community_roi_members;"
            echo "  2. Check relationships: SELECT COUNT(*) FROM lad_dev.community_roi_interactions;"
            echo "  3. View referrals: SELECT COUNT(*) FROM lad_dev.community_roi_referrals;"
            echo ""
            echo "Log file: $LOG_FILE"
        else
            echo ""
            echo -e "${RED}✗ Migration failed${NC}"
            echo "Check log file for details: $LOG_FILE"
            exit 1
        fi
    else
        echo "Migration cancelled"
    fi
else
    echo -e "${RED}✗ Cannot connect to database${NC}"
    echo ""
    echo "To execute migration manually:"
    echo "1. Connect to database: psql -U postgres -d lad_dev"
    echo "2. Run SQL file: \\i $SQL_FILE"
    echo ""
    echo "Or use command line:"
    echo "psql -U postgres -d lad_dev -f $SQL_FILE"
    exit 1
fi
