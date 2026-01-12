#!/usr/bin/env node
/**
 * Script to enable voice-agent feature for all organizations
 * Fixes the 403 Forbidden issues on make-call page
 */

const { pool } = require('../shared/database/connection');

async function enableVoiceAgentFeature() {
  try {
    console.log('🔍 Checking current voice-agent feature flags...');
    
    // Check existing voice-agent feature flags
    const checkQuery = `
      SELECT tenant_id, is_enabled, created_at
      FROM lad_dev.feature_flags 
      WHERE feature_key = 'voice-agent'
      ORDER BY created_at DESC
    `;
    
    const existingFlags = await pool.query(checkQuery);
    console.log(`Found ${existingFlags.rows.length} existing voice-agent flags:`);
    existingFlags.rows.forEach(row => {
      console.log(`  - Tenant: ${row.tenant_id}, Enabled: ${row.is_enabled}`);
    });
    
    // Get all organizations/tenants that don't have voice-agent enabled
    const missingQuery = `
      SELECT DISTINCT u.tenant_id
      FROM lad_dev.users u
      WHERE u.tenant_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM lad_dev.feature_flags ff
        WHERE ff.tenant_id = u.tenant_id 
        AND ff.feature_key = 'voice-agent'
        AND ff.is_enabled = true
      )
    `;
    
    const missingOrgs = await pool.query(missingQuery);
    console.log(`\n🔧 Found ${missingOrgs.rows.length} organizations missing voice-agent feature`);
    
    if (missingOrgs.rows.length > 0) {
      // Enable voice-agent for all organizations
      for (const org of missingOrgs.rows) {
        const insertQuery = `
          INSERT INTO lad_dev.feature_flags (feature_key, tenant_id, is_enabled, config)
          VALUES ('voice-agent', $1, true, '{}')
          ON CONFLICT (feature_key, tenant_id, user_id) 
          DO UPDATE SET is_enabled = true, updated_at = CURRENT_TIMESTAMP
        `;
        
        await pool.query(insertQuery, [org.tenant_id]);
        console.log(`✅ Enabled voice-agent for tenant: ${org.tenant_id}`);
      }
    }
    
    // Also ensure demo tenant has voice-agent enabled
    const demoTenant = '00000000-0000-0000-0000-000000000001';
    const enableDemoQuery = `
      INSERT INTO lad_dev.feature_flags (feature_key, tenant_id, is_enabled, config)
      VALUES ('voice-agent', $1, true, '{}')
      ON CONFLICT (feature_key, tenant_id, user_id) 
      DO UPDATE SET is_enabled = true, updated_at = CURRENT_TIMESTAMP
    `;
    
    await pool.query(enableDemoQuery, [demoTenant]);
    console.log(`✅ Ensured voice-agent is enabled for demo tenant: ${demoTenant}`);
    
    // Final verification
    console.log('\n🎯 Final verification:');
    const finalCheck = await pool.query(checkQuery);
    finalCheck.rows.forEach(row => {
      console.log(`  - Tenant: ${row.tenant_id}, Enabled: ${row.is_enabled}`);
    });
    
    console.log('\n🎉 Voice Agent feature enabling completed successfully!');
    console.log('The make-call page should now work properly.');
    
  } catch (error) {
    console.error('❌ Error enabling voice-agent feature:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
enableVoiceAgentFeature();