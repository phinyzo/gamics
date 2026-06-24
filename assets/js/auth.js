'use strict';

/**
 * PhinTech Arena — Supabase Auth Client
 * Powered by PhinTech Solutions, Kenya
 *
 * Sign-in methods:
 *   1. Google OAuth
 *   2. Magic Link (email OTP)
 *   3. Email + Password (sign-in & sign-up)
 *   4. Phone OTP (SMS via Supabase)
 *
 * Also handles:
 *   - Invite code validation & application
 *   - Profile setup (gamer tag, phone)
 *   - Auth state changes → update UI
 *   - Notification bell
 */

// ── SUPABASE CLIENT ────────────────────────────────────────────────────────────
function getSB() {
  if (!window._sb) throw new Error('Supabase client not initialised');
  return window._sb;
}

// ── STATE ─────────────────────────────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;
let authToken      = null;
let _otpPhone      = null;        // phone kept across OTP steps
let _pendingInvite = null;        // invite code to apply after auth

function getToken()   { return authToken; }
function getUser()    { return currentUser; }
function getProfile() { return currentProfile; }

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (authToken) h['Authorization'] = `Bearer ${authToken}`;
  return h;
}

// ── AUTH TAB SWITCHER ─────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.authtab === tab);
    b.setAttribute('aria-selected', String(b.dataset.authtab === tab));
  });
  document.querySelectorAll('.auth-tab-panel').forEach(p => {
    p.style.display = p.id === 'authtab-' + tab ? 'block' : 'none';
  });
  clearAuthStatus();
}

function switchEmailMode(mode) {
  const isSignUp = mode === 'signup';
  document.querySelectorAll('.auth-sub-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.emailmode === mode);
  });
  document.getElementById('emailSignInForm').style.display  = isSignUp ? 'none' : 'block';
  document.getElementById('emailSignUpForm').style.display  = isSignUp ? 'block' : 'none';
  clearAuthStatus();
}

// ── SIGN IN WITH GOOGLE ────────────────────────────────────────────────────────
async function signInWithGoogle() {
  try {
    // Save pending invite code before OAuth redirect (page will reload on return)
    if (_pendingInvite) sessionStorage.setItem('pendingInvite', _pendingInvite);

    const { error } = await getSB().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://phintech-gamics.vercel.app',
        skipBrowserRedirect: false,
      },
    });
    if (error) throw error;
  } catch (e) {
    showAuthError(e.message);
  }
}

// ── SIGN IN WITH MAGIC LINK ────────────────────────────────────────────────────
async function signInWithMagicLink(email) {
  if (!email || !email.includes('@')) {
    showAuthError('Please enter a valid email address.');
    return;
  }
  try {
    const { error } = await getSB().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname + '#arena',
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
    setAuthStatus(`Magic link sent to ${email}. Check your inbox!`, 'success');
  } catch (e) {
    showAuthError(e.message);
  }
}

// ── SIGN IN WITH EMAIL + PASSWORD ─────────────────────────────────────────────
async function signInWithEmail(email, password) {
  if (!email || !password) { showAuthError('Email and password are required.'); return; }
  try {
    setAuthStatus('Signing in...', '');
    const { error } = await getSB().auth.signInWithPassword({ email, password });
    if (error) throw error;
    // onAuthStateChange will handle the rest
  } catch (e) {
    showAuthError(e.message);
  }
}

// ── SIGN UP WITH EMAIL + PASSWORD ─────────────────────────────────────────────
async function signUpWithEmail(email, password, confirm, inviteCode) {
  if (!email || !password) { showAuthError('Email and password are required.'); return; }
  if (password.length < 8) { showAuthError('Password must be at least 8 characters.'); return; }
  if (password !== confirm)  { showAuthError('Passwords do not match.'); return; }
  try {
    setAuthStatus('Creating account...', '');
    const { error } = await getSB().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) throw error;
    // Store invite code to apply once profile loads
    if (inviteCode) _pendingInvite = inviteCode.trim().toUpperCase();
    setAuthStatus('Account created! Check your email to confirm, then sign in.', 'success');
  } catch (e) {
    showAuthError(e.message);
  }
}

