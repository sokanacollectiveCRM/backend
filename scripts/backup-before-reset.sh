#!/bin/bash
# Backup script - Run this BEFORE deleting anything!

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backups in $BACKUP_DIR..."

# 1. Backup Supabase data
echo "📥 Backing up Supabase..."
# You'll need to export these from Supabase Dashboard
# Go to: Table Editor → Export as CSV for each table
# - client_info
# - assignments
# - activities
# - users (if needed)

echo "⚠️  MANUAL STEP: Export these tables from Supabase Dashboard:"
echo "   1. client_info → $BACKUP_DIR/supabase_client_info.csv"
echo "   2. assignments → $BACKUP_DIR/supabase_assignments.csv"
echo "   3. activities → $BACKUP_DIR/supabase_activities.csv"

# 2. Backup Cloud SQL
echo "📥 Backing up Cloud SQL PHI data..."
# Export from Cloud SQL
echo "⚠️  MANUAL STEP: Export from Cloud SQL:"
echo "   Run: SELECT * FROM your_phi_table"
echo "   Save to: $BACKUP_DIR/cloud_sql_phi_data.csv"

echo ""
echo "✅ Backup directory created: $BACKUP_DIR"
echo "⚠️  DO NOT DELETE DATA until backups are complete!"
echo ""
