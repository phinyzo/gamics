'use strict';
/**
 * PhinTech Arena — Admin Dashboard
 * Dedicated management console — not part of the player experience
 * PhinTech Solutions, Kenya
 */

// ── STATE ─────────────────────────────────────────────────────────────────────
let _adminToken   = null;
let _adminUser    = null;
let _currentPage  = { tournaments: 1, users: 1 };
const PAGE_SIZE   = 15;

// ── AUTH HELPERS ──────────────────────────────────────────────────────────────
function ah() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _adminToken };
}

async function api(path, opts = {}) {
  const res  = await fetch(path, { ...opts, headers: { ...ah(), ...(opts.headers || {}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n) { return Number(n || 0).toLocaleString(); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) : '—'; }
function fmtTime(d) { return d ? new Date(d).toLocaleString('en-KE', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' }) : '—'; }

// ── BOOT: verify admin access ──────────────────────────────────────────────────
async function boot() {
  const msg = document.getElementById('authGateMsg');

  // Wait for supabase-init to load the client
  await new Promise(resolve => {
    if (window._sb) return resolve();
    document.addEventListener('supabase-ready', resolve, { once: true });
    setTimeout(resolve, 4000); // fallback
  });

  if (!window._sb) {
    showGateError('Could not connect to Supabase. Check your environment variables.');
    return;
  }

  const { data: { session } } = await window._sb.auth.getSession();
  if (!session) {
    showGateError('Not signed in. Redirecting to main site...');
    setTimeout(() => window.location.href = '/?admin=1', 1500);
    return;
  }

  _adminToken = session.access_token;
  _adminUser  = session.user;

  // Verify admin status via API
  try {
    const data = await api('/api/admin?action=dashboard');
    // If we get here without 403, user is admin
    revealDashboard(session.user, data.stats);
  } catch (e) {
    if (e.message.includes('403') || e.message.toLowerCase().includes('admin')) {
      showGateError('Access denied. This page is for admins only.');
    } else {
      showGateError('Error: ' + e.message);
    }
  }
}

function showGateError(msg) {
  const m  = document.getElementById('authGateMsg');
  const sp = document.querySelector('.auth-gate-spinner');
  if (m)  { m.textContent = msg; m.style.color = '#f44336'; }
  if (sp) sp.style.display = 'none';
}

function revealDashboard(user, stats) {
  document.getElementById('authGate').style.display    = 'none';
  document.getElementById('dashboard').style.display   = 'flex';

  // Populate admin identity
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin';
  const avatar = user.user_metadata?.avatar_url || '';
  document.getElementById('adminName').textContent = name;
  if (avatar) document.getElementById('adminAvatar').src = avatar;

  // Populate overview stats immediately
  if (stats) applyStats(stats);

  // Load all sections
  loadOverview();
  updateTopbarClock();
  setInterval(updateTopbarClock, 30000);
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────────
function navigate(section) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === section));
  document.querySelectorAll('.section-panel').forEach(p => p.style.display = p.id === 'section-' + section ? 'block' : 'none');
  document.getElementById('topbarTitle').textContent = section.charAt(0).toUpperCase() + section.slice(1);

  const loaders = {
    overview:      loadOverview,
    tournaments:   loadTournaments,
    users:         loadUsers,
    disputes:      loadDisputes,
    payouts:       loadPayouts,
    revenue:       loadRevenue,
    notifications: loadNotifQueue,
    settings:      loadSettings,
  };
  if (loaders[section]) loaders[section]();
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    const data = await api('/api/admin?action=dashboard');
    applyStats(data.stats || {});
    updateBadges(data.stats || {});
    await loadActivityFeed();
  } catch (e) { console.error('[admin] overview:', e); }
}

function applyStats(s) {
  setText('ovUsers',    fmt(s.total_users));
  setText('ovTourns',   fmt(s.total_tournaments));
  setText('ovRevenue',  'KES ' + fmt(s.total_revenue_kes));
  setText('ovDisputes', fmt(s.disputed_matches));
  setText('ovPending',  fmt(s.pending_tournaments));
  setText('ovPayouts',  fmt(s.pending_payouts));
  setText('ovTournsActive', (s.active_tournaments || 0) + ' active');
  setText('ovUsersNew',     (s.new_users_today    || 0) + ' today');
}

function updateBadges(s) {
  setBadge('navBadgeTourns',   s.pending_tournaments);
  setBadge('navBadgeDisputes', s.disputed_matches);
  setBadge('navBadgePayouts',  s.pending_payouts);
}

function setBadge(id, n) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent   = n || 0;
  el.style.display = n > 0 ? 'inline-flex' : 'none';
}

async function loadActivityFeed() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;
  try {
    // Pull recent notifications, registrations, and disputes as activity
    const [notifData, regData] = await Promise.all([
      fetch('/api/admin?action=disputes', { headers: ah() }).then(r=>r.json()),
      fetch('/api/admin?action=payouts',  { headers: ah() }).then(r=>r.json()),
    ]);

    const items = [];
    (notifData.matches || []).slice(0,5).forEach(m => {
      items.push({ icon:'⚠️', text: `Dispute: ${m.player1_tag} vs ${m.player2_tag} in ${m.tournaments?.name||'?'}`, time: m.updated_at, color:'amber' });
    });
    (regData.payouts || []).slice(0,5).forEach(p => {
      const icon = p.status==='paid' ? '💰' : p.status==='failed' ? '❌' : '⏳';
      items.push({ icon, text: `Payout ${p.status}: KES ${p.amount_kes} → ${p.phone}`, time: p.created_at, color: p.status==='paid'?'green':p.status==='failed'?'red':'amber' });
    });

    items.sort((a,b) => new Date(b.time) - new Date(a.time));

    if (!items.length) { feed.innerHTML = '<p class="empty-state">No recent activity.</p>'; return; }
    feed.innerHTML = items.map(i => `
      <div class="activity-item">
        <span class="activity-icon">${i.icon}</span>
        <div class="activity-body">
          <p class="activity-text">${esc(i.text)}</p>
          <p class="activity-time">${fmtTime(i.time)}</p>
        </div>
        <span class="activity-dot activity-dot--${i.color}"></span>
      </div>`).join('');
  } catch (e) { feed.innerHTML = '<p class="empty-state">Could not load activity.</p>'; }
}

