'use strict';

/**
 * PhinTech Arena — HUD (Header User Display)
 * Powered by PhinTech Solutions, Kenya
 *
 * Features:
 *   - Gamer avatars via DiceBear API (free, no key needed)
 *   - Gender-based avatar sets (male / female / neutral)
 *   - Personalised game recommendations based on gender + genre pref
 *   - Header dropdown with ELO stats
 */

// ── AVATAR SETS ───────────────────────────────────────────────────────────────
// DiceBear styles — all free, no API key required
// https://www.dicebear.com/styles/

const AVATAR_BASE = 'https://api.dicebear.com/9.x';

const AVATARS = {
  male: [
    // Bottts (robot)
    { id:'m1',  label:'Blaze',    url:`${AVATAR_BASE}/bottts/svg?seed=BlazeMaleKE&backgroundColor=1a1a2e&eyes=eva&mouth=smile01` },
    { id:'m2',  label:'Phantom',  url:`${AVATAR_BASE}/bottts/svg?seed=PhantomMaleKE&backgroundColor=0d0d2b&eyes=robocop&mouth=bite` },
    { id:'m3',  label:'Reaper',   url:`${AVATAR_BASE}/bottts/svg?seed=ReaperMale&backgroundColor=120030&eyes=glow&mouth=diagram` },
    { id:'m4',  label:'Venom',    url:`${AVATAR_BASE}/bottts/svg?seed=VenomMaleKE&backgroundColor=0a1628&eyes=happy&mouth=square` },
    // Pixel-art
    { id:'m5',  label:'Shadow',   url:`${AVATAR_BASE}/pixel-art/svg?seed=ShadowMaleKE&backgroundColor=533483` },
    { id:'m6',  label:'Byte',     url:`${AVATAR_BASE}/pixel-art/svg?seed=ByteMaleKE&backgroundColor=1a1a2e` },
    { id:'m7',  label:'Glitch',   url:`${AVATAR_BASE}/pixel-art/svg?seed=GlitchMaleKE&backgroundColor=0f0f23` },
    { id:'m8',  label:'Sniper',   url:`${AVATAR_BASE}/pixel-art/svg?seed=SniperMaleKE&backgroundColor=0d1117` },
    // Adventurer
    { id:'m9',  label:'Nexus',    url:`${AVATAR_BASE}/adventurer/svg?seed=NexusMaleKE&backgroundColor=0d0d0d` },
    { id:'m10', label:'Apex',     url:`${AVATAR_BASE}/adventurer/svg?seed=ApexMaleKE&backgroundColor=1a1a2e` },
    { id:'m11', label:'Rogue',    url:`${AVATAR_BASE}/adventurer/svg?seed=RogueMaleKE&backgroundColor=120030` },
    { id:'m12', label:'Grind',    url:`${AVATAR_BASE}/adventurer/svg?seed=GrindMaleKE&backgroundColor=0a2010` },
    // Personas
    { id:'m13', label:'Striker',  url:`${AVATAR_BASE}/personas/svg?seed=StrikerMale&backgroundColor=0f3460` },
    { id:'m14', label:'Tank',     url:`${AVATAR_BASE}/personas/svg?seed=TankMaleKE&backgroundColor=1a0020` },
    { id:'m15', label:'Titan',    url:`${AVATAR_BASE}/lorelei/svg?seed=TitanMaleKE&backgroundColor=1a1a2e` },
    // Open-peeps
    { id:'m16', label:'King',     url:`${AVATAR_BASE}/open-peeps/svg?seed=KingMaleKE&backgroundColor=0d0d0d` },
    { id:'m17', label:'Clutch',   url:`${AVATAR_BASE}/open-peeps/svg?seed=ClutchMaleKE&backgroundColor=1a1a2e` },
    { id:'m18', label:'Warzone',  url:`${AVATAR_BASE}/open-peeps/svg?seed=WarzoneMaleKE&backgroundColor=0f3460` },
    // Fun-emoji
    { id:'m19', label:'Cyber',    url:`${AVATAR_BASE}/fun-emoji/svg?seed=CyberMaleKE&backgroundColor=120030` },
    { id:'m20', label:'Hack',     url:`${AVATAR_BASE}/fun-emoji/svg?seed=HackMaleKE&backgroundColor=0d1117` },
    { id:'m21', label:'Boss',     url:`${AVATAR_BASE}/fun-emoji/svg?seed=BossMaleKE&backgroundColor=1a0020` },
    // Shapes
    { id:'m22', label:'Drago',    url:`${AVATAR_BASE}/shapes/svg?seed=DragoMaleKE&backgroundColor=0a0a1a` },
    { id:'m23', label:'Fury',     url:`${AVATAR_BASE}/shapes/svg?seed=FuryMaleKE&backgroundColor=0f0f23` },
    // Thumbs
    { id:'m24', label:'Nairobi',  url:`${AVATAR_BASE}/thumbs/svg?seed=NairobiMaleKE&backgroundColor=163020` },
    { id:'m25', label:'254KE',    url:`${AVATAR_BASE}/thumbs/svg?seed=254MaleKE&backgroundColor=1a1a2e` },
  ],
  female: [
    { id:'f1',  label:'Nova',     url:`${AVATAR_BASE}/bottts/svg?seed=NovaFemaleKE&backgroundColor=2d1b69&eyes=eva&mouth=smile02` },
    { id:'f2',  label:'Viper',    url:`${AVATAR_BASE}/bottts/svg?seed=ViperFemaleKE&backgroundColor=1a0533&eyes=hearts&mouth=bite` },
    { id:'f3',  label:'Valkyrie', url:`${AVATAR_BASE}/bottts/svg?seed=ValkFemaleKE&backgroundColor=1a0030&eyes=glow&mouth=diagram` },
    { id:'f4',  label:'Zara',     url:`${AVATAR_BASE}/bottts/svg?seed=ZaraFemaleKE&backgroundColor=0d001a&eyes=happy&mouth=square` },
    { id:'f5',  label:'Kira',     url:`${AVATAR_BASE}/personas/svg?seed=KiraFemaleKE&backgroundColor=3d0066` },
    { id:'f6',  label:'Storm',    url:`${AVATAR_BASE}/personas/svg?seed=StormFemaleKE&backgroundColor=1a0033` },
    { id:'f7',  label:'Frost',    url:`${AVATAR_BASE}/pixel-art/svg?seed=FrostFemaleKE&backgroundColor=0a1628` },
    { id:'f8',  label:'Blitz',    url:`${AVATAR_BASE}/pixel-art/svg?seed=BlitzFemaleKE&backgroundColor=1a0030` },
    { id:'f9',  label:'Pixel',    url:`${AVATAR_BASE}/pixel-art/svg?seed=PixelFemaleKE&backgroundColor=2d0060` },
    { id:'f10', label:'Neon',     url:`${AVATAR_BASE}/pixel-art/svg?seed=NeonFemaleKE&backgroundColor=000d1a` },
    { id:'f11', label:'Echo',     url:`${AVATAR_BASE}/lorelei/svg?seed=EchoFemaleKE&backgroundColor=1a0030` },
    { id:'f12', label:'Pulse',    url:`${AVATAR_BASE}/adventurer/svg?seed=PulseFemaleKE&backgroundColor=120033` },
    { id:'f13', label:'Aura',     url:`${AVATAR_BASE}/adventurer/svg?seed=AuraFemaleKE&backgroundColor=1a0040` },
    { id:'f14', label:'Raze',     url:`${AVATAR_BASE}/adventurer/svg?seed=RazeFemaleKE&backgroundColor=200030` },
    { id:'f15', label:'Queen',    url:`${AVATAR_BASE}/open-peeps/svg?seed=QueenFemaleKE&backgroundColor=1a0030` },
    { id:'f16', label:'Empress',  url:`${AVATAR_BASE}/open-peeps/svg?seed=EmpressFemaleKE&backgroundColor=0d001a` },
    { id:'f17', label:'Slay',     url:`${AVATAR_BASE}/open-peeps/svg?seed=SlayFemaleKE&backgroundColor=2d0060` },
    { id:'f18', label:'Cyber-F',  url:`${AVATAR_BASE}/fun-emoji/svg?seed=CyberFemaleKE&backgroundColor=1a0030` },
    { id:'f19', label:'Hype',     url:`${AVATAR_BASE}/fun-emoji/svg?seed=HypeFemaleKE&backgroundColor=200020` },
    { id:'f20', label:'Drip',     url:`${AVATAR_BASE}/fun-emoji/svg?seed=DripFemaleKE&backgroundColor=0d001a` },
    { id:'f21', label:'Legend',   url:`${AVATAR_BASE}/shapes/svg?seed=LegendFemaleKE&backgroundColor=1a0030` },
    { id:'f22', label:'Iconic',   url:`${AVATAR_BASE}/shapes/svg?seed=IconicFemaleKE&backgroundColor=0a0a1a` },
    { id:'f23', label:'Nairobi-F',url:`${AVATAR_BASE}/thumbs/svg?seed=NairobiFemaleKE&backgroundColor=200030` },
    { id:'f24', label:'254-She',  url:`${AVATAR_BASE}/thumbs/svg?seed=254FemaleKE&backgroundColor=1a0040` },
    { id:'f25', label:'Xtreme',   url:`${AVATAR_BASE}/lorelei/svg?seed=XtremeFemaleKE&backgroundColor=0d001a` },
  ],
  other: [
    { id:'n1',  label:'Ghost',    url:`${AVATAR_BASE}/bottts/svg?seed=GhostNeutralKE&backgroundColor=0d1117` },
    { id:'n2',  label:'Cipher',   url:`${AVATAR_BASE}/bottts/svg?seed=CipherNeutralKE&backgroundColor=161b22` },
    { id:'n3',  label:'Zero',     url:`${AVATAR_BASE}/pixel-art/svg?seed=ZeroNeutralKE&backgroundColor=21262d` },
    { id:'n4',  label:'X',        url:`${AVATAR_BASE}/pixel-art/svg?seed=XNeutralKE&backgroundColor=0d1117` },
    { id:'n5',  label:'404',      url:`${AVATAR_BASE}/pixel-art/svg?seed=404NeutralKE&backgroundColor=1a1a2e` },
    { id:'n6',  label:'Void',     url:`${AVATAR_BASE}/lorelei/svg?seed=VoidNeutralKE&backgroundColor=0d0d0d` },
    { id:'n7',  label:'Binary',   url:`${AVATAR_BASE}/fun-emoji/svg?seed=BinaryNeutralKE&backgroundColor=0d1117` },
    { id:'n8',  label:'Anon',     url:`${AVATAR_BASE}/shapes/svg?seed=AnonNeutralKE&backgroundColor=0a0a1a` },
    { id:'n9',  label:'Signal',   url:`${AVATAR_BASE}/thumbs/svg?seed=SignalNeutralKE&backgroundColor=0d1117` },
    { id:'n10', label:'Matrix',   url:`${AVATAR_BASE}/adventurer/svg?seed=MatrixNeutralKE&backgroundColor=001a00` },
    { id:'n11', label:'Null',     url:`${AVATAR_BASE}/open-peeps/svg?seed=NullNeutralKE&backgroundColor=0d1117` },
    { id:'n12', label:'Crypto',   url:`${AVATAR_BASE}/personas/svg?seed=CryptoNeutralKE&backgroundColor=0a0a1a` },
  ],
};

