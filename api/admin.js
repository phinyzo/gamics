/**
 * /api/admin — Admin operations + Config + Ops Router
 * PhinTech Arena | PhinTech Solutions, Kenya
 *
 * Consolidated endpoint (saves Vercel function slots):
 *   - Admin operations
 *   - Public config
 *   - Operations (payouts, notifications, bracket)
 *
 * GET  /api/admin?action=config      → public client config
 * GET  /api/admin?action=dashboard   → stats overview
 * POST /api/admin?action=approve     → approve tournament
 * POST /api/admin?action=reject      → reject + notify host
 * POST /api/admin?action=dispute     → resolve a disputed match
 * POST /api/admin?action=payout      → manually trigger payouts
 * POST /api/admin?action=set_admin   → grant/revoke admin role
 * GET  /api/admin?action=disputes    → list all disputed matches
 * GET  /api/admin?action=pending     → list pending tournaments
 * GET  /api/admin?action=payouts     → payout queue status
 * POST /api/admin?action=advance     → manually advance a bracket round
 *
 * Operations router (from /api/ops):
 *   GET  /api/admin?type=bracket&tournament_id=X → bracket state
 *   POST /api/admin?type=payout                  → run payout queue
 *   POST /api/admin?type=notify                  → run notification queue
 */
const { getServiceClient, getUser, setCors, normalizeKEPhone } = require('./_supabase');

