'use strict';
/**
 * PhinTech Arena — Community Chat
 * Realtime chat via Supabase Broadcast + Postgres
 * PhinTech Solutions, Kenya
 *
 * Features:
 *  - Live messages via Supabase Realtime
 *  - Admin messages pinned/styled differently
 *  - Announcements banner above chat
 *  - Admin: post announcements, pin messages, delete any message
 *  - Players: send messages, reply to messages
 *  - Guests: read-only
 */

const CHAT = {
  channel:    null,
  open:       false,
  messages:   [],
  replyTo:    null,
  unread:     0,
  PAGE:       50,
};

const ADMIN_UID = '339d5edb-cf04-44c6-920f-1a428e411517'; // phingish@gmail.com

function chatEsc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function chatTimeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff/60000);
  if (m < 1)  return 'now';
  if (m < 60) return m + 'm';
  const h = Math.floor(m/60);
  if (h < 24) return h + 'h';
  return Math.floor(h/24) + 'd';
}

function isAdmin() {
  return typeof getUser === 'function' && getUser()?.id === ADMIN_UID;
}

// ── INIT ──────────────────────────────────────────────────────────────────────
function initChat() {
  if (!window._sb) { document.addEventListener('supabase-ready', initChat, { once: true }); return; }

  injectChatWidget();
  loadAnnouncements();
  loadMessages();
  subscribeRealtime();

  // Re-load when auth changes
  document.addEventListener('profile-loaded', () => {
    // Show admin controls if admin
    document.getElementById('chatAdminBar')?.style.setProperty(
      'display', isAdmin() ? 'flex' : 'none'
    );
    loadMessages(); // refresh with fresh auth state
  });
}

// ── WIDGET HTML ───────────────────────────────────────────────────────────────
function injectChatWidget() {
  if (document.getElementById('chatWidget')) return;

  const widget = document.createElement('div');
  widget.id        = 'chatWidget';
  widget.className = 'chat-widget';
  widget.innerHTML = `
    <!-- Toggle button -->
    <button class="chat-toggle-btn" id="chatToggleBtn" aria-label="Open community chat">
      <ion-icon name="chatbubbles-outline" class="chat-toggle-icon"></ion-icon>
      <ion-icon name="close-outline"       class="chat-toggle-close" style="display:none;"></ion-icon>
      <span class="chat-toggle-label">Community Chat</span>
      <span class="chat-unread-badge" id="chatUnreadBadge" style="display:none;">0</span>
    </button>

    <!-- Chat panel -->
    <div class="chat-panel" id="chatPanel" style="display:none;">

      <!-- Header -->
      <div class="chat-header">
        <div class="chat-header-left">
          <span class="chat-header-dot"></span>
          <span class="chat-header-title">Community Chat</span>
          <span class="chat-online-count" id="chatOnline"></span>
        </div>
        <button class="chat-header-close" id="chatCloseBtn" aria-label="Close chat">
          <ion-icon name="chevron-down-outline"></ion-icon>
        </button>
      </div>

      <!-- Announcements strip -->
      <div id="chatAnnouncements" class="chat-announcements" style="display:none;"></div>

      <!-- Admin bar (announcements + tools) -->
      <div class="chat-admin-bar" id="chatAdminBar" style="display:none;">
        <input type="text" id="chatAnnTitle"   class="chat-ann-input" placeholder="Announcement title" maxlength="80">
        <textarea         id="chatAnnBody"    class="chat-ann-textarea" placeholder="Announcement body..." rows="2" maxlength="500"></textarea>
        <div class="chat-ann-btn-row">
          <select id="chatAnnColor" class="chat-ann-select">
            <option value="purple">🟣 Purple</option>
            <option value="red">🔴 Red (urgent)</option>
            <option value="green">🟢 Green</option>
            <option value="amber">🟡 Amber</option>
            <option value="blue">🔵 Blue</option>
          </select>
          <label class="chat-ann-check"><input type="checkbox" id="chatAnnPinned"> 📌 Pin to top</label>
          <button class="chat-ann-post-btn" id="chatPostAnnBtn">
            <ion-icon name="megaphone-outline"></ion-icon> Post
          </button>
        </div>
        <p class="chat-ann-status" id="chatAnnStatus"></p>
      </div>

      <!-- Reply indicator -->
      <div class="chat-reply-indicator" id="chatReplyIndicator" style="display:none;">
        <ion-icon name="return-down-forward-outline"></ion-icon>
        <span id="chatReplyText">Replying to...</span>
        <button onclick="cancelReply()" class="chat-reply-cancel">✕</button>
      </div>

      <!-- Messages list -->
      <div class="chat-messages" id="chatMessages">
        <p class="chat-empty">Loading messages...</p>
      </div>

      <!-- Input -->
      <div class="chat-input-row" id="chatInputRow">
        <div class="chat-input-wrap" id="chatInputWrap">
          <input type="text" id="chatInput" class="chat-input"
            placeholder="Type a message..." maxlength="500" autocomplete="off">
          <button class="chat-send-btn" id="chatSendBtn" aria-label="Send">
            <ion-icon name="send-outline"></ion-icon>
          </button>
        </div>
        <p class="chat-signin-hint" id="chatSigninHint" style="display:none;">
          <ion-icon name="lock-closed-outline"></ion-icon>
          <a href="#" onclick="openAuthModal?.();return false;">Sign in to chat</a>
        </p>
      </div>

    </div>`;

  document.body.appendChild(widget);
  wireChatEvents();
}