// Default avatar when none selected
const DEFAULT_AVATARS = {
  male:   AVATARS.male[0].url,
  female: AVATARS.female[0].url,
  other:  AVATARS.other[0].url,
};

function getDefaultAvatar(gender) {
  return DEFAULT_AVATARS[gender] || DEFAULT_AVATARS.other;
}

function getAllAvatarsForGender(gender) {
  return AVATARS[gender] || [...AVATARS.other, ...AVATARS.male.slice(0,2), ...AVATARS.female.slice(0,2)];
}

// ── GAME RECOMMENDATIONS ──────────────────────────────────────────────────────

const RECOMMENDATIONS = {
  male: {
    action:   { label: 'Top Picks for Action Kings 🎯', genre: 'shooter', ordering: '-rating' },
    sports:   { label: 'Sports Arena Picks ⚽',         genre: 'sports',  ordering: '-rating' },
    fighting: { label: 'Fighter\'s Corner 🥊',           genre: 'fighting',ordering: '-rating' },
    rpg:      { label: 'Epic RPG Adventures 🗡️',        genre: 'rpg',     ordering: '-rating' },
    racing:   { label: 'Speed Demons 🏎️',               genre: 'racing',  ordering: '-rating' },
    strategy: { label: 'Big Brain Plays 🧠',             genre: 'strategy',ordering: '-rating' },
    horror:   { label: 'Dark Mode Activated 💀',         genre: 'horror',  ordering: '-rating' },
    default:  { label: 'Top Rated for You 🎮',           genre: '',        ordering: '-rating' },
  },
  female: {
    action:   { label: 'She Shoots, She Scores 🎯',      genre: 'shooter', ordering: '-rating' },
    sports:   { label: 'Sports Queens 👑',               genre: 'sports',  ordering: '-rating' },
    fighting: { label: 'Girl Power Fighters 💪',         genre: 'fighting',ordering: '-rating' },
    rpg:      { label: 'Queens of Adventure 🌟',         genre: 'rpg',     ordering: '-rating' },
    racing:   { label: 'Fast &amp; Fierce 🏁',           genre: 'racing',  ordering: '-rating' },
    strategy: { label: 'Strategic Masterminds 🧩',       genre: 'strategy',ordering: '-rating' },
    horror:   { label: 'Fearless Mode 🦇',               genre: 'horror',  ordering: '-rating' },
    default:  { label: 'Hand-Picked for You ✨',          genre: '',        ordering: '-rating' },
  },
  other: {
    default:  { label: 'Top Games Right Now 🎮',         genre: '',        ordering: '-rating' },
  },
};

