/**
 * /api/admin — Admin operations
 * PhinTech Arena | PhinTech Solutions, Kenya
 *
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
 */
const { getServiceClient, getUser, setCors } = require('./_supabase');

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
