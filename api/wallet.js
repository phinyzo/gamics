/**
 * /api/wallet — KES wallet operations
 * PhinTech Arena | PhinTech Solutions, Kenya
 *
 * GET  /api/wallet              → own wallet balance + recent transactions
 * POST /api/wallet?action=deposit  → record M-Pesa deposit (STK push via Lipia)
 * POST /api/wallet?action=withdraw → initiate M-Pesa withdrawal (delegates to payout)
 */
const { getServiceClient, getUser, setCors, normalizeKEPhone } = require('./_supabase');

const LIPIA_BASE = 'https://lipia-online.vercel.app/link/PHINTECHSOLUTIONS';

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const sb     = getServiceClient();
  const action = req.query.action;

  // ── GET: wallet balance + transactions ──────────────────────────────────────
  if (req.method === 'GET') {
    // Ensure wallet exists
    const { data: wallet } = await sb.rpc('get_or_create_wallet', { p_user_id: user.id });

    const { data: transactions } = await sb.from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    // Pending payouts
    const { data: payouts } = await sb.from('payout_queue')
      .select('amount_kes, status, created_at, placement')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return res.status(200).json({
      wallet:       wallet || { balance_kes: 0, total_deposited: 0, total_withdrawn: 0 },
      transactions: transactions || [],
      payouts:      payouts || [],
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── POST: initiate deposit (returns Lipia STK push URL) ─────────────────────
  if (action === 'deposit') {
    const { amount, phone } = req.body || {};
    if (!amount || amount < 10)   return res.status(400).json({ error: 'Minimum deposit is KES 10.' });
    if (!phone)                   return res.status(400).json({ error: 'Phone number required.' });

    // Normalise phone — accepts 07XX, 01XX, 7XX, 1XX, 254XX, +254XX
    const normPhone = normalizeKEPhone(phone);
    if (!normPhone)
      return res.status(400).json({ error: 'Invalid phone number. Use format: 07XXXXXXXX, 01XXXXXXXX, or +254XXXXXXXXX' });

    const ref = `WALLET-${user.id.slice(0, 8).toUpperCase()}-${Date.now()}`;

    // Return Lipia URL — user pays, Lipia calls /api/mpesa-callback?type=deposit
    const params = new URLSearchParams({ phone: normPhone, amount, ref });
    const paymentUrl = `${LIPIA_BASE}?${params}`;

    // Store pending transaction so callback can match it
    await sb.from('wallet_transactions').insert({
      user_id:      user.id,
      type:         'deposit',
      amount_kes:   parseInt(amount),
      balance_after: 0,    // will be updated on callback
      status:       'pending',
      ref,
      description:  `Wallet deposit — KES ${amount}`,
    });

    return res.status(200).json({
      payment_url: paymentUrl,
      ref,
      message: `Complete M-Pesa payment of KES ${amount} to add funds to your wallet.`,
    });
  }

  // ── POST: withdraw ───────────────────────────────────────────────────────────
  if (action === 'withdraw') {
    // Delegate to payout API
    const { amount } = req.body || {};
    if (!amount || amount < 50)
      return res.status(400).json({ error: 'Minimum withdrawal is KES 50.' });

    const { data: ok, error } = await sb.rpc('debit_wallet', {
      p_user_id: user.id,
      p_amount:  parseInt(amount),
      p_type:    'withdrawal',
      p_desc:    `Withdrawal to M-Pesa`,
      p_ref:     'WD-' + Date.now(),
    });

    if (error || !ok) {
      return res.status(400).json({ error: 'Insufficient wallet balance.' });
    }

    // Get profile phone
    const { data: profile } = await sb.from('profiles')
      .select('phone, gamer_tag').eq('id', user.id).single();

    if (!profile?.phone)
      return res.status(400).json({ error: 'Add your M-Pesa number to your profile first.' });

    // Queue B2C payout
    await sb.from('payout_queue').insert({
      user_id:       user.id,
      tournament_id: null,
      phone:         profile.phone,
      amount_kes:    parseInt(amount),
      placement:     0,
      status:        'pending',
    });

    // Notification
    await sb.from('notifications').insert({
      user_id: user.id,
      type:    'prize_paid',
      title:   '💸 Withdrawal Requested',
      message: `KES ${amount} withdrawal to ${profile.phone} is being processed. You'll receive it within minutes.`,
      data:    { amount, phone: profile.phone },
    });

    return res.status(200).json({
      success: true,
      message: `KES ${amount} withdrawal initiated to ${profile.phone}. Processing within minutes.`,
    });
  }

  // ── POST: record direct till payment for admin review ───────────────────────
  if (action === 'deposit_till') {
    const { ref, amount, till } = req.body || {};
    if (!ref)               return res.status(400).json({ error: 'M-Pesa confirmation code is required.' });
    if (!amount || amount < 10) return res.status(400).json({ error: 'Minimum deposit is KES 10.' });

    // Check for duplicate ref
    const { data: existing } = await sb.from('wallet_transactions')
      .select('id').eq('ref', ref).maybeSingle();
    if (existing) return res.status(409).json({ error: 'This M-Pesa code has already been submitted.' });

    // Store as pending — admin will verify and credit manually (or via automation)
    await sb.from('wallet_transactions').insert({
      user_id:       user.id,
      type:          'deposit',
      amount_kes:    parseInt(amount),
      balance_after: 0,       // updated when admin confirms
      status:        'pending',
      ref:           ref.toUpperCase(),
      description:   `Till deposit (${till || '5535650'}) — KES ${amount} — awaiting verification`,
    });

    // Notify admin via notifications table
    await sb.from('notifications').insert({
      user_id: user.id,
      type:    'deposit_till',
      title:   '💳 Till Deposit Submitted',
      message: `User submitted till payment: KES ${amount} — ref ${ref}. Please verify and credit wallet.`,
      data:    { ref, amount, till: till || '5535650', user_id: user.id },
    });

    return res.status(200).json({
      success: true,
      message: `Thank you! Your payment of KES ${amount} (ref: ${ref}) has been received and is pending verification.`,
    });
  }

  return res.status(400).json({ error: 'Unknown action.' });
};
