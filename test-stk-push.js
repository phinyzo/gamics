/**
 * Direct M-Pesa STK Push Test
 * Run: node test-stk-push.js
 */

const axios = require('axios');

// Load from .env.production.local or hardcode temporarily
const CONSUMER_KEY = 'P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw';
const CONSUMER_SECRET = 'DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v';
const PASSKEY = '9c79f92c1fe6fe1144dfdb4a4543d0d0b8772f52f43d125f611e772121c507e8';
const SHORTCODE = '4501895';
const PHONE = '254756546347'; // Your phone number
const AMOUNT = 10;
const CALLBACK_URL = 'https://gamics.vercel.app/api/mpesa-callback';

const OAUTH_URL = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const STK_PUSH_URL = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

async function testSTKPush() {
  console.log('=== M-Pesa STK Push Direct Test ===\n');

  try {
    // Step 1: Get OAuth token
    console.log('Step 1: Getting OAuth token...');
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    
    const oauthResponse = await axios.get(OAUTH_URL, {
      headers: { Authorization: `Basic ${auth}` },
    });
    
    const token = oauthResponse.data.access_token;
    console.log('✅ OAuth Success! Token received:', token.substring(0, 20) + '...\n');

    // Step 2: Generate timestamp and password
    console.log('Step 2: Generating STK Push request...');
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: AMOUNT,
      PartyA: PHONE,
      PartyB: SHORTCODE,
      PhoneNumber: PHONE,
      CallBackURL: CALLBACK_URL,
      AccountReference: 'TEST-' + Date.now(),
      TransactionDesc: 'PhinTech Arena Payment',
    };

    console.log('Request payload:');
    console.log(JSON.stringify({ ...payload, Password: '[REDACTED]' }, null, 2));
    console.log();

    // Step 3: Send STK Push
    console.log('Step 3: Sending STK Push request...');
    const stkResponse = await axios.post(STK_PUSH_URL, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('\n✅ STK Push Response:');
    console.log(JSON.stringify(stkResponse.data, null, 2));
    console.log('\n🎉 SUCCESS! Check your phone for STK Push prompt!');
    console.log(`Phone: ${PHONE}`);
    console.log(`Amount: KES ${AMOUNT}`);
    console.log(`CheckoutRequestID: ${stkResponse.data.CheckoutRequestID}`);

  } catch (error) {
    console.error('\n❌ ERROR:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      // Specific error guidance
      const errorCode = error.response.data?.errorCode;
      const errorMessage = error.response.data?.errorMessage;
      
      console.error('\n🔍 Error Analysis:');
      if (errorCode === '400.002.02') {
        console.error('❌ Invalid Shortcode - Verify shortcode 4501895 is correct and active');
      } else if (errorMessage?.includes('Invalid Access Token')) {
        console.error('❌ OAuth failed - Check Consumer Key and Secret');
      } else if (errorMessage?.includes('Invalid Phone')) {
        console.error('❌ Invalid phone number format');
      } else if (errorMessage?.includes('initiator')) {
        console.error('❌ Initiator not configured in Daraja portal');
      } else {
        console.error('Unknown error - Check Daraja portal configuration');
      }
    } else {
      console.error('Network error:', error.message);
    }
  }
}

console.log('Testing M-Pesa STK Push with:');
console.log('- Phone:', PHONE);
console.log('- Amount: KES', AMOUNT);
console.log('- Shortcode:', SHORTCODE);
console.log('- Callback:', CALLBACK_URL);
console.log();

testSTKPush();