// ── WIRE EVENTS ───────────────────────────────────────────────────────────────
function wireChatEvents() {
  document.getElementById('chatToggleBtn')?.addEventListener('click', toggleChat);
  document.getElementById('chatCloseBtn')?.addEventListener('click',  closeChat);

  const input = document.getElementById('chatInput');
  input?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

  document.getElementById('chatSendBtn')?.addEventListener('click', sendMessage);
  document.getElementById('chatPostAnnBtn')?.addEventListener('click', postAnnouncement);

  // Show/hide input based on auth
  document.addEventListener('profile-loaded', showInputForAuth);
  // Check immediately in case already signed in
  setTimeout(showInputForAuth, 500);
}

function showInputForAuth() {
  const user  = typeof getUser === 'function' ? getUser() : null;
  const wrap  = document.getElementById('chatInputWrap');
  const hint  = document.getElementById('chatSigninHint');
  if (user) {
    if (wrap) wrap.style.display = 'flex';
    if (hint) hint.style.display = 'none';
  } else {
    if (wrap) wrap.style.display = 'none';
    if (hint) hint.style.display = 'flex';
  }
}

// ── TOGGLE ────────────────────────────────────────────────────────────────────
function toggleChat() {
  CHAT.open ? closeChat() : openChat();
}

function openChat() {
  CHAT.open = true;
  document.getElementById('chatPanel')?.style.setProperty('display', 'flex');
  document.getElementById('chatToggleBtn')?.classList.add('open');
  document.querySelector('.chat-toggle-icon')?.style.setProperty('display', 'none');
  document.querySelector('.chat-toggle-close')?.style.setProperty('display', 'block');
  resetUnread();
  scrollChatBottom();

  // Show admin bar if admin
  if (isAdmin()) document.getElementById('chatAdminBar')?.style.setProperty('display', 'flex');
}

function closeChat() {
  CHAT.open = false;
  document.getElementById('chatPanel')?.style.setProperty('display', 'none');
  document.getElementById('chatToggleBtn')?.classList.remove('open');
  document.querySelector('.chat-toggle-icon')?.style.setProperty('display', 'block');
  document.querySelector('.chat-toggle-close')?.style.setProperty('display', 'none');
}

function resetUnread() {
  CHAT.unread = 0;
  const badge = document.getElementById('chatUnreadBadge');
  if (badge) badge.style.display = 'none';
}

