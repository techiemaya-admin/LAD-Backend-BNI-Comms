/**
 * Get LinkedIn member ID (provider_id) from profile URL
 * 
 * Usage:
 * node get-linkedin-member-id.js <accountId> <linkedInUrl>
 * 
 * Example:
 * node get-linkedin-member-id.js "qA0M10f3TpKpIKxWJy-YtA" "https://www.linkedin.com/in/pavithra-yadanaparthi-a58581116/"
 */

require('dotenv').config();
const axios = require('axios');

async function getMemberId() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('❌ Missing required arguments\n');
    console.log('Usage: node get-linkedin-member-id.js <accountId> <linkedInUrl>\n');
    console.log('Example:');
    console.log('  node get-linkedin-member-id.js "qA0M10f3TpKpIKxWJy-YtA" "https://www.linkedin.com/in/john-doe"\n');
    console.log('Environment variables (from .env):');
    console.log('  - UNIPILE_DSN:', process.env.UNIPILE_DSN ? '✅ Set' : '❌ Not set');
    console.log('  - UNIPILE_TOKEN:', process.env.UNIPILE_TOKEN ? '✅ Set' : '❌ Not set');
    process.exit(1);
  }
  
  const [accountId, linkedInUrl] = args;
  
  // Check environment configuration
  if (!process.env.UNIPILE_DSN || !process.env.UNIPILE_TOKEN) {
    console.error('❌ Missing Unipile configuration in .env file');
    console.error('Required variables: UNIPILE_DSN, UNIPILE_TOKEN');
    process.exit(1);
  }
  
  // Extract public identifier from URL (handle trailing slashes)
  const match = linkedInUrl.match(/\/in\/([^/?]+)/);
  if (!match) {
    console.error('❌ Invalid LinkedIn URL format');
    console.error('Expected format: https://www.linkedin.com/in/username');
    console.error('Received URL:', linkedInUrl);
    process.exit(1);
  }
  
  const publicId = match[1];
  
  console.log('\n🔍 Looking up LinkedIn profile');
  console.log('=====================================');
  console.log('URL:', linkedInUrl);
  console.log('Public ID:', publicId);
  console.log('Account ID:', accountId);
  console.log('=====================================\n');
  
  try {
    let baseUrl = process.env.UNIPILE_DSN;
    const token = process.env.UNIPILE_TOKEN;
    
    // Ensure baseUrl has protocol
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    // Ensure baseUrl has /api/v1 path
    if (!baseUrl.endsWith('/api/v1')) {
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl + 'api/v1';
      } else {
        baseUrl = baseUrl + '/api/v1';
      }
    }
    
    console.log('📡 Querying Unipile API...\n');
    console.log('Base URL:', baseUrl);
    
    const response = await axios.get(
      `${baseUrl}/users/${publicId}`,
      {
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json'
        },
        params: {
          account_id: accountId
        },
        timeout: 60000
      }
    );
    
    const data = response.data?.data || response.data || {};
    
    console.log('✅ Profile found!\n');
    console.log('Details:');
    console.log('========================================');
    console.log('Provider ID (Member ID):', data.provider_id);
    console.log('Name:', data.display_name || data.name || 'N/A');
    console.log('Public Identifier:', data.public_identifier || publicId);
    console.log('Profile URL:', data.profile_url || linkedInUrl);
    if (data.headline) console.log('Headline:', data.headline);
    if (data.location) console.log('Location:', data.location);
    console.log('========================================\n');
    
    if (!data.provider_id) {
      console.error('⚠️  Warning: No provider_id found in response');
      console.error('Full response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
    
    console.log('🚀 Test Command:');
    console.log('================\n');
    console.log(`node test-first-linkedin-message.js \\`);
    console.log(`  "${accountId}" \\`);
    console.log(`  "${data.provider_id}" \\`);
    console.log(`  "Hi ${data.display_name || 'there'}! Thanks for connecting."\n`);
    
  } catch (error) {
    console.error('\n❌ Lookup failed:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 404) {
        console.error('\n💡 Profile not found. This could mean:');
        console.error('   - The profile URL is incorrect');
        console.error('   - The profile is private or restricted');
        console.error('   - Your LinkedIn account cannot access this profile');
      } else if (error.response.status === 401) {
        console.error('\n💡 Authentication failed. Check your UNIPILE_TOKEN');
      }
    }
    
    process.exit(1);
  }
}

getMemberId();
