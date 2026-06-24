/**
 * /api/leaderboard — GET ELO rankings
 * Powered by PhinTech Solutions, Kenya
 */
const { getServiceClient, setCors } = require('./_supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { game, limit = '50', page = '1' } = req.query;
  const from = (parseInt(page) - 1) * parseInt(limit);
  const to   = from + parseInt(limit) - 1;

  const sb = getServiceClient();

  let q = sb.from('leaderboard')
    .select('*, profiles(avatar_url, county)', { count: 'exact' })
    .order('elo', { ascending: false })
    .range(from, to);

  if (game) q = q.eq('game', game);

  const { data, error, count } = await q;
  if (error) return res.status(500).json({ error: error.message });

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  return res.status(200).json({ players: data || [], count });
};
