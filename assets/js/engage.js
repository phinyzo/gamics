'use strict';
/**
 * PhinTech Arena — Smart Engagement Engine
 * Powered by PhinTech Solutions, Kenya
 *
 * This module makes the site "alive" and proactively talks to the user:
 *   1. Activity Feed      — real-time ticker of what's happening
 *   2. Smart Nudges       — contextual toasts that talk to the user
 *   3. Favourite Game     — ask once, remember forever, prioritise it
 *   4. Host-a-Game Prompt — periodic ask if user wants to host
 *   5. Tournament Reminders — remind about upcoming/live games
 *   6. New-user Greeting  — personalised welcome after profile setup
 *   7. Daily Login Streak — reward and remind returning users
 *   8. "What's Hot" ticker — scrolling header pulse
 */

// ── STORAGE HELPERS ───────────────────────────────────────────────────────────
const LS = {
  get:    k        => { try { return JSON.parse(localStorage.getItem('pt_' + k)); } catch { return null; } },
  set:    (k, v)   => { try { localStorage.setItem('pt_' + k, JSON.stringify(v)); } catch {} },
  remove: k        => { try { localStorage.removeItem('pt_' + k); } catch {} },
};

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeUntil(dateStr) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'started';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── SMART TOAST SYSTEM ────────────────────────────────────────────────────────
let _toastQueue = [];
let _toastBusy  = false;

function nudge(msg, { icon = '🎮', type = 'info', action = null, actionLabel = null, duration = 5000 } = {}) {
  _toastQueue.push({ msg, icon, type, action, actionLabel, duration });
  if (!_toastBusy) _drainToasts();
}

function _drainToasts() {
  if (!_toastQueue.length) { _toastBusy = false; return; }
  _toastBusy = true;
  const item = _toastQueue.shift();
  _showNudge(item);
  setTimeout(_drainToasts, item.duration + 600);
}

function _showNudge({ msg, icon, type, action, actionLabel, duration }) {
  const existing = document.getElementById('ptNudgeToast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'ptNudgeToast';
  el.className = `pt-nudge pt-nudge--${type}`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <span class="pt-nudge-icon">${icon}</span>
    <span class="pt-nudge-msg">${escHtml(msg)}</span>
    ${action ? `<button class="pt-nudge-action">${escHtml(actionLabel || 'Go')}</button>` : ''}
    <button class="pt-nudge-close" aria-label="Dismiss">✕</button>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('pt-nudge--show'), 30);

  el.querySelector('.pt-nudge-close').addEventListener('click', () => dismissNudge(el));
  if (action) el.querySelector('.pt-nudge-action').addEventListener('click', () => { action(); dismissNudge(el); });

  const timer = setTimeout(() => dismissNudge(el), duration);
  el._dismissTimer = timer;
}

function dismissNudge(el) {
  if (!el || !el.parentNode) return;
  clearTimeout(el._dismissTimer);
  el.classList.remove('pt-nudge--show');
  setTimeout(() => el.remove(), 400);
}

// ── ACTIVITY FEED TICKER ──────────────────────────────────────────────────────
const ACTIVITY_FEED_PLACEHOLDER = [
  { icon: '🏆', text: 'NewPlayer254 just joined a FIFA tournament' },
  { icon: '💰', text: 'ProGamer_KE won KES 2,000 in the eFootball Cup' },
  { icon: '🎮', text: 'A new Mortal Kombat 1 tournament just opened — 4 spots left' },
  { icon: '🔥', text: 'NairobiSniper has gone on a 5-match winning streak' },
  { icon: '🏅', text: 'TechniqueGod reached Gold rank' },
  { icon: '👥', text: '3 new players joined from Nairobi in the last hour' },
  { icon: '⚡', text: 'Call of Duty tournament starts in 30 minutes' },
  { icon: '🎯', text: 'Shadow_KE just registered for the Tekken 8 showdown' },
];