function bumpUnread() {
  if (CHAT.open) return;
  CHAT.unread++;
  const badge = document.getElementById('chatUnreadBadge');
  if (badge) { badge.textContent = CHAT.unread; badge.style.display = 'flex'; }
}

// ── LOAD MESSAGES ─────────────────────────────────────────────────────────────
async function loadMessages() {
  try {
    const { data, error } = await window._sb
      .from('chat_messages')
      .select('*')
      .eq('deleted', false)
      .order('created_at', { ascending: true })
      .limit(CHAT.PAGE);

    if (error) throw error;
    CHAT.messages = data || [];
    renderMessages();
  } catch (e) {
    const el = document.getElementById('chatMessages');
    if (el) el.innerHTML = '<p class="chat-empty">Could not load messages.</p>';
  }
}

// ── LOAD ANNOUNCEMENTS ────────────────────────────────────────────────────────
async function loadAnnouncements() {
  try {
    const { data } = await window._sb
      .from('announcements')
      .select('*')
      .eq('active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3);

    const el = document.getElementById('chatAnnouncements');
    if (!el) return;
    if (!data?.length) { el.style.display = 'none'; return; }

    el.style.display = 'block';
    el.innerHTML = data.map(a => `
      <div class="chat-ann-item chat-ann-item--${a.color}">
        <span class="chat-ann-icon">${chatEsc(a.icon)}</span>
        <div>
          <strong>${chatEsc(a.title)}</strong>
          <p>${chatEsc(a.body)}</p>
        </div>
        ${isAdmin() ? `<button class="chat-ann-dismiss" onclick="dismissAnnouncement('${a.id}')">✕</button>` : ''}
      </div>`).join('');
  } catch (_) {}
}

// ── RENDER MESSAGES ───────────────────────────────────────────────────────────
function renderMessages() {
  const el = document.getElementById('chatMessages');
  if (!el) return;

  if (!CHAT.messages.length) {
    el.innerHTML = '<p class="chat-empty">No messages yet. Say hello! 👋</p>';
    return;
  }

  // Pinned messages first, then chronological
  const pinned  = CHAT.messages.filter(m => m.is_pinned);
  const regular = CHAT.messages.filter(m => !m.is_pinned);

  const renderMsg = (m) => {
    const isMe    = typeof getUser === 'function' && getUser()?.id === m.user_id;
    const isAdm   = m.is_admin;
    const isAnn   = m.message_type === 'announcement';
    const isSys   = m.message_type === 'system';

    if (isSys) return `<div class="chat-msg-system">${chatEsc(m.message)}</div>`;

    const replyMsg = m.reply_to ? CHAT.messages.find(x => x.id === m.reply_to) : null;

    return `
      <div class="chat-msg ${isMe?'chat-msg--me':''} ${isAdm?'chat-msg--admin':''} ${isAnn?'chat-msg--announcement':''} ${m.is_pinned?'chat-msg--pinned':''}"
           data-id="${m.id}">
        ${m.is_pinned ? '<span class="chat-pin-label">📌 Pinned</span>' : ''}
        ${isAdm && !isMe ? `<div class="chat-admin-crown" title="Admin">👑</div>` : ''}
        <div class="chat-msg-header">
          ${m.avatar_url ? `<img src="${chatEsc(m.avatar_url)}" class="chat-avatar" alt="" onerror="this.style.display='none'">` : `<span class="chat-avatar-fb">${chatEsc((m.gamer_tag||'?').slice(0,2).toUpperCase())}</span>`}
          <span class="chat-msg-tag ${isAdm?'chat-msg-tag--admin':''}">${chatEsc(m.gamer_tag)}</span>
          ${isAdm ? '<span class="chat-admin-badge">ADMIN</span>' : ''}
          <span class="chat-msg-time">${chatTimeAgo(m.created_at)}</span>
        </div>
        ${replyMsg ? `<div class="chat-reply-quote"><ion-icon name="return-down-forward-outline"></ion-icon> ${chatEsc(replyMsg.gamer_tag)}: ${chatEsc(replyMsg.message.slice(0,60))}${replyMsg.message.length>60?'…':''}</div>` : ''}
        <p class="chat-msg-text">${chatEsc(m.message)}</p>
        <div class="chat-msg-actions">
          <button class="chat-msg-action-btn" onclick="setReply('${m.id}','${chatEsc(m.gamer_tag)}')">↩ Reply</button>
          ${isAdmin() ? `
            <button class="chat-msg-action-btn chat-msg-action-btn--danger" onclick="adminDeleteMsg('${m.id}')">🗑</button>
            <button class="chat-msg-action-btn" onclick="adminPinMsg('${m.id}', ${!m.is_pinned})">📌 ${m.is_pinned?'Unpin':'Pin'}</button>` : ''}
          ${isMe && !isAdm ? `<button class="chat-msg-action-btn chat-msg-action-btn--danger" onclick="deleteOwnMsg('${m.id}')">🗑</button>` : ''}
        </div>
      </div>`;
  };

  el.innerHTML =
    (pinned.length ? `<div class="chat-pinned-section">${pinned.map(renderMsg).join('')}</div><div class="chat-divider">── Recent Messages ──</div>` : '') +
    regular.map(renderMsg).join('');

  scrollChatBottom();
}

function scrollChatBottom() {
  const el = document.getElementById('chatMessages');
  if (el) el.scrollTop = el.scrollHeight;
}

// ── SEND MESSAGE ──────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text  = input?.value.trim();
  if (!text) return;

  const user    = typeof getUser    === 'function' ? getUser()    : null;
  const profile = typeof getProfile === 'function' ? getProfile() : null;

  if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }

  const gamerTag = profile?.gamer_tag || user.email?.split('@')[0] || 'Player';
  const avatarUrl = profile?.avatar_url || null;
  const amAdmin  = user.id === ADMIN_UID;

  if (input) input.value = '';
  input?.focus();

  try {
    const { error } = await window._sb.from('chat_messages').insert({
      user_id:      user.id,
      gamer_tag:    gamerTag,
      avatar_url:   avatarUrl,
      message:      text,
      is_admin:     amAdmin,
      message_type: 'chat',
      reply_to:     CHAT.replyTo || null,
    });
    if (error) throw error;
    cancelReply();
  } catch (e) {
    if (input) input.value = text; // restore on error
    if (typeof showToast === 'function') showToast('Could not send: ' + e.message, 'error');
  }
}

