'use strict';
/**
 * PhinTech Arena — Admin Panel + Wallet UI
 * PhinTech Solutions, Kenya
 *
 * Handles:
 *  - Admin dashboard stats
 *  - Tournament approval/rejection
 *  - Dispute resolution
 *  - Payout queue management
 *  - Wallet balance, deposit, withdrawal
 */

// ── ADMIN ─────────────────────────────────────────────────────────────────────

let adminLoaded = false;

async function loadAdminDashboard() {
  if (!adminLoaded) {
    await loadAdminStats();
    await loadAdminPending();
    adminLoaded = true;
  }
}

async function loadAdminStats() {
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) return;
  try {
    const res  = await fetch('/api/admin?action=dashboard', { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();
    const s    = data.stats || {};
    setText('adminStatUsers',    s.total_users);
    setText('adminStatTourns',   s.total_tournaments);
    setText('adminStatPending',  s.pending_tournaments);
    setText('adminStatDisputes', s.disputed_matches);
    setText('adminStatRevenue',  'KES ' + (s.total_revenue_kes || 0).toLocaleString());
    setText('adminStatPayouts',  s.pending_payouts);
  } catch (e) { console.error('[admin] stats:', e); }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

async function loadAdminPending() {
  const list  = document.getElementById('adminPendingList');
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!list || !token) return;
  list.innerHTML = '<p class="gp-empty">Loading...</p>';
  try {
    const res  = await fetch('/api/admin?action=pending', { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();
    const tourns = data.tournaments || [];
    if (!tourns.length) { list.innerHTML = '<p class="gp-empty">No pending tournaments. ✅</p>'; return; }
    list.innerHTML = tourns.map(t => `
      <div class="admin-row">
        <div class="admin-row-info">
          <p class="admin-row-title">${escAdmin(t.name)}</p>
          <p class="admin-row-meta">${escAdmin(t.game)} · ${escAdmin(t.platform)} · KES ${t.entry_fee} entry · ${t.max_players} players</p>
          <p class="admin-row-meta">Host: ${escAdmin(t.profiles?.gamer_tag || t.host_name)} · ${escAdmin(t.host_contact)}</p>
          ${t.rules ? `<p class="admin-row-rules">${escAdmin(t.rules)}</p>` : ''}
        </div>
        <div class="admin-row-actions">
          <button class="admin-approve-btn" onclick="adminApprove('${t.id}', this)">
            <ion-icon name="checkmark-circle-outline"></ion-icon> Approve
          </button>
          <button class="admin-reject-btn" onclick="adminReject('${t.id}', this)">
            <ion-icon name="close-circle-outline"></ion-icon> Reject
          </button>
        </div>
      </div>`).join('');
  } catch (e) { list.innerHTML = '<p class="gp-empty">Could not load.</p>'; }
}

async function loadAdminDisputes() {
  const list  = document.getElementById('adminDisputesList');
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!list || !token) return;
  list.innerHTML = '<p class="gp-empty">Loading...</p>';
  try {
    const res  = await fetch('/api/admin?action=disputes', { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();
    const matches = data.matches || [];
    if (!matches.length) { list.innerHTML = '<p class="gp-empty">No disputes. ✅</p>'; return; }
    list.innerHTML = matches.map(m => `
      <div class="admin-row">
        <div class="admin-row-info">
          <p class="admin-row-title">⚠️ ${escAdmin(m.player1_tag)} vs ${escAdmin(m.player2_tag)}</p>
          <p class="admin-row-meta">${escAdmin(m.tournaments?.name || '')} · ${escAdmin(m.tournaments?.game || '')}</p>
          <p class="admin-row-meta">${escAdmin(m.dispute_reason || 'No reason given')}</p>
          ${m.screenshot_url ? `<a href="${escAdmin(m.screenshot_url)}" target="_blank" class="admin-evidence-link">📸 View Screenshot</a>` : ''}
        </div>
        <div class="admin-row-actions" style="flex-direction:column;gap:6px;">
          <button class="admin-approve-btn" onclick="adminResolveDispute('${m.id}','${m.player1_tag}',this)">
            ✅ ${escAdmin(m.player1_tag)} Wins
          </button>
          <button class="admin-approve-btn" style="background:hsl(200 70% 30%);" onclick="adminResolveDispute('${m.id}','${m.player2_tag}',this)">
            ✅ ${escAdmin(m.player2_tag)} Wins
          </button>
        </div>
      </div>`).join('');
  } catch (e) { list.innerHTML = '<p class="gp-empty">Could not load.</p>'; }
}

async function loadAdminPayouts() {
  const list  = document.getElementById('adminPayoutsList');
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!list || !token) return;
  list.innerHTML = '<p class="gp-empty">Loading...</p>';
  try {
    const res  = await fetch('/api/admin?action=payouts', { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();
    const payouts = data.payouts || [];
    if (!payouts.length) { list.innerHTML = '<p class="gp-empty">No payouts in queue.</p>'; return; }
    list.innerHTML = payouts.map(p => `
      <div class="gp-tourn-row">
        <div class="gp-tourn-info">
          <p class="gp-tourn-name">${escAdmin(p.profiles?.gamer_tag || '?')} — ${escAdmin(p.tournaments?.name || 'Wallet withdrawal')}</p>
          <p class="gp-tourn-meta">${escAdmin(p.phone)} · ${new Date(p.created_at).toLocaleDateString()}</p>
          ${p.failure_reason ? `<p class="gp-tourn-meta" style="color:#f44336">${escAdmin(p.failure_reason)}</p>` : ''}
        </div>
        <span class="tc-status ${
          p.status === 'paid'       ? 'status-open' :
          p.status === 'failed'     ? 'status-done' :
          p.status === 'processing' ? 'status-ongoing' : ''
        }">KES ${p.amount_kes} · ${p.status}</span>
      </div>`).join('');
  } catch (e) { list.innerHTML = '<p class="gp-empty">Could not load.</p>'; }
}

async function adminApprove(tournamentId, btn) {
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) return;
  btn.disabled = true;
  btn.textContent = 'Approving...';
  try {
    const res = await fetch('/api/admin?action=approve', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tournament_id: tournamentId }),
    });
    const data = await res.json();
    if (data.success) {
      btn.closest('.admin-row').innerHTML = '<p class="gp-empty" style="color:#4caf50">✅ Approved and live!</p>';
      loadAdminStats();
    } else {
      btn.textContent = 'Error: ' + data.error;
    }
  } catch (e) { btn.textContent = 'Failed'; btn.disabled = false; }
}

async function adminReject(tournamentId, btn) {
  const reason = prompt('Reason for rejection (optional):') || '';
  const token  = typeof getToken === 'function' ? getToken() : null;
  if (!token) return;
  btn.disabled = true;
  try {
    await fetch('/api/admin?action=reject', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tournament_id: tournamentId, reason }),
    });
    btn.closest('.admin-row').innerHTML = '<p class="gp-empty" style="color:#f44336">❌ Rejected.</p>';
    loadAdminStats();
  } catch (e) { btn.disabled = false; }
}