function buildActivityFeed() {
  const ticker = document.getElementById('activityTicker');
  if (!ticker) return;

  // Try to build real activity from localStorage tournament data
  const liveItems = _buildLiveActivityItems();
  const items = liveItems.length >= 4 ? liveItems : [...liveItems, ...ACTIVITY_FEED_PLACEHOLDER].slice(0, 10);

  // Duplicate for seamless infinite scroll
  const html = items.map(i =>
    `<span class="activity-item"><span class="activity-icon">${i.icon}</span>${escHtml(i.text)}</span><span class="activity-sep">•</span>`
  ).join('');
  // Double it so the CSS infinite scroll loops seamlessly
  ticker.innerHTML = html + html;
}

function _buildLiveActivityItems() {
  const items = [];
  try {
    const stored = JSON.parse(localStorage.getItem('arena_tournaments') || 'null');
    if (!stored) return items;
    stored.forEach(t => {
      if (t.players?.length) {
        items.push({ icon: '👥', text: `${t.players[t.players.length - 1]} just joined ${t.name}` });
      }
      if (t.status === 'open') {
        const spots = (t.maxPlayers || 16) - (t.players?.length || 0);
        if (spots <= 3 && spots > 0) {
          items.push({ icon: '🔥', text: `Only ${spots} spot${spots > 1 ? 's' : ''} left in ${t.name}!` });
        }
      }
      if (t.status === 'ongoing') {
        items.push({ icon: '⚔️', text: `${t.name} is live right now — ${t.game}` });
      }
      (t.matches || []).filter(m => m.verified && m.winner).forEach(m => {
        items.push({ icon: '🏆', text: `${m.winner} won a ${t.game} match in ${t.name}` });
      });
    });
  } catch { /* ignore */ }
  return items.slice(0, 8);
}

async function loadLiveActivity() {
  // Rebuild feed with latest data
  buildActivityFeed();
}

// ── TOURNAMENT AWARENESS ──────────────────────────────────────────────────────
let _cachedTournaments = [];

async function fetchUpcomingTournaments() {
  try {
    const res = await fetch('/api/tournaments?status=open&limit=5');
    if (res.ok) {
      const data = await res.json();
      if (data.tournaments?.length) {
        _cachedTournaments = data.tournaments;
        return _cachedTournaments;
      }
    }
  } catch { /* fall through to local */ }

  // Fallback: read from arena.js localStorage cache
  try {
    const stored = JSON.parse(localStorage.getItem('arena_tournaments') || 'null');
    if (stored?.length) {
      _cachedTournaments = stored
        .filter(t => t.status === 'open')
        .map(t => ({
          id:           t.id,
          name:         t.name,
          game:         t.game,
          max_players:  t.maxPlayers  || t.max_players  || 16,
          player_count: (t.players || []).length,
          entry_fee:    t.entryFee    || t.entry_fee    || 0,
          prize_pool:   t.prize       || t.prize_pool   || 0,
          starts_at:    t.date        || t.start_date   || null,
          status:       t.status,
        }));
      return _cachedTournaments;
    }
  } catch { /* ignore */ }

  return [];
}

