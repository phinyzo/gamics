'use strict';

/**
 * PhinTech Arena — Live Match Engine
 * Powered by PhinTech Solutions, Kenya
 *
 * Pulls ongoing matches from Supabase, drives the live section
 * with real player data, animated scores, ticker, and countdown.
 */

// ── GAME COVER IMAGES (reuse from arena) ─────────────────────────────────────
const LIVE_GAME_IMAGES = {
  'PES / eFootball':  'https://media.rawg.io/media/games/eb1/eb1ff1ffdab179ff7f0987d0266d4fe5.jpg',
  'FIFA / EA FC':     'https://media.rawg.io/media/screenshots/928/9289953b354ac641e3f1b83d43e18521.jpg',
  'Tekken 8':         'https://media.rawg.io/media/games/ed3/ed3a5e9fab79022979de9ef420137f73.jpg',
  'Call of Duty':     'https://media.rawg.io/media/games/7e3/7e327a055bedb9b6d1be86593bef473d.jpg',
  'Mortal Kombat 1':  'https://media.rawg.io/media/games/155/155087d7b9c1225cda0ab9e586b6374d.jpg',
  'NBA 2K':           'https://media.rawg.io/media/screenshots/d6a/d6a58b272dc77a5e2b38ed5729dee9a8.jpg',
  'Street Fighter 6': 'https://media.rawg.io/media/games/ce2/ce2463db40cec363f360c29ddcc56884.jpg',
};

// ── SEED LIVE DATA ────────────────────────────────────────────────────────────
// Pulled from Supabase ongoing matches; fallback to this seed
const SEED_LIVE_MATCHES = [
  {
    id: 'live1', game: 'FIFA / EA FC', tournament: 'EA FC 25 Weekly',
    p1: { tag: 'EAFC_Phin',  elo: 1710, county: 'Nairobi',  score: 2 },
    p2: { tag: 'Mombasa_FC', elo: 1648, county: 'Mombasa',  score: 1 },
    prize: 1200, round: 'Semifinal', status: 'live', elapsed: '34:20',
  },
  {
    id: 'live2', game: 'PES / eFootball', tournament: 'Nairobi PES Cup',
    p1: { tag: 'Phin_KE',  elo: 1682, county: 'Nairobi',  score: 1 },
    p2: { tag: 'Brian254', elo: 1645, county: 'Kisumu',   score: 0 },
    prize: 1200, round: 'Quarterfinal', status: 'live', elapsed: '12:05',
  },
  {
    id: 'up1', game: 'Tekken 8', tournament: 'Tekken 8 Nairobi Open',
    p1: { tag: 'Kazuya_KE', elo: 1590, county: 'Nairobi', score: 0 },
    p2: { tag: 'Law_NRB',   elo: 1565, county: 'Nakuru',  score: 0 },
    prize: 6000, round: 'Round 1', status: 'upcoming', startsIn: 25 * 60,
  },
  {
    id: 'up2', game: 'Mortal Kombat 1', tournament: 'MK1 Fatality Cup',
    p1: { tag: 'Scorpion_KE', elo: 1720, county: 'Nairobi', score: 0 },
    p2: { tag: 'Liu_KE',      elo: 1655, county: 'Eldoret', score: 0 },
    prize: 600, round: 'Grand Final', status: 'upcoming', startsIn: 60 * 60,
  },
  {
    id: 'up3', game: 'Call of Duty', tournament: 'CoD Warzone Duos',
    p1: { tag: 'Ghost_NRB', elo: 1540, county: 'Nairobi',  score: 0 },
    p2: { tag: 'Apex_KE',   elo: 1532, county: 'Thika',    score: 0 },
    prize: 25000, round: 'Qualifier', status: 'upcoming', startsIn: 2 * 60 * 60,
  },
];

let currentLiveIndex = 0;
let liveMatches      = [];
let liveTimers       = {};

// ── FETCH LIVE MATCHES ────────────────────────────────────────────────────────

