/**
 * /api/mpesa-callback — Lipia Online payment webhook
 * PhinTech Arena | PhinTech Solutions, Kenya
 *
 * Handles two types of payments:
 *   1. Tournament registration payment  → ref starts with "ARENA-"
 *   2. Wallet deposit                   → ref starts with "WALLET-"
 *
 * After payment:
 *   - Updates registration to paid OR credits wallet
 *   - Sends in-app + SMS notification
 *   - Triggers bracket auto-start if tournament is now full
 */
const { getServiceClient, setCors } = require('./_supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ref, amount, phone, mpesa_code, status } = req.body || {};

  // Always acknowledge — Lipia expects 200 even on no-ops
  if (!ref || status !== 'success') return res.status(200).json({ received: true });

  const sb = getServiceClient();

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
      .update({ status: 'completed', balance_after: wallet?.balance_kes || 0 })
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
      mpesa_code:     mpesa_code || null,
    }).eq('id', reg.id);

    if (!ue) {
      const t = reg.tournaments;

      // In-app notification
      await sb.from('notifications').insert({
        user_id: reg.user_id,
        type:    'tournament_reminder',
        title:   `🎮 You're in! ${t?.name}`,
        message: `Payment of KES ${amount} confirmed (${mpesa_code}). Tournament: ${t?.name}. Game: ${t?.game}. Starts: ${t?.start_date}.`,
        data:    { tournament_id: reg.tournament_id, mpesa_code },
      });

      // Queue SMS confirmation
      if (phone) {
        await sb.from('notification_queue').insert({
          user_id:   reg.user_id,
          channel:   'sms',
          recipient: phone.startsWith('+') ? phone : '+' + phone,
          body:      `PhinTech Arena: KES ${amount} received (${mpesa_code}). You're registered for ${t?.name}! Game on 🎮`,
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
