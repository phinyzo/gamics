'use strict';

/**
 * PHINTECH ARENA — RAWG Video Games Browser
 * Powered by PhinTech Solutions, Kenya
 *
 * All game details open in an on-site modal — no external redirects.
 * After payment: shows installation steps + home-visit booking option.
 */

const GENRES = [
  { slug: '',           label: 'All'        },
  { slug: 'action',    label: 'Action'     },
  { slug: 'adventure', label: 'Adventure'  },
  { slug: 'rpg',       label: 'RPG'        },
  { slug: 'shooter',   label: 'Shooter'    },
  { slug: 'sports',    label: 'Sports'     },
  { slug: 'racing',    label: 'Racing'     },
  { slug: 'puzzle',    label: 'Puzzle'     },
  { slug: 'strategy',  label: 'Strategy'   },
  { slug: 'simulation',label: 'Simulation' },
];

const PLATFORMS = [
  { id: '',    label: 'All Platforms'  },
  { id: '4',   label: 'PC'            },
  { id: '18',  label: 'PlayStation 4' },
  { id: '187', label: 'PlayStation 5' },
  { id: '1',   label: 'Xbox One'      },
  { id: '186', label: 'Xbox Series X' },
  { id: '7',   label: 'Nintendo Switch'},
  { id: '3',   label: 'iOS'           },
  { id: '21',  label: 'Android'       },
];

// ── STATE ────────────────────────────────────────────────────────────────────
let state = {
  tab: 'top', genre: '', platform: '', query: '', page: 1,
  loading: false, hasMore: false,
};
let searchTimer = null;

// ── HELPERS ──────────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-KE', { year:'numeric', month:'short' });
}

function isPremium(g) {
  if (g.metacritic && g.metacritic >= 80) return true;
  if (g.rating     && g.rating     >= 4.0) return true;
  if (g.released   && new Date(g.released).getFullYear() >= new Date().getFullYear() - 1) return true;
  return false;
}

function platformIcon(slug) {
  const map = {
    'pc':              '<ion-icon name="desktop-outline"        title="PC"></ion-icon>',
    'playstation4':    '<ion-icon name="logo-playstation"       title="PS4"></ion-icon>',
    'playstation5':    '<ion-icon name="logo-playstation"       title="PS5"></ion-icon>',
    'xbox-one':        '<ion-icon name="logo-xbox"              title="Xbox One"></ion-icon>',
    'xbox-series-x':   '<ion-icon name="logo-xbox"              title="Xbox Series X"></ion-icon>',
    'nintendo-switch': '<ion-icon name="game-controller-outline" title="Switch"></ion-icon>',
    'ios':             '<ion-icon name="phone-portrait-outline"  title="iOS"></ion-icon>',
    'android':         '<ion-icon name="logo-android"           title="Android"></ion-icon>',
  };
  return map[slug] || '';
}