async function fetchLiveMatches() {
  let dbMatches = [];

  try {
    const res  = await fetch('/api/tournaments?status=ongoing&limit=10');
    const data = await res.json();
    if (data.tournaments?.length) {
      dbMatches = data.tournaments.map(t => ({
        id:         t.id,
        game:       t.game,
        tournament: t.name,
        p1: { tag: 'Player 1', elo: 1500, county: 'Kenya', score: 0 },
        p2: { tag: 'Player 2', elo: 1500, county: 'Kenya', score: 0 },
        prize:   t.prize_pool,
        round:   `Round ${t.current_round || 1}`,
        status:  'live',
        elapsed: '00:00',
        startedAt: Date.now(),
      }));
    }
  } catch (_) {}

  // Use real DB data if available, otherwise fall back to seed
  if (dbMatches.length) {
    // Show real live + upcoming seeds together
    const seedUpcoming = SEED_LIVE_MATCHES.filter(m => m.status === 'upcoming');
    liveMatches = [...dbMatches, ...seedUpcoming];
  } else {
    liveMatches = [...SEED_LIVE_MATCHES];
  }

  initLiveSection();

  // Refresh real data every 60 seconds
  if (!window._liveRefreshTimer) {
    window._liveRefreshTimer = setInterval(async () => {
      try {
        const res  = await fetch('/api/tournaments?status=ongoing&limit=10');
        const data = await res.json();
        if (data.tournaments?.length) {
          const fresh = data.tournaments.map(t => ({
            id: t.id, game: t.game, tournament: t.name,
            p1: { tag: 'Player 1', elo: 1500, county: 'Kenya', score: RT?.scores?.p1 || 0 },
            p2: { tag: 'Player 2', elo: 1500, county: 'Kenya', score: RT?.scores?.p2 || 0 },
            prize: t.prize_pool, round: `Round ${t.current_round || 1}`,
            status: 'live', elapsed: '00:00', startedAt: Date.now(),
          }));
          liveMatches = [...fresh, ...SEED_LIVE_MATCHES.filter(m => m.status === 'upcoming')];
          buildTicker();
          buildUpcomingList();
        }
      } catch (_) {}
    }, 60000);
  }
}

// ── INIT LIVE SECTION ─────────────────────────────────────────────────────────

function initLiveSection() {
  buildTicker();
  buildUpcomingList();
  showLiveMatch(0);
  startLiveClocks();
}

// ── TICKER ────────────────────────────────────────────────────────────────────

function buildTicker() {
  const el = document.getElementById('liveTickerItems');
  if (!el) return;
  const items = SEED_LIVE_MATCHES.map(m => {
    const score = m.status === 'live'
      ? `${m.p1.tag} ${m.p1.score} – ${m.p2.score} ${m.p2.tag}`
      : `${m.p1.tag} vs ${m.p2.tag} (${fmtCountdown(m.startsIn || 0)})`;
    return `<span class="ticker-item">
      <span class="ticker-dot ${m.status === 'live' ? 'live' : 'upcoming'}"></span>
      <strong>${m.game}</strong> — ${score}
    </span>`;
  }).join('');
  // Duplicate for seamless loop
  el.innerHTML = items + items;
}

// ── SHOW MATCH ────────────────────────────────────────────────────────────────

function showLiveMatch(idx) {
  const match = liveMatches[idx];
  if (!match) return;
  currentLiveIndex = idx;

  const bannerImg  = document.getElementById('liveMatchBannerImg');
  const gameEl     = document.getElementById('liveMatchGame');
  const prizeEl    = document.getElementById('liveMatchPrize');
  const p1Tag      = document.getElementById('liveP1Tag');
  const p1Elo      = document.getElementById('liveP1Elo');
  const p2Tag      = document.getElementById('liveP2Tag');
  const p2Elo      = document.getElementById('liveP2Elo');
  const p1Score    = document.getElementById('liveP1Score');
  const p2Score    = document.getElementById('liveP2Score');
  const subtitle   = document.getElementById('liveMatchSubtitle');
  const timeEl     = document.getElementById('liveMatchTime');
  const statusEl   = document.getElementById('liveMatchStatus');

  if (bannerImg) bannerImg.src = LIVE_GAME_IMAGES[match.game] || './assets/images/live-match-banner.jpg';
  if (gameEl)    gameEl.textContent  = match.game;
  if (prizeEl)   prizeEl.textContent = `KES ${Number(match.prize).toLocaleString()} Prize`;
  if (p1Tag)     p1Tag.textContent   = match.p1.tag;
  if (p1Elo)     p1Elo.textContent   = `ELO ${match.p1.elo}`;
  if (p2Tag)     p2Tag.textContent   = match.p2.tag;
  if (p2Elo)     p2Elo.textContent   = `ELO ${match.p2.elo}`;
  if (p1Score)   p1Score.textContent = match.p1.score;
  if (p2Score)   p2Score.textContent = match.p2.score;
  if (subtitle)  subtitle.textContent = match.tournament + ' — ' + match.round;

  if (match.status === 'live') {
    if (timeEl)   timeEl.textContent   = match.elapsed || '00:00';
    if (statusEl) { statusEl.textContent = '🔴 LIVE NOW'; statusEl.className = 'live-match-status status-live'; }
    liveTimers[match.id] = liveTimers[match.id] || { elapsed: parseTime(match.elapsed || '00:00') };
    startMatchClock(match.id, timeEl);
  } else {
    if (timeEl)   timeEl.textContent   = fmtCountdown(match.startsIn || 0);
    if (statusEl) { statusEl.textContent = '⏳ STARTING SOON'; statusEl.className = 'live-match-status status-upcoming'; }
    startCountdown(match.id, match.startsIn || 0, timeEl, statusEl);
  }

  // Animate score change
  [p1Score, p2Score].forEach(el => {
    if (!el) return;
    el.classList.remove('score-pop');
    void el.offsetWidth;
    el.classList.add('score-pop');
  });
}

