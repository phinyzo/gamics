/**
 * /api/invite — Invite code management & referral processing
 * PhinTech Arena | PhinTech Solutions, Kenya
 *
 * GET  /api/invite          → get own invite code + referral stats
 * GET  /api/invite?code=XXX → validate an invite code (public)
 * POST /api/invite          → apply an invite code (used at profile setup)
 */
const { getServiceClient, getUser, setCors } = require('./_supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getServiceClient();

  // ── Public: validate invite code ───────────────────────────────────────────
  if (req.method === 'GET' && req.query.code) {
    const code = String(req.query.code).toUpperCase().trim();
    const { data, error } = await sb
      .from('invite_codes')
      .select('code, uses, profiles(gamer_tag, avatar_url)')
      .eq('code', code)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ valid: false, error: 'Invite code not found.' });
    }
    return res.status(200).json({
      valid: true,
      code:  data.code,
      uses:  data.uses,
      owner: data.profiles?.gamer_tag || 'A PhinTech player',
    });
  }

  // All remaining routes require auth
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  // ── GET: own invite code + stats ────────────────────────────────────────────
  if (req.method === 'GET') {
    // Ensure invite code exists (generates if not)
    const { data: existing } = await sb
      .from('invite_codes')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    let code = existing;

    if (!code) {
      // Call DB function to generate
      const { data: genData } = await sb.rpc('generate_invite_code', { p_user_id: user.id });
      const { data: newCode } = await sb
        .from('invite_codes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      code = newCode;
    }

    // Get referral list
    const { data: referrals } = await sb
      .from('referrals')
      .select('created_at, points_awarded, bonus_claimed, profiles!referrals_referred_id_fkey(gamer_tag, avatar_url)')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    // Get points balance
    const { data: profile } = await sb
      .from('profiles')
      .select('points_balance, referred_by')
      .eq('id', user.id)
      .single();

    // Points ledger (recent 20)
    const { data: ledger } = await sb
      .from('points_ledger')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    return res.status(200).json({
      invite_code:    code?.code || null,
      total_uses:     code?.uses || 0,
      points_earned:  code?.points_earned || 0,
      points_balance: profile?.points_balance || 0,
      referred_by:    profile?.referred_by || null,
      referrals:      referrals || [],
      ledger:         ledger || [],
    });
  }

  // ── POST: apply an invite code ───────────────────────────────────────────────
  if (req.method === 'POST') {
    const { invite_code } = req.body || {};
    if (!invite_code) return res.status(400).json({ error: 'invite_code is required.' });

    // Check if user already used an invite code
    const { data: profile } = await sb
      .from('profiles')
      .select('referred_by')
      .eq('id', user.id)
      .single();

    if (profile?.referred_by) {
      return res.status(400).json({ error: 'You have already used an invite code.' });
    }

    // Call the DB function
    const { data: result, error } = await sb.rpc('process_referral', {
      p_referred_id: user.id,
      p_invite_code: invite_code.trim().toUpperCase(),
    });

    if (error) return res.status(500).json({ error: error.message });
    if (!result?.success) return res.status(400).json({ error: result?.error || 'Failed to process invite code.' });

    return res.status(200).json({
      success:       true,
      points_earned: 20,
      message:       'Invite code applied! You earned 20 bonus points. Your friend earned 50 points.',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
