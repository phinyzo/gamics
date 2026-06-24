/**
 * /api/config — GET public client-side config
 * Powered by PhinTech Solutions, Kenya
 *
 * Returns only public-safe values (anon key + URL).
 * Service role key NEVER returned here.
 */
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url  = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return res.status(200).json({ supabase: null });
  }

  return res.status(200).json({
    supabase: { url, anon_key: anon },
  });
};
