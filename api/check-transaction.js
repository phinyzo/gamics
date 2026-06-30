/**
 * Check transaction status and M-Pesa response
 * GET /api/check-transaction?ref=WALLET-XXX-XXX
 */
const { getServiceClient } = require('./_supabase');

module.exports = async function handler(req, res) {
  const { ref } = req.query;
  
  if (!ref) {
    return res.status(400).json({ error: 'Provide transaction ref as query param' });
  }

  const sb = getServiceClient();
  
  const { data: transaction, error } = await sb
    .from('wallet_transactions')
    .select('*')
    .eq('ref', ref)
    .single();

  if (error || !transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  return res.status(200).json({
    ref: transaction.ref,
    status: transaction.status,
    amount: transaction.amount_kes,
    description: transaction.description,
    mpesa_checkout_id: transaction.mpesa_checkout_id,
    mpesa_code: transaction.mpesa_code,
    created_at: transaction.created_at,
    phone_used: transaction.description?.match(/254\d{9}/)?.[0] || 'Unknown',
  });
};