function getRecommendation(gender, genre) {
  const g = gender || 'other';
  const pool = RECOMMENDATIONS[g] || RECOMMENDATIONS.other;
  return pool[genre] || pool.default || RECOMMENDATIONS.other.default;
}

// ── HUD DROPDOWN ──────────────────────────────────────────────────────────────

let hudOpen = false;

function toggleHudDropdown() {
  const dropdown = document.getElementById('hudDropdown');
  const chevron  = document.getElementById('hudChevron');
  const btn      = document.getElementById('headerUserBtn');
  if (!dropdown) return;
  hudOpen = !hudOpen;
  dropdown.classList.toggle('open', hudOpen);
  if (chevron) chevron.style.transform = hudOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  if (btn) btn.setAttribute('aria-expanded', String(hudOpen));
}

function closeHudDropdown() {
  const dropdown = document.getElementById('hudDropdown');
  const chevron  = document.getElementById('hudChevron');
  const btn      = document.getElementById('headerUserBtn');
  if (!dropdown) return;
  hudOpen = false;
  dropdown.classList.remove('open');
  if (chevron) chevron.style.transform = 'rotate(0deg)';
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// ── UPDATE HUD with profile data ──────────────────────────────────────────────

function updateHUD(profile, user) {
  if (!profile && !user) return;

  const tag    = profile?.gamer_tag  || user?.email?.split('@')[0] || 'Player';
  const email  = user?.email || '';
  const gender = profile?.gender || 'other';
  const avatar = profile?.avatar_url || getDefaultAvatar(gender);
  const initials = tag.slice(0, 2).toUpperCase();

  // Trigger button
  setAvatarImg('headerUserAvatar', 'hudAvatarFallback', avatar, initials);
  const nameEl = document.getElementById('headerUserName');
  if (nameEl) nameEl.textContent = tag;

  // Rank badge
  const rankEl = document.getElementById('hudRank');
  if (rankEl) {
    const elo = profile?.elo || 1500;
    rankEl.textContent = eloToRank(elo);
  }

  // Dropdown header
  setAvatarImg('hudDropAvatar', 'hudDropFallback', avatar, initials);
  const dropName  = document.getElementById('hudDropName');
  const dropEmail = document.getElementById('hudDropEmail');
  if (dropName)  dropName.textContent  = tag;
  if (dropEmail) dropEmail.textContent = email;

  // Stats
  document.getElementById('hudStatElo')?.setAttribute('data-target', profile?.elo || 1500);
  document.getElementById('hudStatWins')?.setAttribute('data-target', profile?.wins || 0);
  document.getElementById('hudStatTourns')?.setAttribute('data-target', profile?.tournament_count || 0);
  animateStatCounters();

  // Build avatar grid in dropdown
  buildAvatarGrid('hudAvatarGrid', gender, avatar, (newUrl) => {
    saveAvatarToProfile(newUrl);
    setAvatarImg('headerUserAvatar', 'hudAvatarFallback', newUrl, initials);
    setAvatarImg('hudDropAvatar',   'hudDropFallback',   newUrl, initials);
  });

  // Apply gender ring color
  applyGenderRing(gender);

  // Show personalised recommendation banner
  showRecommendationBanner(gender, profile?.preferred_game);
}

function setAvatarImg(imgId, fallbackId, url, initials) {
  const img      = document.getElementById(imgId);
  const fallback = document.getElementById(fallbackId);
  if (!img) return;
  if (url) {
    img.src   = url;
    img.style.display = 'block';
    img.onerror = () => {
      img.style.display = 'none';
      if (fallback) { fallback.textContent = initials; fallback.style.display = 'flex'; }
    };
    if (fallback) fallback.style.display = 'none';
  } else {
    img.style.display = 'none';
    if (fallback) { fallback.textContent = initials; fallback.style.display = 'flex'; }
  }
}

function applyGenderRing(gender) {
  const ring = document.getElementById('hudAvatarRing');
  if (!ring) return;
  ring.dataset.gender = gender || 'other';
}

function eloToRank(elo) {
  if (elo >= 2000) return '👑 Grand Master';
  if (elo >= 1800) return '💎 Diamond';
  if (elo >= 1650) return '🥇 Gold';
  if (elo >= 1550) return '🥈 Silver';
  if (elo >= 1500) return '🥉 Bronze';
  return '🎮 Unranked';
}

function animateStatCounters() {
  ['hudStatElo', 'hudStatWins', 'hudStatTourns'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const target = parseInt(el.getAttribute('data-target') || '0');
    let current  = 0;
    const step   = Math.max(1, Math.ceil(target / 30));
    const timer  = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current.toLocaleString();
      if (current >= target) clearInterval(timer);
    }, 30);
  });
}

