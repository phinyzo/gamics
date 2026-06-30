/**
 * Payment Confirmation URL
 * Safaricom calls this AFTER processing payment to confirm the transaction
 * 
 * URL: https://gamics.vercel.app/api/mpesa-confirmation
 */
const { getServiceClient, setCors } = require('./_supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  console.log('[payment-confirmation] Received confirmation:', JSON.stringify(req.body, null, 2));

  const data = req.body || {};
  
  // Extract payment details
  const {
    TransID,           // Transaction confirmation code
    TransAmount,       // Amount paid
    MSISDN,            // Customer phone number
    BillRefNumber,     // Account reference (your transaction ref)
    TransTime,         // Transaction timestamp
    BusinessShortCode, // Your Till/Paybill number
    FirstName,
    MiddleName,
    LastName,
  } = data;

  try {
    const sb = getServiceClient();

    // Try to find matching pending transaction by reference
    if (BillRefNumber) {
      const { data: transaction } = await sb
        .from('wallet_transactions')
        .select('*')
        .eq('ref', BillRefNumber)
        .eq('status', 'pending')
        .single();

      if (transaction) {
        // Update transaction as completed
        await sb.from('wallet_transactions').update({
          status: 'completed',
          mpesa_code: TransID,
          description: `${transaction.description} — Confirmed: ${TransID}`,
        }).eq('id', transaction.id);

        // Credit wallet
        await sb.rpc('credit_wallet', {
          p_user_id: transaction.user_id,
          p_amount: parseInt(TransAmount),
          p_type: 'deposit',
          p_desc: `Mobile payment confirmed - ${TransID}`,
          p_ref: TransID,
        });

        console.log('[payment-confirmation] Transaction completed:', BillRefNumber);
      } else {
        // No matching transaction - log it for manual review
        console.log('[payment-confirmation] No matching transaction for ref:', BillRefNumber);
        
        // Store in a separate table for manual reconciliation
        await sb.from('unmatched_payments').insert({
          trans_id: TransID,
          amount: parseFloat(TransAmount),
          phone: MSISDN,
          ref: BillRefNumber,
          trans_time: TransTime,
          business_shortcode: BusinessShortCode,
          customer_name: `${FirstName || ''} ${MiddleName || ''} ${LastName || ''}`.trim(),
          raw_data: data,
        });
      }
    }

  } catch (error) {
    console.error('[payment-confirmation] Error processing:', error);
  }

  // Always respond with success - Safaricom retries if we don't
  return res.status(200).json({
    ResultCode: 0,
    ResultDesc: "Accepted"
  });
};