// ── RESET PASSWORD ─────────────────────────────────────────────────────────────
async function sendPasswordReset(email) {
  const e = email || document.getElementById('epEmail')?.value.trim();
  if (!e) { showAuthError('Enter your email address first, then click Forgot password.'); return; }
  try {
    const { error } = await getSB().auth.resetPasswordForEmail(e, {
      redirectTo: window.location.origin + window.location.pathname + '?reset=1',
    });
    if (error) throw error;
    setAuthStatus(`Password reset email sent to ${e}. Check your inbox.`, 'success');
  } catch (err) {
    showAuthError(err.message);
  }
}

// ── SIGN IN WITH PHONE OTP ─────────────────────────────────────────────────────
async function sendPhoneOtp(phone, inviteCode) {
  if (!phone) { showAuthError('Enter your phone number.'); return; }

  // Normalise to E.164 — accepts 07XX, 01XX, 7XX, 1XX, 254XX, +254XX
  const digits = phone.replace(/[\s\-().]/g, '');
  let e164 = digits;

  if (/^0[17]\d{8}$/.test(digits))       e164 = '+254' + digits.slice(1);   // 07XX / 01XX
  else if (/^[17]\d{8}$/.test(digits))   e164 = '+254' + digits;            // 7XX / 1XX (9 digits)
  else if (/^254[17]\d{8}$/.test(digits)) e164 = '+' + digits;              // 254XX
  else if (/^\+254[17]\d{8}$/.test(digits)) e164 = digits;                  // +254XX already

  if (!/^\+254[17]\d{8}$/.test(e164)) {
    showAuthError('Enter a valid Kenyan number: 07XX, 01XX, or +254XXXXXXXXX');
    return;
  }

  try {
    setAuthStatus('Sending OTP...', '');
    const { error } = await getSB().auth.signInWithOtp({
      phone: e164,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;

    _otpPhone = e164;
    if (inviteCode) _pendingInvite = inviteCode.trim().toUpperCase();

    document.getElementById('otpPhoneDisplay').textContent = e164;
    document.getElementById('phoneInputStep').style.display = 'none';
    document.getElementById('phoneOtpStep').style.display   = 'block';
    setAuthStatus('OTP sent! Enter the 6-digit code.', 'success');
  } catch (e) {
    showAuthError(e.message);
  }
}

async function verifyPhoneOtp(otp) {
  if (!otp || otp.length < 6) { showAuthError('Enter the 6-digit OTP.'); return; }
  if (!_otpPhone) { showAuthError('Session expired. Please request a new OTP.'); return; }
  try {
    setAuthStatus('Verifying...', '');
    const { error } = await getSB().auth.verifyOtp({
      phone: _otpPhone,
      token: otp.trim(),
      type:  'sms',
    });
    if (error) throw error;
    // onAuthStateChange handles the sign-in
  } catch (e) {
    showAuthError(e.message);
  }
}

// ── SIGN OUT ───────────────────────────────────────────────────────────────────
async function signOut() {
  await getSB().auth.signOut();
  currentUser    = null;
  currentProfile = null;
  authToken      = null;
  _pendingInvite = null;
  updateAuthUI(null);
  closeProfileModal();
}

// ── INVITE CODE VALIDATION ────────────────────────────────────────────────────
async function validateInviteCode(code, hintElId) {
  const hintEl = document.getElementById(hintElId);
  if (!code) { if (hintEl) { hintEl.textContent = ''; hintEl.className = 'auth-invite-hint'; } return; }
  if (hintEl) { hintEl.textContent = 'Checking...'; hintEl.className = 'auth-invite-hint'; }
  try {
    const res = await fetch(`/api/invite?code=${encodeURIComponent(code.toUpperCase())}`);
    const data = await res.json();
    if (data.valid) {
      if (hintEl) { hintEl.textContent = `✅ Valid code — invited by ${data.owner} (${data.uses} uses)`; hintEl.className = 'auth-invite-hint success'; }
      return true;
    } else {
      if (hintEl) { hintEl.textContent = '❌ Invalid invite code.'; hintEl.className = 'auth-invite-hint error'; }
      return false;
    }
  } catch (e) {
    if (hintEl) { hintEl.textContent = 'Could not validate.'; hintEl.className = 'auth-invite-hint'; }
    return false;
  }
}

async function applyPendingInviteCode() {
  if (!_pendingInvite || !authToken) return;
  try {
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ invite_code: _pendingInvite }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`🎁 Invite code applied! You earned ${data.points_earned} bonus points.`, 'success');
    }
  } catch (e) { /* non-critical */ }
  _pendingInvite = null;
  sessionStorage.removeItem('pendingInvite'); // clean up regardless of outcome
}

