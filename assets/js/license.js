'use strict';

/**
 * PHINTECH ARENA — Payment System
 * Powered by PhinTech Solutions, Kenya
 * Payment via M-Pesa (Till 5535650) or Lipia Online STK Push
 *
 * Plans:
 *   Monthly   — KES 2,000
 *   Annual    — KES 23,000
 *   Lifetime  — KES 25,000
 */

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const LICENSE_CONFIG = {
  plans: {
    monthly:  { label: 'Monthly',  amount: 2000,  durationDays: 30 },
    annual:   { label: 'Annual',   amount: 23000, durationDays: 365 },
    lifetime: { label: 'Lifetime', amount: 25000, durationDays: null },
  },
  // Lipia Online payment link for PHINTECH SOLUTIONS till
  lipiaBaseUrl: 'https://lipia-online.vercel.app/link/PHINTECHSOLUTIONS',
  // Poll interval (ms) when waiting for payment confirmation
  pollInterval: 5000,
  pollMaxAttempts: 24, // 2 minutes total
};

const TILL_NUMBER = '5535650';

// ---------------------------------------------------------------------------
// STORAGE
// ---------------------------------------------------------------------------

const KEYS = {
  licenseType: 'phintech arena_license_type',
  licenseExp:  'phintech arena_license_exp',
  txRef:       'phintech arena_tx_ref',
  phone:       'phintech arena_phone',
};

function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

function retrieve(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function now() { return Date.now(); }

function daysMs(d) { return d * 24 * 60 * 60 * 1000; }

function generateRef() {
  return 'GMX-' + Math.random().toString(36).substr(2, 9).toUpperCase() + '-' + Date.now();
}

function formatPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/[\s\-().+]/g, '');
  if (/^0[17]\d{8}$/.test(digits))   return '254' + digits.slice(1);
  if (/^[17]\d{8}$/.test(digits))    return '254' + digits;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  return digits;
}

function isValidPhone(phone) {
  return /^254[17]\d{8}$/.test(phone);
}

// ---------------------------------------------------------------------------
// LICENSE STATE (paid licenses only — no trial)
// ---------------------------------------------------------------------------

function getLicenseState() {
  const licenseType = retrieve(KEYS.licenseType);
  const licenseExp  = retrieve(KEYS.licenseExp);

  if (licenseType) {
    if (licenseType === 'lifetime') return { status: 'licensed', type: 'lifetime' };
    if (licenseExp && now() < licenseExp) {
      return { status: 'licensed', type: licenseType, expiresAt: licenseExp };
    }
    return { status: 'expired', type: licenseType };
  }

  // No license and no trial — site is freely accessible
  return { status: 'free' };
}

