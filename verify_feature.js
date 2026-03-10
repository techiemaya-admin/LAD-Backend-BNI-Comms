// Load environment variables first
require('dotenv').config();

const { query } = require('./shared/database/connection');
const { getSchema } = require('./core/utils/schemaHelper');

async function verifyAndEnableFeature() {
  try {
    const tenantId = '9ca4012a-2e02-5593-8cc1-fd5bd81483f9';
    const featureKey = 'community-roi';
    const schema = getSchema();
    
    console.log('\n=== Checking Feature Flag Status ===');
    console.log('Tenant ID:', tenantId);
    console.log('Feature Key:', featureKey);
    console.log('Email: admin@bnirisingphoenix.com\n');
    
    // Check if feature flag exists and is enabled
    const checkResult = await query(
      `SELECT feature_key, is_enabled, config, updated_at FROM ${schema}.feature_flags WHERE tenant_id = $1::uuid AND feature_key = $2`,
      [tenantId, featureKey]
    );
    
    if (checkResult.rows.length > 0 && checkResult.rows[0].is_enabled) {
      console.log('✅ Feature Flag Already Enabled');
      const row = checkResult.rows[0];
      console.log('  Feature:', row.feature_key);
      console.log('  Status:', row.is_enabled ? 'ENABLED' : 'DISABLED');
      console.log('  Updated:', row.updated_at);
      console.log('\n✨ Your account is ready to use community-roi API!');
    } else {
      console.log('❌ Feature Flag Not Enabled - Enabling now...\n');
      
      // Enable the feature flag - use INSERT with ON CONFLICT for the unique constraint
      const enableResult = await query(
        `INSERT INTO ${schema}.feature_flags (tenant_id, feature_key, is_enabled, config, user_id)
         VALUES ($1::uuid, $2, true, '{}', NULL)
         ON CONFLICT (feature_key, tenant_id, user_id) DO UPDATE SET is_enabled = true, updated_at = NOW()
         RETURNING feature_key, is_enabled, updated_at`,
        [tenantId, featureKey]
      );
      
      if (enableResult.rows.length > 0) {
        const row = enableResult.rows[0];
        console.log('✅ Feature Flag Enabled Successfully!');
        console.log('  Feature:', row.feature_key);
        console.log('  Status:', row.is_enabled ? 'ENABLED' : 'DISABLED');
        console.log('  Updated:', row.updated_at);
        console.log('\n✨ The 403 Forbidden errors should now be resolved!');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyAndEnableFeature();