async function adminResolveDispute(matchId, winnerTag, btn) {
  const note  = prompt(`Resolve: ${winnerTag} wins. Admin note (optional):`) || 'Admin decision.';
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) return;
  btn.disabled = true;
  btn.textContent = 'Resolving...';
  try {
    const res = await fetch('/api/admin?action=dispute', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ match_id: matchId, winner_tag: winnerTag, resolution_note: note }),
    });
    const data = await res.json();
    if (data.success) {
      btn.closest('.admin-row').innerHTML = `<p class="gp-empty" style="color:#4caf50">✅ Resolved: ${winnerTag} wins.</p>`;
      loadAdminStats();
    } else {
      btn.textContent = 'Error'; btn.disabled = false;
    }
  } catch (e) { btn.disabled = false; }
}

async function adminRunPayouts() {
  const btn   = document.getElementById('adminRunPayoutsBtn');
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token || !btn) return;
  btn.disabled = true;
  btn.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Processing...';
  try {
    const res  = await fetch('/api/ops?type=payout', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    });
    const data = await res.json();
    if (typeof showToast === 'function') {
      showToast(`Payouts: ${data.processed || 0} sent, ${data.failed || 0} failed.`, 'success');
    }
    await loadAdminPayouts();
    await loadAdminStats();
  } catch (e) {
    if (typeof showToast === 'function') showToast('Payout error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<ion-icon name="send-outline"></ion-icon> Process All Pending Payouts Now';
  }
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.admintab === tab));
  document.querySelectorAll('.admin-panel').forEach(p => { p.style.display = p.id === 'adminpanel-' + tab ? 'block' : 'none'; });
  if (tab === 'disputes')      loadAdminDisputes();
  if (tab === 'payouts-admin') loadAdminPayouts();
}

