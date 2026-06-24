/**
 * /api/ops — Operations router
 * Consolidates: payout, notify, bracket  (saves Vercel function slots)
 * PhinTech Arena | PhinTech Solutions, Kenya
 *
 * Routes via ?type= param:
 *   type=payout   → M-Pesa B2C prize/withdrawal payouts
 *   type=notify   → outbound email/SMS queue processor
 *   type=bracket  → bracket state + progression + check-in
 *
 * Examples:
 *   POST /api/ops?type=payout               → run payout queue (cron/admin)
 *   POST /api/ops?type=payout&action=withdraw → user withdrawal
 *   POST /api/ops?type=notify               → run notification queue
 *   GET  /api/ops?type=bracket&tournament_id=X → bracket state
 *   POST /api/ops?type=bracket&action=checkin  → check in
 *   POST /api/ops?type=bracket&action=advance  → advance round
 */

const { getServiceClient, getUser, setCors, normalizeKEPhone } = require('./_supabase');

// ── PAYOUT ─────────────────────────────────────────────────────────────────────
const AT_BASE    = 'https://payments.africastalking.com/mobile/b2c/request';
const AT_SANDBOX = 'https://payments.sandbox.africastalking.com/mobile/b2c/request';

async function sendMpesaB2C({ phone, amount, reason, username, apiKey, isSandbox }) {
  const url  = isSandbox ? AT_SANDBOX : AT_BASE;
  const body = new URLSearchParams({
    username,
    productName: 'PhinTechArena',
    recipients: JSON.stringify([{
      phoneNumber: phone.startsWith('+') ? phone : '+' + phone,
      amount:      `KES ${amount}`,
      reason,
      metadata: { source: 'PhinTech Arena Tournament Prize' },
    }]),
  });
  const resp = await fetch(url, {
    method:  'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'apiKey': apiKey },
    body,
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(`AT B2C ${resp.status}: ${t}`); }
  return resp.json();
}

async function processSinglePayout(sb, payout, { AT_KEY, AT_USER, isSandbox }) {
  await sb.from('payout_queue').update({ status: 'processing' }).eq('id', payout.id);
  try {
    const result = await sendMpesaB2C({
      phone: payout.phone, amount: payout.amount_kes,
      reason: payout.placement === 1 ? 'SalaryPayment' : 'BusinessPayment',
      username: AT_USER, apiKey: AT_KEY, isSandbox,
    });
    const entry   = result.responses?.[0];
    const success = entry?.status === 'Queued' || entry?.status === 'Success';
    await sb.from('payout_queue').update({
      status: success ? 'paid' : 'failed',
      processed_at: new Date().toISOString(),
      mpesa_code:   entry?.transactionId || null,
      failure_reason: success ? null : (entry?.errorMessage || 'Unknown'),
    }).eq('id', payout.id);
    if (success) {
      await sb.from('notifications').insert({
        user_id: payout.user_id, type: 'prize_paid', title: '💰 Money Sent!',
        message: `KES ${payout.amount_kes} sent to ${payout.phone}. Ref: ${entry?.transactionId || 'pending'}.`,
        data: { payout_id: payout.id, amount: payout.amount_kes },
      });
    }
  } catch (e) {
    await sb.from('payout_queue').update({
      status: 'failed', failure_reason: e.message,
      retry_count: payout.retry_count + 1,
    }).eq('id', payout.id);
    throw e;
  }
}

async function handlePayout(req, res, sb) {
  const AT_KEY    = process.env.AT_API_KEY;
  const AT_USER   = process.env.AT_USERNAME || 'sandbox';
  const isSandbox = AT_USER === 'sandbox';
  const cronSecret = process.env.CRON_SECRET;
  const action    = req.query.action;

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });

  // User withdrawal
  if (action === 'withdraw') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    const { amount } = req.body || {};
    if (!amount || amount < 50) return res.status(400).json({ error: 'Minimum withdrawal is KES 50.' });
    const { data: profile } = await sb.from('profiles').select('phone').eq('id', user.id).single();
    if (!profile?.phone) return res.status(400).json({ error: 'Add your M-Pesa number to your profile first.' });
    const ok = await sb.rpc('debit_wallet', { p_user_id: user.id, p_amount: parseInt(amount), p_type: 'withdrawal', p_desc: `Withdrawal to ${profile.phone}`, p_ref: 'WD-' + Date.now() });
    if (!ok.data) return res.status(400).json({ error: 'Insufficient balance.' });
    const { data: payout } = await sb.from('payout_queue').insert({ user_id: user.id, tournament_id: null, phone: profile.phone, amount_kes: parseInt(amount), placement: 0, status: 'pending' }).select().single();
    if (AT_KEY) { try { await processSinglePayout(sb, payout, { AT_KEY, AT_USER, isSandbox }); } catch (_) {} }
    return res.status(200).json({ success: true, message: `KES ${amount} withdrawal initiated to ${profile.phone}.` });
  }

  // Cron/admin batch
  const isCron = req.headers['authorization'] === `Bearer ${cronSecret}`;
  if (!isCron) {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    const { data: isAdmin } = await sb.rpc('is_admin', { p_user_id: user.id });
    if (!isAdmin) return res.status(403).json({ error: 'Admin access required.' });
  }
  if (!AT_KEY) return res.status(503).json({ error: 'AT_API_KEY not configured.', docs: 'https://developers.africastalking.com/' });
  const { data: pending } = await sb.from('payout_queue').select('*').eq('status', 'pending').lte('retry_count', 3).order('created_at').limit(10);
  if (!pending?.length) return res.status(200).json({ processed: 0, message: 'No pending payouts.' });
  let processed = 0, failed = 0;
  for (const p of pending) { try { await processSinglePayout(sb, p, { AT_KEY, AT_USER, isSandbox }); processed++; } catch (e) { failed++; } }
  return res.status(200).json({ processed, failed, total: pending.length });
}

