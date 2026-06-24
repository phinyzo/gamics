/**
 * Vercel Serverless Function — /api/games
 * Also handles /api/games?slug=X (single game detail — replaces /api/game)
 * Powered by PhinTech Solutions, Kenya
 *
 * Accepted query params:
 *   slug=X            → single game detail + screenshots (replaces /api/game)
 *   type=top          → highest rated all-time (default)
 *   type=new          → recently released
 *   type=search&q=X   → search by name
 *   genre=action      → filter by genre slug
 *   platform=4        → filter by platform ID
 *   page=1            → page number
 *   page_size=20      → results per page (max 40)
 */

const RAWG_BASE = 'https://api.rawg.io/api';

module.exports = async function handler(req, res) {

  // ── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER') {
    return res.status(500).json({ error: 'RAWG_API_KEY is not configured.' });
  }

  // ── SINGLE GAME DETAIL (replaces /api/game) ────────────────────────────────
  const { slug } = req.query;
  if (slug) {
    try {
      const [detailRes, screensRes] = await Promise.all([
        fetch(`${RAWG_BASE}/games/${encodeURIComponent(slug)}?key=${apiKey}`),
        fetch(`${RAWG_BASE}/games/${encodeURIComponent(slug)}/screenshots?key=${apiKey}&page_size=6`),
      ]);
      if (!detailRes.ok) return res.status(detailRes.status).json({ error: `RAWG error: ${detailRes.status}` });
      const [detail, screens] = await Promise.all([
        detailRes.json(),
        screensRes.ok ? screensRes.json() : { results: [] },
      ]);
      const description = (detail.description || '')
        .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
        .replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim().slice(0, 1200);
      const game = {
        id: detail.id, slug: detail.slug, name: detail.name, description,
        released: detail.released, tba: detail.tba,
        background_image: detail.background_image,
        rating: detail.rating, rating_top: detail.rating_top,
        ratings_count: detail.ratings_count, metacritic: detail.metacritic,
        playtime: detail.playtime, esrb: detail.esrb_rating?.name || null,
        website: detail.website || null,
        genres:      (detail.genres     || []).map(x => ({ id: x.id, name: x.name })),
        platforms:   (detail.platforms  || []).map(p => ({ id: p.platform?.id, name: p.platform?.name, slug: p.platform?.slug, requirements: p.requirements || null })),
        developers:  (detail.developers || []).map(x => x.name),
        publishers:  (detail.publishers || []).map(x => x.name),
        tags:        (detail.tags       || []).slice(0, 8).map(t => t.name),
        stores:      (detail.stores     || []).map(s => ({ name: s.store?.name, slug: s.store?.slug })),
        screenshots: (screens.results   || []).map(s => s.image),
        achievements_count: detail.achievements_count || 0,
        additions_count:    detail.additions_count    || 0,
        game_series_count:  detail.game_series_count  || 0,
      };
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');
      return res.status(200).json({ game });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PARAMS ─────────────────────────────────────────────────────────────────
  const {
    type      = 'top',
    q         = '',
    genre     = '',
    platform  = '',
    page      = '1',
    page_size = '20',
  } = req.query;

  const size = Math.min(parseInt(page_size, 10) || 20, 40);

  const params = new URLSearchParams({
    key:               apiKey,
    page:              String(parseInt(page, 10) || 1),
    page_size:         String(size),
    exclude_additions: 'true',
  });

  if (genre)    params.set('genres',    genre);
  if (platform) params.set('platforms', platform);

  if (type === 'search' && q) {
    params.set('search',         q.slice(0, 100));
    params.set('search_precise', 'false');
  } else if (type === 'new') {
    const now  = new Date();
    const past = new Date(now);
    past.setFullYear(past.getFullYear() - 2); // last 2 years
    const fmt  = d => d.toISOString().slice(0, 10);
    params.set('dates',    `${fmt(past)},${fmt(now)}`);
    params.set('ordering', '-released');
  } else {
    // top rated
    params.set('ordering',      '-rating');
    params.set('metacritic',    '75,100');
    params.set('ratings_count', '20');
  }

  // ── RAWG FETCH ─────────────────────────────────────────────────────────────
  try {
    const rawgRes = await fetch(`${RAWG_BASE}/games?${params.toString()}`);

    if (!rawgRes.ok) {
      const text = await rawgRes.text();
      console.error('[/api/games] RAWG error:', rawgRes.status, text.slice(0, 300));
      return res.status(rawgRes.status).json({ error: `RAWG API error: ${rawgRes.status}` });
    }

    const data = await rawgRes.json();

    // ── NORMALISE ─────────────────────────────────────────────────────────────
    const games = (data.results || []).map(g => ({
      id:               g.id,
      slug:             g.slug,
      name:             g.name,
      released:         g.released   || null,
      tba:              g.tba        || false,
      background_image: g.background_image || null,
      rating:           g.rating          || null,   // 0–5
      rating_top:       g.rating_top      || null,
      ratings_count:    g.ratings_count   || 0,
      metacritic:       g.metacritic      || null,
      playtime:         g.playtime        || null,
      esrb:             g.esrb_rating ? g.esrb_rating.name : null,
      genres:    (g.genres    || []).map(x => ({ id: x.id, name: x.name, slug: x.slug })),
      platforms: (g.platforms || []).map(p => ({
        id:   p.platform && p.platform.id,
        name: p.platform && p.platform.name,
        slug: p.platform && p.platform.slug,
      })),
      stores: (g.stores || []).map(s => ({
        id:   s.store && s.store.id,
        name: s.store && s.store.name,
        slug: s.store && s.store.slug,
      })),
      tags:    (g.tags || []).slice(0, 5).map(t => ({ id: t.id, name: t.name })),
      website: `https://rawg.io/games/${g.slug}`,
    }));

    // Strip API key from next/previous pagination URLs
    const cleanUrl = url => {
      if (!url) return null;
      try {
        const u = new URL(url);
        u.searchParams.delete('key');
        return u.toString();
      } catch { return null; }
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      count:    data.count    || 0,
      next:     cleanUrl(data.next),
      previous: cleanUrl(data.previous),
      games,
    });

  } catch (err) {
    console.error('[/api/games] Unexpected error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