// ── AVATAR GRID BUILDER ───────────────────────────────────────────────────────

function buildAvatarGrid(containerId, gender, currentUrl, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const avatars = getAllAvatarsForGender(gender || 'other');
  container.innerHTML = avatars.map(a => `
    <button type="button" class="avatar-pick-btn ${a.url === currentUrl ? 'selected' : ''}"
            data-url="${a.url}" title="${a.label}" aria-label="Select ${a.label} avatar">
      <img src="${a.url}" alt="${a.label}" loading="lazy">
      <span class="avatar-pick-name">${a.label}</span>
      <span class="avatar-pick-check"><ion-icon name="checkmark-circle"></ion-icon></span>
    </button>`).join('');

  container.querySelectorAll('.avatar-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.avatar-pick-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const url = btn.dataset.url;
      // Also update setup hidden field if present
      const hiddenField = document.getElementById('pm_avatar_url');
      if (hiddenField) hiddenField.value = url;
      if (onSelect) onSelect(url);
    });
  });
}

// Build avatar grid in profile setup modal — responds to gender selection
function buildSetupAvatarGrid(gender) {
  const currentUrl = document.getElementById('su_avatar_url')?.value || '';
  buildAvatarGrid('setupAvatarGrid', gender || 'other', currentUrl, (url) => {
    const field = document.getElementById('su_avatar_url');
    if (field) field.value = url;
  });
}

