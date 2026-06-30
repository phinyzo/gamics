/**
 * Register C2B Confirmation and Validation URLs with Safaricom
 * Run: node register-c2b-urls.js
 * 
 * This MUST be done before STK Push will work with Till numbers
 */

const axios = require('axios');

const CONSUMER_KEY = 'P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw';
const CONSUMER_SECRET = 'DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v';
const SHORTCODE = '4501895';

const VALIDATION_URL = 'https://gamics.vercel.app/api/mpesa-validation';
const CONFIRMATION_URL = 'https://gamics.vercel.app/api/mpesa-confirmation';

const OAUTH_URL = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const REGISTER_URL = 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl';

async function registerURLs() {
  console.log('=== Registering C2B URLs with Safaricom ===\n');
  console.log('Shortcode:', SHORTCODE);
  console.log('Validation URL:', VALIDATION_URL);
  console.log('Confirmation URL:', CONFIRMATION_URL);
  console.log();

  try {
    // Get OAuth token
    console.log('Step 1: Getting OAuth token...');
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const oauthResponse = await axios.get(OAUTH_URL, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const token = oauthResponse.data.access_token;
    console.log('✅ Token received\n');

    // Register URLs
    console.log('Step 2: Registering URLs...');
    const payload = {
      ShortCode: SHORTCODE,
      ResponseType: 'Completed', // or 'Cancelled' - use 'Completed' for production
      ConfirmationURL: CONFIRMATION_URL,
      ValidationURL: VALIDATION_URL,
    };

    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log();

    const response = await axios.post(REGISTER_URL, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Registration Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log();

    if (response.data.ResponseCode === '0' || response.data.ResponseDescription?.includes('success')) {
      console.log('🎉 SUCCESS! URLs registered successfully!');
      console.log();
      console.log('Your Till can now receive payment notifications.');
      console.log('Try the STK Push test again: node test-stk-push.js');
    } else {
      console.log('⚠️  Registration may have failed. Check response above.');
    }

  } catch (error) {
    console.error('\n❌ ERROR:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      // Common errors
      const errorMessage = error.response.data?.errorMessage || '';
      if (errorMessage.includes('Invalid ShortCode')) {
        console.error('\n💡 Fix: Verify shortcode 4501895 is correct');
      } else if (errorMessage.includes('Invalid URL')) {
        console.error('\n💡 Fix: URLs must be HTTPS and publicly accessible');
      } else if (errorMessage.includes('C2B')) {
        console.error('\n💡 Fix: Ensure C2B v2 is enabled in your Daraja app');
      }
    } else {
      console.error('Network error:', error.message);
    }
  }
}

registerURLs();
