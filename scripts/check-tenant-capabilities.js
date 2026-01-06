/**
 * Check and disable AI Assistant and Campaigns for specific tenant
 */
require('dotenv').config();
const { Pool } = require('pg');

const tenantId = '926070b5-189b-4682-9279-ea10ca090b84';
const schema = process.env.POSTGRES_SCHEMA || process.env.DB_SCHEMA || 'lad_dev';

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function checkAndDisableCapabilities() {
  const client = await pool.connect();
  
  try {
    console.log(`\n🔍 Checking capabilities for tenant: ${tenantId}\n`);
    
    // Check current state
    const checkQuery = `
      SELECT 
        uc.user_id,
        u.email,
        uc.capability_key,
        uc.enabled,
        uc.updated_at
      FROM ${schema}.user_capabilities uc
      JOIN ${schema}.users u ON u.id = uc.user_id
      WHERE uc.tenant_id = $1::uuid
        AND uc.capability_key IN ('view_ai_assistant', 'view_campaigns')
      ORDER BY u.email, uc.capability_key
    `;
    
    const currentState = await client.query(checkQuery, [tenantId]);
    
    if (currentState.rows.length === 0) {
      console.log('⚠️  No user_capabilities found for this tenant with view_ai_assistant or view_campaigns');
      console.log('ℹ️  These capabilities might not exist yet. Users might have access via other means.\n');
      
      // Check if users exist for this tenant
      const usersQuery = `
        SELECT u.id, u.email, m.role
        FROM ${schema}.users u
        JOIN ${schema}.memberships m ON m.user_id = u.id
        WHERE m.tenant_id = $1::uuid
      `;
      const users = await client.query(usersQuery, [tenantId]);
      
      if (users.rows.length > 0) {
        console.log(`📋 Found ${users.rows.length} user(s) in this tenant:`);
        users.rows.forEach(user => {
          console.log(`   - ${user.email} (${user.role})`);
        });
        
        console.log('\n💡 You need to INSERT capabilities first, then disable them.');
        console.log('   Run: node scripts/add-and-disable-capabilities.js\n');
      } else {
        console.log('⚠️  No users found for this tenant!\n');
      }
      
      return;
    }
    
    console.log('📊 Current State:');
    currentState.rows.forEach(row => {
      const status = row.enabled ? '✅ ENABLED' : '❌ DISABLED';
      console.log(`   ${row.email}: ${row.capability_key} - ${status}`);
    });
    
    // Count enabled capabilities
    const enabledCount = currentState.rows.filter(r => r.enabled).length;
    
    if (enabledCount === 0) {
      console.log('\n✅ All capabilities are already DISABLED. Pages should be hidden.\n');
      return;
    }
    
    console.log(`\n⚠️  Found ${enabledCount} ENABLED capability/capabilities\n`);
    console.log('🔧 Disabling view_ai_assistant and view_campaigns...\n');
    
    // Disable the capabilities
    const updateQuery = `
      UPDATE ${schema}.user_capabilities
      SET 
        enabled = false,
        updated_at = NOW()
      WHERE tenant_id = $1::uuid
        AND capability_key IN ('view_ai_assistant', 'view_campaigns')
        AND enabled = true
      RETURNING user_id, capability_key
    `;
    
    const result = await client.query(updateQuery, [tenantId]);
    
    console.log(`✅ Disabled ${result.rows.length} capability/capabilities:\n`);
    result.rows.forEach(row => {
      console.log(`   - ${row.capability_key} for user ${row.user_id}`);
    });
    
    // Verify final state
    const finalState = await client.query(checkQuery, [tenantId]);
    console.log('\n📊 Final State:');
    finalState.rows.forEach(row => {
      const status = row.enabled ? '✅ ENABLED' : '❌ DISABLED';
      console.log(`   ${row.email}: ${row.capability_key} - ${status}`);
    });
    
    console.log('\n✅ Done! Pages should now be hidden in the sidebar.\n');
    console.log('ℹ️  Users may need to refresh their browser or log out/in to see changes.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAndDisableCapabilities();