// ── SAVE AVATAR ───────────────────────────────────────────────────────────────

async function saveAvatarToProfile(url) {
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) return;
  try {
    await fetch('/api/profile', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({ avatar_url: url }),
    });
  } catch (e) { console.warn('[HUD] save avatar error:', e); }
}

// ── RECOMMENDATION BANNER ─────────────────────────────────────────────────────

function showRecommendationBanner(gender, genre) {
  const banner = document.getElementById('recoBanner');
  const label  = document.getElementById('recoBannerLabel');
  const loadBtn= document.getElementById('recoLoadBtn');
  if (!banner || !label) return;

  const rec = getRecommendation(gender, genre);
  label.innerHTML = rec.label;
  banner.style.display = 'flex';

  // Store for games section to use
  window._recoGenre   = rec.genre;
  window._recoOrdering= rec.ordering;

  if (loadBtn) {
    loadBtn.onclick = () => {
      // Update the games section search/filter
      const genreEl = document.getElementById('igdbGenres');
      if (genreEl) {
        genreEl.querySelectorAll('.igdb-genre-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.slug === rec.genre);
        });
      }
      if (window.state) {
        window.state.genre = rec.genre;
        if (typeof fetchGames === 'function') fetchGames(false);
      }
      document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' });
    };
  }
}

// ── GENDER PICKER WIRING (profile setup) ─────────────────────────────────────

function wireGenderPicker(pickerId, hiddenId, avatarGridFn) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;
  picker.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const gender = btn.dataset.gender;
      const field  = document.getElementById(hiddenId);
      if (field) field.value = gender;
      if (avatarGridFn) avatarGridFn(gender);
    });
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // HUD dropdown toggle
  document.getElementById('headerUserBtn')?.addEventListener('click', toggleHudDropdown);

  // Close on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('#headerUserArea')) closeHudDropdown();
  });

  // ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeHudDropdown();
  });

  // Gender picker in setup modal
  wireGenderPicker('setupGenderPicker', 'su_gender', (gender) => {
    buildSetupAvatarGrid(gender);
  });

  // Build default avatar grid for setup modal
  buildSetupAvatarGrid('other');

  // Listen for profile loaded event from auth.js
  document.addEventListener('profile-loaded', (e) => {
    const { profile, user } = e.detail;
    updateHUD(profile, user);
  });
});


// ── GAMER PROFILE MODAL (GP) ──────────────────────────────────────────────────

const BADGES = [
  { id:'first_win',    icon:'🏆', name:'First Blood',       desc:'Win your first match',             req: p => p.wins >= 1 },
  { id:'five_wins',    icon:'🔥', name:'On Fire',           desc:'Win 5 matches',                    req: p => p.wins >= 5 },
  { id:'ten_wins',     icon:'⚡', name:'Unstoppable',       desc:'Win 10 matches',                   req: p => p.wins >= 10 },
  { id:'first_tourney',icon:'🎮', name:'Tournament Debut',  desc:'Enter your first tournament',      req: p => (p.tournament_count||0) >= 1 },
  { id:'elo_1600',     icon:'💎', name:'Rising Star',       desc:'Reach 1600 ELO',                   req: p => (p.elo||1500) >= 1600 },
  { id:'elo_1800',     icon:'👑', name:'Elite Gamer',       desc:'Reach 1800 ELO',                   req: p => (p.elo||1500) >= 1800 },
  { id:'prize_winner', icon:'💰', name:'Money Moves',       desc:'Win prize money in a tournament',  req: p => (p.prize_won||0) > 0 },
  { id:'profile_set',  icon:'✅', name:'Ready Player One',  desc:'Complete your profile',            req: p => !!(p.gamer_tag && p.phone && p.avatar_url) },
  { id:'nairobi',      icon:'🇰🇪', name:'Nairobi Warrior',  desc:'Join from Nairobi county',         req: p => (p.county||'').toLowerCase().includes('nairobi') },
];

const ELO_RANKS = [
  { name:'unranked',   min:0,    max:1499, icon:'🎮',  label:'Unranked'     },
  { name:'bronze',     min:1500, max:1549, icon:'🥉',  label:'Bronze'       },
  { name:'silver',     min:1550, max:1649, icon:'🥈',  label:'Silver'       },
  { name:'gold',       min:1650, max:1799, icon:'🥇',  label:'Gold'         },
  { name:'diamond',    min:1800, max:1999, icon:'💎',  label:'Diamond'      },
  { name:'grandmaster',min:2000, max:9999, icon:'👑',  label:'Grand Master' },
];

