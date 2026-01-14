const axios = require('axios');

const testReveal = async () => {
  try {
    const response = await axios.post(
      'http://localhost:3001/api/apollo-leads/reveal-email',
      { person_id: '62c918a17338f1000166e93d' },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': '1ead8e68-2375-43bd-91c9-555df2521dec',
          'Authorization': 'Bearer test-token'
        }
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