async function updatePulseBanner() {
  const banner = document.getElementById('pulseBanner');
  const list   = document.getElementById('pulseList');
  if (!list) return;

  const tourns = await fetchUpcomingTournaments();

  if (!tourns.length) {
    list.innerHTML = '<div class="pulse-empty">No open tournaments right now — check back soon or <button class="pulse-see-all" onclick="scrollToArena()" style="display:inline;font-size:inherit;padding:0;border:none;cursor:pointer;color:hsl(270 60% 65%);">host one</button>!</div>';
    return;
  }

  list.innerHTML = tourns.map(t => {
    const maxP  = t.max_players  || 16;
    const curP  = t.player_count || 0;
    const spots = Math.max(0, maxP - curP);
    const prize = t.prize_pool   || 0;
    const fee   = t.entry_fee    || 0;
    const urgency = spots > 0 && spots <= 2 ? 'pulse-card--urgent' : spots <= 5 ? 'pulse-card--hot' : '';
    return `
      <div class="pulse-card ${urgency}" data-tid="${escHtml(String(t.id))}">
        <div class="pulse-card-game">${escHtml(t.game || 'Unknown')}</div>
        <div class="pulse-card-name">${escHtml(t.name)}</div>
        <div class="pulse-card-meta">
          <span><ion-icon name="people-outline"></ion-icon>${spots > 0 ? spots + ' spots left' : 'Full'}</span>
          <span><ion-icon name="cash-outline"></ion-icon>KES ${fee}</span>
          <span><ion-icon name="trophy-outline"></ion-icon>KES ${prize}</span>
        </div>
        <div class="pulse-card-time">
          <ion-icon name="time-outline"></ion-icon>
          ${t.starts_at ? timeUntil(t.starts_at) : 'Open now'}
        </div>
        ${spots > 0
          ? `<button class="pulse-join-btn" onclick="scrollToArena()"><ion-icon name="game-controller-outline"></ion-icon> Join</button>`
          : `<span class="pulse-full-badge">Full</span>`}
      </div>`;
  }).join('');
}

function scrollToArena() {
  document.getElementById('arena')?.scrollIntoView({ behavior: 'smooth' });
}

// ── SMART NUDGE SEQUENCES ─────────────────────────────────────────────────────
let _nudgeEngineStarted = false;
let _profile = null;
let _user    = null;

function startNudgeEngine(profile, user) {
  _profile = profile;
  _user    = user;
  if (_nudgeEngineStarted) return;
  _nudgeEngineStarted = true;

  // Sequence 1: Welcome back message (returning user)
  const lastVisit = LS.get('last_visit');
  const now = Date.now();
  LS.set('last_visit', now);

  if (lastVisit) {
    const hoursSince = (now - lastVisit) / 3600000;
    const name = profile?.gamer_tag || user?.email?.split('@')[0] || 'Player';

    if (hoursSince > 48) {
      setTimeout(() => nudge(
        `Welcome back, ${name}! You've been away for ${Math.round(hoursSince / 24)} days. New tournaments are waiting! 🔥`,
        { icon: '👋', type: 'welcome', duration: 7000, action: scrollToArena, actionLabel: 'See Tournaments' }
      ), 2000);
    } else if (hoursSince > 4) {
      setTimeout(() => nudge(
        `Hey ${name}, good to see you back! Check out what's new in the Arena.`,
        { icon: '🎮', type: 'info', duration: 5000 }
      ), 2000);
    }
  }

  // Sequence 2: Favourite game (ask once, remind when available)
  setTimeout(() => checkFavouriteGameNudge(profile), 8000);

  // Sequence 3: Tournament reminders (check every 5 min after initial load)
  setTimeout(() => tournamentNudgeCheck(), 15000);
  setInterval(() => tournamentNudgeCheck(), 5 * 60 * 1000);

  // Sequence 4: Host-a-game prompt (ask returning users after 3 visits)
  const visitCount = (LS.get('visit_count') || 0) + 1;
  LS.set('visit_count', visitCount);
  if (visitCount >= 3 && !LS.get('host_prompted')) {
    setTimeout(() => hostGameNudge(profile), 25000);
  }

  // Sequence 5: Idle reminder (if user is signed in but hasn't joined any tournaments)
  setTimeout(() => idleUserNudge(profile), 45000);

  // Sequence 6: Periodic activity pulse messages
  setTimeout(broadcastActivityNudge, 60000);
  setInterval(broadcastActivityNudge, 8 * 60 * 1000);
}