function getRankFromElo(elo) {
  return ELO_RANKS.find(r => elo >= r.min && elo <= r.max) || ELO_RANKS[0];
}

function getXpProgress(elo) {
  const rank = getRankFromElo(elo);
  const next = ELO_RANKS[ELO_RANKS.indexOf(rank) + 1];
  if (!next) return { pct: 100, label: 'MAX RANK' };
  const range = next.min - rank.min;
  const earned = elo - rank.min;
  const pct = Math.min(100, Math.round((earned / range) * 100));
  return { pct, label: `${elo} / ${next.min} ELO to ${next.label}` };
}

function switchGPTab(tab) {
  document.querySelectorAll('.gp-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.gptab === tab);
  });
  document.querySelectorAll('.gp-panel').forEach(p => {
    p.style.display = p.id === 'gptab-' + tab ? 'block' : 'none';
  });
  if (tab === 'tournaments')  loadGPTournaments();
  if (tab === 'achievements') renderGPBadges();
  if (tab === 'referrals')    loadGPReferrals();
}

function openProfileModal() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  // Default to overview
  switchGPTab('overview');
  populateGPModal();
}

function closeProfileModal() {
  document.getElementById('profileModal')?.classList.remove('active');
  document.body.style.overflow = '';
}

function populateGPModal() {
  const profile = typeof getProfile === 'function' ? getProfile() : null;
  const user    = typeof getUser === 'function'    ? getUser()    : null;
  if (!profile && !user) return;

  const tag     = profile?.gamer_tag || user?.email?.split('@')[0] || 'Player';
  const email   = user?.email || '';
  const gender  = profile?.gender || 'other';
  const avatar  = profile?.avatar_url || getDefaultAvatar(gender);
  const elo     = profile?.elo     || 1500;
  const wins    = profile?.wins    || 0;
  const tourns  = profile?.tournament_count || 0;
  const prize   = profile?.prize_won        || 0;
  const rank    = getRankFromElo(elo);
  const xp      = getXpProgress(elo);

  // Hero
  const gpAvatar   = document.getElementById('gpAvatar');
  const gpFallback = document.getElementById('gpAvatarFallback');
  if (gpAvatar)   { gpAvatar.src = avatar; gpAvatar.onerror = () => { gpAvatar.style.display='none'; if(gpFallback){gpFallback.textContent=tag.slice(0,2).toUpperCase(); gpFallback.style.display='flex';} }; }
  const gpTag   = document.getElementById('gpTag');
  const gpRank  = document.getElementById('gpRankBadge');
  const gpEmail = document.getElementById('gpEmailDisplay');
  const gpHeroBg= document.getElementById('gpHeroBg');
  if (gpTag)   gpTag.textContent   = tag;
  if (gpRank)  { gpRank.textContent = rank.icon + ' ' + rank.label; gpRank.dataset.rank = rank.name; }
  if (gpEmail) gpEmail.textContent  = email;
  if (gpHeroBg) gpHeroBg.style.backgroundImage = avatar ? `url('${avatar}')` : '';

  // XP bar
  const xpFill  = document.getElementById('gpXpFill');
  const xpLabel = document.getElementById('gpXpLabel');
  const xpPct   = document.getElementById('gpXpPct');
  if (xpFill)  { setTimeout(() => { xpFill.style.width = xp.pct + '%'; }, 300); }
  if (xpLabel) xpLabel.textContent = xp.label;
  if (xpPct)   xpPct.textContent   = xp.pct + '%';

  // Highlight rank track
  document.querySelectorAll('.gp-rank-step').forEach(step => {
    step.classList.toggle('current',  step.dataset.rank === rank.name);
    step.classList.toggle('achieved', ELO_RANKS.findIndex(r=>r.name===step.dataset.rank) <= ELO_RANKS.findIndex(r=>r.name===rank.name));
  });

  // Stats — animate counting up
  const animCount = (id, target, prefix='') => {
    const el = document.getElementById(id);
    if (!el) return;
    let cur = 0;
    const t = parseInt(target) || 0;
    const step = Math.max(1, Math.ceil(t / 40));
    const timer = setInterval(() => {
      cur = Math.min(cur + step, t);
      el.textContent = prefix + cur.toLocaleString();
      if (cur >= t) clearInterval(timer);
    }, 25);
  };
  animCount('gpElo',   elo);
  animCount('gpWins',  wins);
  animCount('gpTourns',tourns);
  animCount('gpPrize', prize, 'KES ');

  // Settings tab — pre-fill
  const fields = ['gamer_tag','full_name','phone','county','platform_id'];
  fields.forEach(f => { const el = document.getElementById('pm_'+f); if(el) el.value = profile?.[f] || ''; });
  const genreEl = document.getElementById('pm_preferred_genre');
  if (genreEl) genreEl.value = profile?.preferred_game || '';
  const emailNotify = document.getElementById('pm_email_notify');
  const waNotify    = document.getElementById('pm_whatsapp_notify');
  if (emailNotify) emailNotify.checked = profile?.email_notify !== false;
  if (waNotify)    waNotify.checked    = profile?.whatsapp_notify !== false;
  const hiddenGender = document.getElementById('pm_gender');
  if (hiddenGender) hiddenGender.value = gender;
  const hiddenAvatar = document.getElementById('pm_avatar_url');
  if (hiddenAvatar) hiddenAvatar.value = avatar;

  // Wire gender picker in settings
  wireGenderPicker('profileGenderPicker', 'pm_gender', (g) => {
    buildAvatarGrid('profileAvatarGrid', g, hiddenAvatar?.value || '', (url) => {
      if (hiddenAvatar) hiddenAvatar.value = url;
    });
  });
  // Mark active gender
  document.querySelectorAll('#profileGenderPicker .gender-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.gender === gender);
  });
  // Build avatar grid
  buildAvatarGrid('profileAvatarGrid', gender, avatar, (url) => {
    if (hiddenAvatar) hiddenAvatar.value = url;
  });
}

