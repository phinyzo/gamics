/**
 * /api/tournaments — GET list / POST create
 * Powered by PhinTech Solutions, Kenya
 */
const { getServiceClient, getUser, setCors } = require('./_supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getServiceClient();

  // ── GET — list tournaments ────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { game, status, page = '1', limit = '20' } = req.query;
    const from = (parseInt(page) - 1) * parseInt(limit);
    const to   = from + parseInt(limit) - 1;

    let q = sb.from('tournaments')
      .select('*', { count: 'exact' })
      .eq('pending_approval', false)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (game)   q = q.eq('game', game);
    if (status) q = q.eq('status', status);

    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });

    // Attach player count from registrations
    const ids = (data || []).map(t => t.id);
    const { data: regs } = await sb.from('registrations')
      .select('tournament_id')
      .in('tournament_id', ids)
      .eq('payment_status', 'paid');

    const countMap = {};
    (regs || []).forEach(r => {
      countMap[r.tournament_id] = (countMap[r.tournament_id] || 0) + 1;
    });

    const enriched = (data || []).map(t => ({
      ...t,
      player_count: countMap[t.id] || 0,
    }));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ tournaments: enriched, count });
  }

  // ── POST — create tournament (auth required) ──────────────────────────────
  if (req.method === 'POST') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });

    const {
      name, game, format = 'single', max_players = 16,
      entry_fee = 100, prize_pool = 0, platform = 'PS5',
      start_date, rules, host_name, host_contact,
    } = req.body || {};

    if (!name || !game || !start_date || !host_contact)
      return res.status(400).json({ error: 'name, game, start_date and host_contact are required.' });

    const { data, error } = await sb.from('tournaments').insert({
      host_id: user.id, name, game, format,
      max_players: parseInt(max_players),
      entry_fee:   parseInt(entry_fee),
      prize_pool:  parseInt(prize_pool),
      platform, start_date, rules, host_name, host_contact,
      status: 'pending', pending_approval: true,
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ tournament: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