// ── FETCH LIST ───────────────────────────────────────────────────────────────
async function fetchGames(append = false) {
  if (state.loading) return;
  state.loading = true;

  const grid    = document.getElementById('igdbGrid');
  const loader  = document.getElementById('igdbLoader');
  const empty   = document.getElementById('igdbEmpty');
  const moreBtn = document.getElementById('igdbLoadMore');

  if (loader)  loader.style.display = 'flex';
  if (moreBtn) moreBtn.disabled = true;
  if (empty)   empty.style.display  = 'none';
  if (!append) { state.page = 1; if (grid) grid.innerHTML = ''; }

  const params = new URLSearchParams({
    type:      state.query ? 'search' : state.tab,
    page:      state.page,
    page_size: 20,
  });
  if (state.query)    params.set('q',        state.query);
  if (state.genre)    params.set('genre',    state.genre);
  if (state.platform) params.set('platform', state.platform);

  try {
    const res  = await fetch(`${API_BASE}/api/games?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const games = data.games || [];

    if (!games.length && !append) {
      if (empty) empty.style.display = 'block';
    } else {
      games.forEach(g => grid && grid.appendChild(buildCard(g)));
      state.page++;
    }

    state.hasMore = !!data.next;
    if (moreBtn) {
      moreBtn.style.display = state.hasMore ? 'inline-flex' : 'none';
      moreBtn.disabled = false;
    }
  } catch (err) {
    console.error('[PHINTECH ARENA RAWG]', err);
    if (!append && grid) {
      grid.innerHTML = `<li class="igdb-error-msg">
        <ion-icon name="cloud-offline-outline"></ion-icon>
        <p>Could not load games. Please try again.</p>
        <button onclick="fetchGames(false)">Retry</button></li>`;
    }
  } finally {
    state.loading = false;
    if (loader) loader.style.display = 'none';
  }
}

// ── CARD BUILDER ─────────────────────────────────────────────────────────────
function buildCard(g) {
  const img      = g.background_image || 'assets/images/featured-game-1.jpg';
  const rating   = g.rating ? (g.rating * 20).toFixed(0) + '%' : 'N/A';
  const mc       = g.metacritic ? `<span class="igdb-mc">${g.metacritic}</span>` : '';
  const genres   = (g.genres || []).slice(0, 2).map(x => x.name).join(' · ') || '';
  const released = g.tba ? 'TBA' : fmtDate(g.released);
  const playtime = g.playtime ? `${g.playtime}h avg` : '';
  const icons    = (g.platforms || []).slice(0,3).map(p => platformIcon(p.slug)).filter(Boolean).join('');
  const price    = isPremium(g) ? 'KES 1,000' : 'KES 1000';

  const li = document.createElement('li');
  li.className = 'igdb-game-card';
  li.innerHTML = `
    <div class="igdb-card-inner" role="button" tabindex="0"
         aria-label="View details for ${esc(g.name)}"
         data-slug="${esc(g.slug)}" data-name="${esc(g.name)}"
         data-price="${esc(price)}" data-img="${esc(img)}">
      <figure class="igdb-cover">
        <img src="${esc(img)}" alt="${esc(g.name)}" loading="lazy"
             onerror="this.src='assets/images/featured-game-1.jpg'">
        <div class="igdb-rating-badge">${rating}</div>
        ${mc}
      </figure>
      <div class="igdb-card-body">
        <h3 class="igdb-game-title">${esc(g.name)}</h3>
        <p class="igdb-genres">${genres}</p>
        <div class="igdb-meta">
          ${released ? `<span><ion-icon name="calendar-outline"></ion-icon>${released}</span>` : ''}
          ${playtime ? `<span><ion-icon name="time-outline"></ion-icon>${playtime}</span>` : ''}
        </div>
        ${icons ? `<div class="igdb-platforms">${icons}</div>` : ''}
        <div class="igdb-card-footer">
          <span class="igdb-price-tag">${price}</span>
          <button class="igdb-view-btn" data-slug="${esc(g.slug)}"
                  data-name="${esc(g.name)}" data-price="${esc(price)}"
                  aria-label="View ${esc(g.name)}">
            <ion-icon name="information-circle-outline"></ion-icon> Details
          </button>
        </div>
      </div>
    </div>`;
  return li;
}

// ── GAME DETAIL MODAL ────────────────────────────────────────────────────────
async function openGameModal(slug, name, price) {
  const modal = document.getElementById('gameModal');
  const body  = document.getElementById('gameModalBody');
  if (!modal || !body) return;

  // Show modal with loader
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  body.innerHTML = `
    <div class="gm-loader">
      <div class="igdb-spinner"></div>
      <p>Loading ${esc(name)}...</p>
    </div>`;

  try {
    const res  = await fetch(`${API_BASE}/api/games?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { game } = await res.json();
    renderGameModal(game, price);
  } catch (err) {
    body.innerHTML = `<div class="gm-error">
      <ion-icon name="cloud-offline-outline"></ion-icon>
      <p>Could not load game details. Please try again.</p>
      <button onclick="openGameModal('${esc(slug)}','${esc(name)}','${esc(price)}')">Retry</button>
    </div>`;
  }
}

function renderGameModal(g, price) {
  const body       = document.getElementById('gameModalBody');
  const hero       = g.background_image || 'assets/images/featured-game-1.jpg';
  const rating     = g.rating ? (g.rating * 20).toFixed(0) + '%' : 'N/A';
  const mc         = g.metacritic ? `<span class="gm-mc">${g.metacritic} MC</span>` : '';
  const genres     = (g.genres    || []).map(x => `<span class="gm-tag">${esc(x.name)}</span>`).join('');
  const tags       = (g.tags      || []).map(t => `<span class="gm-tag small">${esc(t)}</span>`).join('');
  const devs       = (g.developers|| []).join(', ') || 'N/A';
  const pubs       = (g.publishers|| []).join(', ') || 'N/A';
  const esrb       = g.esrb ? `<span class="gm-esrb">${esc(g.esrb)}</span>` : '';
  const playtime   = g.playtime ? `${g.playtime}h average playtime` : '';
  const released   = g.tba ? 'TBA' : fmtDate(g.released);
  const desc       = g.description ? esc(g.description).replace(/\n/g,'<br>') : 'No description available.';

  const screenshots = (g.screenshots || []).map(s =>
    `<figure class="gm-screenshot"><img src="${esc(s)}" alt="screenshot" loading="lazy"></figure>`
  ).join('');

  const platforms = (g.platforms || []).map(p => {
    const reqs = p.requirements;
    const hasReqs = reqs && (reqs.minimum || reqs.recommended);
    return `
      <div class="gm-platform-item">
        <p class="gm-platform-name">${platformIcon(p.slug)} ${esc(p.name)}</p>
        ${hasReqs ? `
          <div class="gm-requirements">
            ${reqs.minimum    ? `<div><strong>Minimum:</strong><br>${esc(reqs.minimum).replace(/\n/g,'<br>')}</div>`     : ''}
            ${reqs.recommended? `<div><strong>Recommended:</strong><br>${esc(reqs.recommended).replace(/\n/g,'<br>')}</div>` : ''}
          </div>` : ''}
      </div>`;
  }).join('');

  body.innerHTML = `
    <div class="gm-hero" style="background-image:url('${esc(hero)}')">
      <div class="gm-hero-overlay">
        <h2 class="gm-title">${esc(g.name)}</h2>
        <div class="gm-hero-meta">
          <span class="gm-rating-big">${rating}</span>
          ${mc} ${esrb}
          ${released ? `<span><ion-icon name="calendar-outline"></ion-icon>${released}</span>` : ''}
          ${playtime ? `<span><ion-icon name="time-outline"></ion-icon>${playtime}</span>`     : ''}
        </div>
        <div class="gm-genres">${genres}</div>
      </div>
    </div>

    <div class="gm-body">

      <div class="gm-cols">
        <div class="gm-main">
          <section class="gm-section">
            <h3 class="gm-section-title"><ion-icon name="reader-outline"></ion-icon> About</h3>
            <p class="gm-desc">${desc}</p>
          </section>

          ${screenshots ? `
          <section class="gm-section">
            <h3 class="gm-section-title"><ion-icon name="images-outline"></ion-icon> Screenshots</h3>
            <div class="gm-screenshots">${screenshots}</div>
          </section>` : ''}

          ${platforms ? `
          <section class="gm-section">
            <h3 class="gm-section-title"><ion-icon name="hardware-chip-outline"></ion-icon> Platforms & System Requirements</h3>
            <div class="gm-platforms-list">${platforms}</div>
          </section>` : ''}

          ${tags ? `
          <section class="gm-section">
            <h3 class="gm-section-title"><ion-icon name="pricetag-outline"></ion-icon> Tags</h3>
            <div class="gm-tags">${tags}</div>
          </section>` : ''}
        </div>

        <aside class="gm-sidebar">
          <div class="gm-price-box">
            <p class="gm-price-label">Price</p>
            <p class="gm-price-value">${esc(price)}</p>
            <button class="gm-buy-btn" onclick="openInstallModal('${esc(g.slug)}','${esc(g.name)}','${esc(price)}')">
              <ion-icon name="cart-outline"></ion-icon> Buy &amp; Install
            </button>
          </div>

          <div class="gm-meta-box">
            <div class="gm-meta-row"><span>Developer</span><span>${esc(devs)}</span></div>
            <div class="gm-meta-row"><span>Publisher</span><span>${esc(pubs)}</span></div>
            ${g.achievements_count ? `<div class="gm-meta-row"><span>Achievements</span><span>${g.achievements_count}</span></div>` : ''}
          </div>
        </aside>
      </div>

    </div>`;
}

function closeGameModal() {
  const modal = document.getElementById('gameModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

// ── INSTALL / PURCHASE MODAL ─────────────────────────────────────────────────
function openInstallModal(slug, name, price) {
  // Close game detail modal first
  closeGameModal();

  const modal = document.getElementById('installModal');
  const title = document.getElementById('installGameTitle');
  const priceEl = document.getElementById('installGamePrice');
  if (!modal) return;

  if (title)   title.textContent = name;
  if (priceEl) priceEl.textContent = price;

  // Also update the price reference inside the self-install steps
  const selfPrice = document.getElementById('selfInstallPrice');
  if (selfPrice) selfPrice.textContent = price;

  // Store current game on modal for the pay button
  modal.dataset.slug  = slug;
  modal.dataset.name  = name;
  modal.dataset.price = price;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Default to self-install tab
  switchInstallTab('self');
}

function closeInstallModal() {
  const modal = document.getElementById('installModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

function switchInstallTab(tab) {
  document.querySelectorAll('.install-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.install-tab-panel').forEach(p => {
    p.style.display = p.dataset.panel === tab ? 'block' : 'none';
  });
}

// ── HOME VISIT BOOKING ───────────────────────────────────────────────────────
function submitVisitBooking(e) {
  e.preventDefault();
  const form     = document.getElementById('visitForm');
  const modal    = document.getElementById('installModal');
  const name     = modal ? modal.dataset.name  : '';
  const phone    = document.getElementById('visitPhone')?.value.trim();
  const location = document.getElementById('visitLocation')?.value.trim();
  const date     = document.getElementById('visitDate')?.value;
  const status   = document.getElementById('visitStatus');

  if (!phone || !location || !date) {
    if (status) { status.textContent = 'Please fill in all fields.'; status.className = 'visit-status error'; }
    return;
  }

  // Format phone to +254
  const digits = phone.replace(/\D/g, '');
  const fmt = digits.startsWith('0') ? '+254' + digits.slice(1)
            : digits.startsWith('254') ? '+' + digits
            : phone;

  // Log the booking (in production this would POST to a backend/email service)
  const booking = {
    game:      name,
    phone:     fmt,
    location,
    date,
    bookedAt:  new Date().toISOString(),
  };
  try {
    const log = JSON.parse(localStorage.getItem('phintech arena_visit_bookings') || '[]');
    log.push(booking);
    localStorage.setItem('phintech arena_visit_bookings', JSON.stringify(log));
  } catch (_) {}

  if (status) {
    status.className   = 'visit-status success';
    status.textContent = `Booking confirmed! Our technician will visit ${location} on ${date}. We will call ${fmt} to confirm.`;
  }
  if (form) form.reset();
}

// ── TABS / GENRE / PLATFORM / SEARCH ─────────────────────────────────────────
function switchTab(tab) {
  state.tab   = tab;
  state.query = '';
  const si = document.getElementById('igdbSearch');
  if (si) si.value = '';
  document.querySelectorAll('.igdb-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  });
  fetchGames(false);
}

function buildGenreChips() {
  const wrap = document.getElementById('igdbGenres');
  if (!wrap) return;
  wrap.innerHTML = '';
  GENRES.forEach(g => {
    const btn = document.createElement('button');
    btn.className    = 'igdb-genre-chip' + (g.slug === '' ? ' active' : '');
    btn.textContent  = g.label;
    btn.dataset.slug = g.slug;
    btn.addEventListener('click', () => {
      state.genre = g.slug;
      wrap.querySelectorAll('.igdb-genre-chip').forEach(c =>
        c.classList.toggle('active', c.dataset.slug === g.slug));
      fetchGames(false);
    });
    wrap.appendChild(btn);
  });
}

function buildPlatformSelect() {
  const sel = document.getElementById('igdbPlatform');
  if (!sel) return;
  PLATFORMS.forEach(p => {
    const opt       = document.createElement('option');
    opt.value       = p.id;
    opt.textContent = p.label;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => { state.platform = sel.value; fetchGames(false); });
}

function initSearch() {
  const input = document.getElementById('igdbSearch');
  if (!input) return;
  input.addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    searchTimer = setTimeout(() => { state.query = q; fetchGames(false); }, 500);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      clearTimeout(searchTimer);
      state.query = input.value.trim();
      fetchGames(false);
    }
  });
}

// ── EVENT DELEGATION — card clicks ──────────────────────────────────────────
function wireCardClicks() {
  const grid = document.getElementById('igdbGrid');
  if (!grid) return;
  grid.addEventListener('click', e => {
    const btn  = e.target.closest('.igdb-view-btn');
    const card = e.target.closest('.igdb-card-inner');
    const el   = btn || card;
    if (!el) return;
    const slug  = el.dataset.slug;
    const name  = el.dataset.name;
    const price = el.dataset.price;
    if (slug) openGameModal(slug, name, price);
  });
  grid.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.igdb-card-inner');
      if (card && card.dataset.slug)
        openGameModal(card.dataset.slug, card.dataset.name, card.dataset.price);
    }
  });
}

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildGenreChips();
  buildPlatformSelect();
  initSearch();
  wireCardClicks();

  // Tab buttons
  document.querySelectorAll('.igdb-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Load more
  const moreBtn = document.getElementById('igdbLoadMore');
  if (moreBtn) moreBtn.addEventListener('click', () => fetchGames(true));

  // Game modal close
  const gameModal = document.getElementById('gameModal');
  if (gameModal) {
    document.getElementById('gameModalClose')
      ?.addEventListener('click', closeGameModal);
    gameModal.addEventListener('click', e => {
      if (e.target === gameModal) closeGameModal();
    });
  }

  // Install modal close + tabs
  const installModal = document.getElementById('installModal');
  if (installModal) {
    document.getElementById('installModalClose')
      ?.addEventListener('click', closeInstallModal);
    installModal.addEventListener('click', e => {
      if (e.target === installModal) closeInstallModal();
    });
    document.querySelectorAll('.install-tab-btn').forEach(b => {
      b.addEventListener('click', () => switchInstallTab(b.dataset.tab));
    });
  }

  // Visit booking form
  document.getElementById('visitForm')
    ?.addEventListener('submit', submitVisitBooking);

  // Set minimum visit date to today
  const visitDate = document.getElementById('visitDate');
  if (visitDate) visitDate.min = new Date().toISOString().slice(0, 10);

  // ESC closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeGameModal(); closeInstallModal(); }
  });

  // Initial load
  fetchGames(false);
});
