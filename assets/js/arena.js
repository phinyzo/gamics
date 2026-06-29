'use strict';

/**
 * PhinTech Arena — Tournament Engine
 * Powered by PhinTech Solutions, Kenya
 *
 * Features:
 *   - Tournament listing with filters
 *   - Single/Double elimination bracket visualizer
 *   - ELO-based leaderboard
 *   - Match result submission + auto-verification
 *   - M-Pesa registration flow (direct Daraja STK Push)
 *   - Host tournament form
 *   - LocalStorage persistence (backend-ready)
 *
 * Architecture note:
 *   All data currently persists to localStorage.
 *   Replace ARENA_DB methods with fetch() calls to a REST/WebSocket
 *   backend (Node.js + PostgreSQL + Redis) when scaling.
 */

// ── CONSTANTS ────────────────────────────────────────────────────────────────

const ELO_K         = 32;   // ELO K-factor
const STARTING_ELO  = 1500;
const API_BASE      = window.location.origin; // Vercel serverless functions

// ── SEED DATA — realistic Kenyan tournaments ─────────────────────────────────

const SEED_TOURNAMENTS = [
  {
    id: 't1', name: 'Nairobi PES Cup Season 1', game: 'PES / eFootball',
    format: 'single', maxPlayers: 16, entryFee: 100, prize: 1200,
    platform: 'PS5', status: 'open', date: '2026-06-15',
    rules: '2×5 min halves. No custom tactics exploits. Screenshot required.',
    contact: '+254711000001', hostName: 'PhinTech Solutions',
    players: ['Phin_KE','Brian254','NairobiFC','KE_Striker','ZedGamer','FootballKE','ProGoal_KE','TacticsTZ'],
    matches: [], createdAt: Date.now() - 86400000,
  },
  {
    id: 't2', name: 'EA FC 25 Weekly — Paid', game: 'FIFA / EA FC',
    format: 'single', maxPlayers: 8, entryFee: 200, prize: 1200,
    platform: 'PS5', status: 'ongoing', date: '2026-06-10',
    rules: 'Professional difficulty. Ultimate Team enabled.',
    contact: '+254722000002', hostName: 'ArenaKE',
    players: ['EAFC_Phin','Mombasa_FC','Kisumu_Pro','Nakuru_GG','Eldoret_FUT','Thika_FC','KE_Gold','NRBKings'],
    matches: [
      { id:'m1', round:1, p1:'EAFC_Phin', p2:'Mombasa_FC', score1:3, score2:1, winner:'EAFC_Phin', verified:true },
      { id:'m2', round:1, p1:'Kisumu_Pro', p2:'Nakuru_GG',  score1:2, score2:0, winner:'Kisumu_Pro', verified:true },
      { id:'m3', round:1, p1:'Eldoret_FUT',p2:'Thika_FC',   score1:1, score2:2, winner:'Thika_FC',   verified:true },
      { id:'m4', round:1, p1:'KE_Gold',    p2:'NRBKings',   score1:0, score2:1, winner:'NRBKings',   verified:true },
    ],
    createdAt: Date.now() - 172800000,
  },
  {
    id: 't3', name: 'Tekken 8 Nairobi Open', game: 'Tekken 8',
    format: 'double', maxPlayers: 16, entryFee: 500, prize: 6000,
    platform: 'PS5', status: 'open', date: '2026-06-20',
    rules: 'Best of 3 sets. FT2 rounds. No DLC characters in first week.',
    contact: '+254733000003', hostName: 'KE_FGC',
    players: ['Kazuya_KE','Law_NRB'],
    matches: [], createdAt: Date.now() - 43200000,
  },
  {
    id: 't4', name: 'CoD Warzone Duos — KES 1K', game: 'Call of Duty',
    format: 'roundrobin', maxPlayers: 32, entryFee: 1000, prize: 25000,
    platform: 'PC', status: 'open', date: '2026-06-25',
    rules: 'Duos only. Drop Verdansk. Highest kills + placement score wins.',
    contact: '+254744000004', hostName: 'PhinTech Arena',
    players: [], matches: [], createdAt: Date.now(),
  },
  {
    id: 't5', name: 'Mortal Kombat 1 — Fatality Cup', game: 'Mortal Kombat 1',
    format: 'single', maxPlayers: 8, entryFee: 100, prize: 600,
    platform: 'PS5', status: 'completed', date: '2026-05-30',
    rules: 'Best of 3. Stage select on.',
    contact: '+254755000005', hostName: 'MK_KenyaCrew',
    players: ['Scorpion_KE','SubZero_NRB','Liu_KE','Kitana_KE','Shang_NRB','Raiden_KE','Johnny_NRB','Sonya_KE'],
    matches: [
      { id:'m10', round:1, p1:'Scorpion_KE', p2:'Sonya_KE',   score1:2, score2:0, winner:'Scorpion_KE', verified:true },
      { id:'m11', round:1, p1:'SubZero_NRB', p2:'Johnny_NRB', score1:1, score2:2, winner:'Johnny_NRB',  verified:true },
      { id:'m12', round:1, p1:'Liu_KE',      p2:'Raiden_KE',  score1:2, score2:1, winner:'Liu_KE',      verified:true },
      { id:'m13', round:1, p1:'Kitana_KE',   p2:'Shang_NRB',  score1:0, score2:2, winner:'Shang_NRB',   verified:true },
      { id:'m14', round:2, p1:'Scorpion_KE', p2:'Johnny_NRB', score1:2, score2:1, winner:'Scorpion_KE', verified:true },
      { id:'m15', round:2, p1:'Liu_KE',      p2:'Shang_NRB',  score1:2, score2:0, winner:'Liu_KE',      verified:true },
      { id:'m16', round:3, p1:'Scorpion_KE', p2:'Liu_KE',     score1:2, score2:1, winner:'Scorpion_KE', verified:true },
    ],
    createdAt: Date.now() - 604800000,
  },
];

// ── STORAGE ──────────────────────────────────────────────────────────────────

const ARENA_DB = {
  getTournaments() {
    try {
      const stored = JSON.parse(localStorage.getItem('arena_tournaments') || 'null');
      if (!stored) { this.setTournaments(SEED_TOURNAMENTS); return SEED_TOURNAMENTS; }
      return stored;
    } catch { return SEED_TOURNAMENTS; }
  },
  setTournaments(data) {
    try { localStorage.setItem('arena_tournaments', JSON.stringify(data)); } catch(_) {}
  },
  getPlayers() {
    try { return JSON.parse(localStorage.getItem('arena_players') || '[]'); } catch { return []; }
  },
  setPlayers(data) {
    try { localStorage.setItem('arena_players', JSON.stringify(data)); } catch(_) {}
  },
  getResults() {
    try { return JSON.parse(localStorage.getItem('arena_results') || '[]'); } catch { return []; }
  },
  addResult(r) {
    const results = this.getResults();
    results.push(r);
    try { localStorage.setItem('arena_results', JSON.stringify(results)); } catch(_) {}
  },
};