function startGuestNudgeEngine() {
  if (_nudgeEngineStarted) return;
  _nudgeEngineStarted = true;

  // Sequence for non-logged-in users
  const visitCount = (LS.get('visit_count') || 0) + 1;
  LS.set('visit_count', visitCount);

  // First visit — no nudge (walkthrough handles it)
  // 2nd+ visit — encourage sign up
  if (visitCount >= 2 && !LS.get('signup_nudge_done')) {
    setTimeout(() => {
      nudge(
        'Join PhinTech Arena free — compete in tournaments and win real KES prizes! 🏆',
        {
          icon: '🎯',
          type: 'promo',
          duration: 8000,
          action: () => document.getElementById('headerSignInBtn')?.click(),
          actionLabel: 'Join Free'
        }
      );
      if (visitCount >= 4) LS.set('signup_nudge_done', true); // stop after 4th visit
    }, 10000);
  }

  // Show live tournament teaser after 20s
  setTimeout(async () => {
    const tourns = await fetchUpcomingTournaments();
    if (tourns.length) {
      const t = tourns[0];
      const spots = t.max_players - (t.player_count || 0);
      nudge(
        `${spots} spots left in "${t.name}" (KES ${t.prize_pool} prize) — sign in to join!`,
        {
          icon: '🏆',
          type: 'promo',
          duration: 8000,
          action: () => document.getElementById('headerSignInBtn')?.click(),
          actionLabel: 'Sign In'
        }
      );
    }
  }, 20000);
}

// ── FAVOURITE GAME LOGIC ──────────────────────────────────────────────────────
async function checkFavouriteGameNudge(profile) {
  // If profile has no preferred_game, ask
  if (!profile?.preferred_game && !LS.get('fav_game_asked')) {
    LS.set('fav_game_asked', true);
    openFavGameModal();
  } else if (profile?.preferred_game) {
    // Check if any open tournament matches their favourite
    await checkFavGameTournament(profile.preferred_game);
  }
}

async function checkFavGameTournament(favGame) {
  if (!favGame) return;
  const notifyKey = `fav_notified_${favGame}`;
  if (LS.get(notifyKey)) return; // already notified this session

  const tourns = await fetchUpcomingTournaments();
  const match = tourns.find(t => t.game?.toLowerCase().includes(favGame.toLowerCase()) ||
                                  favGame.toLowerCase().includes(t.game?.toLowerCase()));
  if (match) {
    LS.set(notifyKey, Date.now());
    const name = _profile?.gamer_tag || 'Player';
    nudge(
      `${name}, your favourite game "${match.game}" has an open tournament right now! ${match.max_players - (match.player_count||0)} spots left.`,
      {
        icon: '⭐',
        type: 'fav',
        duration: 9000,
        action: scrollToArena,
        actionLabel: 'View Tournament'
      }
    );
  }
}

function openFavGameModal() {
  const modal = document.getElementById('favGameModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeFavGameModal() {
  const modal = document.getElementById('favGameModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

async function saveFavouriteGame(game) {
  closeFavGameModal();
  if (!game) return;

  // Save to profile
  try {
    const token = typeof getToken === 'function' ? getToken() : null;
    if (token) {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ preferred_game: game }),
      });
    }
    LS.set('fav_game', game);

    const name = _profile?.gamer_tag || 'Player';
    nudge(
      `Got it, ${name}! We'll alert you whenever a ${game} tournament opens up. 🎯`,
      { icon: '⭐', type: 'success', duration: 5000 }
    );

    // Check immediately for matching tournaments
    await checkFavGameTournament(game);
  } catch { /* non-critical */ }
}