// ── LOAD PROFILE ──────────────────────────────────────────────────────────────
async function loadProfile() {
  try {
    const res = await fetch('/api/profile', { headers: authHeaders() });
    if (!res.ok) return;
    const { profile } = await res.json();
    currentProfile = profile;
    updateProfileUI(profile);
    loadNotifications();
    document.dispatchEvent(new CustomEvent('profile-loaded', {
      detail: { profile, user: currentUser }
    }));
    if (!profile.gamer_tag) openProfileSetupModal();
    // Apply pending invite code if any (e.g. after email/phone sign-up)
    if (_pendingInvite) await applyPendingInviteCode();
  } catch (e) {
    console.error('[auth] loadProfile error:', e);
  }
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
async function loadNotifications() {
  try {
    const res = await fetch('/api/profile?type=notifications', { headers: authHeaders() });
    if (!res.ok) return;
    const { notifications } = await res.json();
    renderNotifications(notifications || []);
  } catch (e) {}
}

function renderNotifications(notes) {
  const bell  = document.getElementById('notifBell');
  const list  = document.getElementById('notifList');
  const badge = document.getElementById('notifBadge');
  const unread = notes.filter(n => !n.read).length;

  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }

  if (!list) return;
  if (!notes.length) {
    list.innerHTML = '<p class="notif-empty">No notifications yet.</p>';
    return;
  }
  list.innerHTML = notes.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}">
      <p class="notif-title">${escHtml(n.title)}</p>
      <p class="notif-msg">${escHtml(n.message)}</p>
      <p class="notif-time">${timeAgo(n.created_at)}</p>
    </div>`).join('');
}

// ── AUTH STATE LISTENER ────────────────────────────────────────────────────────
async function initAuth() {
  const sb = getSB();

  sb.auth.onAuthStateChange(async (event, session) => {
    console.log('[Auth]', event, session?.user?.email || session?.user?.phone || '');

    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      authToken   = session.access_token;
      updateAuthUI(session.user);
      closeAuthModal();
      await loadProfile();
      showToast('Welcome to PhinTech Arena! 🎮', 'success');
      if (window.location.search.includes('code=') ||
          window.location.hash.includes('access_token')) {
        history.replaceState(null, '', window.location.pathname);
      }
    }

    if (event === 'INITIAL_SESSION') {
      if (session) {
        currentUser = session.user;
        authToken   = session.access_token;
        updateAuthUI(session.user);
        await loadProfile();
      } else {
        updateAuthUI(null);
      }
    }

    if (event === 'SIGNED_OUT') {
      currentUser    = null;
      currentProfile = null;
      authToken      = null;
      updateAuthUI(null);
    }

    if (event === 'TOKEN_REFRESHED' && session) {
      authToken = session.access_token;
    }
  });
}

// ── UI HELPERS ─────────────────────────────────────────────────────────────────
function updateAuthUI(user) {
  const headerSignIn  = document.getElementById('headerSignInBtn');
  const headerUserArea= document.getElementById('headerUserArea');
  const headerUserName= document.getElementById('headerUserName');
  const headerAvatar  = document.getElementById('headerUserAvatar');
  const arenaSignIn   = document.getElementById('arenaSignInBtn');
  const arenaUserArea = document.getElementById('arenaUserArea');
  const arenaUserName = document.getElementById('arenaUserName');
  const arenaAvatar   = document.getElementById('arenaUserAvatar');

  if (user) {
    const name   = currentProfile?.gamer_tag || user.email?.split('@')[0] || user.phone || 'Player';
    const avatar = currentProfile?.avatar_url || user.user_metadata?.avatar_url || null;

    if (headerSignIn)   headerSignIn.style.display   = 'none';
    if (headerUserArea) headerUserArea.style.display  = 'flex';
    if (headerUserName) headerUserName.textContent    = name;
    if (headerAvatar) {
      if (avatar) { headerAvatar.src = avatar; headerAvatar.style.display = 'block'; }
      else headerAvatar.style.display = 'none';
    }
    if (arenaSignIn)   arenaSignIn.style.display   = 'none';
    if (arenaUserArea) arenaUserArea.style.display  = 'flex';
    if (arenaUserName) arenaUserName.textContent    = name;
    if (arenaAvatar) {
      if (avatar) { arenaAvatar.src = avatar; arenaAvatar.style.display = 'block'; }
      else arenaAvatar.style.display = 'none';
    }
  } else {
    if (headerSignIn)   headerSignIn.style.display   = 'flex';
    if (headerUserArea) headerUserArea.style.display  = 'none';
    if (arenaSignIn)   arenaSignIn.style.display   = 'flex';
    if (arenaUserArea) arenaUserArea.style.display  = 'none';
  }
}

function updateProfileUI(profile) {
  const userName   = document.getElementById('arenaUserName');
  const userAvatar = document.getElementById('arenaUserAvatar');
  if (userName && profile.gamer_tag) userName.textContent = profile.gamer_tag;
  if (userAvatar && profile.avatar_url) { userAvatar.src = profile.avatar_url; userAvatar.style.display = 'block'; }
}

// ── AUTH MODAL ─────────────────────────────────────────────────────────────────
function openAuthModal(prefillCode) {
  document.getElementById('authModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
  clearAuthStatus();
  switchAuthTab('social');
  // Pre-fill invite code if coming from an invite link
  if (prefillCode) {
    ['epInviteCode','phoneInviteCode'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = prefillCode.toUpperCase();
    });
    switchAuthTab('email');
    switchEmailMode('signup');
    validateInviteCode(prefillCode, 'epInviteHint');
  }
}
function closeAuthModal() {
  document.getElementById('authModal')?.classList.remove('active');
  document.body.style.overflow = '';
  // Reset phone OTP step
  document.getElementById('phoneInputStep').style.display = 'block';
  document.getElementById('phoneOtpStep').style.display   = 'none';
}
function showAuthError(msg) { setAuthStatus(msg, 'error'); }
function clearAuthStatus()  { setAuthStatus('', ''); }
function setAuthStatus(msg, type) {
  const el = document.getElementById('authStatus');
  if (!el) return;
  el.textContent = msg;
  el.className   = `visit-status ${type}`;
}

// ── PROFILE SETUP MODAL ────────────────────────────────────────────────────────
function openProfileSetupModal() {
  // Hide invite code field if user was already referred
  if (currentProfile?.referred_by) {
    const wrap = document.getElementById('suInviteCodeWrap');
    if (wrap) wrap.style.display = 'none';
  }
  document.getElementById('profileSetupModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
  // Pre-fill invite from URL param ?ref=CODE
  const urlRef = new URLSearchParams(window.location.search).get('ref');
  if (urlRef && !currentProfile?.referred_by) {
    const field = document.getElementById('su_invite_code');
    if (field) field.value = urlRef.toUpperCase();
    validateInviteCode(urlRef, 'suInviteHint');
  }
}
function closeProfileSetupModal() {
  document.getElementById('profileSetupModal')?.classList.remove('active');
  document.body.style.overflow = '';
}
function openProfileModal() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  if (typeof switchGPTab === 'function') switchGPTab('overview');
  if (typeof populateGPModal === 'function') populateGPModal();
}
function closeProfileModal() {
  document.getElementById('profileModal')?.classList.remove('active');
  document.body.style.overflow = '';
}

async function loadMyTournaments() {
  // Support both the old dead ID and the actual GP modal ID
  const list = document.getElementById('myTournamentsList') ||
               document.getElementById('gpTournamentsList');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--roman-silver)">Loading...</p>';
  try {
    const res = await fetch('/api/profile?type=registrations', { headers: authHeaders() });
    const { registrations } = await res.json();
    if (!registrations?.length) { list.innerHTML = '<p style="color:var(--roman-silver)">No tournaments joined yet.</p>'; return; }
    list.innerHTML = registrations.map(r => `
      <div class="my-tournament-row">
        <div>
          <p class="mt-name">${escHtml(r.tournaments?.name || 'Unknown')}</p>
          <p class="mt-meta">${escHtml(r.tournaments?.game)} · ${escHtml(r.gamer_tag)}</p>
        </div>
        <span class="tc-status ${r.payment_status === 'paid' ? 'status-open' : 'status-done'}">
          ${r.payment_status}
        </span>
      </div>`).join('');
  } catch(e) { list.innerHTML = '<p style="color:var(--roman-silver)">Could not load.</p>'; }
}

// ── PROFILE SAVE (main settings form) ──────────────────────────────────────────
async function saveProfile(e) {
  e.preventDefault();
  const status = document.getElementById('profileSaveStatus');
  const btn    = document.getElementById('profileSaveBtn');
  if (btn) btn.disabled = true;

  const body = {
    gamer_tag:      document.getElementById('pm_gamer_tag')?.value.trim(),
    full_name:      document.getElementById('pm_full_name')?.value.trim(),
    phone:          document.getElementById('pm_phone')?.value.trim(),
    county:         document.getElementById('pm_county')?.value.trim(),
    platform_id:    document.getElementById('pm_platform_id')?.value.trim(),
    gender:         document.getElementById('pm_gender')?.value || undefined,
    avatar_url:     document.getElementById('pm_avatar_url')?.value || undefined,
    preferred_game: document.getElementById('pm_preferred_genre')?.value || undefined,
    email_notify:   document.getElementById('pm_email_notify')?.checked,
    whatsapp_notify:document.getElementById('pm_whatsapp_notify')?.checked,
  };

  try {
    const res  = await fetch('/api/profile', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    currentProfile = data.profile;
    updateProfileUI(data.profile);
    if (typeof updateHUD === 'function') updateHUD(data.profile, currentUser);
    if (status) { status.textContent = 'Profile saved!'; status.className = 'visit-status success'; }
    setTimeout(() => closeProfileModal(), 1500);
  } catch (err) {
    if (status) { status.textContent = err.message; status.className = 'visit-status error'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── PROFILE SAVE (setup form) ──────────────────────────────────────────────────
async function saveSetupProfile(e) {
  e.preventDefault();
  const status = document.getElementById('suSaveStatus');
  const btn    = document.getElementById('suSaveBtn');
  if (btn) btn.disabled = true;

  const inviteCode = document.getElementById('su_invite_code')?.value.trim().toUpperCase();
  const body = {
    gamer_tag:      document.getElementById('su_gamer_tag')?.value.trim(),
    full_name:      document.getElementById('su_full_name')?.value.trim(),
    phone:          document.getElementById('su_phone')?.value.trim(),
    county:         document.getElementById('su_county')?.value.trim(),
    platform_id:    document.getElementById('su_platform_id')?.value.trim(),
    gender:         document.getElementById('su_gender')?.value || undefined,
    avatar_url:     document.getElementById('su_avatar_url')?.value || undefined,
    preferred_game: document.getElementById('su_preferred_genre')?.value || undefined,
  };

  if (!body.gamer_tag) {
    if (status) { status.textContent = 'Gamer tag is required.'; status.className = 'visit-status error'; }
    if (btn) btn.disabled = false;
    return;
  }

  try {
    const res  = await fetch('/api/profile', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    currentProfile = data.profile;
    updateProfileUI(data.profile);
    if (typeof updateHUD === 'function') updateHUD(data.profile, currentUser);

    // Apply invite code if provided and not already referred
    if (inviteCode && !data.profile.referred_by) {
      const invRes = await fetch('/api/invite', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invite_code: inviteCode }),
      });
      const invData = await invRes.json();
      if (invData.success) {
        if (status) { status.textContent = 'Profile saved! Invite code applied — you earned 20 bonus points 🎁'; status.className = 'visit-status success'; }
        setTimeout(() => closeProfileSetupModal(), 2200);
        return;
      }
    }

    if (status) { status.textContent = 'Profile saved! Welcome to PhinTech Arena 🎮'; status.className = 'visit-status success'; }
    setTimeout(() => closeProfileSetupModal(), 1800);
  } catch (err) {
    if (status) { status.textContent = err.message; status.className = 'visit-status error'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function showToast(msg, type) {
  const toast = document.createElement('div');
  toast.className = 'license-toast';
  toast.innerHTML = `<ion-icon name="${type === 'success' ? 'checkmark-circle' : 'alert-circle'}"></ion-icon> ${escHtml(msg)}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 50);
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 4000);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check for invite link in URL: ?ref=PHIN-XXXXX
  const urlParams = new URLSearchParams(window.location.search);
  const refCode   = urlParams.get('ref');

  // Persist to sessionStorage so it survives the Google OAuth redirect
  if (refCode) {
    _pendingInvite = refCode.toUpperCase();
    sessionStorage.setItem('pendingInvite', _pendingInvite);
  } else {
    // Recover invite code that was saved before OAuth redirect
    const saved = sessionStorage.getItem('pendingInvite');
    if (saved) _pendingInvite = saved;
  }

  // ── Auth modal wiring ──────────────────────────────────────────────────────
  document.getElementById('headerSignInBtn') ?.addEventListener('click', () => openAuthModal(refCode));
  document.getElementById('arenaSignInBtn')  ?.addEventListener('click', () => openAuthModal(refCode));
  document.getElementById('headerUserBtn')   ?.addEventListener('click', openProfileModal);
  document.getElementById('authModalClose')  ?.addEventListener('click', closeAuthModal);
  document.getElementById('authModal')       ?.addEventListener('click', e => {
    if (e.target === document.getElementById('authModal')) closeAuthModal();
  });

  // Auth tabs
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.authtab));
  });

  // Email sub-tabs
  document.getElementById('emailSignInTab') ?.addEventListener('click', () => switchEmailMode('signin'));
  document.getElementById('emailSignUpTab') ?.addEventListener('click', () => switchEmailMode('signup'));

  // Google
  document.getElementById('googleSignInBtn') ?.addEventListener('click', signInWithGoogle);

  // Magic link
  document.getElementById('magicLinkBtn') ?.addEventListener('click', () => {
    signInWithMagicLink(document.getElementById('magicLinkEmail')?.value.trim());
  });

  // Email sign-in
  document.getElementById('epSignInBtn') ?.addEventListener('click', () => {
    signInWithEmail(
      document.getElementById('epEmail')?.value.trim(),
      document.getElementById('epPassword')?.value
    );
  });
  document.getElementById('epForgotBtn') ?.addEventListener('click', () => sendPasswordReset());

  // Email sign-up
  document.getElementById('epSignUpBtn') ?.addEventListener('click', () => {
    signUpWithEmail(
      document.getElementById('epSignUpEmail')?.value.trim(),
      document.getElementById('epSignUpPassword')?.value,
      document.getElementById('epSignUpConfirm')?.value,
      document.getElementById('epInviteCode')?.value.trim()
    );
  });

  // Invite code validation buttons
  document.getElementById('epInviteCheckBtn') ?.addEventListener('click', () => {
    validateInviteCode(document.getElementById('epInviteCode')?.value.trim(), 'epInviteHint');
  });
  document.getElementById('phoneInviteCheckBtn') ?.addEventListener('click', () => {
    validateInviteCode(document.getElementById('phoneInviteCode')?.value.trim(), 'phoneInviteHint');
  });
  document.getElementById('suInviteCheckBtn') ?.addEventListener('click', () => {
    validateInviteCode(document.getElementById('su_invite_code')?.value.trim(), 'suInviteHint');
  });

  // Auto-validate invite code as user types (debounced)
  ['epInviteCode','phoneInviteCode','su_invite_code'].forEach((id, i) => {
    const hintIds = ['epInviteHint','phoneInviteHint','suInviteHint'];
    const el = document.getElementById(id);
    if (!el) return;
    let timer;
    el.addEventListener('input', () => {
      clearTimeout(timer);
      const val = el.value.trim().toUpperCase();
      el.value = val;
      if (val.length >= 10) {
        timer = setTimeout(() => validateInviteCode(val, hintIds[i]), 600);
      }
    });
  });

  // Phone OTP
  document.getElementById('otpSendBtn') ?.addEventListener('click', () => {
    sendPhoneOtp(
      document.getElementById('otpPhone')?.value.trim(),
      document.getElementById('phoneInviteCode')?.value.trim()
    );
  });
  document.getElementById('otpVerifyBtn') ?.addEventListener('click', () => {
    verifyPhoneOtp(document.getElementById('otpCode')?.value.trim());
  });
  document.getElementById('otpResendBtn') ?.addEventListener('click', () => {
    document.getElementById('phoneInputStep').style.display = 'block';
    document.getElementById('phoneOtpStep').style.display   = 'none';
    clearAuthStatus();
  });

  // Password show/hide toggles
  [['epPwToggle','epPassword'],['epSignUpPwToggle','epSignUpPassword']].forEach(([btnId, inputId]) => {
    document.getElementById(btnId)?.addEventListener('click', () => {
      const input = document.getElementById(inputId);
      if (!input) return;
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      const icon = document.querySelector(`#${btnId} ion-icon`);
      if (icon) icon.setAttribute('name', isText ? 'eye-outline' : 'eye-off-outline');
    });
  });

  // Enter key support in email/phone fields
  document.getElementById('magicLinkEmail') ?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('magicLinkBtn')?.click();
  });
  document.getElementById('epPassword') ?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('epSignInBtn')?.click();
  });
  document.getElementById('otpCode') ?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('otpVerifyBtn')?.click();
  });

  // User area
  document.getElementById('arenaUserBtn')         ?.addEventListener('click', openProfileModal);
  document.getElementById('signOutBtn')            ?.addEventListener('click', signOut);
  document.getElementById('profileModalClose')     ?.addEventListener('click', closeProfileModal);
  document.getElementById('profileSetupModalClose')?.addEventListener('click', closeProfileSetupModal);
  document.getElementById('profileForm')           ?.addEventListener('submit', saveProfile);
  document.getElementById('setupForm')             ?.addEventListener('submit', saveSetupProfile);

  // Notifications
  document.getElementById('notifBell')?.addEventListener('click', () => {
    document.getElementById('notifDropdown')?.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.arena-notif-wrap'))
      document.getElementById('notifDropdown')?.classList.remove('open');
  });

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeAuthModal(); closeProfileModal(); closeProfileSetupModal(); }
  });

  // Init Supabase auth
  if (window._sb) {
    initAuth();
  } else {
    document.addEventListener('supabase-ready', initAuth);
    setTimeout(() => { if (!currentUser && window._sb) initAuth(); }, 3000);
  }
});

// ── PROFILE TAB SWITCHER ─────────────────────────────────────────────────────
function switchProfileTab(tab) {
  document.querySelectorAll('#profileModal .install-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('#profileModal .install-tab-panel').forEach(p => {
    p.style.display = p.dataset.panel === tab ? 'block' : 'none';
  });
  if (tab === 'profile-tournaments') loadMyTournaments();
}