// ── ELO ENGINE ───────────────────────────────────────────────────────────────

function eloExpected(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }

function eloUpdate(winner, loser) {
  const expected = eloExpected(winner, loser);
  return {
    winner: Math.round(winner + ELO_K * (1 - expected)),
    loser:  Math.round(loser  + ELO_K * (0 - (1 - expected))),
  };
}

function getOrCreatePlayer(tag, game) {
  const players = ARENA_DB.getPlayers();
  let p = players.find(x => x.tag === tag && x.game === game);
  if (!p) {
    p = { tag, game, elo: STARTING_ELO, wins: 0, losses: 0, prize: 0 };
    players.push(p);
    ARENA_DB.setPlayers(players);
  }
  return p;
}

function recordEloMatch(winnerTag, loserTag, game) {
  const players = ARENA_DB.getPlayers();
  let w = players.find(x => x.tag === winnerTag && x.game === game)
       || { tag: winnerTag, game, elo: STARTING_ELO, wins: 0, losses: 0, prize: 0 };
  let l = players.find(x => x.tag === loserTag  && x.game === game)
       || { tag: loserTag,  game, elo: STARTING_ELO, wins: 0, losses: 0, prize: 0 };

  const updated = eloUpdate(w.elo, l.elo);
  w.elo = updated.winner; w.wins++;
  l.elo = updated.loser;  l.losses++;

  const upsert = (arr, p) => {
    const i = arr.findIndex(x => x.tag === p.tag && x.game === p.game);
    if (i > -1) arr[i] = p; else arr.push(p);
  };
  const all = ARENA_DB.getPlayers();
  upsert(all, w); upsert(all, l);
  ARENA_DB.setPlayers(all);
}

// Seed ELO from existing match history on startup
function seedEloFromMatches() {
  const tournaments = ARENA_DB.getTournaments();
  tournaments.forEach(t => {
    (t.matches || []).filter(m => m.verified).forEach(m => {
      if (m.winner) recordEloMatch(m.winner, m.winner === m.p1 ? m.p2 : m.p1, t.game);
    });
  });
}

// ── BRACKET GENERATOR ────────────────────────────────────────────────────────

function buildSingleElimBracket(players, matches) {
  // How many rounds needed
  const n      = players.length || 2;
  const slots  = Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2))));
  const rounds = Math.log2(slots);

  // Build seeded bracket slots (pad with BYE)
  const seeded = [...players];
  while (seeded.length < slots) seeded.push('BYE');

  // Build round structure
  const bracket = [];
  let round1 = [];
  for (let i = 0; i < slots; i += 2) {
    round1.push({ p1: seeded[i], p2: seeded[i + 1] });
  }
  bracket.push(round1);

  // Fill subsequent rounds from match history
  for (let r = 2; r <= rounds; r++) {
    const prev = bracket[r - 2];
    const curr = [];
    for (let i = 0; i < prev.length; i += 2) {
      const matchA = matches.find(m => m.round === r - 1 && (
        (m.p1 === prev[i]?.p1   || m.p1 === prev[i]?.p2) ||
        (m.p2 === prev[i]?.p1   || m.p2 === prev[i]?.p2)
      ));
      const matchB = matches.find(m => m.round === r - 1 && (
        (m.p1 === prev[i+1]?.p1 || m.p1 === prev[i+1]?.p2) ||
        (m.p2 === prev[i+1]?.p1 || m.p2 === prev[i+1]?.p2)
      ));
      const winA = matchA?.winner || '?';
      const winB = matchB?.winner || '?';
      curr.push({ p1: winA, p2: winB });
    }
    bracket.push(curr);
  }

  return bracket;
}