// ── TOURNAMENT NUDGE CHECKS ───────────────────────────────────────────────────
async function tournamentNudgeCheck() {
  const tourns = await fetchUpcomingTournaments();
  if (!tourns.length) return;

  const shownKey = 'tourn_nudge_shown';
  const shown = LS.get(shownKey) || {};
  const now   = Date.now();

  for (const t of tourns) {
    if (shown[t.id] && now - shown[t.id] < 30 * 60 * 1000) continue; // once per 30 min per tournament

    const spots = t.max_players - (t.player_count || 0);

    // Urgent: 1–2 spots left
    if (spots > 0 && spots <= 2) {
      shown[t.id] = now;
      LS.set(shownKey, shown);
      nudge(
        `Only ${spots} spot${spots > 1 ? 's' : ''} left in "${t.name}"! Entry: KES ${t.entry_fee} · Prize: KES ${t.prize_pool}`,
        { icon: '🔥', type: 'urgent', duration: 8000, action: scrollToArena, actionLabel: 'Join Now' }
      );
      return; // one urgent nudge at a time
    }

    // Starting soon
    if (t.starts_at) {
      const minsUntil = (new Date(t.starts_at).getTime() - now) / 60000;
      if (minsUntil > 0 && minsUntil <= 30) {
        shown[t.id] = now;
        LS.set(shownKey, shown);
        nudge(
          `"${t.name}" starts ${timeUntil(t.starts_at)}! ${spots} spot${spots !== 1 ? 's' : ''} still open.`,
          { icon: '⏰', type: 'warning', duration: 7000, action: scrollToArena, actionLabel: 'Join' }
        );
        return;
      }
    }
  }
}

// ── HOST-A-GAME NUDGE ─────────────────────────────────────────────────────────
function hostGameNudge(profile) {
  if (LS.get('host_prompted')) return;
  LS.set('host_prompted', Date.now());
  const name = profile?.gamer_tag || 'Player';
  nudge(
    `${name}, have you thought about hosting your own tournament? Organizers earn a cut of entry fees! 🤑`,
    {
      icon: '🏟️',
      type: 'host',
      duration: 10000,
      action: scrollToArena,
      actionLabel: 'Host a Game'
    }
  );
}

// ── IDLE USER NUDGE ───────────────────────────────────────────────────────────
async function idleUserNudge(profile) {
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) return;
  try {
    const res = await fetch('/api/profile?type=registrations', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const count = (data.registrations || []).length;
    if (count === 0 && !LS.get('idle_nudge')) {
      LS.set('idle_nudge', Date.now());
      const name = profile?.gamer_tag || 'Player';
      nudge(
        `${name}, you haven't joined any tournaments yet! Entry fees start from KES 50. Your first win could pay you KES 500–5,000! 💰`,
        {
          icon: '💡',
          type: 'info',
          duration: 9000,
          action: scrollToArena,
          actionLabel: 'Browse Tournaments'
        }
      );
    }
  } catch { /* non-critical */ }
}

// ── PERIODIC ACTIVITY BROADCASTS ─────────────────────────────────────────────
const _activityMessages = [
  { icon: '🔥', msg: 'Someone just registered for a tournament. Are you in?' },
  { icon: '💰', msg: 'KES prizes are being won right now. Don\'t miss out!' },
  { icon: '🎮', msg: 'New tournament just opened. Spots are filling fast!' },
  { icon: '👥', msg: 'Players are competing live. Come watch and join!' },
  { icon: '🏆', msg: 'A winner just got paid. You could be next!' },
  { icon: '⚡', msg: 'Check-in open for an upcoming tournament. Don\'t lose your spot!' },
];
let _actIdx = 0;

function broadcastActivityNudge() {
  const item = _activityMessages[_actIdx % _activityMessages.length];
  _actIdx++;
  nudge(item.msg, {
    icon: item.icon,
    type: 'activity',
    duration: 5000,
    action: scrollToArena,
    actionLabel: 'View Arena'
  });
}

// ── DAILY LOGIN STREAK ────────────────────────────────────────────────────────
function checkDailyStreak(profile) {
  const name = profile?.gamer_tag || 'Player';
  const today = new Date().toDateString();
  const last  = LS.get('last_daily');
  const streak = LS.get('streak') || 0;

  if (last === today) return; // already logged today
  LS.set('last_daily', today);

  // Check if yesterday
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const newStreak = last === yesterday ? streak + 1 : 1;
  LS.set('streak', newStreak);

  if (newStreak >= 3) {
    setTimeout(() => nudge(
      `🔥 ${newStreak}-day login streak, ${name}! You're on fire. Keep it up to unlock bonus points.`,
      { icon: '🔥', type: 'streak', duration: 6000 }
    ), 5000);
  }
}

