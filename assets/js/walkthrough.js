'use strict';
/**
 * PhinTech Arena — First-Time Walkthrough
 * Powered by PhinTech Solutions, Kenya
 *
 * Shows a spotlight tour for new visitors.
 * Triggered once per browser (localStorage flag).
 * Can also be manually re-launched: startWalkthrough()
 */

// ── STEPS ─────────────────────────────────────────────────────────────────────
const WALKTHROUGH_STEPS = [
  {
    target: null,
    pos:    'center',
    icon:   '🎮',
    title:  'Welcome to PhinTech Arena!',
    desc:   'Kenya\'s #1 esports tournament platform. This quick tour takes about 30 seconds. You can skip anytime.',
  },
  {
    target: '#headerSignInBtn, #arenaSignInBtn',
    pos:    'bottom',
    icon:   '🔑',
    title:  'Sign Up or Sign In',
    desc:   'Create your free account using Google, your email, or your Safaricom number. Takes under a minute.',
  },
  {
    target: '#pulseBannerSection',
    pos:    'top',
    icon:   '⚡',
    title:  'Live Open Tournaments',
    desc:   'See what\'s happening right now — open tournaments with real KES prize pools. Spots fill up fast!',
  },
  {
    target: '.arena-section, #arena',
    pos:    'top',
    icon:   '🏆',
    title:  'Browse All Tournaments',
    desc:   'Find every open tournament in the Arena section. Each card shows the game, entry fee, prize pool, and spots left.',
  },
  {
    target: '.section.leaderboard, #leaderboard',
    pos:    'top',
    icon:   '📊',
    title:  'Leaderboard',
    desc:   'Track your ELO ranking and see how you compare against players across Kenya.',
  },
  {
    target: '#headerUserBtn, #arenaUserBtn',
    pos:    'bottom',
    icon:   '👤',
    title:  'Your Profile',
    desc:   'After signing in, your avatar appears here. Click it to see your stats, badges, and invite link to earn bonus points.',
  },
  {
    target: null,
    pos:    'center',
    icon:   '🎁',
    title:  'Invite Friends — Earn Points!',
    desc:   'Go to Profile → Referrals. Share your invite link on WhatsApp. You earn 50 points for every friend who joins!',
  },
];

// ── STATE ─────────────────────────────────────────────────────────────────────
let wtStep      = 0;
let wtActive    = false;
let wtResizeTimer;

const STORAGE_KEY = 'phintech_wt_done';

// ── CORE ──────────────────────────────────────────────────────────────────────
function startWalkthrough(force) {
  // Don't start if a modal is blocking the view
  const modalOpen = document.querySelector('.modal-overlay.active, #profileSetupModal.active, #authModal.active');
  if (modalOpen && !force) return;

  if (!force && localStorage.getItem(STORAGE_KEY)) return; // already seen

  wtStep  = 0;
  wtActive= true;
  const overlay = document.getElementById('walkthroughOverlay');
  if (!overlay) { console.warn('[Walkthrough] overlay element not found'); return; }
  overlay.style.display = 'flex';
  document.body.classList.add('wt-active');
  buildDots();
  renderStep();
}

function endWalkthrough() {
  wtActive = false;
  localStorage.setItem(STORAGE_KEY, '1');
  const overlay = document.getElementById('walkthroughOverlay');
  if (overlay) {
    overlay.classList.add('wt-fade-out');
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('wt-fade-out');
      document.body.classList.remove('wt-active');
      clearSpotlight();
    }, 350);
  }
}

function goNext() {
  if (wtStep < WALKTHROUGH_STEPS.length - 1) {
    wtStep++;
    renderStep();
  } else {
    endWalkthrough();
  }
}

function goPrev() {
  if (wtStep > 0) { wtStep--; renderStep(); }
}