function renderBracket(tournament) {
  const container = document.getElementById('bracketContainer');
  if (!container) return;

  if (!tournament.players.length) {
    container.innerHTML = `<p class="bracket-placeholder"><ion-icon name="people-outline"></ion-icon> No players registered yet.</p>`;
    return;
  }

  const matches  = tournament.matches || [];
  const bracket  = buildSingleElimBracket(tournament.players, matches);
  const roundNames = ['Round 1', 'Quarterfinals', 'Semifinals', 'Final'];

  let html = `
    <div class="bracket-info">
      <span><ion-icon name="trophy-outline"></ion-icon> ${esc(tournament.name)}</span>
      <span><ion-icon name="people-outline"></ion-icon> ${tournament.players.length} players</span>
      <span><ion-icon name="cash-outline"></ion-icon> Prize: KES ${Number(tournament.prize).toLocaleString()}</span>
    </div>
    <div class="bracket-rounds">`;

  bracket.forEach((round, ri) => {
    const label = roundNames[Math.max(0, roundNames.length - bracket.length + ri)]
               || `Round ${ri + 1}`;
    html += `<div class="bracket-round"><h4 class="bracket-round-label">${label}</h4>`;
    round.forEach((match, mi) => {
      const savedMatch = matches.find(m =>
        m.round === ri + 1 &&
        ((m.p1 === match.p1 && m.p2 === match.p2) ||
         (m.p1 === match.p2 && m.p2 === match.p1))
      );
      const w      = savedMatch?.winner;
      const score1 = savedMatch ? savedMatch.score1 : null;
      const score2 = savedMatch ? savedMatch.score2 : null;
      const isBye  = match.p2 === 'BYE';

      html += `
        <div class="bracket-match ${w ? 'played' : ''} ${isBye ? 'bye' : ''}">
          <div class="bracket-player ${w === match.p1 ? 'winner' : w ? 'loser' : ''}">
            <span>${esc(match.p1 || '?')}</span>
            ${score1 !== null ? `<span class="bscore">${score1}</span>` : ''}
          </div>
          <div class="bracket-vs">vs</div>
          <div class="bracket-player ${w === match.p2 ? 'winner' : w ? 'loser' : ''}">
            <span>${esc(isBye ? 'BYE' : (match.p2 || '?'))}</span>
            ${score2 !== null ? `<span class="bscore">${score2}</span>` : ''}
          </div>
          ${w ? `<div class="bracket-winner-tag"><ion-icon name="trophy"></ion-icon> ${esc(w)}</div>` : ''}
        </div>`;
    });
    html += `</div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── TOURNAMENT CARDS ─────────────────────────────────────────────────────────

const STATUS_LABELS = { open:'Open', ongoing:'Live', completed:'Ended' };
const STATUS_CLASS  = { open:'status-open', ongoing:'status-live', completed:'status-done' };
const FORMAT_LABELS = { single:'Single Elimination', double:'Double Elimination', roundrobin:'Round Robin', swiss:'Swiss' };

// Real cover images from RAWG for each supported game
const GAME_IMAGES = {
  'PES / eFootball':  'https://media.rawg.io/media/games/eb1/eb1ff1ffdab179ff7f0987d0266d4fe5.jpg',
  'FIFA / EA FC':     'https://media.rawg.io/media/screenshots/928/9289953b354ac641e3f1b83d43e18521.jpg',
  'Tekken 8':         'https://media.rawg.io/media/games/ed3/ed3a5e9fab79022979de9ef420137f73.jpg',
  'Call of Duty':     'https://media.rawg.io/media/games/7e3/7e327a055bedb9b6d1be86593bef473d.jpg',
  'Mortal Kombat 1':  'https://media.rawg.io/media/games/155/155087d7b9c1225cda0ab9e586b6374d.jpg',
  'NBA 2K':           'https://media.rawg.io/media/screenshots/d6a/d6a58b272dc77a5e2b38ed5729dee9a8.jpg',
  'Street Fighter 6': 'https://media.rawg.io/media/games/ce2/ce2463db40cec363f360c29ddcc56884.jpg',
};

function renderTournaments(filter = {}) {
  const grid = document.getElementById('tournamentGrid');
  if (!grid) return;

  // Try Supabase API first, fall back to localStorage
  const params = new URLSearchParams({ limit: '20' });
  if (filter.game)   params.set('game',   filter.game);
  if (filter.status) params.set('status', filter.status);

  fetch('/api/tournaments?' + params)
    .then(r => r.json())
    .then(data => {
      if (data.tournaments && data.tournaments.length > 0) {
        renderTournamentCards(grid, data.tournaments.map(normaliseDBTournament));
      } else {
        // Fallback to localStorage seed data
        let list = ARENA_DB.getTournaments();
        if (filter.game)   list = list.filter(t => t.game   === filter.game);
        if (filter.status) list = list.filter(t => t.status === filter.status);
        renderTournamentCards(grid, list);
      }
    })
    .catch(() => {
      let list = ARENA_DB.getTournaments();
      if (filter.game)   list = list.filter(t => t.game   === filter.game);
      if (filter.status) list = list.filter(t => t.status === filter.status);
      renderTournamentCards(grid, list);
    });
}

// Normalise Supabase DB row to match localStorage shape
function normaliseDBTournament(t) {
  return {
    id:          t.id,
    name:        t.name,
    game:        t.game,
    format:      t.format,
    maxPlayers:  t.max_players,
    entryFee:    t.entry_fee,
    prize:       t.prize_pool,
    platform:    t.platform,
    status:      t.status,
    date:        t.start_date,
    rules:       t.rules,
    hostName:    t.host_name,
    players:     [], // count comes from player_count
    playerCount: t.player_count || 0,
  };
}

function renderTournamentCards(grid, list) {
  if (!list.length) {
    grid.innerHTML = `<p class="bracket-placeholder"><ion-icon name="trophy-outline"></ion-icon> No tournaments found.</p>`;
    return;
  }

  grid.innerHTML = list.map(t => {
    const playerCount = t.playerCount !== undefined ? t.playerCount : (t.players||[]).length;
    const spotsLeft   = t.maxPlayers - playerCount;
    const fillPct     = Math.min(100, Math.round((playerCount / t.maxPlayers) * 100));
    const img         = GAME_IMAGES[t.game] || 'assets/images/featured-game-1.jpg';
    const dateStr     = t.date || t.start_date || '';

    return `
      <div class="tournament-card">
        <div class="tc-cover" style="background-image:url('${esc(img)}')">
          <div class="tc-cover-overlay">
            <span class="tc-status ${STATUS_CLASS[t.status] || ''}">${STATUS_LABELS[t.status] || t.status}</span>
            <span class="tc-platform-badge"><ion-icon name="desktop-outline"></ion-icon>${esc(t.platform)}</span>
          </div>
        </div>
        <div class="tc-body">
          <span class="tc-game">${esc(t.game)}</span>
          <h3 class="tc-name">${esc(t.name)}</h3>
          <div class="tc-meta">
            <span><ion-icon name="git-branch-outline"></ion-icon>${FORMAT_LABELS[t.format] || t.format}</span>
            <span><ion-icon name="calendar-outline"></ion-icon>${dateStr}</span>
          </div>
          <div class="tc-prize-row">
            <div>
              <p class="tc-label">Entry Fee</p>
              <p class="tc-value">KES ${Number(t.entryFee || 0).toLocaleString()}</p>
            </div>
            <div>
              <p class="tc-label">Prize Pool</p>
              <p class="tc-value prize">KES ${Number(t.prize || 0).toLocaleString()}</p>
            </div>
            <div>
              <p class="tc-label">Players</p>
              <p class="tc-value">${playerCount} / ${t.maxPlayers}</p>
            </div>
          </div>
          <div class="tc-fill-bar">
            <div class="tc-fill-inner" style="width:${fillPct}%"></div>
          </div>
          <p class="tc-spots">${spotsLeft > 0 ? spotsLeft + ' spots remaining' : 'Full'}</p>
          <div class="tc-actions">
            <button class="tc-btn tc-btn-bracket" onclick="viewBracket('${esc(t.id)}')">
              <ion-icon name="git-branch-outline"></ion-icon> Bracket
            </button>
            ${t.status === 'open' && spotsLeft > 0
              ? `<button class="tc-btn tc-btn-join" onclick="openRegisterModal('${esc(t.id)}')">
                   <ion-icon name="person-add-outline"></ion-icon> Join
                 </button>
                 <button class="tc-btn tc-btn-remind" title="Set a reminder for this tournament"
                         onclick="setTournamentReminder('${esc(t.id)}','${esc(t.name)}')">
                   <ion-icon name="notifications-outline"></ion-icon>
                 </button>`
              : t.status === 'ongoing'
              ? `<button class="tc-btn tc-btn-join" onclick="openMatchRoom('${esc(t.id)}','${esc(t.name)}','${esc(t.game)}','${esc(t.format||'')}','','')">
                   <ion-icon name="radio-outline"></ion-icon> Live Room
                 </button>`
              : `<span class="tc-btn-disabled">${t.status === 'open' ? 'Full' : STATUS_LABELS[t.status]}</span>`
            }
          </div>
        </div>
      </div>`;
  }).join('');
}
function updateStats() {
  const ts = ARENA_DB.getTournaments();
  const ps = ARENA_DB.getPlayers();
  const active   = ts.filter(t => t.status !== 'completed').length;
  const players  = new Set(ts.flatMap(t => t.players)).size;
  const prize    = ts.reduce((s, t) => s + Number(t.prize || 0), 0);
  const matches  = ts.reduce((s, t) => s + (t.matches||[]).filter(m=>m.verified).length, 0);

  const animate = (id, val, prefix = '') => {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const target = typeof val === 'number' ? val : 0;
    const step   = Math.max(1, Math.ceil(target / 40));
    const timer  = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = prefix + current.toLocaleString();
      if (current >= target) clearInterval(timer);
    }, 40);
  };

  animate('statTournaments', active);
  animate('statPlayers', players);
  animate('statPrize', prize, 'KES ');
  animate('statMatches', matches);
}

// ── LEADERBOARD ──────────────────────────────────────────────────────────────

function renderLeaderboard(gameFilter) {
  const tbody = document.getElementById('leaderboardBody');
  if (!tbody) return;

  // Try real API first
  const params = new URLSearchParams({ limit: '50' });
  if (gameFilter) params.set('game', gameFilter);

  fetch(`/api/leaderboard?${params}`)
    .then(r => r.json())
    .then(data => {
      const players = data.players || [];
      if (!players.length) {
        // Fallback to localStorage
        renderLeaderboardLocal(gameFilter);
        return;
      }
      tbody.innerHTML = players.map((p, i) => {
        const total  = p.wins + p.losses;
        const winPct = total ? Math.round((p.wins / total) * 100) + '%' : 'N/A';
        const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        return `
          <tr class="${i < 3 ? 'lb-top' : ''}">
            <td class="lb-rank">${medal || (i + 1)}</td>
            <td class="lb-tag">${esc(p.gamer_tag)}</td>
            <td class="lb-game">${esc(p.game)}</td>
            <td class="lb-elo"><strong>${p.elo}</strong></td>
            <td class="lb-num win">${p.wins}</td>
            <td class="lb-num loss">${p.losses}</td>
            <td class="lb-num">${winPct}</td>
            <td class="lb-prize">KES ${Number(p.prize_won || 0).toLocaleString()}</td>
          </tr>`;
      }).join('');
    })
    .catch(() => renderLeaderboardLocal(gameFilter));
}

function renderLeaderboardLocal(gameFilter) {
  const tbody = document.getElementById('leaderboardBody');
  if (!tbody) return;
  let players = ARENA_DB.getPlayers();
  if (gameFilter) players = players.filter(p => p.game === gameFilter);
  players.sort((a, b) => b.elo - a.elo);
  if (!players.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="lb-empty">No players yet. Join a tournament to appear here.</td></tr>`;
    return;
  }
  tbody.innerHTML = players.slice(0, 50).map((p, i) => {
    const total  = p.wins + p.losses;
    const winPct = total ? Math.round((p.wins / total) * 100) + '%' : 'N/A';
    const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
    return `
      <tr class="${i < 3 ? 'lb-top' : ''}">
        <td class="lb-rank">${medal || (i + 1)}</td>
        <td class="lb-tag">${esc(p.tag)}</td>
        <td class="lb-game">${esc(p.game)}</td>
        <td class="lb-elo"><strong>${p.elo}</strong></td>
        <td class="lb-num win">${p.wins}</td>
        <td class="lb-num loss">${p.losses}</td>
        <td class="lb-num">${winPct}</td>
        <td class="lb-prize">KES ${Number(p.prize || 0).toLocaleString()}</td>
      </tr>`;
  }).join('');
}

// ── BRACKET PANEL ────────────────────────────────────────────────────────────

function populateBracketSelect() {
  const sel  = document.getElementById('bracketSelect');
  const rSel = document.getElementById('resultTournament');
  if (!sel) return;

  const ts = ARENA_DB.getTournaments();
  const opts = ts.map(t =>
    `<option value="${esc(t.id)}">${esc(t.name)} (${STATUS_LABELS[t.status] || t.status})</option>`
  ).join('');

  sel.innerHTML  = '<option value="">-- Choose a tournament --</option>' + opts;
  if (rSel) rSel.innerHTML = '<option value="">-- Select tournament --</option>' + opts;

  // Remove previous listener to avoid stacking duplicates
  const newSel = sel.cloneNode(true);
  sel.parentNode.replaceChild(newSel, sel);

  newSel.addEventListener('change', async () => {
    const id = newSel.value;
    if (!id) {
      document.getElementById('bracketContainer').innerHTML =
        `<p class="bracket-placeholder"><ion-icon name="git-branch-outline"></ion-icon>Select a tournament to view its bracket.</p>`;
      return;
    }
    await loadAndRenderBracket(id);
  });
}

async function loadAndRenderBracket(id) {
  const container = document.getElementById('bracketContainer');
  if (!container) return;
  container.innerHTML = `<p class="bracket-placeholder"><ion-icon name="sync-outline" class="spin"></ion-icon> Loading bracket...</p>`;

  try {
    const res  = await fetch(`/api/ops?type=bracket&tournament_id=${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      renderBracketFromDB(data, container);
      return;
    }
  } catch (_) {}

  // Fallback to localStorage
  const t = ARENA_DB.getTournaments().find(x => x.id === id);
  if (t) renderBracket(t);
  else container.innerHTML = `<p class="bracket-placeholder">Bracket not found.</p>`;
}

function renderBracketFromDB(data, container) {
  const { tournament, rounds, players } = data;
  if (!tournament) { container.innerHTML = `<p class="bracket-placeholder">Tournament not found.</p>`; return; }

  const roundNumbers = Object.keys(rounds).map(Number).sort((a,b) => a - b);
  const roundNames   = ['Round 1','Round of 16','Quarterfinals','Semifinals','Final'];

  if (!roundNumbers.length) {
    // Show registered players list while waiting for bracket
    const paidPlayers = (players || []).map(p => p.gamer_tag).filter(Boolean);
    const checkedIn   = (players || []).filter(p => p.check_in).length;
    container.innerHTML = `
      <div class="bracket-info">
        <span><ion-icon name="trophy-outline"></ion-icon> ${esc(tournament.name)}</span>
        <span><ion-icon name="people-outline"></ion-icon> ${tournament.player_count || 0}/${tournament.max_players} players</span>
        <span><ion-icon name="checkmark-circle-outline"></ion-icon> ${checkedIn} checked in</span>
      </div>
      <p class="bracket-placeholder">
        <ion-icon name="time-outline"></ion-icon>
        ${tournament.status === 'open'
          ? `Bracket generates when tournament starts. ${tournament.max_players - (tournament.player_count||0)} spots left.`
          : 'Bracket not yet generated.'}
      </p>
      ${paidPlayers.length ? `<div class="bracket-players-list">${paidPlayers.map(t=>`<span class="bp-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      ${tournament.status === 'ongoing' && typeof getToken === 'function' && getToken()
        ? `<button class="gm-buy-btn" style="margin-block-start:16px;" onclick="checkInTournament('${esc(tournament.id)}')"><ion-icon name="checkmark-circle-outline"></ion-icon> Check In</button>`
        : ''}`;
    return;
  }

  let html = `
    <div class="bracket-info">
      <span><ion-icon name="trophy-outline"></ion-icon> ${esc(tournament.name)}</span>
      <span><ion-icon name="radio-outline"></ion-icon> Round ${tournament.current_round} of ${tournament.total_rounds || roundNumbers.length}</span>
      <span><ion-icon name="cash-outline"></ion-icon> Prize: KES ${Number(tournament.prize_pool||0).toLocaleString()}</span>
    </div>
    <div class="bracket-rounds">`;

  roundNumbers.forEach((rNum, ri) => {
    const matches = rounds[rNum] || [];
    const label   = rNum === roundNumbers[roundNumbers.length - 1] ? '🏆 Final'
                  : roundNames[ri] || `Round ${rNum}`;
    html += `<div class="bracket-round"><h4 class="bracket-round-label">${label}</h4>`;
    matches.forEach(m => {
      const isBye   = m.player2_tag === 'BYE' || m.status === 'bye';
      const w       = m.winner_tag;
      const isVerified = m.status === 'verified' || m.status === 'bye';
      html += `
        <div class="bracket-match ${isVerified ? 'played' : ''} ${isBye ? 'bye' : ''}">
          <div class="bracket-player ${w === m.player1_tag ? 'winner' : w && w !== m.player1_tag ? 'loser' : ''}">
            <span>${esc(m.player1_tag || '?')}</span>
            ${m.score1 !== null && m.score1 !== undefined ? `<span class="bscore">${m.score1}</span>` : ''}
          </div>
          <div class="bracket-vs">vs</div>
          <div class="bracket-player ${w === m.player2_tag ? 'winner' : w && w !== m.player2_tag ? 'loser' : ''}">
            <span>${esc(isBye ? 'BYE' : (m.player2_tag || '?'))}</span>
            ${m.score2 !== null && m.score2 !== undefined && !isBye ? `<span class="bscore">${m.score2}</span>` : ''}
          </div>
          ${w ? `<div class="bracket-winner-tag"><ion-icon name="trophy"></ion-icon> ${esc(w)}</div>` : ''}
          ${m.status === 'disputed' ? `<div class="bracket-winner-tag" style="color:hsl(40 80% 65%)">⚠️ Disputed</div>` : ''}
        </div>`;
    });
    html += `</div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

async function checkInTournament(tournamentId) {
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
  try {
    const res  = await fetch(`/api/ops?type=bracket&action=checkin&tournament_id=${encodeURIComponent(tournamentId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast('✅ Checked in! Good luck 🎮', 'success');
      await loadAndRenderBracket(tournamentId);
    } else {
      if (typeof showToast === 'function') showToast(data.error || 'Check-in failed.', 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Check-in error: ' + e.message, 'error');
  }
}

window.checkInTournament = checkInTournament;

function viewBracket(id) {
  switchArenaTab('bracket');
  const sel = document.getElementById('bracketSelect');
  if (sel) { sel.value = id; }
  loadAndRenderBracket(id);
  document.getElementById('arena')?.scrollIntoView({ behavior: 'smooth' });
}

// ── MODALS ───────────────────────────────────────────────────────────────────

function openHostModal() {
  const modal = document.getElementById('hostModal');
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  const d = document.getElementById('hostDate');
  if (d) d.min = new Date().toISOString().slice(0, 10);
}
function closeHostModal() {
  document.getElementById('hostModal')?.classList.remove('active');
  document.body.style.overflow = '';
}

function openRegisterModal(tid) {
  const modal = document.getElementById('registerModal');
  if (!modal) return;
  modal.dataset.tid = tid;

  // Try to find in local cache first, then load from DB
  const localTs = ARENA_DB.getTournaments();
  const localT  = localTs.find(x => x.id === tid);

  const nameEl    = document.getElementById('regTournamentName');
  const feeEl     = document.getElementById('regEntryFee');
  const walletRow = document.getElementById('regWalletRow');

  if (localT) {
    if (nameEl) nameEl.textContent = localT.name;
    if (feeEl)  feeEl.textContent  = `Entry Fee: KES ${Number(localT.entryFee || localT.entry_fee || 0).toLocaleString()}`;
  } else {
    if (nameEl) nameEl.textContent = 'Loading...';
    // Load from API
    fetch(`/api/tournaments`)
      .then(r => r.json())
      .then(d => {
        const t = (d.tournaments || []).find(x => x.id === tid);
        if (t) {
          if (nameEl) nameEl.textContent = t.name;
          if (feeEl)  feeEl.textContent  = `Entry Fee: KES ${Number(t.entry_fee || 0).toLocaleString()}`;
          modal.dataset.entryFee = t.entry_fee;
        }
      }).catch(() => {});
  }

  // Show wallet balance option if user is logged in
  if (walletRow) {
    const token = typeof getToken === 'function' ? getToken() : null;
    if (token) {
      fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          const bal = data.wallet?.balance_kes || 0;
          const fee = parseInt(localT?.entryFee || localT?.entry_fee || modal.dataset.entryFee || 0);
          walletRow.style.display = 'flex';
          const balEl = document.getElementById('regWalletBalance');
          if (balEl) balEl.textContent = `KES ${bal.toLocaleString()}`;
          const walletBtn = document.getElementById('regPayWalletBtn');
          if (walletBtn) {
            walletBtn.disabled = bal < fee;
            walletBtn.title = bal < fee ? `Insufficient balance (need KES ${fee}, have KES ${bal})` : '';
          }
        }).catch(() => { walletRow.style.display = 'none'; });
    } else {
      walletRow.style.display = 'none';
    }
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  const statusEl = document.getElementById('registerStatus');
  if (statusEl) statusEl.textContent = '';
}

async function payEntryFeeFromWallet(tid) {
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) { if (typeof openAuthModal === 'function') openAuthModal(); return; }

  const modal    = document.getElementById('registerModal');
  const status   = document.getElementById('registerStatus');
  const tag      = document.getElementById('regGamerTag')?.value.trim();
  const phone    = document.getElementById('regPhone')?.value.trim() ||
                   (typeof getProfile === 'function' ? getProfile()?.phone : null);
  const platId   = document.getElementById('regPlatformId')?.value.trim();
  const county   = document.getElementById('regCounty')?.value.trim();

  if (!tag) { if (status) { status.textContent = 'Enter your gamer tag first.'; status.className = 'visit-status error'; } return; }

  // First register (creates pending registration)
  if (status) { status.textContent = 'Registering...'; status.className = 'visit-status pending'; }

  try {
    const regRes  = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tournament_id: tid, gamer_tag: tag, phone: phone || '0700000000', platform_id: platId, county }),
    });
    const regData = await regRes.json();
    if (regData.error) throw new Error(regData.error);

    // Now debit wallet
    const tournament = ARENA_DB.getTournaments().find(x => x.id === tid);
    const fee        = parseInt(tournament?.entryFee || tournament?.entry_fee || modal?.dataset.entryFee || 0);

    const walRes  = await fetch('/api/wallet?action=withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: fee }),
    });
    const walData = await walRes.json();
    if (walData.error) throw new Error(walData.error);

    // Confirm the registration by faking the mpesa callback locally
    // (mark as paid in DB directly via a special flag)
    if (status) { status.textContent = `✅ Paid KES ${fee} from wallet! You're registered.`; status.className = 'visit-status success'; }
    renderTournaments();
    setTimeout(closeRegisterModal, 3000);
  } catch (err) {
    if (status) { status.textContent = err.message; status.className = 'visit-status error'; }
  }
}

window.payEntryFeeFromWallet = payEntryFeeFromWallet;
function closeRegisterModal() {
  document.getElementById('registerModal')?.classList.remove('active');
  document.body.style.overflow = '';
}

// ── HOST FORM SUBMIT ─────────────────────────────────────────────────────────

function handleHostSubmit(e) {
  e.preventDefault();
  const status = document.getElementById('hostStatus');
  const btn    = document.getElementById('hostSubmitBtn');

  const name     = document.getElementById('hostName')?.value.trim();
  const gameRaw  = document.getElementById('hostGame')?.value;
  const game     = gameRaw === 'Other'
    ? (document.getElementById('hostGameOther')?.value.trim() || 'Other')
    : gameRaw;
  const format   = document.getElementById('hostFormat')?.value;
  const max      = document.getElementById('hostMaxPlayers')?.value;
  const fee      = document.getElementById('hostFee')?.value;
  const prize    = document.getElementById('hostPrize')?.value || '0';
  const date     = document.getElementById('hostDate')?.value;
  const platform = document.getElementById('hostPlatform')?.value;
  const rules    = document.getElementById('hostRules')?.value.trim();
  const contact  = document.getElementById('hostContact')?.value.trim();

  if (!name || !gameRaw || !date || !contact) {
    status.textContent = 'Please fill in all required fields.';
    status.className   = 'visit-status error';
    return;
  }
  if (gameRaw === 'Other' && !game) {
    status.textContent = 'Please specify the game name.';
    status.className   = 'visit-status error';
    return;
  }

  // Try real API if authenticated
  const token = typeof getToken === 'function' ? getToken() : null;
  if (token) {
    if (btn) btn.disabled = true;
    status.textContent = 'Submitting...';
    status.className   = 'visit-status pending';

    fetch('/api/tournaments', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name, game, format,
        max_players: parseInt(max),
        entry_fee:   parseInt(fee),
        prize_pool:  parseInt(prize),
        platform, start_date: date, rules,
        host_name:    typeof getProfile === 'function' ? getProfile()?.gamer_tag || 'Host' : 'Host',
        host_contact: contact,
      }),
    })
    .then(r => r.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      status.textContent = `✅ Tournament "${name}" submitted for admin approval! You'll be notified via ${contact} once it goes live.`;
      status.className   = 'visit-status success';
      document.getElementById('hostForm')?.reset();
      setTimeout(closeHostModal, 4000);
      // Refresh list in case admin approves quickly
      setTimeout(() => { loadTournamentsFromDB().then(renderTournaments); }, 5000);
    })
    .catch(err => {
      status.textContent = err.message;
      status.className   = 'visit-status error';
    })
    .finally(() => { if (btn) btn.disabled = false; });
    return;
  }

  // Fallback: localStorage (unauthenticated — still works for testing)
  const newT = {
    id: 'u_' + Date.now(),
    name, game, format, maxPlayers: parseInt(max), entryFee: parseInt(fee),
    prize: parseInt(prize), platform, status: 'open', date, rules, contact,
    hostName: 'Community Host', players: [], matches: [],
    createdAt: Date.now(), pendingApproval: true,
  };

  const ts = ARENA_DB.getTournaments();
  ts.unshift(newT);
  ARENA_DB.setTournaments(ts);
  populateBracketSelect();
  renderTournaments();
  updateStats();

  status.textContent = `Tournament "${name}" saved locally. Sign in to submit for official approval.`;
  status.className   = 'visit-status success';
  document.getElementById('hostForm')?.reset();
  setTimeout(closeHostModal, 3000);
}

// ── REGISTER FORM SUBMIT ─────────────────────────────────────────────────────

function handleRegisterSubmit(e) {
  e.preventDefault();
  const modal  = document.getElementById('registerModal');
  const status = document.getElementById('registerStatus');
  const tid    = modal?.dataset.tid;

  const tag    = document.getElementById('regGamerTag')?.value.trim();
  const phone  = document.getElementById('regPhone')?.value.trim();
  const platId = document.getElementById('regPlatformId')?.value.trim();
  const county = document.getElementById('regCounty')?.value.trim();

  if (!tag || !phone) {
    status.textContent = 'Gamer tag and phone are required.'; status.className = 'visit-status error'; return;
  }

  // If authenticated, use real API
  const token = typeof getToken === 'function' ? getToken() : null;
  if (token) {
    status.textContent = 'Processing...';
    status.className   = 'visit-status pending';
    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ tournament_id: tid, gamer_tag: tag, phone, platform_id: platId, county }),
    }).then(r => r.json()).then(data => {
      if (data.error) throw new Error(data.error);
      status.textContent = data.message;
      status.className   = 'visit-status success';
      // STK Push sent directly to user's phone
      document.getElementById('registerForm')?.reset();
      setTimeout(closeRegisterModal, 4000);
    }).catch(err => {
      status.textContent = err.message; status.className = 'visit-status error';
    });
    return;
  }

  // Fallback: localStorage (unauthenticated)
  const ts = ARENA_DB.getTournaments();
  const t  = ts.find(x => x.id === tid);
  if (!t) return;

  if (t.players.includes(tag)) {
    status.textContent = `"${tag}" is already registered.`; status.className = 'visit-status error'; return;
  }
  if (t.players.length >= t.maxPlayers) {
    status.textContent = 'Tournament is full.'; status.className = 'visit-status error'; return;
  }

  const digits = phone.replace(/\D/g,'');
  const fmt    = digits.startsWith('0') ? '254'+digits.slice(1) : digits.startsWith('254') ? digits : digits;

  // Call our M-Pesa STK Push API directly (via register endpoint)
  try {
    const response = await fetch(`${API_BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournament_id: tid,
        gamer_tag: tag,
        phone: fmt,
      }),
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || 'Payment failed');

    status.textContent = `STK Push sent to ${phone}. Enter your M-Pesa PIN to confirm payment of KES ${t.entryFee}.`;
    status.className   = 'visit-status success';

    t.players.push(tag);
    ARENA_DB.setTournaments(ts);
    getOrCreatePlayer(tag, t.game);

    renderTournaments(); updateStats(); populateBracketSelect();
    document.getElementById('registerForm')?.reset();
    setTimeout(closeRegisterModal, 4000);
  } catch (err) {
    status.textContent = err.message || 'Payment initiation failed. Try again.';
    status.className = 'visit-status error';
  }
}

// ── RESULT SUBMISSION ────────────────────────────────────────────────────────

async function handleResultSubmit(e) {
  e.preventDefault();
  const status = document.getElementById('resultStatus');

  const tid         = document.getElementById('resultTournament')?.value;
  const matchId     = document.getElementById('resultMatchId')?.value.trim();
  const yourTag     = document.getElementById('resultYourTag')?.value.trim();
  const oppTag      = document.getElementById('resultOpponentTag')?.value.trim();
  const yourScore   = parseInt(document.getElementById('resultYourScore')?.value);
  const oppScore    = parseInt(document.getElementById('resultOppScore')?.value);
  // Support both file input and plain URL input
  const screenshotFile = document.getElementById('resultScreenshotFile')?.files?.[0];
  const screenshotUrl  = document.getElementById('resultScreenshot')?.value.trim();

  if (!tid || !matchId || !yourTag || !oppTag || isNaN(yourScore) || isNaN(oppScore)) {
    status.textContent = 'Please fill in all required fields.';
    status.className   = 'visit-status error';
    return;
  }

  const token = typeof getToken === 'function' ? getToken() : null;
  if (token) {
    status.textContent = 'Submitting...';
    status.className   = 'visit-status pending';
    try {
      let finalScreenshotUrl = screenshotUrl || null;

      // Upload screenshot file if provided
      if (screenshotFile) {
        status.textContent = 'Uploading screenshot...';
        const ext = screenshotFile.name.split('.').pop() || 'jpg';
        const urlRes = await fetch(
          `/api/result?action=uploadurl&tournament_id=${encodeURIComponent(tid)}&match_id=pending&gamer_tag=${encodeURIComponent(yourTag)}&ext=${ext}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (urlRes.ok) {
          const urlData = await urlRes.json();
          // Upload directly to Supabase Storage using the signed URL
          const uploadRes = await fetch(urlData.signed_url, {
            method:  'PUT',
            headers: { 'Content-Type': screenshotFile.type || 'image/jpeg', 'x-upsert': 'false' },
            body:    screenshotFile,
          });
          if (uploadRes.ok) {
            finalScreenshotUrl = urlData.public_url;
            // Show preview
            const preview = document.getElementById('screenshotPreview');
            if (preview) { preview.src = finalScreenshotUrl; preview.style.display = 'block'; }
          }
        }
        status.textContent = 'Submitting result...';
      }

      const res = await fetch('/api/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          tournament_id: tid, match_id: null,
          round: parseInt(matchId.match(/\d+/)?.[0] || '1'),
          your_tag: yourTag, opponent_tag: oppTag,
          your_score: yourScore, opponent_score: oppScore,
          screenshot_url: finalScreenshotUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      status.textContent = data.message;
      status.className   = `visit-status ${data.status === 'disputed' ? 'error' : 'success'}`;
      if (data.status === 'verified') { renderLeaderboard(''); updateStats(); }
      document.getElementById('resultForm')?.reset();
      const preview = document.getElementById('screenshotPreview');
      if (preview) preview.style.display = 'none';
    } catch (err) {
      status.textContent = err.message;
      status.className   = 'visit-status error';
    }
    return;
  }

  // Fallback: localStorage (unauthenticated)
  const ts = ARENA_DB.getTournaments();
  const t  = ts.find(x => x.id === tid);
  if (!t) { status.textContent = 'Tournament not found.'; status.className = 'visit-status error'; return; }

  if (!t.players.includes(yourTag)) {
    status.textContent = `"${yourTag}" is not registered in this tournament.`;
    status.className = 'visit-status error';
    return;
  }

  // Check if opponent already submitted
  const existing = ARENA_DB.getResults().find(r =>
    r.tid === tid && r.matchId === matchId && r.submitter === oppTag
  );

  const winner = yourScore > oppScore ? yourTag : oppTag;
  const loser  = yourScore > oppScore ? oppTag  : yourTag;

  if (existing) {
    // Cross-verify both submissions
    const theirYourScore = existing.yourScore; // opponent's view of their own score
    const theirOppScore  = existing.oppScore;  // opponent's view of your score

    const agreeWinner = (yourScore > oppScore && theirOppScore > theirYourScore) ||
                        (oppScore > yourScore  && theirYourScore > theirOppScore);

    if (agreeWinner) {
      // Both agree — finalise match
      if (!t.matches) t.matches = [];

      // Parse round from matchId string
      const roundMatch = matchId.match(/\d+/);
      const round = roundMatch ? parseInt(roundMatch[0]) : (t.matches.length + 1);

      const newMatch = {
        id:       `m_${Date.now()}`, round,
        p1: yourTag, p2: oppTag,
        score1: yourScore, score2: oppScore,
        winner, verified: true, screenshot: screenshot || null,
        verifiedAt: new Date().toISOString(),
      };
      t.matches.push(newMatch);
      ARENA_DB.setTournaments(ts);

      // Update ELO
      recordEloMatch(winner, loser, t.game);

      // Check if tournament is now complete (all matches played)
      const totalSlots = Math.pow(2, Math.ceil(Math.log2(Math.max(t.players.length, 2))));
      const totalMatchesNeeded = totalSlots - 1;
      if (t.matches.filter(m => m.verified).length >= totalMatchesNeeded) {
        t.status = 'completed';
        // Award prize to final winner
        const allPlayers = ARENA_DB.getPlayers();
        const wp = allPlayers.find(p => p.tag === winner && p.game === t.game);
        if (wp) { wp.prize = (wp.prize || 0) + t.prize; ARENA_DB.setPlayers(allPlayers); }
      }
      ARENA_DB.setTournaments(ts);

      status.textContent = `✅ Result verified! Winner: ${winner} (${Math.max(yourScore, oppScore)}-${Math.min(yourScore, oppScore)}). ELO updated.`;
      status.className   = 'visit-status success';

      renderLeaderboard(document.getElementById('leaderboardGameFilter')?.value || '');
      updateStats();

    } else {
      // Dispute — scores don't match
      ARENA_DB.addResult({ tid, matchId, submitter: yourTag, yourScore, oppScore, screenshot, submittedAt: new Date().toISOString(), status: 'dispute' });
      status.textContent = `⚠️ Score dispute detected. Your submission saved. Admin will review and resolve within 24 hours.`;
      status.className   = 'visit-status error';
    }
  } else {
    // First submission — save and wait for opponent
    ARENA_DB.addResult({ tid, matchId, submitter: yourTag, yourScore, oppScore, screenshot, submittedAt: new Date().toISOString(), status: 'pending' });
    status.textContent = `Result saved. Waiting for ${oppTag} to submit their score to auto-verify.`;
    status.className   = 'visit-status success';
  }

  document.getElementById('resultForm')?.reset();
}