// ── FAVOURITE GAME MODAL CONTENT ──────────────────────────────────────────────
const FAV_GAMES = [
  { id: 'fifa',      label: 'FIFA / FC',       icon: '⚽' },
  { id: 'efootball', label: 'eFootball / PES',  icon: '🏃' },
  { id: 'cod',       label: 'Call of Duty',      icon: '🔫' },
  { id: 'tekken',    label: 'Tekken',             icon: '🥊' },
  { id: 'mortal',    label: 'Mortal Kombat',      icon: '🩸' },
  { id: 'fortnite',  label: 'Fortnite',           icon: '🏗️' },
  { id: 'valorant',  label: 'Valorant',           icon: '🎯' },
  { id: 'minecraft', label: 'Minecraft',          icon: '⛏️' },
  { id: 'gta',       label: 'GTA',                icon: '🚗' },
  { id: 'other',     label: 'Other / Surprise me',icon: '🎲' },
];

function buildFavGameModal() {
  const grid = document.getElementById('favGameGrid');
  if (!grid) return;
  grid.innerHTML = FAV_GAMES.map(g => `
    <button class="fav-game-btn" data-game="${escHtml(g.label)}" aria-label="Select ${g.label}">
      <span class="fav-game-icon">${g.icon}</span>
      <span class="fav-game-label">${escHtml(g.label)}</span>
    </button>`).join('');

  grid.querySelectorAll('.fav-game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.fav-game-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('favGameConfirmBtn')?.removeAttribute('disabled');
    });
  });
}

// ── NOTIFICATION CENTRE (enhanced in-app) ─────────────────────────────────────
let _inAppNotes = [];

function addInAppNotification(title, message, icon = '🔔') {
  const note = { id: Date.now(), title, message, icon, time: new Date().toISOString(), read: false };
  _inAppNotes.unshift(note);
  if (_inAppNotes.length > 50) _inAppNotes = _inAppNotes.slice(0, 50);
  renderInAppNotifications();
}

