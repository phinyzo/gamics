// Test M-Pesa Daraja OAuth directly
const axios = require('axios');

const CONSUMER_KEY = 'P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw';
const CONSUMER_SECRET = 'DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v';

async function test() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  console.log('Auth header:', auth);
  
  try {
    const { data } = await axios.get(
      'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}` } }
    );
    console.log('✅ SUCCESS! Token:', data.access_token);
  } catch (err) {
    console.error('❌ FAILED:', err.response?.data || err.message);
  }
}

test();
