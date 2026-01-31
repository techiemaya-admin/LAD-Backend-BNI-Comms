#!/bin/bash

echo "🚀 Creating fresh LAD schema: lad_dev"
echo "======================================"
echo ""

# Database connection details from .env
HOST="${POSTGRES_HOST:-165.22.221.77}"
PORT="${POSTGRES_PORT:-5432}"
USER="${POSTGRES_USER:-dbadmin}"
DB="${POSTGRES_DB:-salesmaya_agent}"
SCHEMA="${POSTGRES_SCHEMA:-lad_dev}"

echo "📊 Connection Info:"
echo "  Host: $HOST"
echo "  Port: $PORT"
echo "  Database: $DB"
echo "  Schema: $SCHEMA"
echo ""

# Run migration
echo "📝 Running migration..."
PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -f ./migrations/000_create_fresh_schema.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Schema created successfully!"
  echo ""
  echo "📊 Verifying tables..."
  PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -c "\dt $SCHEMA.*"
  echo ""
  echo "👤 Checking demo user..."
  PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -c "SELECT id, email, name, is_active FROM $SCHEMA.users;"
else
  echo ""
  echo "❌ Migration failed!"
  exit 1
fi