function renderInAppNotifications() {
  const list  = document.getElementById('notifList');
  const badge = document.getElementById('notifBadge');
  const unread = _inAppNotes.filter(n => !n.read).length;

  if (badge) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }

  if (!list) return;
  if (!_inAppNotes.length) {
    list.innerHTML = '<p class="notif-empty">No notifications yet. Stay tuned!</p>';
    return;
  }

  list.innerHTML = _inAppNotes.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" data-nid="${n.id}">
      <span class="notif-icon-big">${n.icon}</span>
      <div class="notif-body">
        <p class="notif-title">${escHtml(n.title)}</p>
        <p class="notif-msg">${escHtml(n.message)}</p>
        <p class="notif-time">${timeAgoLocal(n.time)}</p>
      </div>
    </div>`).join('');

  // Mark all as read when opened
  list.addEventListener('mouseenter', () => {
    _inAppNotes.forEach(n => n.read = true);
    if (badge) badge.style.display = 'none';
  }, { once: false });
}

function timeAgoLocal(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── EMAIL REMINDER API HELPER ──────────────────────────────────────────────────
async function sendTournamentEmailReminder(tournamentId) {
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) return;
  try {
    await fetch('/api/ops?type=notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'tournament_reminder', tournament_id: tournamentId }),
    });
  } catch { /* non-critical */ }
}

// ── WHAT'S HOT HEADER TICKER ──────────────────────────────────────────────────
let _hotTickerItems = [];
let _hotTickerIdx   = 0;

function startHotTicker() {
  const el = document.getElementById('hotTickerText');
  if (!el) return;

  const base = [
    '🔥 Live tournaments happening right now',
    '💰 Prize pools up to KES 10,000',
    '🎮 New games added every week',
    '🇰🇪 Kenya\'s #1 esports platform',
    '⚡ Instant M-Pesa payments',
    '🏆 Join free — compete for real prizes',
  ];

  async function refresh() {
    const tourns = _cachedTournaments;
    _hotTickerItems = [...base];
    if (tourns.length) {
      tourns.slice(0, 2).forEach(t => {
        const spots = t.max_players - (t.player_count || 0);
        if (spots > 0) {
          _hotTickerItems.unshift(`🏆 ${t.name} — ${spots} spots left · KES ${t.prize_pool} prize`);
        }
      });
    }
    rotate();
  }

  function rotate() {
    const item = _hotTickerItems[_hotTickerIdx % _hotTickerItems.length];
    _hotTickerIdx++;
    el.classList.add('ticker-fade-out');
    setTimeout(() => {
      el.textContent = item;
      el.classList.remove('ticker-fade-out');
      el.classList.add('ticker-fade-in');
      setTimeout(() => el.classList.remove('ticker-fade-in'), 500);
    }, 300);
  }

  refresh();
  setInterval(refresh, 12000);
  setInterval(rotate, 4000);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Build favourite game modal
  buildFavGameModal();

  // Build activity feed with placeholders
  buildActivityFeed();

  // Load live pulse data — also refreshes activity feed after data is available
  fetchUpcomingTournaments().then(() => {
    updatePulseBanner();
    buildActivityFeed(); // rebuild with real data now that ARENA_DB may be populated
    startHotTicker();
  });

  // Fav game modal wiring
  document.getElementById('favGameConfirmBtn')?.addEventListener('click', () => {
    const selected = document.querySelector('.fav-game-btn.selected');
    saveFavouriteGame(selected?.dataset.game || null);
  });
  document.getElementById('favGameSkipBtn')?.addEventListener('click', closeFavGameModal);
  document.getElementById('favGameModalClose')?.addEventListener('click', closeFavGameModal);
  document.getElementById('favGameModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('favGameModal')) closeFavGameModal();
  });

  // Listen for profile loaded — start personalised engagement
  document.addEventListener('profile-loaded', e => {
    const { profile, user } = e.detail;
    startNudgeEngine(profile, user);
    checkDailyStreak(profile);
    // Merge server notifications with in-app system
    if (profile) mergeServerNotifications(profile);
  });

  // ESC closes fav modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeFavGameModal();
  });

  // If not signed in after 5s, start guest engine
  setTimeout(() => {
    if (!_nudgeEngineStarted) startGuestNudgeEngine();
  }, 5000);
});

async function mergeServerNotifications(profile) {
  // Load from server and add to in-app notification centre
  try {
    const token = typeof getToken === 'function' ? getToken() : null;
    if (!token) return;
    const res = await fetch('/api/profile?type=notifications', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const { notifications } = await res.json();
    (notifications || []).forEach(n => {
      // Only add ones not already shown
      if (!_inAppNotes.find(x => x.serverid === n.id)) {
        _inAppNotes.push({
          id: n.id,
          serverid: n.id,
          title: n.title,
          message: n.message,
          icon: n.type === 'prize_paid' ? '💰' : n.type === 'tournament_reminder' ? '⏰' : '🔔',
          time: n.created_at,
          read: !!n.read,
        });
      }
    });
    _inAppNotes.sort((a, b) => new Date(b.time) - new Date(a.time));
    renderInAppNotifications();
  } catch { /* non-critical */ }
}

// Expose for other modules
window.nudge = nudge;
window.openFavGameModal = openFavGameModal;
window.closeFavGameModal = closeFavGameModal;
window.addInAppNotification = addInAppNotification;
window.scrollToArena = scrollToArena;
