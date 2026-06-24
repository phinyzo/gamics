/**
 * /api/result — Match result submission + screenshot signed URL
 * Powered by PhinTech Solutions, Kenya
 *
 * POST /api/result                  → submit match result
 * GET  /api/result?action=uploadurl → get signed URL for screenshot upload
 */
const { getServiceClient, getUser, setCors } = require('./_supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const sb = getServiceClient();

  // ── GET: generate signed upload URL for screenshot (client uploads directly) ──
  if (req.method === 'GET' && req.query.action === 'uploadurl') {
    const { tournament_id, match_id, gamer_tag, ext = 'jpg' } = req.query;
    const safeTag  = (gamer_tag || 'player').replace(/[^a-zA-Z0-9_-]/g, '');
    const safExt   = ['jpg','jpeg','png','webp','gif'].includes(ext.toLowerCase()) ? ext.toLowerCase() : 'jpg';
    const path     = `screenshots/${tournament_id || 'misc'}/${match_id || 'no-match'}/${Date.now()}_${safeTag}.${safExt}`;

    const { data, error } = await sb.storage
      .from('screenshots')
      .createSignedUploadUrl(path);

    if (error) return res.status(500).json({ error: error.message });

    const { data: { publicUrl } } = sb.storage.from('screenshots').getPublicUrl(path);

    return res.status(200).json({
      signed_url: data.signedUrl,
      token:      data.token,
      path,
      public_url: publicUrl,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    tournament_id, match_id, round,
    your_tag, opponent_tag,
    your_score, opponent_score,
    screenshot_url,
  } = req.body || {};

  if (!tournament_id || !your_tag || !opponent_tag ||
      your_score === undefined || opponent_score === undefined)
    return res.status(400).json({ error: 'Missing required fields.' });

  // Get tournament + verify registration
  const { data: reg } = await sb.from('registrations')
    .select('id').eq('tournament_id', tournament_id)
    .eq('user_id', user.id).eq('payment_status', 'paid').maybeSingle();

  if (!reg) return res.status(403).json({ error: 'You are not a paid participant in this tournament.' });

  // Get or create match record
  let match;
  if (match_id) {
    const { data } = await sb.from('matches').select('*').eq('id', match_id).single();
    match = data;
  } else {
    // Find existing match for this pairing in this round
    const { data } = await sb.from('matches').select('*')
      .eq('tournament_id', tournament_id).eq('round', round || 1)
      .or(`and(player1_tag.eq.${your_tag},player2_tag.eq.${opponent_tag}),and(player1_tag.eq.${opponent_tag},player2_tag.eq.${your_tag})`)
      .maybeSingle();
    match = data;
  }

  const yourScoreInt = parseInt(your_score);
  const oppScoreInt  = parseInt(opponent_score);
  const winner = yourScoreInt > oppScoreInt ? your_tag : opponent_tag;
  const loser  = yourScoreInt > oppScoreInt ? opponent_tag : your_tag;

  if (!match) {
    // First submission — create match record
    const { data: newMatch, error } = await sb.from('matches').insert({
      tournament_id,
      round:       round || 1,
      match_number: 1,
      player1_tag: your_tag,
      player2_tag: opponent_tag,
      score1:      yourScoreInt,
      score2:      oppScoreInt,
      status:      'p1_submitted',
      screenshot_url: screenshot_url || null,
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({
      status:  'pending',
      message: `Result saved. Waiting for ${opponent_tag} to submit their score.`,
      match:   newMatch,
    });
  }

  // Second submission — cross-verify
  const theirScore1 = match.player1_tag === opponent_tag ? match.score1 : match.score2;
  const theirScore2 = match.player1_tag === opponent_tag ? match.score2 : match.score1;
  const theirWinner = theirScore1 > theirScore2 ? match.player1_tag : match.player2_tag;

  const agreeWinner = theirWinner === winner;

  if (agreeWinner) {
    // Verified — update match
    const { data: verified, error } = await sb.from('matches').update({
      status:      'verified',
      winner_tag:  winner,
      verified_at: new Date().toISOString(),
    }).eq('id', match.id).select().single();

    if (error) return res.status(500).json({ error: error.message });

    // Update ELO via Supabase RPC
    const { data: t } = await sb.from('tournaments').select('game').eq('id', tournament_id).single();
    if (t?.game) {
      await sb.rpc('update_elo', {
        p_winner_tag: winner,
        p_loser_tag:  loser,
        p_game:       t.game,
      });
    }

    // Notify both players
    for (const [tag, isWinner] of [[winner, true], [loser, false]]) {
      const { data: userReg } = await sb.from('registrations')
        .select('user_id').eq('tournament_id', tournament_id).eq('gamer_tag', tag).maybeSingle();
      if (userReg?.user_id) {
        await sb.from('notifications').insert({
          user_id: userReg.user_id,
          type:    'result_verified',
          title:   isWinner ? '🏆 You Won!' : 'Match Result',
          message: isWinner
            ? `Your win vs ${loser} (${yourScoreInt}-${oppScoreInt}) has been verified. ELO updated.`
            : `Result vs ${winner} verified: ${loser} ${oppScoreInt}-${yourScoreInt} ${winner}. Better luck next time!`,
          data: { match_id: match.id, tournament_id },
        });
      }
    }

    // Fire-and-forget: try to advance bracket (non-blocking)
    sb.rpc('advance_bracket', { p_tournament_id: tournament_id }).catch(() => {});

    return res.status(200).json({
      status: 'verified',
      winner,
      message: `Match verified. Winner: ${winner}. ELO updated.`,
      match:   verified,
    });
  } else {
    // Dispute
    await sb.from('matches').update({
      status: 'disputed',
      dispute_reason: `Score conflict: ${your_tag} says ${yourScoreInt}-${oppScoreInt}, ${opponent_tag} submitted ${theirScore1}-${theirScore2}`,
    }).eq('id', match.id);

    return res.status(200).json({
      status: 'disputed',
      message: 'Score conflict detected. Admin will review within 24 hours.',
    });
  }
};