// ── NOTIFY ─────────────────────────────────────────────────────────────────────
const RESEND_API  = 'https://api.resend.com/emails';
const AT_SMS_API  = 'https://api.africastalking.com/version1/messaging';
const AT_SMS_SAND = 'https://api.sandbox.africastalking.com/version1/messaging';

function buildEmailHtml(subject, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:system-ui,sans-serif;background:#0d0d1a;color:#e0e0e0;margin:0;padding:20px}
    .c{max-width:560px;margin:0 auto;background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #2d2541}
    .h{background:linear-gradient(135deg,#533483,#1a0040);padding:28px;text-align:center}
    .h h1{color:#fff;font-size:22px;margin:0 0 4px}.h p{color:#b39ddb;font-size:13px;margin:0}
    .b{padding:24px}.b p{line-height:1.7;color:#c0c0c0;font-size:14px}
    .btn{display:inline-block;background:linear-gradient(135deg,#533483,#7b1fa2);color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin:14px 0}
    .f{padding:16px 24px;border-top:1px solid #2d2541;text-align:center;font-size:11px;color:#666}
  </style></head><body><div class="c">
    <div class="h"><h1>🎮 PhinTech Arena</h1><p>Kenya's #1 Gaming Tournament Platform</p></div>
    <div class="b"><h2 style="color:#b39ddb;margin-top:0">${subject}</h2>
    ${body.split('\n').map(l => `<p>${l}</p>`).join('')}
    <a href="https://phintech-gamics.vercel.app" class="btn">Open PhinTech Arena →</a></div>
    <div class="f"><p>PhinTech Solutions · Nairobi, Kenya</p></div>
  </div></body></html>`;
}

async function handleNotify(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });

  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const RESEND_FROM = process.env.RESEND_FROM || 'PhinTech Arena <arena@phintechsolutions.com>';
  const AT_KEY      = process.env.AT_API_KEY;
  const AT_USER     = process.env.AT_USERNAME || 'sandbox';
  const isSandbox   = AT_USER === 'sandbox';

  // ── USER-TRIGGERED: subscribe to tournament reminders or request a reminder ──
  const { action: notifyAction } = req.body || {};

  if (notifyAction === 'tournament_reminder') {
    // Any authenticated user can request a reminder for a specific tournament
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });

    const { tournament_id } = req.body || {};
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id required.' });

    // Get tournament and user profile
    const [{ data: tournament }, { data: profile }] = await Promise.all([
      sb.from('tournaments').select('name, game, starts_at, entry_fee, prize_pool').eq('id', tournament_id).single(),
      sb.from('profiles').select('gamer_tag, email_notify, whatsapp_notify, phone').eq('id', user.id).single(),
    ]);

    if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });

    const name       = profile?.gamer_tag || 'Player';
    const gameLabel  = tournament.game || 'the game';
    const startDate  = tournament.starts_at ? new Date(tournament.starts_at).toLocaleString('en-KE') : 'soon';
    const subject    = `⏰ Reminder: ${tournament.name} starts ${startDate}`;
    const body       = `Hey ${name}!\n\nYour tournament "${tournament.name}" (${gameLabel}) is coming up — starting ${startDate}.\n\nEntry Fee: KES ${tournament.entry_fee}\nPrize Pool: KES ${tournament.prize_pool}\n\nMake sure you're checked in and ready to go. Good luck! 🏆`;

    // Queue the notification
    const items = [];
    if (user.email && profile?.email_notify !== false) {
      items.push({ user_id: user.id, channel: 'email', recipient: user.email, subject, body, status: 'pending', retry_count: 0, created_at: new Date().toISOString() });
    }
    if (profile?.phone && profile?.whatsapp_notify) {
      items.push({ user_id: user.id, channel: 'sms', recipient: profile.phone, subject, body: `PhinTech Arena: ${subject}\n${body.slice(0, 140)}`, status: 'pending', retry_count: 0, created_at: new Date().toISOString() });
    }

    if (items.length) {
      await sb.from('notification_queue').insert(items);
    }

    // Also create an in-app notification
    await sb.from('notifications').insert({
      user_id: user.id,
      type:    'tournament_reminder',
      title:   `⏰ Reminder set for "${tournament.name}"`,
      message: `You'll be notified when "${tournament.name}" is about to start.`,
      data:    { tournament_id },
    });

    return res.status(200).json({ success: true, queued: items.length });
  }

  if (notifyAction === 'fav_game_alert') {
    // Notify user when a tournament for their favourite game opens
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    const { tournament_id } = req.body || {};
    const [{ data: profile }, { data: tournament }] = await Promise.all([
      sb.from('profiles').select('gamer_tag, preferred_game, email_notify').eq('id', user.id).single(),
      tournament_id ? sb.from('tournaments').select('name, game, prize_pool').eq('id', tournament_id).single() : Promise.resolve({ data: null }),
    ]);
    if (!profile || !user.email) return res.status(200).json({ success: false, reason: 'no_email' });
    const name    = profile.gamer_tag || 'Player';
    const tname   = tournament?.name || 'a new tournament';
    const subject = `🎮 A ${profile.preferred_game || 'new game'} tournament just opened!`;
    const body    = `Hey ${name}!\n\nGood news — "${tname}" just opened and it matches your favourite game: ${profile.preferred_game || 'your game'}.\n\nPrize Pool: KES ${tournament?.prize_pool || 0}\n\nJoin now before spots fill up!`;
    if (profile.email_notify !== false) {
      await sb.from('notification_queue').insert({ user_id: user.id, channel: 'email', recipient: user.email, subject, body, status: 'pending', retry_count: 0, created_at: new Date().toISOString() });
    }
    return res.status(200).json({ success: true });
  }

  // ── CRON / ADMIN: process the notification queue ──────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const isCron = req.headers['authorization'] === `Bearer ${cronSecret}`;
  if (!isCron) {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    const { data: isAdmin } = await sb.rpc('is_admin', { p_user_id: user.id });
    if (!isAdmin) return res.status(403).json({ error: 'Admin access required.' });
  }
  const { data: queue } = await sb.from('notification_queue').select('*').eq('status', 'pending').lte('retry_count', 3).order('created_at').limit(20);
  if (!queue?.length) return res.status(200).json({ sent: 0, message: 'Queue empty.' });
  let sent = 0, failed = 0;
  for (const item of queue) {
    try {
      if (item.channel === 'email' && RESEND_KEY) {
        const r = await fetch(RESEND_API, { method: 'POST', headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: RESEND_FROM, to: item.recipient, subject: item.subject || 'PhinTech Arena', html: buildEmailHtml(item.subject || 'Notification', item.body) }) });
        if (!r.ok) throw new Error(`Resend ${r.status}`);
      } else if ((item.channel === 'sms' || item.channel === 'whatsapp') && AT_KEY) {
        const url  = isSandbox ? AT_SMS_SAND : AT_SMS_API;
        const body = new URLSearchParams({ username: AT_USER, to: item.recipient.startsWith('+') ? item.recipient : '+' + item.recipient, message: item.body, from: 'PHINTECH' });
        const r = await fetch(url, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'apiKey': AT_KEY }, body });
        if (!r.ok) throw new Error(`AT SMS ${r.status}`);
      }
      await sb.from('notification_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', item.id);
      sent++;
    } catch (e) {
      failed++;
      await sb.from('notification_queue').update({ status: item.retry_count >= 3 ? 'failed' : 'pending', failure_reason: e.message, retry_count: item.retry_count + 1 }).eq('id', item.id);
    }
  }
  return res.status(200).json({ sent, failed, total: queue.length });
}

// ── BRACKET ─────────────────────────────────────────────────────────────────────
async function handleBracket(req, res, sb) {
  const { tournament_id, action } = req.query;

  if (req.method === 'GET') {
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id required.' });
    const [{ data: tournament }, { data: matches }, { data: registrations }] = await Promise.all([
      sb.from('tournaments').select('*').eq('id', tournament_id).single(),
      sb.from('matches').select('*').eq('tournament_id', tournament_id).order('round').order('match_number'),
      sb.from('registrations').select('gamer_tag, payment_status, seed, check_in, profiles(avatar_url, county)').eq('tournament_id', tournament_id).eq('payment_status', 'paid'),
    ]);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
    const rounds = {};
    for (const m of (matches || [])) { if (!rounds[m.round]) rounds[m.round] = []; rounds[m.round].push(m); }
    const paidCount   = (registrations || []).length;
    const checkedIn   = (registrations || []).filter(r => r.check_in).length;
    const totalRounds = tournament.total_rounds || Math.ceil(Math.log2(Math.max(paidCount, 2)));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ tournament: { ...tournament, player_count: paidCount, checked_in: checkedIn, total_rounds: totalRounds }, rounds, players: registrations || [], match_count: (matches || []).length, current_round: tournament.current_round || 1 });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  if (action === 'checkin') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id required.' });
    const { data: ok } = await sb.rpc('player_check_in', { p_tournament_id: tournament_id, p_user_id: user.id });
    return ok ? res.status(200).json({ success: true, message: 'Checked in! Good luck 🎮' }) : res.status(404).json({ error: 'Registration not found.' });
  }

  if (action === 'advance') {
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id required.' });
    const { data: t } = await sb.from('tournaments').select('current_round, status').eq('id', tournament_id).single();
    if (!t) return res.status(404).json({ error: 'Tournament not found.' });
    if (t.status === 'completed') return res.status(200).json({ action: 'already_complete' });
    const { data: open } = await sb.from('matches').select('id').eq('tournament_id', tournament_id).eq('round', t.current_round).not('status', 'in', '("verified","bye")');
    if (open?.length > 0) return res.status(200).json({ action: 'waiting', remaining: open.length, message: `${open.length} match(es) still in progress.` });
    const { data: result } = await sb.rpc('advance_bracket', { p_tournament_id: tournament_id });
    return res.status(200).json(result);
  }

  return res.status(400).json({ error: 'Unknown action.' });
}

// ── MAIN ROUTER ───────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const sb   = getServiceClient();
  const type = req.query.type;
  if (type === 'payout')  return handlePayout(req, res, sb);
  if (type === 'notify')  return handleNotify(req, res, sb);
  if (type === 'bracket') return handleBracket(req, res, sb);
  return res.status(400).json({ error: 'type param required: payout | notify | bracket' });
};
