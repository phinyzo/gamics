/**
 * /api/payment-callback — Payment provider callback
 * PhinTech Arena | PhinTech Solutions, Kenya
 *
 * Handles payment callbacks for:
 *   1. Tournament registration payment  → ref starts with "ARENA-"
 *   2. Wallet deposit                   → ref starts with "WALLET-"
 *   3. B2C payout results (optional)    → ?type=b2c_result
 *
 * After payment:
 *   - Updates registration to paid OR credits wallet
 *   - Sends in-app notification
 *   - Triggers bracket auto-start if tournament is now full
 */
const { getServiceClient, setCors } = require('./_supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('[payment-callback] Received:', JSON.stringify(req.body, null, 2));

  // ── Handle payment provider STK Push callback ─────────────────────────────────
  const darajaBody = req.body?.Body?.stkCallback;
  if (darajaBody) {
    // Daraja callback format
    const resultCode = darajaBody.ResultCode;
    const resultDesc = darajaBody.ResultDesc;
    const checkoutRequestID = darajaBody.CheckoutRequestID;

    // Extract CallbackMetadata if payment successful
    let amount, phone, mpesaCode, ref;
    if (resultCode === 0 && darajaBody.CallbackMetadata?.Item) {
      const items = darajaBody.CallbackMetadata.Item;
      amount = items.find(i => i.Name === 'Amount')?.Value;
      phone = items.find(i => i.Name === 'PhoneNumber')?.Value;
      mpesaCode = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
    }

    // Find transaction by CheckoutRequestID
    const sb = getServiceClient();
    const { data: tx } = await sb.from('wallet_transactions')
      .select('*')
      .eq('mpesa_checkout_id', checkoutRequestID)
      .maybeSingle();

    if (!tx) {
      console.warn('[mpesa-callback] No transaction found for CheckoutRequestID:', checkoutRequestID);
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    ref = tx.ref;

    // Payment failed
    if (resultCode !== 0) {
      console.log('[mpesa-callback] Payment failed:', resultDesc, ref);
      await sb.from('wallet_transactions').update({ status: 'failed' }).eq('ref', ref);
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    console.log('[mpesa-callback] Payment success:', mpesaCode, ref, 'KES', amount);

    // Continue with existing logic below...
    // Reuse the rest of the code by setting variables to match old format
    const status = 'success';
    // Fall through to existing wallet/tournament logic
  } else {
    // ── Legacy Lipia Online format (backward compatibility) ───────────────────
    const { ref, amount, phone, mpesa_code, status } = req.body || {};
    if (!ref || status !== 'success') return res.status(200).json({ received: true });
    var mpesaCode = mpesa_code;
  }

  const sb = getServiceClient();
  const status = 'success'; // Ensure status is set for Daraja flow

  // ── WALLET DEPOSIT ─────────────────────────────────────────────────────────
  if (ref.startsWith('WALLET-')) {
    const { data: tx } = await sb.from('wallet_transactions')
      .select('*').eq('ref', ref).eq('status', 'pending').maybeSingle();

    if (!tx) return res.status(200).json({ received: true });

    // Credit wallet using DB function
    const { data: wallet } = await sb.rpc('credit_wallet', {
      p_user_id: tx.user_id,
      p_amount:  parseInt(amount) || tx.amount_kes,
      p_type:    'deposit',
      p_desc:    `M-Pesa deposit — KES ${amount} (${mpesa_code})`,
      p_ref:     mpesa_code || ref,
    });

    // Mark pending transaction as completed
    await sb.from('wallet_transactions')
      .update({ 
        status: 'completed', 
        balance_after: wallet?.balance_kes || 0,
        mpesa_code: mpesaCode || mpesa_code || null,
      })
      .eq('ref', ref);

    // In-app notification
    await sb.from('notifications').insert({
      user_id: tx.user_id,
      type:    'tournament_reminder',
      title:   '💰 Wallet Topped Up!',
      message: `KES ${amount} (${mpesa_code}) added to your PhinTech Arena wallet. Balance: KES ${wallet?.balance_kes || amount}.`,
      data:    { amount, mpesa_code, wallet_balance: wallet?.balance_kes },
    });

    // Queue SMS
    if (phone) {
      await sb.from('notification_queue').insert({
        user_id:   tx.user_id,
        channel:   'sms',
        recipient: phone.startsWith('+') ? phone : '+' + phone,
        body:      `PhinTech Arena: KES ${amount} added to your wallet (${mpesa_code}). Ready to join tournaments!`,
      });
    }

    console.log('[mpesa-callback] Wallet deposit:', tx.user_id, 'KES', amount);
    return res.status(200).json({ received: true, type: 'wallet_deposit' });
  }

  // ── TOURNAMENT REGISTRATION PAYMENT ──────────────────────────────────────
  if (ref.startsWith('ARENA-')) {
    const { data: reg, error } = await sb.from('registrations')
      .select('*, tournaments(*)').eq('payment_ref', ref).maybeSingle();

    if (error || !reg) {
      console.error('[mpesa-callback] Registration not found for ref:', ref);
      return res.status(200).json({ received: true });
    }

    // Update to paid
    const { error: ue } = await sb.from('registrations').update({
      payment_status: 'paid',
      mpesa_code:     mpesaCode || mpesa_code || null,
    }).eq('id', reg.id);

    if (!ue) {
      const t = reg.tournaments;

      // In-app notification
      await sb.from('notifications').insert({
        user_id: reg.user_id,
        type:    'tournament_reminder',
        title:   `🎮 You're in! ${t?.name}`,
        message: `Payment of KES ${amount} confirmed (${mpesaCode || mpesa_code}). Tournament: ${t?.name}. Game: ${t?.game}. Starts: ${t?.start_date}.`,
        data:    { tournament_id: reg.tournament_id, mpesa_code: mpesaCode || mpesa_code },
      });

      // Queue SMS confirmation
      if (phone) {
        await sb.from('notification_queue').insert({
          user_id:   reg.user_id,
          channel:   'sms',
          recipient: phone.startsWith('+') ? phone : '+' + phone,
          body:      `PhinTech Arena: KES ${amount} received (${mpesaCode || mpesa_code}). You're registered for ${t?.name}! Game on 🎮`,
        });
      }

      // Award referral bonus to referrer if first paid tournament
      const { data: profile } = await sb.from('profiles')
        .select('referred_by').eq('id', reg.user_id).single();

      if (profile?.referred_by) {
        const { data: prevPaid } = await sb.from('registrations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', reg.user_id)
          .eq('payment_status', 'paid');

        if ((prevPaid || 0) <= 1) {
          // First paid tournament — award bonus to referrer
          await sb.rpc('award_points', {
            p_user_id: profile.referred_by,
            p_type:    'invite_paid',
            p_amount:  100,
            p_desc:    'Your invite friend played their first paid tournament!',
            p_ref_id:  reg.user_id,
          });
          // Mark bonus claimed
          await sb.from('referrals')
            .update({ bonus_claimed: true })
            .eq('referrer_id', profile.referred_by)
            .eq('referred_id', reg.user_id);
        }
      }

      console.log('[mpesa-callback] Registration confirmed:', reg.id, 'for', reg.gamer_tag);
    }

    return res.status(200).json({ received: true, type: 'tournament_registration', confirmed: !ue });
  }

  return res.status(200).json({ received: true });
};