function activateLicense(plan) {
  const cfg = LICENSE_CONFIG.plans[plan];
  if (!cfg) return;
  store(KEYS.licenseType, plan);
  if (cfg.durationDays) {
    store(KEYS.licenseExp, now() + daysMs(cfg.durationDays));
  } else {
    store(KEYS.licenseExp, null);
  }
  logTransaction({ plan, amount: cfg.amount, activatedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// TRANSACTION LOG
// ---------------------------------------------------------------------------

function logTransaction(data) {
  try {
    const logs = JSON.parse(localStorage.getItem('phintech arena_tx_log') || '[]');
    logs.push(data);
    localStorage.setItem('phintech arena_tx_log', JSON.stringify(logs));
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// UI — MODAL
// ---------------------------------------------------------------------------

let selectedPlan = 'monthly';
let pollTimer    = null;
let pollCount    = 0;

function showPaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    selectPlan('monthly');
  }
}

function hidePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  clearPollTimer();
}

function selectPlan(plan) {
  selectedPlan = plan;
  document.querySelectorAll('.pricing-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.plan === plan);
  });
}

function setPayStatus(msg, type) {
  const el = document.getElementById('payStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'pay-status ' + (type || '');
}

// ---------------------------------------------------------------------------
// OPTION 1 — DIRECT TILL PAYMENT (in payment modal)
// ---------------------------------------------------------------------------

/**
 * Handle the "Confirm Payment" button inside the main payment modal.
 * Submits the M-Pesa code for admin verification and activates the license
 * optimistically so the user can continue while it is confirmed.
 */
async function submitTillPaymentModal() {
  const ref      = (document.getElementById('tillConfirmRefModal')?.value || '').trim().toUpperCase();
  const statusEl = document.getElementById('tillModalStatus');
  const btn      = document.getElementById('tillConfirmModalBtn');

  if (!ref) {
    if (statusEl) { statusEl.textContent = 'Enter your M-Pesa confirmation code first.'; statusEl.className = 'pay-status error'; }
    return;
  }

  const plan = selectedPlan;
  const cfg  = LICENSE_CONFIG.plans[plan];

  if (btn) btn.disabled = true;
  if (statusEl) { statusEl.textContent = 'Verifying…'; statusEl.className = 'pay-status pending'; }

  // Try to record via API if user is signed in
  try {
    const token = typeof getToken === 'function' ? getToken() : null;
    if (token) {
      await fetch('/api/wallet?action=deposit_till', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body:    JSON.stringify({ ref, amount: cfg.amount, till: TILL_NUMBER, plan }),
      });
    }
  } catch (_) { /* non-critical — proceed */ }

  // Activate locally so the user isn't blocked
  activateLicense(plan);
  logTransaction({ txRef: ref, plan, amount: cfg.amount, method: 'till', initiatedAt: new Date().toISOString() });

  if (statusEl) {
    statusEl.textContent = '✅ ' + cfg.label + ' license activated! Welcome to PhinTech Arena.';
    statusEl.className = 'pay-status success';
  }

  setTimeout(() => {
    hidePaymentModal();
    showSuccessToast(cfg.label);
  }, 2000);
}

// ---------------------------------------------------------------------------
// OPTION 2 — LIPIA ONLINE STK PUSH
// ---------------------------------------------------------------------------

function initiateMpesaPayment() {
  const phoneRaw = document.getElementById('phoneInput')?.value || '';
  const phone    = formatPhone(phoneRaw);

  if (!isValidPhone(phone)) {
    setPayStatus('Please enter a valid Kenyan number: 07XX, 01XX, or +254XXXXXXXXX', 'error');
    return;
  }

  const plan  = selectedPlan;
  const cfg   = LICENSE_CONFIG.plans[plan];
  const txRef = generateRef();

  store(KEYS.phone, phone);
  store(KEYS.txRef, txRef);

  setPayStatus('Sending payment prompt to ' + phoneRaw + '…', 'pending');

  const payBtn = document.getElementById('payBtn');
  if (payBtn) payBtn.disabled = true;

  const params = new URLSearchParams({ phone, amount: cfg.amount, ref: txRef, plan });
  const payUrl = LICENSE_CONFIG.lipiaBaseUrl + '?' + params.toString();
  window.open(payUrl, '_blank', 'noopener,noreferrer');

  setPayStatus(
    'A payment prompt of KES ' + cfg.amount.toLocaleString() +
    ' has been sent to your phone. Enter your M-Pesa PIN to confirm.',
    'pending'
  );

  logTransaction({ txRef, plan, amount: cfg.amount, phone, initiatedAt: new Date().toISOString(), status: 'pending' });

  startPolling(txRef, plan);
}

// ---------------------------------------------------------------------------
// PAYMENT POLLING
// ---------------------------------------------------------------------------

function startPolling(txRef, plan) {
  pollCount = 0;
  clearPollTimer();

  pollTimer = setInterval(function () {
    pollCount++;
    const confirmed = retrieve('phintech arena_payment_confirmed_' + txRef);

    if (confirmed) {
      clearPollTimer();
      handlePaymentSuccess(plan, txRef);
      return;
    }

    if (pollCount >= LICENSE_CONFIG.pollMaxAttempts) {
      clearPollTimer();
      setPayStatus("Payment not confirmed yet. If you paid, click \"I've Paid\" below.", 'error');
      showManualConfirmButton(txRef, plan);
    }
  }, LICENSE_CONFIG.pollInterval);
}

function clearPollTimer() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function showManualConfirmButton(txRef, plan) {
  const form = document.getElementById('payOptionStk');
  if (!form) return;
  const existing = document.getElementById('manualConfirmBtn');
  if (existing) existing.remove();

  const btn = document.createElement('button');
  btn.id        = 'manualConfirmBtn';
  btn.className = 'manual-confirm-btn';
  btn.textContent = "I've Paid — Activate Now";
  btn.onclick = function () {
    store('phintech arena_payment_confirmed_' + txRef, true);
    handlePaymentSuccess(plan, txRef);
  };
  form.appendChild(btn);
}

function handlePaymentSuccess(plan, txRef) {
  activateLicense(plan);
  const cfg = LICENSE_CONFIG.plans[plan];
  setPayStatus('Payment confirmed. ' + cfg.label + ' license activated!', 'success');
  logTransaction({ txRef, plan, amount: cfg.amount, confirmedAt: new Date().toISOString(), status: 'confirmed' });

  const payBtn = document.getElementById('payBtn');
  if (payBtn) payBtn.disabled = false;

  setTimeout(function () {
    hidePaymentModal();
    showSuccessToast(cfg.label);
  }, 2000);
}

function showSuccessToast(planLabel) {
  const toast = document.createElement('div');
  toast.className = 'license-toast';
  toast.innerHTML = '<ion-icon name="checkmark-circle"></ion-icon> ' + planLabel + ' license activated — welcome to PHINTECH ARENA!';
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 50);
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 4000);
}

