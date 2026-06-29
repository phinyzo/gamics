/**
 * M-Pesa Daraja API Service
 * PhinTech Arena | PhinTech Solutions, Kenya
 *
 * Handles:
 *   - OAuth token generation
 *   - STK Push (Lipa Na M-Pesa)
 *   - Transaction status query
 *   - B2C payouts (optional)
 *
 * Docs: https://developer.safaricom.co.ke/APIs
 */
const axios = require('axios');

const ENV = process.env.MPESA_ENVIRONMENT || 'production';

const ENDPOINTS = {
  sandbox: {
    oauth:      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPush:    'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    stkQuery:   'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
    b2c:        'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest',
    txStatus:   'https://sandbox.safaricom.co.ke/mpesa/transactionstatus/v1/query',
  },
  production: {
    oauth:      'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPush:    'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    stkQuery:   'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query',
    b2c:        'https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest',
    txStatus:   'https://api.safaricom.co.ke/mpesa/transactionstatus/v1/query',
  },
};

const API = ENDPOINTS[ENV];

// ── OAuth: Get Access Token ──────────────────────────────────────────────────
async function getAccessToken() {
  // Trim env vars to remove any newlines/whitespace from Vercel
  const consumerKey = (process.env.MPESA_CONSUMER_KEY || '').trim();
  const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || '').trim();
  
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const { data } = await axios.get(API.oauth, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return data.access_token;
  } catch (err) {
    console.error('[mpesa-daraja] OAuth failed:', err.response?.data || err.message);
    throw new Error('Failed to authenticate with M-Pesa Daraja API');
  }
}

// ── STK Push: Prompt user to pay ─────────────────────────────────────────────
/**
 * Initiates STK Push (Lipa Na M-Pesa)
 * @param {string} phone - 254XXXXXXXXX format
 * @param {number} amount - Amount in KES
 * @param {string} accountRef - Unique reference (e.g., WALLET-ABC-123)
 * @param {string} description - Transaction description
 * @returns {Promise<{CheckoutRequestID: string, ResponseCode: string, ...}>}
 */
async function stkPush(phone, amount, accountRef, description = 'PhinTech Arena Payment') {
  const token = await getAccessToken();
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  
  // Trim env vars
  const shortcode = (process.env.MPESA_SHORTCODE || '').trim();
  const passkey = (process.env.MPESA_PASSKEY || '').trim();
  
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: shortcode,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   'CustomerPayBillOnline',
    Amount:            Math.floor(amount),
    PartyA:            phone,                           // Customer phone
    PartyB:            shortcode,     // Your till/paybill
    PhoneNumber:       phone,
    CallBackURL:       (process.env.MPESA_CALLBACK_URL || '').trim(),  // Your Vercel endpoint
    AccountReference:  accountRef,
    TransactionDesc:   description,
  };

  try {
    const { data } = await axios.post(API.stkPush, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[mpesa-daraja] STK Push initiated:', data.CheckoutRequestID, accountRef);
    return data;
  } catch (err) {
    console.error('[mpesa-daraja] STK Push failed:', err.response?.data || err.message);
    throw new Error(err.response?.data?.errorMessage || 'M-Pesa STK Push failed');
  }
}

// ── STK Query: Check transaction status ──────────────────────────────────────
/**
 * Queries STK Push transaction status
 * @param {string} checkoutRequestID - From STK Push response
 * @returns {Promise<{ResultCode: string, ResultDesc: string, ...}>}
 */
async function stkQuery(checkoutRequestID) {
  const token = await getAccessToken();
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const password = Buffer.from(
    `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
  ).toString('base64');

  const payload = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password:          password,
    Timestamp:         timestamp,
    CheckoutRequestID: checkoutRequestID,
  };

  try {
    const { data } = await axios.post(API.stkQuery, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (err) {
    console.error('[mpesa-daraja] STK Query failed:', err.response?.data || err.message);
    throw new Error('Failed to query M-Pesa transaction status');
  }
}

// ── B2C: Send money to customer (payouts) ────────────────────────────────────
/**
 * Sends money to customer's M-Pesa wallet
 * @param {string} phone - 254XXXXXXXXX
 * @param {number} amount - Amount in KES
 * @param {string} remarks - Transaction remarks
 * @returns {Promise<{ConversationID: string, ResponseCode: string, ...}>}
 */
async function b2cPayout(phone, amount, remarks = 'PhinTech Arena Payout') {
  const token = await getAccessToken();

  const payload = {
    InitiatorName:      'apiop',  // Your Daraja initiator name
    SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL, // Encrypted password
    CommandID:          'BusinessPayment',
    Amount:             Math.floor(amount),
    PartyA:             process.env.MPESA_SHORTCODE,
    PartyB:             phone,
    Remarks:            remarks,
    QueueTimeOutURL:    `${process.env.MPESA_CALLBACK_URL}?type=b2c_timeout`,
    ResultURL:          `${process.env.MPESA_CALLBACK_URL}?type=b2c_result`,
    Occassion:          'Withdrawal',
  };

  try {
    const { data } = await axios.post(API.b2c, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[mpesa-daraja] B2C initiated:', data.ConversationID);
    return data;
  } catch (err) {
    console.error('[mpesa-daraja] B2C failed:', err.response?.data || err.message);
    throw new Error(err.response?.data?.errorMessage || 'M-Pesa B2C payout failed');
  }
}

module.exports = {
  getAccessToken,
  stkPush,
  stkQuery,
  b2cPayout,
};