// ── REPLY ─────────────────────────────────────────────────────────────────────
function setReply(msgId, tag) {
  CHAT.replyTo = msgId;
  const indicator = document.getElementById('chatReplyIndicator');
  const text      = document.getElementById('chatReplyText');
  if (indicator) indicator.style.display = 'flex';
  if (text) text.textContent = `Replying to ${tag}`;
  document.getElementById('chatInput')?.focus();
}

function cancelReply() {
  CHAT.replyTo = null;
  const indicator = document.getElementById('chatReplyIndicator');
  if (indicator) indicator.style.display = 'none';
}

window.setReply    = setReply;
window.cancelReply = cancelReply;

// ── ADMIN: DELETE / PIN ───────────────────────────────────────────────────────
async function adminDeleteMsg(id) {
  if (!isAdmin()) return;
  await window._sb.from('chat_messages').update({ deleted: true }).eq('id', id);
  CHAT.messages = CHAT.messages.filter(m => m.id !== id);
  renderMessages();
}

async function deleteOwnMsg(id) {
  const user = typeof getUser === 'function' ? getUser() : null;
  if (!user) return;
  await window._sb.from('chat_messages').update({ deleted: true }).eq('id', id).eq('user_id', user.id);
  CHAT.messages = CHAT.messages.filter(m => m.id !== id);
  renderMessages();
}

async function adminPinMsg(id, pin) {
  if (!isAdmin()) return;
  await window._sb.from('chat_messages').update({ is_pinned: pin }).eq('id', id);
  const msg = CHAT.messages.find(m => m.id === id);
  if (msg) msg.is_pinned = pin;
  renderMessages();
}

