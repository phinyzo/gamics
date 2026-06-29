/**
 * /api/register — POST register for a tournament
 * Powered by PhinTech Solutions, Kenya
 *
 * Flow:
 *   1. Validate user is authenticated
 *   2. Check tournament is open + has space
 *   3. Check user not already registered
 *   4. Create registration with status=pending
 *   5. Initiate M-Pesa STK Push directly (Daraja API)
 *   6. (Callback at /api/mpesa-callback confirms payment → status=paid)
 */
const { getServiceClient, getUser, setCors, normalizeKEPhone } = require('./_supabase');
const { stkPush } = require('./lib/mpesa-daraja');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'You must be logged in to register.' });

  const { tournament_id, gamer_tag, phone, platform_id, county } = req.body || {};
  if (!tournament_id || !gamer_tag || !phone)
    return res.status(400).json({ error: 'tournament_id, gamer_tag and phone are required.' });

  // Normalise phone — accepts 07XX, 01XX, 7XX, 1XX, 254XX, +254XX
  const normPhone = normalizeKEPhone(phone);
  if (!normPhone)
    return res.status(400).json({ error: 'Invalid phone number. Use format: 07XXXXXXXX, 01XXXXXXXX, or +254XXXXXXXXX' });

  const sb = getServiceClient();

  // Get tournament
  const { data: t, error: te } = await sb.from('tournaments')
    .select('*').eq('id', tournament_id).single();
  if (te || !t) return res.status(404).json({ error: 'Tournament not found.' });
  if (t.status !== 'open') return res.status(400).json({ error: 'Tournament is not open for registration.' });

  // Check capacity
  const { count } = await sb.from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournament_id)
    .eq('payment_status', 'paid');
  if (count >= t.max_players)
    return res.status(400).json({ error: 'Tournament is full.' });

  // Check duplicate
  const { data: existing } = await sb.from('registrations')
    .select('id').eq('tournament_id', tournament_id).eq('user_id', user.id).maybeSingle();
  if (existing) return res.status(400).json({ error: 'You are already registered for this tournament.' });

  const payRef = `ARENA-${tournament_id.slice(0,8)}-${gamer_tag}`.toUpperCase();

  // Insert registration
  const { data: reg, error: re } = await sb.from('registrations').insert({
    tournament_id, user_id: user.id, gamer_tag,
    phone: normPhone, platform_id, county,
    payment_status: 'pending', payment_ref: payRef,
  }).select().single();

  if (re) return res.status(500).json({ error: re.message });

  try {
    // Initiate M-Pesa STK Push directly
    const stkResponse = await stkPush(
      normPhone,
      t.entry_fee,
      payRef,
      `PhinTech Arena - ${t.name} (${t.game})`
    );

    // Store CheckoutRequestID for status queries
    await sb.from('registrations')
      .update({ mpesa_checkout_id: stkResponse.CheckoutRequestID })
      .eq('id', reg.id);

    return res.status(201).json({
      registration: reg,
      checkoutRequestID: stkResponse.CheckoutRequestID,
      message: `STK Push sent to ${normPhone}. Enter M-Pesa PIN to pay KES ${t.entry_fee}.`,
    });
  } catch (err) {
    console.error('[register] STK Push failed:', err.message);
    // Mark registration as failed
    await sb.from('registrations').update({ payment_status: 'failed' }).eq('id', reg.id);
    return res.status(500).json({ error: err.message || 'M-Pesa payment initiation failed. Try again.' });
  }
};