// ── TOURNAMENTS ────────────────────────────────────────────────────────────────
let _allTournaments = [];
let _tournFilter    = '';
let _tournSearch    = '';

async function loadTournaments() {
  const list = document.getElementById('tournamentsList');
  list.innerHTML = '<p class="empty-state loading">Loading...</p>';
  try {
    // Load all + pending separately
    const [allData, pendingData] = await Promise.all([
      fetch('/api/tournaments?limit=100', { headers: ah() }).then(r=>r.json()),
      api('/api/admin?action=pending'),
    ]);

    // Merge pending into all list, marking them
    const pending = (pendingData.tournaments || []).map(t => ({ ...t, _pending: true }));
    const regular = (allData.tournaments || []);
    _allTournaments = [...pending, ...regular.filter(t => !pending.find(p => p.id === t.id))];

    // Pending alert
    const alert = document.getElementById('pendingAlert');
    const alertText = document.getElementById('pendingAlertText');
    if (pending.length) {
      alert.style.display = 'flex';
      alertText.textContent = `${pending.length} tournament${pending.length>1?'s':''} awaiting your approval.`;
    } else {
      alert.style.display = 'none';
    }

    renderTournaments();
  } catch (e) { list.innerHTML = `<p class="empty-state error">${esc(e.message)}</p>`; }
}