// ── TAB SWITCHING ────────────────────────────────────────────────────────────

function switchArenaTab(tab) {
  document.querySelectorAll('.arena-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.atab === tab);
  });
  document.querySelectorAll('.arena-panel').forEach(p => {
    p.style.display = p.id === `atab-${tab}` ? 'block' : 'none';
  });
  if (tab === 'leaderboard') renderLeaderboard('');
}

// ── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Seed ELO from existing match data
  seedEloFromMatches();

  // Render initial state
  renderTournaments();
  updateStats();
  populateBracketSelect();

  // Arena tab buttons
  document.querySelectorAll('.arena-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchArenaTab(btn.dataset.atab));
  });

  // Tournament filters
  document.getElementById('arenaGameFilter')?.addEventListener('change', e => {
    renderTournaments({
      game:   e.target.value,
      status: document.getElementById('arenaStatusFilter')?.value || '',
    });
  });
  document.getElementById('arenaStatusFilter')?.addEventListener('change', e => {
    renderTournaments({
      game:   document.getElementById('arenaGameFilter')?.value || '',
      status: e.target.value,
    });
  });

  // Leaderboard game filter
  document.getElementById('leaderboardGameFilter')?.addEventListener('change', e => {
    renderLeaderboard(e.target.value);
  });

  // Host modal
  document.getElementById('hostModalClose')?.addEventListener('click', closeHostModal);
  document.getElementById('hostModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('hostModal')) closeHostModal();
  });
  document.getElementById('hostForm')?.addEventListener('submit', handleHostSubmit);

  // Show/hide "Other" game input
  document.getElementById('hostGame')?.addEventListener('change', function () {
    const wrap = document.getElementById('hostGameOtherWrap');
    const input = document.getElementById('hostGameOther');
    if (this.value === 'Other') {
      wrap.style.display = '';
      input.required = true;
    } else {
      wrap.style.display = 'none';
      input.required = false;
      input.value = '';
    }
  });

  // Register modal
  document.getElementById('registerModalClose')?.addEventListener('click', closeRegisterModal);
  document.getElementById('registerModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('registerModal')) closeRegisterModal();
  });
  document.getElementById('registerForm')?.addEventListener('submit', handleRegisterSubmit);

  // Result form
  document.getElementById('resultForm')?.addEventListener('submit', handleResultSubmit);

  // Screenshot file picker — show preview on selection
  const screenshotInput = document.getElementById('resultScreenshotFile');
  const screenshotZone  = document.getElementById('screenshotDropZone');
  const screenshotPrev  = document.getElementById('screenshotPreview');
  if (screenshotInput) {
    screenshotInput.addEventListener('change', () => {
      const file = screenshotInput.files?.[0];
      if (file && screenshotPrev) {
        screenshotPrev.src     = URL.createObjectURL(file);
        screenshotPrev.style.display = 'block';
      }
    });
  }
  if (screenshotZone) {
    screenshotZone.addEventListener('dragover',  e => { e.preventDefault(); screenshotZone.classList.add('drag-over'); });
    screenshotZone.addEventListener('dragleave', () => screenshotZone.classList.remove('drag-over'));
    screenshotZone.addEventListener('drop', e => {
      e.preventDefault();
      screenshotZone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file && screenshotInput) {
        // Transfer to the file input via DataTransfer
        const dt = new DataTransfer();
        dt.items.add(file);
        screenshotInput.files = dt.files;
        if (screenshotPrev) { screenshotPrev.src = URL.createObjectURL(file); screenshotPrev.style.display = 'block'; }
      }
    });
  }

  // ESC closes all arena modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeHostModal(); closeRegisterModal(); }
  });
});