// ── UPCOMING LIST ─────────────────────────────────────────────────────────────

function buildUpcomingList() {
  const list = document.getElementById('liveUpcomingList');
  if (!list) return;

  list.innerHTML = liveMatches.map((m, i) => {
    const img     = LIVE_GAME_IMAGES[m.game] || '';
    const timeStr = m.status === 'live' ? '🔴 LIVE' : fmtCountdown(m.startsIn || 0);
    return `
      <div class="upcoming-match-card ${i === currentLiveIndex ? 'active' : ''}"
           onclick="showLiveMatch(${i})" role="button" tabindex="0">
        <div class="umc-cover" style="background-image:url('${img}')"></div>
        <div class="umc-info">
          <p class="umc-game">${esc(m.game)}</p>
          <p class="umc-players">${esc(m.p1.tag)} vs ${esc(m.p2.tag)}</p>
          <p class="umc-round">${esc(m.round)}</p>
        </div>
        <div class="umc-right">
          <span class="umc-time ${m.status === 'live' ? 'umc-live' : ''}">${timeStr}</span>
          <span class="umc-prize">KES ${Number(m.prize).toLocaleString()}</span>
        </div>
      </div>`;
  }).join('');
}

// ── LIVE STREAM MODAL ─────────────────────────────────────────────────────────

function openLiveStream() {
  const match = liveMatches[currentLiveIndex];
  if (!match) return;
  const url = `https://www.twitch.tv/directory/game/${encodeURIComponent(match.game)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ── CLOCKS ────────────────────────────────────────────────────────────────────

function parseTime(str) {
  const parts = str.split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtCountdown(secs) {
  if (secs <= 0) return 'Starting...';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function startMatchClock(id, el) {
  if (liveTimers['_clock_'+id]) return; // already running
  liveTimers['_clock_'+id] = setInterval(() => {
    if (!liveTimers[id]) return;
    liveTimers[id].elapsed++;
    const match = liveMatches.find(m => m.id === id);
    if (match && liveMatches[currentLiveIndex]?.id === id && el) {
      el.textContent = fmtTime(liveTimers[id].elapsed);
    }
  }, 1000);
}

function startCountdown(id, initial, timeEl, statusEl) {
  let remaining = initial;
  if (liveTimers['_cd_'+id]) clearInterval(liveTimers['_cd_'+id]);
  liveTimers['_cd_'+id] = setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    const match = liveMatches.find(m => m.id === id);
    if (match) match.startsIn = remaining;
    if (liveMatches[currentLiveIndex]?.id === id) {
      if (timeEl)   timeEl.textContent   = fmtCountdown(remaining);
      if (remaining === 0 && statusEl) {
        statusEl.textContent = '🔴 LIVE NOW';
        statusEl.className = 'live-match-status status-live';
      }
    }
    if (remaining === 0) clearInterval(liveTimers['_cd_'+id]);
  }, 1000);
}

function startLiveClocks() {
  const liveOnly = liveMatches.filter(m => m.status === 'live');
  liveOnly.forEach(m => {
    liveTimers[m.id] = { elapsed: parseTime(m.elapsed || '00:00') };
  });
}

// ── UTILS ─────────────────────────────────────────────────────────────────────

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── INIT ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  fetchLiveMatches();
  // Auto-rotate through live matches every 15s
  setInterval(() => {
    if (!liveMatches.length) return;
    showLiveMatch((currentLiveIndex + 1) % liveMatches.length);
    // Refresh upcoming list to update active state
    buildUpcomingList();
  }, 15000);
});