// Expose for onclick in HTML
window.switchAdminTab    = switchAdminTab;
window.adminApprove      = adminApprove;
window.adminReject       = adminReject;
window.adminResolveDispute = adminResolveDispute;

// ── WALLET ─────────────────────────────────────────────────────────────────────

async function loadWallet() {
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) return;
  try {
    const res  = await fetch('/api/wallet', { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();

    const bal = data.wallet?.balance_kes || 0;
    const el  = document.getElementById('walletBalance');
    if (el) {
      let cur = 0;
      const step  = Math.max(1, Math.ceil(bal / 40));
      const timer = setInterval(() => {
        cur = Math.min(cur + step, bal);
        el.textContent = cur.toLocaleString();
        if (cur >= bal) clearInterval(timer);
      }, 25);
    }

    const txEl = document.getElementById('walletTransactions');
    if (txEl) {
      const txs = data.transactions || [];
      // Filter out failed transactions - only show completed and pending
      const visibleTxs = txs.filter(tx => tx.status !== 'failed');
      
      if (!visibleTxs.length) {
        txEl.innerHTML = '<p class="gp-empty">No transactions yet.</p>';
      } else {
        const typeIcon = { deposit:'💳', withdrawal:'💸', entry_fee:'🎮', prize:'🏆', refund:'↩️', platform_fee:'🏢' };
        const statusBadge = (status) => {
          if (status === 'pending') return '<span class="tx-pending-badge" style="font-size:0.75em;color:#ffa500;margin-left:5px;">⏳ Pending</span>';
          return '';
        };
        txEl.innerHTML = visibleTxs.map(tx => `
          <div class="gp-tourn-row">
            <div class="gp-tourn-info" style="flex:1;">
              <p class="gp-tourn-name">${typeIcon[tx.type] || '💰'} ${escAdmin(tx.description || tx.type)}${statusBadge(tx.status)}</p>
              <p class="gp-tourn-meta">${new Date(tx.created_at).toLocaleDateString()} · Ref: ${escAdmin(tx.ref || '—')}</p>
            </div>
            <span class="tc-status ${tx.amount_kes >= 0 ? 'status-open' : 'status-done'}" style="min-width:70px;text-align:right;">
              ${tx.amount_kes >= 0 ? '+' : ''}KES ${Math.abs(tx.amount_kes)}
            </span>
          </div>`).join('');
      }
    }
  } catch (e) { console.error('[wallet] load error:', e); }
}

async function initiateDeposit() {
  const token  = typeof getToken === 'function' ? getToken() : null;
  const amount = document.getElementById('depositAmount')?.value;
  const phone  = document.getElementById('depositPhone')?.value;
  const status = document.getElementById('depositStatus');
  const btn    = document.getElementById('depositSubmitBtn');

  if (!token) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
  if (!amount || amount < 10) { if (status) { status.textContent = 'Minimum deposit is KES 10.'; status.className = 'visit-status error'; } return; }
  if (!phone) { if (status) { status.textContent = 'Enter your M-Pesa number.'; status.className = 'visit-status error'; } return; }

  if (btn) btn.disabled = true;
  if (status) { status.textContent = 'Initiating payment...'; status.className = 'visit-status'; }

  try {
    const res  = await fetch('/api/wallet?action=deposit', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ amount: parseInt(amount), phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // M-Pesa Daraja STK Push - no payment page, prompt goes directly to phone
    if (status) { 
      status.textContent = `📱 STK Push sent to ${phone}! Check your phone and enter your M-Pesa PIN to complete payment of KES ${amount}.`; 
      status.className = 'visit-status success'; 
    }
    
    // Show the transaction reference for tracking
    if (data.ref) {
      setTimeout(() => {
        if (status) status.textContent += ` Ref: ${data.ref}`;
      }, 1000);
    }
    
    // Reload wallet data after a few seconds to show pending transaction
    setTimeout(() => {
      if (typeof loadWalletData === 'function') {
        loadWalletData();
      }
    }, 2000);
    
  } catch (e) {
    if (status) { status.textContent = e.message; status.className = 'visit-status error'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function initiateWithdrawal() {
  const token  = typeof getToken === 'function' ? getToken() : null;
  const amount = document.getElementById('withdrawAmount')?.value;
  const status = document.getElementById('withdrawStatus');
  const btn    = document.getElementById('withdrawSubmitBtn');

  if (!token) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
  if (!amount || amount < 50) { if (status) { status.textContent = 'Minimum withdrawal is KES 50.'; status.className = 'visit-status error'; } return; }

  if (btn) btn.disabled = true;
  if (status) { status.textContent = 'Processing...'; status.className = 'visit-status'; }

  try {
    const res  = await fetch('/api/wallet?action=withdraw', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ amount: parseInt(amount) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (status) { status.textContent = '✅ ' + data.message; status.className = 'visit-status success'; }
    document.getElementById('walletWithdrawForm').style.display = 'none';
    setTimeout(() => loadWallet(), 2000);
  } catch (e) {
    if (status) { status.textContent = e.message; status.className = 'visit-status error'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── WIRE GP TAB EXTENSION ─────────────────────────────────────────────────────
// Extend the existing switchGPTab from hud.js
const _origSwitchGPTab = window.switchGPTab;
window.switchGPTab = function(tab) {
  if (typeof _origSwitchGPTab === 'function') _origSwitchGPTab(tab);
  if (tab === 'wallet') loadWallet();
  if (tab === 'admin')  loadAdminDashboard();
};

// ── SHOW ADMIN TAB ONLY FOR ADMINS ────────────────────────────────────────────
document.addEventListener('profile-loaded', (e) => {
  const profile = e.detail?.profile;
  // Always show wallet tab for logged-in users
  document.getElementById('gpWalletTab')?.style.setProperty('display', 'flex');
  // Admin console link — only for admins
  if (profile?.is_admin) {
    document.getElementById('gpAdminConsoleLink')?.style.setProperty('display', 'flex');
  }
});

// ── DOMContentLoaded wiring ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Wallet buttons
  document.getElementById('walletDepositBtn')?.addEventListener('click', () => {
    const f = document.getElementById('walletDepositForm');
    const w = document.getElementById('walletWithdrawForm');
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
    if (w) w.style.display = 'none';
  });
  document.getElementById('walletWithdrawBtn')?.addEventListener('click', () => {
    const f = document.getElementById('walletWithdrawForm');
    const d = document.getElementById('walletDepositForm');
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
    if (d) d.style.display = 'none';
  });
  document.getElementById('depositSubmitBtn')?.addEventListener('click', initiateDeposit);
  document.getElementById('withdrawSubmitBtn')?.addEventListener('click', initiateWithdrawal);
  document.getElementById('adminRunPayoutsBtn')?.addEventListener('click', adminRunPayouts);
});

// ── UTILS ────────────────────────────────────────────────────────────────────
function escAdmin(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