// ── RENDER STEP ───────────────────────────────────────────────────────────────
function renderStep() {
  const step = WALKTHROUGH_STEPS[wtStep];
  const last = wtStep === WALKTHROUGH_STEPS.length - 1;

  document.getElementById('wtIcon').textContent  = step.icon;
  document.getElementById('wtTitle').textContent = step.title;
  document.getElementById('wtDesc').textContent  = step.desc;
  document.getElementById('wtStepBadge').textContent = `${wtStep + 1} / ${WALKTHROUGH_STEPS.length}`;
  document.getElementById('wtNextBtn').textContent   = last ? '✓ Done' : 'Next →';
  document.getElementById('wtPrevBtn').style.display = wtStep > 0 ? 'inline-flex' : 'none';

  document.querySelectorAll('.wt-dot').forEach((d, i) => {
    d.classList.toggle('active', i === wtStep);
  });

  // Handle comma-separated selectors (try each)
  let el = null;
  if (step.target) {
    const selectors = step.target.split(',').map(s => s.trim());
    for (const sel of selectors) {
      const found = document.querySelector(sel);
      if (found) { el = found; break; }
    }
  }

  positionTooltip(el, step.pos);
  spotlightElement(el);

  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── SPOTLIGHT ─────────────────────────────────────────────────────────────────
function spotlightElement(el) {
  const spot = document.getElementById('wtSpotlight');
  if (!el) {
    spot.style.cssText = 'display:none';
    return;
  }
  const r = el.getBoundingClientRect();
  const pad = 10;
  spot.style.cssText = `
    display: block;
    top:    ${r.top    - pad + window.scrollY}px;
    left:   ${r.left   - pad}px;
    width:  ${r.width  + pad * 2}px;
    height: ${r.height + pad * 2}px;
    border-radius: 12px;
  `;
}

function clearSpotlight() {
  const spot = document.getElementById('wtSpotlight');
  if (spot) spot.style.display = 'none';
}

// ── TOOLTIP POSITION ──────────────────────────────────────────────────────────
function positionTooltip(el, preferredPos) {
  const tooltip = document.getElementById('wtTooltip');
  tooltip.dataset.pos = preferredPos || 'center';
  tooltip.style.cssText = '';
}

// ── DOTS ─────────────────────────────────────────────────────────────────────
function buildDots() {
  const container = document.getElementById('wtDots');
  container.innerHTML = WALKTHROUGH_STEPS.map((_, i) =>
    `<span class="wt-dot${i === 0 ? ' active' : ''}" data-idx="${i}"></span>`
  ).join('');
  container.querySelectorAll('.wt-dot').forEach(d => {
    d.addEventListener('click', () => { wtStep = parseInt(d.dataset.idx); renderStep(); });
  });
}

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('wtNextBtn') ?.addEventListener('click', goNext);
  document.getElementById('wtPrevBtn') ?.addEventListener('click', goPrev);
  document.getElementById('wtSkipBtn') ?.addEventListener('click', endWalkthrough);

  document.getElementById('walkthroughOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('walkthroughOverlay')) endWalkthrough();
  });

  document.addEventListener('keydown', e => {
    if (!wtActive) return;
    if (e.key === 'Escape')     endWalkthrough();
    if (e.key === 'ArrowRight') goNext();
    if (e.key === 'ArrowLeft')  goPrev();
  });

  window.addEventListener('resize', () => {
    clearTimeout(wtResizeTimer);
    wtResizeTimer = setTimeout(() => { if (wtActive) renderStep(); }, 150);
  });

  // Start for first-time visitors — wait longer so profile setup modal has priority
  // If profile setup opens, walkthrough waits until it's closed
  function tryStartWalkthrough() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const blocking = document.querySelector('#profileSetupModal.active, #authModal.active');
      if (blocking) {
        // Wait until those modals close
        const observer = new MutationObserver(() => {
          const stillBlocking = document.querySelector('#profileSetupModal.active, #authModal.active');
          if (!stillBlocking) {
            observer.disconnect();
            setTimeout(() => startWalkthrough(false), 800);
          }
        });
        observer.observe(document.body, { subtree: true, attributeFilter: ['class'] });
      } else {
        startWalkthrough(false);
      }
    }
  }

  setTimeout(tryStartWalkthrough, 1800);

  // Expose for manual re-launch (e.g. "Take the tour again" button in profile)
  window.startWalkthrough = () => {
    localStorage.removeItem(STORAGE_KEY); // Clear flag
    startWalkthrough(true); // Force start
  };
  window.endWalkthrough   = endWalkthrough;
});