function renderTournaments() {
  const list = document.getElementById('tournamentsList');
  let filtered = _allTournaments;
  if (_tournFilter === 'pending_approval') filtered = filtered.filter(t => t._pending || t.pending_approval);
  else if (_tournFilter) filtered = filtered.filter(t => t.status === _tournFilter);
  if (_tournSearch) {
    const q = _tournSearch.toLowerCase();
    filtered = filtered.filter(t => t.name?.toLowerCase().includes(q) || t.game?.toLowerCase().includes(q));
  }

  const page  = _currentPage.tournaments;
  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);
  const total = filtered.length;

  document.getElementById('tournPageInfo').textContent = `Page ${page} of ${Math.ceil(total/PAGE_SIZE) || 1} (${total} total)`;
  document.getElementById('tournPrevBtn').disabled = page <= 1;
  document.getElementById('tournNextBtn').disabled = start + PAGE_SIZE >= total;

  if (!slice.length) { list.innerHTML = '<p class="empty-state">No tournaments found.</p>'; return; }

  const STATUS_COLOR = { open:'green', ongoing:'blue', completed:'gray', cancelled:'red', pending:'amber' };

  list.innerHTML = slice.map(t => {
    const isPending = t._pending || t.pending_approval;
    const status    = isPending ? 'pending' : t.status;
    const color     = STATUS_COLOR[status] || 'gray';
    return `
    <div class="data-row ${isPending ? 'data-row--highlight' : ''}">
      <div class="data-row-main">
        <div class="data-row-title">
          ${isPending ? '<span class="badge badge--amber">⏳ PENDING</span>' : ''}
          ${esc(t.name)}
        </div>
        <div class="data-row-meta">
          <span>${esc(t.game)}</span>
          <span>${esc(t.platform)}</span>
          <span>KES ${fmt(t.entry_fee)} entry</span>
          <span>${fmt(t.prize_pool)} prize</span>
          <span>${t.player_count || 0}/${t.max_players} players</span>
          <span>${fmtDate(t.start_date)}</span>
        </div>
        <div class="data-row-meta">
          Host: ${esc(t.host_name || t.profiles?.gamer_tag || '?')} · ${esc(t.host_contact || '?')}
          ${t.rules ? `<br><em style="opacity:.7">${esc(t.rules.slice(0,100))}${t.rules.length>100?'…':''}</em>` : ''}
        </div>
      </div>
      <div class="data-row-actions">
        <span class="status-pill status-pill--${color}">${esc(status)}</span>
        ${isPending ? `
          <button class="action-btn action-btn--success" onclick="doApprove('${t.id}', this)">
            <ion-icon name="checkmark-outline"></ion-icon> Approve
          </button>
          <button class="action-btn action-btn--danger" onclick="doReject('${t.id}', this)">
            <ion-icon name="close-outline"></ion-icon> Reject
          </button>` : ''}
        ${t.status === 'ongoing' ? `
          <button class="action-btn action-btn--info" onclick="doAdvanceBracket('${t.id}', this)">
            <ion-icon name="arrow-forward-outline"></ion-icon> Advance Round
          </button>` : ''}
        ${t.status !== 'cancelled' && t.status !== 'completed' ? `
          <button class="action-btn action-btn--ghost" onclick="doTriggerPayout('${t.id}', this)">
            <ion-icon name="cash-outline"></ion-icon> Pay Prize
          </button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function doApprove(id, btn) {
  btn.disabled = true; btn.textContent = '...';
  try {
    await api('/api/admin?action=approve', { method:'POST', body: JSON.stringify({ tournament_id: id }) });
    btn.closest('.data-row').querySelector('.badge')?.remove();
    btn.closest('.data-row').classList.remove('data-row--highlight');
    btn.closest('.data-row-actions').querySelectorAll('.action-btn--success, .action-btn--danger').forEach(b => b.remove());
    showToast('✅ Tournament approved and live!', 'success');
    loadOverview();
  } catch (e) { btn.textContent = 'Error'; btn.disabled = false; showToast(e.message, 'error'); }
}

async function doReject(id, btn) {
  const reason = await confirm_dialog('⚠️ Reject Tournament', 'Reject this tournament? The host will be notified.', 'Reject');
  if (!reason) return;
  btn.disabled = true;
  try {
    await api('/api/admin?action=reject', { method:'POST', body: JSON.stringify({ tournament_id: id, reason: 'Does not meet guidelines.' }) });
    btn.closest('.data-row').style.opacity = '0.4';
    showToast('Tournament rejected.', 'success');
    loadOverview();
  } catch (e) { btn.disabled = false; showToast(e.message, 'error'); }
}

async function doAdvanceBracket(id, btn) {
  btn.disabled = true;
  try {
    const data = await api(`/api/ops?type=bracket&action=advance&tournament_id=${id}`, { method:'POST', body:'{}' });
    showToast(data.action === 'tournament_complete' ? '🏆 Tournament completed! Payouts queued.' : `Round ${data.new_round} started — ${data.matches_created} matches created.`, 'success');
    loadTournaments();
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; }
}

async function doTriggerPayout(id, btn) {
  const ok = await confirm_dialog('💰 Trigger Prize Payout', 'Queue prize payouts for this tournament now?', 'Pay Prize');
  if (!ok) return;
  btn.disabled = true;
  try {
    await api('/api/admin?action=payout', { method:'POST', body: JSON.stringify({ tournament_id: id }) });
    showToast('Prize payout queued and processing.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; }
}

// ── USERS ─────────────────────────────────────────────────────────────────────
let _allUsers   = [];
let _userFilter = '';
let _userSearch = '';

async function loadUsers() {
  const list = document.getElementById('usersList');
  list.innerHTML = '<p class="empty-state loading">Loading...</p>';
  try {
    // Use leaderboard + admin endpoints to get user data
    const [lbData, adminData] = await Promise.all([
      fetch('/api/leaderboard?limit=200', { headers: ah() }).then(r=>r.json()),
      api('/api/admin?action=dashboard'),
    ]);

    // Leaderboard has profiles joined
    _allUsers = (lbData.players || []).map(p => ({
      id:         p.user_id,
      gamer_tag:  p.gamer_tag,
      elo:        p.elo,
      wins:       p.wins,
      losses:     p.losses,
      prize_won:  p.prize_won,
      county:     p.profiles?.county,
      avatar_url: p.profiles?.avatar_url,
    }));

    renderUsers();
  } catch (e) { list.innerHTML = `<p class="empty-state error">${esc(e.message)}</p>`; }
}

function renderUsers() {
  const list = document.getElementById('usersList');
  let filtered = _allUsers;
  if (_userSearch) {
    const q = _userSearch.toLowerCase();
    filtered = filtered.filter(u => u.gamer_tag?.toLowerCase().includes(q) || u.county?.toLowerCase().includes(q));
  }

  const page  = _currentPage.users;
  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  document.getElementById('userPageInfo').textContent = `Page ${page} of ${Math.ceil(filtered.length/PAGE_SIZE)||1} (${filtered.length} total)`;
  document.getElementById('userPrevBtn').disabled = page <= 1;
  document.getElementById('userNextBtn').disabled = start + PAGE_SIZE >= filtered.length;

  if (!slice.length) { list.innerHTML = '<p class="empty-state">No users found.</p>'; return; }

  list.innerHTML = slice.map(u => `
    <div class="data-row">
      <div class="data-row-avatar">
        ${u.avatar_url ? `<img src="${esc(u.avatar_url)}" alt="" class="user-avatar" onerror="this.style.display='none'">` : '<span class="user-avatar-fb">' + esc((u.gamer_tag||'?').slice(0,2).toUpperCase()) + '</span>'}
      </div>
      <div class="data-row-main">
        <div class="data-row-title">${esc(u.gamer_tag || '—')}</div>
        <div class="data-row-meta">
          <span>ELO: ${fmt(u.elo)}</span>
          <span>W/L: ${u.wins}/${u.losses}</span>
          <span>Prize: KES ${fmt(u.prize_won)}</span>
          ${u.county ? `<span>${esc(u.county)}</span>` : ''}
        </div>
      </div>
      <div class="data-row-actions">
        <button class="action-btn action-btn--ghost" onclick="viewUserMatches('${esc(u.gamer_tag||'')}')">
          <ion-icon name="eye-outline"></ion-icon> History
        </button>
      </div>
    </div>`).join('');
}

async function viewUserMatches(tag) {
  showToast(`Leaderboard profile for ${tag} — full match history coming in next update.`, 'info');
}

// ── DISPUTES ──────────────────────────────────────────────────────────────────
async function loadDisputes() {
  const list = document.getElementById('disputesList');
  list.innerHTML = '<p class="empty-state loading">Loading...</p>';
  try {
    const data    = await api('/api/admin?action=disputes');
    const matches = data.matches || [];
    if (!matches.length) { list.innerHTML = '<p class="empty-state">✅ No open disputes.</p>'; return; }
    list.innerHTML = matches.map(m => `
      <div class="data-row data-row--highlight">
        <div class="data-row-main">
          <div class="data-row-title">
            ⚠️ ${esc(m.player1_tag)} <span style="opacity:.5">vs</span> ${esc(m.player2_tag)}
          </div>
          <div class="data-row-meta">
            <span>${esc(m.tournaments?.name||'?')}</span>
            <span>${esc(m.tournaments?.game||'?')}</span>
            <span>Round ${m.round}</span>
            <span>${fmtDate(m.updated_at)}</span>
          </div>
          <div class="data-row-meta" style="color:hsl(40 80% 70%);font-style:italic;">
            ${esc(m.dispute_reason || 'No reason provided')}
          </div>
          ${m.screenshot_url ? `<a href="${esc(m.screenshot_url)}" target="_blank" rel="noopener" class="evidence-link">📸 View Screenshot Evidence</a>` : ''}
        </div>
        <div class="data-row-actions" style="flex-direction:column;gap:8px;">
          <button class="action-btn action-btn--success" onclick="resolveDispute('${m.id}','${esc(m.player1_tag)}','${esc(m.player2_tag)}','${m.player1_tag}', this)">
            🏆 ${esc(m.player1_tag)} Wins
          </button>
          <button class="action-btn action-btn--info" onclick="resolveDispute('${m.id}','${esc(m.player1_tag)}','${esc(m.player2_tag)}','${m.player2_tag}', this)">
            🏆 ${esc(m.player2_tag)} Wins
          </button>
        </div>
      </div>`).join('');
  } catch (e) { list.innerHTML = `<p class="empty-state error">${esc(e.message)}</p>`; }
}

async function resolveDispute(matchId, p1, p2, winner, btn) {
  const note = prompt(`Ruling: ${winner} wins this match.\n\nAdmin note (will be sent to both players):`) || 'Admin decision after review.';
  btn.disabled = true; btn.textContent = 'Resolving...';
  try {
    await api('/api/admin?action=dispute', {
      method:'POST',
      body: JSON.stringify({ match_id: matchId, winner_tag: winner, resolution_note: note }),
    });
    btn.closest('.data-row').innerHTML = `<p style="color:hsl(140 60% 60%);padding:16px;">✅ Resolved — ${esc(winner)} wins. Both players notified.</p>`;
    showToast(`Dispute resolved: ${winner} wins.`, 'success');
    loadOverview();
  } catch (e) { btn.disabled = false; btn.textContent = 'Error'; showToast(e.message, 'error'); }
}

// ── PAYOUTS ───────────────────────────────────────────────────────────────────
async function loadPayouts() {
  const list = document.getElementById('payoutsList');
  list.innerHTML = '<p class="empty-state loading">Loading...</p>';
  try {
    const data    = await api('/api/admin?action=payouts');
    const payouts = data.payouts || [];
    if (!payouts.length) { list.innerHTML = '<p class="empty-state">No payouts in queue.</p>'; return; }

    const STATUS_COLOR = { paid:'green', failed:'red', processing:'blue', pending:'amber' };
    list.innerHTML = payouts.map(p => `
      <div class="data-row">
        <div class="data-row-main">
          <div class="data-row-title">${esc(p.profiles?.gamer_tag || '?')} — KES ${fmt(p.amount_kes)}</div>
          <div class="data-row-meta">
            <span>${esc(p.phone)}</span>
            <span>${esc(p.tournaments?.name || 'Wallet withdrawal')}</span>
            <span>${fmtTime(p.created_at)}</span>
            ${p.processed_at ? `<span>Processed: ${fmtTime(p.processed_at)}</span>` : ''}
          </div>
          ${p.mpesa_code ? `<div class="data-row-meta" style="color:hsl(140 60% 65%);">M-Pesa Ref: ${esc(p.mpesa_code)}</div>` : ''}
          ${p.failure_reason ? `<div class="data-row-meta" style="color:#f44336;">Error: ${esc(p.failure_reason)}</div>` : ''}
        </div>
        <div class="data-row-actions">
          <span class="status-pill status-pill--${STATUS_COLOR[p.status]||'gray'}">${p.status}</span>
          ${p.placement > 0 ? `<span class="status-pill status-pill--purple">🏆 Place ${p.placement}</span>` : '<span class="status-pill status-pill--gray">Withdrawal</span>'}
        </div>
      </div>`).join('');
  } catch (e) { list.innerHTML = `<p class="empty-state error">${esc(e.message)}</p>`; }
}

async function runPayouts() {
  const btns = document.querySelectorAll('#runPayoutsBtn, #quickRunPayoutsBtn');
  btns.forEach(b => { b.disabled = true; b.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Processing...'; });
  try {
    const data = await api('/api/ops?type=payout', { method:'POST', body:'{}' });
    showToast(`Payouts: ${data.processed||0} sent, ${data.failed||0} failed, ${data.total||0} total.`, 'success');
    loadPayouts();
    loadOverview();
  } catch (e) {
    showToast('Payout error: ' + e.message, 'error');
  } finally {
    btns.forEach(b => { b.disabled = false; b.innerHTML = '<ion-icon name="send-outline"></ion-icon> Process All Pending Payouts'; });
  }
}

// ── REVENUE ───────────────────────────────────────────────────────────────────
async function loadRevenue() {
  try {
    const [adminData, payoutData] = await Promise.all([
      api('/api/admin?action=dashboard'),
      api('/api/admin?action=payouts'),
    ]);

    const s = adminData.stats || {};
    setText('revTotal',   'KES ' + fmt(s.total_revenue_kes));
    setText('revPending', 'KES ' + fmt(s.pending_payouts * 500)); // estimate

    // Calculate paid amount
    const paid = (payoutData.payouts||[]).filter(p=>p.status==='paid').reduce((a,p)=>a+p.amount_kes, 0);
    setText('revPaid', 'KES ' + fmt(paid));

    // Show ledger
    const ledger = document.getElementById('revenueLedger');
    const payouts = payoutData.payouts || [];
    if (!payouts.length) { ledger.innerHTML = '<p class="empty-state">No transactions.</p>'; return; }
    ledger.innerHTML = payouts.map(p => `
      <div class="data-row">
        <div class="data-row-main">
          <div class="data-row-title">${p.status==='paid'?'💰':'⏳'} ${esc(p.profiles?.gamer_tag||'?')} — ${esc(p.tournaments?.name||'Withdrawal')}</div>
          <div class="data-row-meta"><span>${esc(p.phone)}</span><span>${fmtTime(p.created_at)}</span>${p.mpesa_code?`<span>Ref: ${esc(p.mpesa_code)}</span>`:''}</div>
        </div>
        <span class="status-pill status-pill--${p.status==='paid'?'green':p.status==='failed'?'red':'amber'}">KES ${fmt(p.amount_kes)} · ${p.status}</span>
      </div>`).join('');
  } catch (e) { console.error('[admin] revenue:', e); }
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
async function loadNotifQueue() {
  const list = document.getElementById('notifQueueList');
  list.innerHTML = '<p class="empty-state loading">Loading...</p>';
  // Notification queue is not directly readable via API currently
  // Show a summary based on status
  list.innerHTML = `
    <div class="alert alert--info">
      <ion-icon name="information-circle-outline"></ion-icon>
      Notification queue is processed automatically every 3 minutes by pg_cron.
      Click "Send All Pending" to trigger immediately.
    </div>`;
}

async function runNotifications() {
  const btn = document.getElementById('runNotifBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Sending...'; }
  try {
    const data = await api('/api/ops?type=notify', { method:'POST', body:'{}' });
    showToast(`Notifications: ${data.sent||0} sent, ${data.failed||0} failed.`, 'success');
  } catch (e) {
    showToast('Notify error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<ion-icon name="paper-plane-outline"></ion-icon> Send All Pending'; }
  }
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
async function loadSettings() {
  await loadAdminList();
  await checkSystemStatus();
}

async function loadAdminList() {
  const list = document.getElementById('adminList');
  if (!list) return;
  // Load from admin_roles via dashboard
  list.innerHTML = '<p class="empty-state">Admin list available in Supabase Dashboard → Table Editor → admin_roles</p>';
}

async function checkSystemStatus() {
  const el = document.getElementById('systemStatus');
  if (!el) return;
  const checks = [
    { name: 'API Endpoint',       test: () => fetch('/api/config').then(r => r.ok) },
    { name: 'Supabase Auth',      test: () => Promise.resolve(!!window._sb) },
    { name: 'RAWG Games API',     test: () => fetch('/api/games?page_size=1').then(r => r.ok) },
    { name: 'Tournaments API',    test: () => fetch('/api/tournaments?limit=1').then(r => r.ok) },
    { name: 'Leaderboard API',    test: () => fetch('/api/leaderboard?limit=1').then(r => r.ok) },
  ];

  el.innerHTML = '<p class="empty-state loading">Checking...</p>';
  const results = await Promise.allSettled(checks.map(async c => {
    const ok = await c.test().catch(() => false);
    return { name: c.name, ok };
  }));

  el.innerHTML = results.map(r => {
    const { name, ok } = r.value || { name: '?', ok: false };
    return `<div class="sys-check"><span class="sys-check-name">${esc(name)}</span><span class="sys-check-status ${ok?'ok':'fail'}">${ok?'✅ OK':'❌ Error'}</span></div>`;
  }).join('');
}

async function grantAdmin(grant) {
  const input  = document.getElementById('adminTargetUser')?.value.trim();
  const status = document.getElementById('adminGrantStatus');
  if (!input) { if (status) { status.textContent = 'Enter a user email or ID.'; status.style.color='#f44336'; } return; }
  if (status) { status.textContent = 'Processing...'; status.style.color=''; }
  try {
    // Look up user ID from email if needed
    let userId = input;
    // Try to find by leaderboard (approximate)
    if (input.includes('@')) {
      status.textContent = 'Note: Enter the Supabase user UUID for precise targeting. Email lookup available in Supabase Dashboard.';
      status.style.color = 'hsl(40 80% 65%)';
      return;
    }
    await api('/api/admin?action=set_admin', {
      method:'POST',
      body: JSON.stringify({ target_user_id: userId, grant }),
    });
    if (status) { status.textContent = (grant ? '✅ Admin granted.' : '✅ Admin revoked.'); status.style.color = 'hsl(140 60% 60%)'; }
  } catch (e) {
    if (status) { status.textContent = e.message; status.style.color = '#f44336'; }
  }
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'admin-toast admin-toast--' + type;
  toast.innerHTML = `<span>${esc(msg)}</span><button onclick="this.parentElement.remove()">✕</button>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 50);
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 5000);
}

function confirm_dialog(title, msg, confirmLabel = 'Confirm') {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent   = msg;
    document.getElementById('confirmOk').textContent    = confirmLabel;
    overlay.style.display = 'flex';

    const ok  = document.getElementById('confirmOk');
    const no  = document.getElementById('confirmCancel');
    const close = (val) => { overlay.style.display = 'none'; ok.replaceWith(ok.cloneNode(true)); no.replaceWith(no.cloneNode(true)); resolve(val); };
    document.getElementById('confirmOk').addEventListener('click',     () => close(true),  { once: true });
    document.getElementById('confirmCancel').addEventListener('click', () => close(false), { once: true });
  });
}

function updateTopbarClock() {
  const el = document.getElementById('topbarTime');
  if (el) el.textContent = new Date().toLocaleTimeString('en-KE', { hour:'2-digit', minute:'2-digit' });
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Nav links
  document.querySelectorAll('.nav-item[data-section]').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); navigate(link.dataset.section); });
  });

  // Sidebar toggle (mobile)
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
  document.getElementById('topbarMenuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });

  // Sign out
  document.getElementById('adminSignOutBtn')?.addEventListener('click', async () => {
    await window._sb?.auth.signOut();
    window.location.href = '/';
  });

  // Refresh
  document.getElementById('globalRefreshBtn')?.addEventListener('click', () => {
    const active = document.querySelector('.section-panel.active')?.id?.replace('section-','');
    if (active) navigate(active);
  });

  // Payout buttons
  document.getElementById('runPayoutsBtn')?.addEventListener('click', runPayouts);
  document.getElementById('quickRunPayoutsBtn')?.addEventListener('click', runPayouts);

  // Notification button
  document.getElementById('runNotifBtn')?.addEventListener('click', runNotifications);

  // Admin grant/revoke
  document.getElementById('grantAdminBtn')?.addEventListener('click',  () => grantAdmin(true));
  document.getElementById('revokeAdminBtn')?.addEventListener('click', () => grantAdmin(false));

  // Tournament filters
  document.getElementById('tournFilterStatus')?.addEventListener('change', e => {
    _tournFilter = e.target.value; _currentPage.tournaments = 1; renderTournaments();
  });
  document.getElementById('tournSearch')?.addEventListener('input', e => {
    _tournSearch = e.target.value; _currentPage.tournaments = 1; renderTournaments();
  });

  // User filters
  document.getElementById('userSearch')?.addEventListener('input', e => {
    _userSearch = e.target.value; _currentPage.users = 1; renderUsers();
  });

  // Pagination
  document.getElementById('tournPrevBtn')?.addEventListener('click', () => { _currentPage.tournaments--; renderTournaments(); });
  document.getElementById('tournNextBtn')?.addEventListener('click', () => { _currentPage.tournaments++; renderTournaments(); });
  document.getElementById('userPrevBtn')?.addEventListener('click',  () => { _currentPage.users--; renderUsers(); });
  document.getElementById('userNextBtn')?.addEventListener('click',  () => { _currentPage.users++; renderUsers(); });

  // Boot
  if (window._sb) {
    boot();
  } else {
    document.addEventListener('supabase-ready', boot, { once: true });
  }
});

// Expose for onclick handlers in HTML
window.navigate            = navigate;
window.doApprove           = doApprove;
window.doReject            = doReject;
window.doAdvanceBracket    = doAdvanceBracket;
window.doTriggerPayout     = doTriggerPayout;
window.resolveDispute      = resolveDispute;
window.viewUserMatches     = viewUserMatches;
