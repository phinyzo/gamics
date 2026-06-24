/**
 * /api/profile — GET own profile / PUT update / GET notifications
 * Powered by PhinTech Solutions, Kenya
 */
const { getServiceClient, getUser, setCors } = require('./_supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const sb = getServiceClient();

  if (req.method === 'GET') {
    const { type } = req.query;

    if (type === 'notifications') {
      const { data, error } = await sb.from('notifications')
        .select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(20);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ notifications: data || [] });
    }

    if (type === 'registrations') {
      const { data, error } = await sb.from('registrations')
        .select('*, tournaments(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ registrations: data || [] });
    }

    // Full profile — include wallet balance and admin flag
    const { data, error } = await sb.from('profiles')
      .select('*').eq('id', user.id).single();
    if (error) return res.status(500).json({ error: error.message });

    // Get wallet balance
    const { data: wallet } = await sb.from('wallets')
      .select('balance_kes').eq('user_id', user.id).maybeSingle();

    return res.status(200).json({
      profile: {
        ...data,
        email:          user.email,
        wallet_balance: wallet?.balance_kes || 0,
      }
    });
  }

  if (req.method === 'PUT') {
    const allowed = ['gamer_tag','full_name','phone','county','platform_id',
                     'preferred_game','email_notify','whatsapp_notify',
                     'gender','avatar_url'];
    const updates = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    // Check gamer_tag uniqueness
    if (updates.gamer_tag) {
      const { data: clash } = await sb.from('profiles')
        .select('id').eq('gamer_tag', updates.gamer_tag).neq('id', user.id).maybeSingle();
      if (clash) return res.status(400).json({ error: 'Gamer tag already taken.' });
    }

    const { data, error } = await sb.from('profiles')
      .update(updates).eq('id', user.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ profile: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