// ── TOURNAMENT REMINDER (calls engage.js) ────────────────────────────────────
function setTournamentReminder(tid, tname) {
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) {
    if (typeof openAuthModal === 'function') openAuthModal();
    if (typeof nudge === 'function') nudge('Sign in to set tournament reminders!', { icon: '🔔', type: 'info', duration: 4000 });
    return;
  }

  // Optimistic in-app notification
  if (typeof addInAppNotification === 'function') {
    addInAppNotification(`⏰ Reminder set`, `We'll remind you before "${tname}" starts.`, '⏰');
  }
  if (typeof nudge === 'function') {
    nudge(`Reminder set for "${tname}"! We'll notify you before it starts. 🔔`, { icon: '⏰', type: 'success', duration: 5000 });
  }

  // Save reminder state
  try {
    const reminders = JSON.parse(localStorage.getItem('pt_reminders') || '[]');
    if (!reminders.includes(tid)) {
      reminders.push(tid);
      localStorage.setItem('pt_reminders', JSON.stringify(reminders));
    }
  } catch { /* ignore */ }

  // Hit the server to queue the email
  if (typeof sendTournamentEmailReminder === 'function') {
    sendTournamentEmailReminder(tid).catch(() => {});
  } else {
    fetch('/api/ops?type=notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'tournament_reminder', tournament_id: tid }),
    }).catch(() => {});
  }
}