// ---------------------------------------------------------------------------
// PLAN CARD WIRING
// ---------------------------------------------------------------------------

function wirePlanCards() {
  document.querySelectorAll('.pricing-card').forEach(function (card) {
    card.addEventListener('click', function () { selectPlan(card.dataset.plan); });
  });
}

function wireModalClose() {
  const overlay = document.getElementById('paymentModal');
  if (!overlay) return;
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) hidePaymentModal();
  });
}

// ---------------------------------------------------------------------------
// INIT — no trial checks, no auto-popup
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function () {
  wirePlanCards();
  wireModalClose();
});

// ---------------------------------------------------------------------------
// WALLET DEPOSIT — Direct till tabs (wallet panel)
// ---------------------------------------------------------------------------

/**
 * Switch between STK push and direct till tabs in the wallet deposit form.
 */
function switchDepositTab(tab) {
  const stkPanel  = document.getElementById('depositPanelStk');
  const tillPanel = document.getElementById('depositPanelTill');
  const stkTab    = document.getElementById('depositTabStk');
  const tillTab   = document.getElementById('depositTabTill');

  if (stkPanel)  stkPanel.style.display  = tab === 'stk'  ? 'block' : 'none';
  if (tillPanel) tillPanel.style.display = tab === 'till' ? 'block' : 'none';
  if (stkTab)    stkTab.classList.toggle('active', tab === 'stk');
  if (tillTab)   tillTab.classList.toggle('active', tab === 'till');
}

/**
 * Submit a till deposit confirmation from the wallet panel.
 */
async function submitTillPayment() {
  const ref      = (document.getElementById('tillConfirmRef')?.value    || '').trim().toUpperCase();
  const amount   = parseInt(document.getElementById('tillConfirmAmount')?.value || '0');
  const statusEl = document.getElementById('tillConfirmStatus');
  const btn      = document.getElementById('tillConfirmBtn');

  if (!ref)   { if (statusEl) { statusEl.textContent = 'Enter your M-Pesa confirmation code.'; statusEl.style.color = '#f44336'; } return; }
  if (!amount || amount < 10) { if (statusEl) { statusEl.textContent = 'Enter the amount you paid (min KES 10).'; statusEl.style.color = '#f44336'; } return; }

  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token) { if (statusEl) { statusEl.textContent = 'You must be signed in.'; statusEl.style.color = '#f44336'; } return; }

  if (btn) btn.disabled = true;
  if (statusEl) { statusEl.textContent = 'Submitting…'; statusEl.style.color = ''; }

  try {
    const res  = await fetch('/api/wallet?action=deposit_till', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify({ ref, amount, till: TILL_NUMBER }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not submit confirmation.');

    if (statusEl) { statusEl.textContent = '✅ Received! Wallet credited once verified (usually within minutes).'; statusEl.style.color = '#22c55e'; }
    const refEl = document.getElementById('tillConfirmRef');
    const amtEl = document.getElementById('tillConfirmAmount');
    if (refEl) refEl.value = '';
    if (amtEl) amtEl.value = '';
  } catch (err) {
    if (statusEl) { statusEl.textContent = err.message; statusEl.style.color = '#f44336'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// COPY TILL NUMBER
// ---------------------------------------------------------------------------

function copyTillNumber() {
  navigator.clipboard.writeText(TILL_NUMBER).then(() => {
    if (typeof showToast === 'function') {
      showToast('Till number ' + TILL_NUMBER + ' copied!', 'success');
    } else {
      document.querySelectorAll('.till-copy-btn').forEach(btn => {
        const orig = btn.innerHTML;
        btn.innerHTML = '<ion-icon name="checkmark-outline"></ion-icon>';
        setTimeout(() => { btn.innerHTML = orig; }, 1800);
      });
    }
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = TILL_NUMBER;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (typeof showToast === 'function') showToast('Copied: ' + TILL_NUMBER, 'success');
  });
}

// expose globals
window.showPaymentModal       = showPaymentModal;
window.hidePaymentModal       = hidePaymentModal;
window.initiateMpesaPayment   = initiateMpesaPayment;
window.submitTillPaymentModal = submitTillPaymentModal;
window.submitTillPayment      = submitTillPayment;
window.switchDepositTab       = switchDepositTab;
window.copyTillNumber         = copyTillNumber;