async function requireAdmin(req, sb) {
  const user = await getUser(req);
  if (!user) return { user: null, error: 'Authentication required.' };
  const { data: isAdmin } = await sb.rpc('is_admin', { p_user_id: user.id });
  if (!isAdmin) return { user, error: 'Admin access required.' };
  return { user, error: null };
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb     = getServiceClient();
  const action = req.query.action;
  const type   = req.query.type;

  // ── PUBLIC CONFIG (no auth required) ────────────────────────────────────────
  if (action === 'config') {
    res.setHeader('Cache-Control', 's-maxage=3600');
    const url  = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;
    if (!url || !anon) return res.status(200).json({ supabase: null });
    return res.status(200).json({ supabase: { url, anon_key: anon } });
  }

  // ── OPS ROUTER (from /api/ops) ──────────────────────────────────────────────
  if (type) {
    if (type === 'payout')  return handlePayout(req, res, sb);
    if (type === 'notify')  return handleNotify(req, res, sb);
    if (type === 'bracket') return handleBracket(req, res, sb);
    return res.status(400).json({ error: 'type param must be: payout | notify | bracket' });
  }

  const { user, error } = await requireAdmin(req, sb);
  if (error) return res.status(error === 'Authentication required.' ? 401 : 403).json({ error });

  // ── GET: dashboard stats ────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'dashboard') {
    const [
      { count: totalUsers },
      { count: totalTournaments },
      { count: pendingTournaments },
      { count: disputedMatches },
      { count: pendingPayouts },
      { data: revenueData },
    ] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('tournaments').select('*', { count: 'exact', head: true }),
      sb.from('tournaments').select('*', { count: 'exact', head: true }).eq('pending_approval', true),
      sb.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'disputed'),
      sb.from('payout_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      sb.from('platform_revenue').select('amount_kes').limit(1000),
    ]);

    const totalRevenue = (revenueData || []).reduce((s, r) => s + r.amount_kes, 0);

    return res.status(200).json({
      stats: {
        total_users:          totalUsers  || 0,
        total_tournaments:    totalTournaments || 0,
        pending_tournaments:  pendingTournaments || 0,
        disputed_matches:     disputedMatches || 0,
        pending_payouts:      pendingPayouts  || 0,
        total_revenue_kes:    totalRevenue,
      },
    });
  }

  // ── GET: pending tournaments ────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'pending') {
    const { data, error: e } = await sb.from('tournaments')
      .select('*, profiles(gamer_tag, phone)')
      .eq('pending_approval', true)
      .order('created_at', { ascending: false });
    if (e) return res.status(500).json({ error: e.message });
    return res.status(200).json({ tournaments: data || [] });
  }

  // ── GET: disputed matches ────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'disputes') {
    const { data, error: e } = await sb.from('matches')
      .select('*, tournaments(name, game)')
      .eq('status', 'disputed')
      .order('updated_at', { ascending: false });
    if (e) return res.status(500).json({ error: e.message });
    return res.status(200).json({ matches: data || [] });
  }

  // ── GET: payout queue ───────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'payouts') {
    const { data, error: e } = await sb.from('payout_queue')
      .select('*, profiles(gamer_tag), tournaments(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (e) return res.status(500).json({ error: e.message });
    return res.status(200).json({ payouts: data || [] });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── POST: approve tournament ────────────────────────────────────────────────
  if (action === 'approve') {
    const { tournament_id } = req.body || {};
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id required.' });

    const { data: t, error: e } = await sb.from('tournaments')
      .update({ pending_approval: false, status: 'open', updated_at: new Date().toISOString() })
      .eq('id', tournament_id)
      .select('*, profiles(gamer_tag)')
      .single();

    if (e) return res.status(500).json({ error: e.message });

    // Notify the host
    if (t.host_id) {
      await sb.from('notifications').insert({
        user_id: t.host_id,
        type:    'tournament_reminder',
        title:   '✅ Tournament Approved!',
        message: `Your tournament "${t.name}" is now live and open for registration.`,
        data:    { tournament_id },
      });
      // Queue SMS notification
      if (t.host_contact) {
        await sb.from('notification_queue').insert({
          user_id:   t.host_id,
          channel:   'sms',
          recipient: t.host_contact,
          body:      `PhinTech Arena: Your tournament "${t.name}" has been approved and is now live!`,
        });
      }
    }

    return res.status(200).json({ success: true, tournament: t });
  }

  // ── POST: reject tournament ─────────────────────────────────────────────────
  if (action === 'reject') {
    const { tournament_id, reason } = req.body || {};
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id required.' });

    const { data: t } = await sb.from('tournaments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', tournament_id)
      .select()
      .single();

    if (t?.host_id) {
      await sb.from('notifications').insert({
        user_id: t.host_id,
        type:    'tournament_reminder',
        title:   '❌ Tournament Not Approved',
        message: `Your tournament "${t.name}" was not approved. Reason: ${reason || 'Does not meet guidelines.'}`,
        data:    { tournament_id },
      });
    }

    return res.status(200).json({ success: true });
  }

  // ── POST: resolve dispute ───────────────────────────────────────────────────
  if (action === 'dispute') {
    const { match_id, winner_tag, resolution_note, evidence_url } = req.body || {};
    if (!match_id || !winner_tag)
      return res.status(400).json({ error: 'match_id and winner_tag required.' });

    const { data: match } = await sb.from('matches').select('*').eq('id', match_id).single();
    if (!match) return res.status(404).json({ error: 'Match not found.' });

    const loser_tag = match.player1_tag === winner_tag ? match.player2_tag : match.player1_tag;

    // Update match
    await sb.from('matches').update({
      status:      'verified',
      winner_tag,
      verified_at: new Date().toISOString(),
      dispute_reason: `Admin resolved: ${resolution_note || 'Admin decision.'}`,
    }).eq('id', match_id);

    // Log resolution
    await sb.from('dispute_resolutions').insert({
      match_id, tournament_id: match.tournament_id,
      resolved_by: user.id, winner_tag, loser_tag,
      resolution_note, evidence_url,
    });

    // Update ELO
    const { data: t } = await sb.from('tournaments')
      .select('game').eq('id', match.tournament_id).single();
    if (t?.game) {
      await sb.rpc('update_elo', {
        p_winner_tag: winner_tag,
        p_loser_tag:  loser_tag,
        p_game:       t.game,
      });
    }

    // Notify both players
    for (const [tag, won] of [[winner_tag, true], [loser_tag, false]]) {
      const { data: reg } = await sb.from('registrations')
        .select('user_id').eq('tournament_id', match.tournament_id).eq('gamer_tag', tag).maybeSingle();
      if (reg?.user_id) {
        await sb.from('notifications').insert({
          user_id: reg.user_id,
          type:    'result_verified',
          title:   won ? '⚖️ Dispute Resolved — You Won!' : '⚖️ Dispute Resolved',
          message: won
            ? `Admin reviewed the evidence and awarded the win to you. ELO updated.`
            : `Admin reviewed the dispute. ${winner_tag} was awarded the win.`,
          data: { match_id, tournament_id: match.tournament_id },
        });
      }
    }

    // Check if bracket can advance
    await sb.rpc('advance_bracket', { p_tournament_id: match.tournament_id });

    return res.status(200).json({ success: true, winner: winner_tag, loser: loser_tag });
  }

  // ── POST: manually advance bracket ─────────────────────────────────────────
  if (action === 'advance') {
    const { tournament_id } = req.body || {};
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id required.' });

    const { data: result } = await sb.rpc('advance_bracket', { p_tournament_id: tournament_id });
    return res.status(200).json(result);
  }

  // ── POST: grant/revoke admin ────────────────────────────────────────────────
  if (action === 'set_admin') {
    const { target_user_id, grant } = req.body || {};
    if (!target_user_id) return res.status(400).json({ error: 'target_user_id required.' });

    if (grant) {
      await sb.from('admin_roles').upsert({
        user_id:    target_user_id,
        role:       'admin',
        granted_by: user.id,
      });
      await sb.from('profiles').update({ is_admin: true }).eq('id', target_user_id);
    } else {
      await sb.from('admin_roles').delete().eq('user_id', target_user_id);
      await sb.from('profiles').update({ is_admin: false }).eq('id', target_user_id);
    }

    return res.status(200).json({ success: true, grant });
  }

  // ── POST: trigger payouts manually ─────────────────────────────────────────
  if (action === 'payout') {
    const { tournament_id } = req.body || {};
    if (tournament_id) {
      await sb.rpc('queue_prize_payouts', { p_tournament_id: tournament_id });
    }
    // Delegate actual processing to the ops API
    const payoutUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['host']}/api/ops?type=payout`;
    const resp = await fetch(payoutUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': req.headers['authorization'] },
      body:    JSON.stringify({}),
    });
    const data = await resp.json();
    return res.status(200).json(data);
  }

  return res.status(400).json({ error: 'Unknown action.' });
};


// ══════════════════════════════════════════════════════════════════════════════
// ── OPS HANDLERS (consolidated from /api/ops) ─────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

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

  const { action: notifyAction } = req.body || {};

  if (notifyAction === 'tournament_reminder') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    const { tournament_id } = req.body || {};
    if (!tournament_id) return res.status(400).json({ error: 'tournament_id required.' });
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
    const items = [];
    if (user.email && profile?.email_notify !== false) {
      items.push({ user_id: user.id, channel: 'email', recipient: user.email, subject, body, status: 'pending', retry_count: 0, created_at: new Date().toISOString() });
    }
    if (profile?.phone && profile?.whatsapp_notify) {
      items.push({ user_id: user.id, channel: 'sms', recipient: profile.phone, subject, body: `PhinTech Arena: ${subject}\n${body.slice(0, 140)}`, status: 'pending', retry_count: 0, created_at: new Date().toISOString() });
    }
    if (items.length) await sb.from('notification_queue').insert(items);
    await sb.from('notifications').insert({
      user_id: user.id, type: 'tournament_reminder', title: `⏰ Reminder set for "${tournament.name}"`,
      message: `You'll be notified when "${tournament.name}" is about to start.`, data: { tournament_id },
    });
    return res.status(200).json({ success: true, queued: items.length });
  }

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
