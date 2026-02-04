#!/usr/bin/env node
/**
 * Enable all features and capabilities for a tenant
 * Usage: node scripts/enable-all-features-for-tenant.js <tenant_id>
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// All available features
const ALL_FEATURES = [
  'ai-icp-assistant',
  'apollo-leads',
  'campaigns',
  'dashboard',
  'deals-pipeline',
  'education-counsellors',
  'education-students',
  'lead-enrichment',
  'social-integration',
  'voice-agent'
];

// All available capabilities
const ALL_CAPABILITIES = [
  'view_dashboard',
  'manage_campaigns',
  'manage_leads',
  'make_calls',
  'view_analytics',
  'manage_team',
  'manage_integrations',
  'manage_billing',
  'admin_access',
  'voice_agent_access',
  'apollo_search',
  'lead_enrichment',
  'ai_assistant',
  'social_media_integration',
  'deals_pipeline_access',
  'education_features'
];

async function enableAllFeaturesForTenant(tenantId) {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Enabling all features and capabilities for tenant');
    console.log(`📍 Tenant ID: ${tenantId}`);
    console.log(`📍 Schema: ${process.env.POSTGRES_SCHEMA || 'lad_dev'}\n`);

    const schema = process.env.POSTGRES_SCHEMA || 'lad_dev';
    
    await client.query('BEGIN');

    // ================================================
    // 1. Enable all feature flags
    // ================================================
    console.log('📌 Enabling feature flags...');
    
    for (const featureKey of ALL_FEATURES) {
      const sql = `
        INSERT INTO ${schema}.feature_flags (
          id, tenant_id, feature_key, is_enabled, config, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(), $1, $2, true, '{}'::jsonb, NOW(), NOW()
        )
        ON CONFLICT (feature_key, tenant_id, user_id)
        DO UPDATE SET
          is_enabled = true,
          updated_at = NOW()
      `;
      
      await client.query(sql, [tenantId, featureKey]);
      console.log(`   ✓ ${featureKey}`);
    }

    // ================================================
    // 2. Get all users for this tenant
    // ================================================
    console.log('\n📌 Getting tenant users...');
    
    const usersResult = await client.query(`
      SELECT id, email
      FROM ${schema}.users
      WHERE tenant_id = $1
        AND is_deleted = false
    `, [tenantId]);

    const users = usersResult.rows;
    console.log(`   Found ${users.length} users`);

    // ================================================
    // 3. Enable all capabilities for all users
    // ================================================
    console.log('\n📌 Enabling user capabilities...');
    
    let totalCapabilities = 0;
    for (const user of users) {
      for (const capabilityKey of ALL_CAPABILITIES) {
        const sql = `
          INSERT INTO ${schema}.user_capabilities (
            id, user_id, tenant_id, capability_key, is_enabled, granted_at, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(), $1, $2, $3, true, NOW(), NOW(), NOW()
          )
          ON CONFLICT (user_id, capability_key)
          DO UPDATE SET
            is_enabled = true,
            granted_at = NOW(),
            updated_at = NOW()
        `;
        
        await client.query(sql, [user.id, tenantId, capabilityKey]);
        totalCapabilities++;
      }
      console.log(`   ✓ ${user.email} - ${ALL_CAPABILITIES.length} capabilities`);
    }

    // ================================================
    // 4. Summary
    // ================================================
    console.log('\n================================================');
    console.log('Summary');
    console.log('================================================');

    const summaryResult = await client.query(`
      SELECT 
        'Feature Flags' as type,
        COUNT(*) as enabled_count
      FROM ${schema}.feature_flags
      WHERE tenant_id = $1
        AND is_enabled = true
      UNION ALL
      SELECT 
        'User Capabilities' as type,
        COUNT(DISTINCT capability_key) as enabled_count
      FROM ${schema}.user_capabilities
      WHERE tenant_id = $1
        AND is_enabled = true
    `, [tenantId, tenantId]);

    console.log('\n📊 Results:');
    summaryResult.rows.forEach(row => {
      console.log(`   ${row.type}: ${row.enabled_count}`);
    });

    // List enabled features
    const featuresResult = await client.query(`
      SELECT feature_key, is_enabled, updated_at
      FROM ${schema}.feature_flags
      WHERE tenant_id = $1
      ORDER BY feature_key
    `, [tenantId]);

    console.log('\n✅ Enabled Feature Flags:');
    featuresResult.rows.forEach(row => {
      console.log(`   • ${row.feature_key}`);
    });

    await client.query('COMMIT');
    
    console.log('\n✅ All features and capabilities enabled successfully!\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error enabling features:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Main execution
const tenantId = process.argv[2];

if (!tenantId) {
  console.error('❌ Usage: node scripts/enable-all-features-for-tenant.js <tenant_id>');
  console.error('   Example: node scripts/enable-all-features-for-tenant.js 926070b5-189b-4682-9279-ea10ca090b84');
  process.exit(1);
}

// Validate UUID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(tenantId)) {
  console.error('❌ Invalid tenant ID format. Must be a valid UUID.');
  process.exit(1);
}

enableAllFeaturesForTenant(tenantId).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
