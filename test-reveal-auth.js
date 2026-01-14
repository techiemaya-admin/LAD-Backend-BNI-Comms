const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Create a test token
const testToken = jwt.sign({
  userId: 'test-user-123',
  email: 'test@example.com',
  tenantId: '1ead8e68-2375-43bd-91c9-555df2521dec',
  organizationId: '1ead8e68-2375-43bd-91c9-555df2521dec'
}, JWT_SECRET, { expiresIn: '1h' });

console.log('Test token created:', testToken.substring(0, 50) + '...');

const testReveal = async () => {
  try {
    console.log('Testing /api/apollo-leads/reveal-email...');
    const response = await axios.post(
      'http://localhost:3004/api/apollo-leads/reveal-email',
      { person_id: '62c918a17338f1000166e93d' },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`
        },
        timeout: 15000
      }
    );
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
  }
};

testReveal();