function renderGPBadges() {
  const profile = typeof getProfile === 'function' ? getProfile() : null;
  if (!profile) return;
  const earned = document.getElementById('gpBadgeGrid');
  const locked = document.getElementById('gpLockedBadgeGrid');
  if (!earned || !locked) return;

  let earnedHTML = '', lockedHTML = '';
  BADGES.forEach(b => {
    const has = b.req(profile);
    const card = `
      <div class="gp-badge-card ${has ? 'earned' : 'locked'}" title="${b.desc}">
        <span class="gp-badge-icon">${b.icon}</span>
        <span class="gp-badge-name">${b.name}</span>
        <span class="gp-badge-desc">${b.desc}</span>
        ${has ? '<span class="gp-badge-check">&#10003;</span>' : ''}
      </div>`;
    if (has) earnedHTML += card;
    else     lockedHTML += card;
  });
  earned.innerHTML = earnedHTML || '<p class="gp-empty">No badges yet. Keep playing!</p>';
  locked.innerHTML = lockedHTML;
}

async function loadGPTournaments() {
  const list  = document.getElementById('gpTournamentsList');
  if (!list) return;
  list.innerHTML = '<p class="gp-empty">Loading...</p>';
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) { list.innerHTML = '<p class="gp-empty">Sign in to see your tournaments.</p>'; return; }
  try {
    const res  = await fetch('/api/profile?type=registrations', { headers: { Authorization: 'Bearer '+token } });
    const data = await res.json();
    const regs = data.registrations || [];
    if (!regs.length) { list.innerHTML = '<p class="gp-empty">You have not joined any tournaments yet.</p>'; return; }
    list.innerHTML = regs.map(r => `
      <div class="gp-tourn-row">
        <div class="gp-tourn-game-img" style="background-image:url('${GAME_IMAGES[r.tournaments?.game] || ''}')"></div>
        <div class="gp-tourn-info">
          <p class="gp-tourn-name">${r.tournaments?.name || 'Unknown'}</p>
          <p class="gp-tourn-meta">${r.tournaments?.game || ''} &middot; Tag: <strong>${r.gamer_tag}</strong></p>
        </div>
        <span class="tc-status ${r.payment_status==='paid'?'status-open':'status-done'}">${r.payment_status}</span>
      </div>`).join('');
  } catch(e) { list.innerHTML = '<p class="gp-empty">Could not load tournaments.</p>'; }
}

// ── REFERRALS TAB ─────────────────────────────────────────────────────────────

