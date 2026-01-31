#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DB_URL:-postgresql://dbadmin:TechieMaya@165.22.221.77:5432/salesmaya_agent}"
SCHEMA="${SCHEMA:-lad_dev}"

# 1) Full schema DDL (tables, types, constraints, indexes, triggers)
pg_dump "$DB_URL" \
  --schema="$SCHEMA" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --quote-all-identifiers \
  > "${SCHEMA}_full_schema.sql"

echo "✅ Exported: ${SCHEMA}_full_schema.sql"
