/**
 * Check STK Push Transaction Status
 * Run: node check-stk-status.js <CheckoutRequestID>
 */

const axios = require('axios');

const CONSUMER_KEY = 'P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw';
const CONSUMER_SECRET = 'DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v';
const PASSKEY = '9c79f92c1fe6fe1144dfdb4a4543d0d0b8772f52f43d125f611e772121c507e8';
const SHORTCODE = '4501895';

const OAUTH_URL = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const QUERY_URL = 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query';

async function checkStatus(checkoutRequestID) {
  console.log('=== Checking STK Push Status ===\n');
  console.log('CheckoutRequestID:', checkoutRequestID);
  console.log();

  try {
    // Get OAuth token
    console.log('Getting OAuth token...');
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const oauthResponse = await axios.get(OAUTH_URL, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const token = oauthResponse.data.access_token;
    console.log('✅ Token received\n');

    // Query transaction status
    console.log('Querying transaction status...');
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID,
    };

    const response = await axios.post(QUERY_URL, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('\n✅ Transaction Status:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log();

    // Interpret result
    const resultCode = response.data.ResultCode;
    if (resultCode === '0') {
      console.log('✅ Payment SUCCESSFUL!');
    } else if (resultCode === '1032') {
      console.log('❌ Payment CANCELLED by user');
    } else if (resultCode === '1037') {
      console.log('⏱️  TIMEOUT - User did not respond to STK prompt');
    } else if (resultCode === '1001') {
      console.log('⏳ PENDING - User has not completed payment yet');
    } else {
      console.log(`❌ Payment FAILED - ResultCode: ${resultCode}`);
      console.log('ResultDesc:', response.data.ResultDesc);
    }

  } catch (error) {
    console.error('\n❌ ERROR:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Get CheckoutRequestID from command line
const checkoutRequestID = process.argv[2];

if (!checkoutRequestID) {
  console.log('Usage: node check-stk-status.js <CheckoutRequestID>');
  console.log('\nExample:');
  console.log('node check-stk-status.js ws_CO_30062026094316780114565176');
  process.exit(1);
}

checkStatus(checkoutRequestID);