async function loadGPReferrals() {
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) {
    ['gpReferralsList','gpPointsLedger'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<p class="gp-empty">Sign in to see your referrals.</p>';
    });
    return;
  }

  try {
    const res  = await fetch('/api/invite', { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();

    // Invite code
    const codeEl = document.getElementById('gpInviteCode');
    if (codeEl) codeEl.textContent = data.invite_code || '—';

    // Points balance
    const balEl = document.getElementById('gpPointsBalance');
    if (balEl) {
      let cur = 0;
      const target = data.points_balance || 0;
      const step   = Math.max(1, Math.ceil(target / 40));
      const timer  = setInterval(() => {
        cur = Math.min(cur + step, target);
        balEl.textContent = cur.toLocaleString();
        if (cur >= target) clearInterval(timer);
      }, 25);
    }

    // Referrals list
    const refList = document.getElementById('gpReferralsList');
    if (refList) {
      const refs = data.referrals || [];
      if (!refs.length) {
        refList.innerHTML = '<p class="gp-empty">No referrals yet. Share your code to start earning!</p>';
      } else {
        refList.innerHTML = refs.map(r => {
          const tag    = r.profiles?.gamer_tag || 'Anonymous';
          const avatar = r.profiles?.avatar_url || '';
          const pts    = r.points_awarded || 50;
          const bonus  = r.bonus_claimed ? '<span class="tc-status status-open">+50 bonus</span>' : '';
          return `
            <div class="gp-tourn-row">
              ${avatar ? `<img src="${avatar}" class="gp-tourn-game-img" style="border-radius:50%;object-fit:cover;" alt="">` : '<div class="gp-tourn-game-img" style="background:#1a1a2e;display:flex;align-items:center;justify-content:center;font-size:1.6rem;">🎮</div>'}
              <div class="gp-tourn-info">
                <p class="gp-tourn-name">${escHtml(tag)}</p>
                <p class="gp-tourn-meta">${timeAgo(r.created_at)}</p>
              </div>
              <span class="tc-status status-paid">+${pts} pts</span>
              ${bonus}
            </div>`;
        }).join('');
      }
    }

    // Points ledger
    const ledgerEl = document.getElementById('gpPointsLedger');
    if (ledgerEl) {
      const ledger = data.ledger || [];
      if (!ledger.length) {
        ledgerEl.innerHTML = '<p class="gp-empty">No points history yet.</p>';
      } else {
        const typeIcons = {
          invite_signup: '🎁',
          invite_paid:   '💰',
          tournament_win:'🏆',
          daily_login:   '📅',
          bonus:         '⭐',
        };
        ledgerEl.innerHTML = ledger.map(l => `
          <div class="gp-tourn-row">
            <div class="gp-tourn-info" style="flex:1;">
              <p class="gp-tourn-name">${typeIcons[l.type] || '⭐'} ${escHtml(l.description || l.type)}</p>
              <p class="gp-tourn-meta">${timeAgo(l.created_at)}</p>
            </div>
            <span class="tc-status ${l.amount >= 0 ? 'status-open' : 'status-done'}" style="min-width:56px;text-align:right;">
              ${l.amount >= 0 ? '+' : ''}${l.amount} pts
            </span>
          </div>`).join('');
      }
    }
  } catch (e) {
    ['gpReferralsList','gpPointsLedger'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<p class="gp-empty">Could not load.</p>';
    });
  }
}

// Wire sign out button inside profile modal, plus invite tab actions
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('gpSignOutBtn')?.addEventListener('click', () => {
    closeProfileModal();
    if (typeof signOut === 'function') signOut();
  });

  // ── Helper: show the copied feedback strip ──────────────────────────────────
  function showCopiedStrip(msg) {
    const strip = document.getElementById('inviteCopiedStrip');
    const msgEl = document.getElementById('inviteCopiedMsg');
    if (!strip || !msgEl) return;
    msgEl.textContent = msg;
    strip.style.display = 'flex';
    strip.classList.remove('wt-fade-out');
    setTimeout(() => {
      strip.classList.add('invite-copied-hide');
      setTimeout(() => {
        strip.style.display = 'none';
        strip.classList.remove('invite-copied-hide');
      }, 400);
    }, 2200);
  }

  function getInviteCode() {
    return document.getElementById('gpInviteCode')?.textContent?.trim();
  }
  function getInviteLink(code) {
    return `${window.location.origin}${window.location.pathname}?ref=${code}`;
  }

  // ── Copy code only ───────────────────────────────────────────────────────────
  document.getElementById('gpCopyCodeBtn')?.addEventListener('click', () => {
    const code = getInviteCode();
    if (!code || code === '—' || code === 'Loading...') return;
    navigator.clipboard.writeText(code)
      .then(() => showCopiedStrip(`Code ${code} copied! Paste it anywhere.`))
      .catch(() => prompt('Copy your invite code:', code));
  });

  // ── Copy invite link ─────────────────────────────────────────────────────────
  document.getElementById('gpCopyLinkBtn')?.addEventListener('click', () => {
    const code = getInviteCode();
    if (!code || code === '—' || code === 'Loading...') return;
    const link = getInviteLink(code);
    navigator.clipboard.writeText(link)
      .then(() => showCopiedStrip('Invite link copied! Send it on WhatsApp.'))
      .catch(() => prompt('Copy your invite link:', link));
  });

  // ── Share via OS share sheet ─────────────────────────────────────────────────
  document.getElementById('gpShareCodeBtn')?.addEventListener('click', () => {
    const code = getInviteCode();
    if (!code || code === '—' || code === 'Loading...') return;
    const link = getInviteLink(code);
    const text = `🎮 Join me on PhinTech Arena — Kenya's best gaming tournament platform!\nSign up with my invite link and get 20 bonus points to start. ${link}\n(Code: ${code})`;
    if (navigator.share) {
      navigator.share({ title: 'Join PhinTech Arena 🎮', text, url: link }).catch(() => {});
    } else {
      // Fallback: open WhatsApp web
      const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank', 'noopener');
    }
  });
});
