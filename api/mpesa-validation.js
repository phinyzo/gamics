/**
 * Payment Validation URL
 * Safaricom calls this BEFORE processing payment to validate the transaction
 * 
 * URL: https://gamics.vercel.app/api/mpesa-validation
 */
const { setCors } = require('./_supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  console.log('[payment-validation] Received validation request:', JSON.stringify(req.body, null, 2));

  // Safaricom expects this exact response format
  // ResultCode 0 = Accept payment
  // ResultCode non-zero = Reject payment
  
  const validation = req.body || {};
  
  // You can add custom validation logic here
  // For now, accept all payments
  
  const response = {
    ResultCode: 0,
    ResultDesc: "Accepted"
  };

  console.log('[payment-validation] Responding with:', response);
  
  return res.status(200).json(response);
};