window.adminDeleteMsg  = adminDeleteMsg;
window.deleteOwnMsg    = deleteOwnMsg;
window.adminPinMsg     = adminPinMsg;

// ── ADMIN: ANNOUNCEMENTS ──────────────────────────────────────────────────────
async function postAnnouncement() {
  if (!isAdmin()) return;
  const title    = document.getElementById('chatAnnTitle')?.value.trim();
  const body     = document.getElementById('chatAnnBody')?.value.trim();
  const color    = document.getElementById('chatAnnColor')?.value || 'purple';
  const pinned   = document.getElementById('chatAnnPinned')?.checked || false;
  const statusEl = document.getElementById('chatAnnStatus');

  if (!title || !body) {
    if (statusEl) { statusEl.textContent = 'Title and body required.'; statusEl.style.color = '#f44336'; }
    return;
  }

  const btn = document.getElementById('chatPostAnnBtn');
  if (btn) btn.disabled = true;
  if (statusEl) { statusEl.textContent = 'Posting...'; statusEl.style.color = ''; }

  try {
    const token = typeof getToken === 'function' ? getToken() : null;
    const { error } = await window._sb.from('announcements').insert({
      title, body, color, pinned, active: true, icon: '📢',
    });
    if (error) throw error;

    // Also post as a pinned chat message so it appears inline
    const user    = typeof getUser    === 'function' ? getUser()    : null;
    const profile = typeof getProfile === 'function' ? getProfile() : null;
    await window._sb.from('chat_messages').insert({
      user_id:      user?.id,
      gamer_tag:    '📢 PhinTech Arena',
      avatar_url:   null,
      message:      `📢 ANNOUNCEMENT: ${title}\n${body}`,
      is_admin:     true,
      is_pinned:    pinned,
      message_type: 'announcement',
    });

    // Clear form
    document.getElementById('chatAnnTitle').value = '';
    document.getElementById('chatAnnBody').value  = '';
    if (statusEl) { statusEl.textContent = '✅ Announcement posted!'; statusEl.style.color = '#22c55e'; }
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
    loadAnnouncements();
  } catch (e) {
    if (statusEl) { statusEl.textContent = e.message; statusEl.style.color = '#f44336'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function dismissAnnouncement(id) {
  if (!isAdmin()) return;
  await window._sb.from('announcements').update({ active: false }).eq('id', id);
  loadAnnouncements();
}

window.dismissAnnouncement = dismissAnnouncement;

// ── REALTIME SUBSCRIPTION ─────────────────────────────────────────────────────
function subscribeRealtime() {
  if (!window._sb) return;

  CHAT.channel = window._sb
    .channel('arena:community-chat')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'deleted=eq.false' },
      (payload) => {
        const msg = payload.new;
        if (!msg || msg.deleted) return;
        // Avoid duplicate from our own insert
        if (!CHAT.messages.find(m => m.id === msg.id)) {
          CHAT.messages.push(msg);
          renderMessages();
          bumpUnread();
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
      (payload) => {
        const updated = payload.new;
        const idx     = CHAT.messages.findIndex(m => m.id === updated.id);
        if (updated.deleted) {
          CHAT.messages = CHAT.messages.filter(m => m.id !== updated.id);
        } else if (idx > -1) {
          CHAT.messages[idx] = updated;
        }
        renderMessages();
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'announcements' },
      () => loadAnnouncements()
    )
    .on(
      'presence', { event: 'sync' },
      () => {
        const count = Object.keys(CHAT.channel?.presenceState?.() || {}).length;
        const el    = document.getElementById('chatOnline');
        if (el && count > 0) el.textContent = count + ' online';
      }
    )
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const user = typeof getUser === 'function' ? getUser() : null;
        if (user) {
          await CHAT.channel.track({ user_id: user.id });
        }
      }
    });
}

// ── AUTO-INIT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (window._sb) {
    initChat();
  } else {
    document.addEventListener('supabase-ready', initChat, { once: true });
  }
});
