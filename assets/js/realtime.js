'use strict';

/**
 * PhinTech Arena — Supabase Realtime Match Engine
 * Powered by PhinTech Solutions, Kenya
 *
 * Two players join a shared channel. Score updates, chat messages,
 * and match events broadcast instantly to both players + all spectators.
 *
 * Architecture:
 *   channel: arena:match:{matchId}
 *   events:
 *     score_update  → player updates their score
 *     match_event   → start, pause, end, dispute
 *     chat_message  → in-match chat between players + spectators
 *     player_join   → player/spectator connected
 *     player_leave  → player/spectator disconnected
 *     presence      → online presence (who's watching)
 */

// ── STATE ─────────────────────────────────────────────────────────────────────

const RT = {
  channel:    null,
  matchId:    null,
  myRole:     null,   // 'p1' | 'p2' | 'spectator'
  myTag:      null,
  connected:  false,
  scores:     { p1: 0, p2: 0 },
  presence:   {},
  chatHistory:[],
};

// ── CONNECT TO MATCH ROOM ─────────────────────────────────────────────────────

function joinMatchRoom(matchId, role, myTag) {
  if (!window._sb) { console.warn('[RT] Supabase not ready'); return; }
  if (RT.channel) leaveMatchRoom(); // leave old room first

  RT.matchId  = matchId;
  RT.myRole   = role;
  RT.myTag    = myTag || 'Spectator';
  RT.scores   = { p1: 0, p2: 0 };
  RT.chatHistory = [];

  const channelName = `arena:match:${matchId}`;
  RT.channel = window._sb.channel(channelName, {
    config: {
      presence: { key: RT.myTag },
      broadcast: { self: true },
    },
  });

  // ── Presence — who's watching ──────────────────────────────────────────────
  RT.channel.on('presence', { event: 'sync' }, () => {
    RT.presence = RT.channel.presenceState();
    updatePresenceUI();
  });

  RT.channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
    newPresences.forEach(p => {
      addChatMessage({ type: 'system', text: `${p.tag || key} joined the match room` });
    });
  });

  RT.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    leftPresences.forEach(p => {
      addChatMessage({ type: 'system', text: `${p.tag || key} left` });
    });
  });

  // ── Score updates (broadcast) ─────────────────────────────────────────────
  RT.channel.on('broadcast', { event: 'score_update' }, ({ payload }) => {
    handleScoreUpdate(payload);
  });

  // ── Match events ──────────────────────────────────────────────────────────
  RT.channel.on('broadcast', { event: 'match_event' }, ({ payload }) => {
    handleMatchEvent(payload);
  });

  // ── Chat messages ─────────────────────────────────────────────────────────
  RT.channel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
    addChatMessage(payload);
  });

  // ── Subscribe & track presence ────────────────────────────────────────────
  RT.channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      RT.connected = true;
      await RT.channel.track({
        tag:  RT.myTag,
        role: RT.myRole,
        joinedAt: new Date().toISOString(),
      });
      updateConnectionUI(true);
      addChatMessage({ type: 'system', text: `You joined as ${RT.myTag} (${RT.myRole})` });
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      RT.connected = false;
      updateConnectionUI(false);
    }
  });
}

function leaveMatchRoom() {
  if (!RT.channel) return;
  RT.channel.unsubscribe();
  RT.channel   = null;
  RT.connected = false;
  updateConnectionUI(false);
}

// ── BROADCAST SCORE UPDATE ────────────────────────────────────────────────────

function broadcastScore(playerRole, score) {
  if (!RT.channel || !RT.connected) return;
  RT.channel.send({
    type:    'broadcast',
    event:   'score_update',
    payload: {
      role:      playerRole,
      score:     score,
      tag:       RT.myTag,
      timestamp: Date.now(),
    },
  });
}

function broadcastMatchEvent(eventType, data = {}) {
  if (!RT.channel || !RT.connected) return;
  RT.channel.send({
    type:    'broadcast',
    event:   'match_event',
    payload: { eventType, by: RT.myTag, ...data, timestamp: Date.now() },
  });
}

function broadcastChat(text) {
  if (!RT.channel || !RT.connected || !text.trim()) return;
  RT.channel.send({
    type:    'broadcast',
    event:   'chat_message',
    payload: {
      tag:       RT.myTag,
      role:      RT.myRole,
      text:      text.trim(),
      timestamp: Date.now(),
    },
  });
}

// ── HANDLE INCOMING ───────────────────────────────────────────────────────────

function handleScoreUpdate(payload) {
  const { role, score, tag } = payload;
  if (role === 'p1') RT.scores.p1 = score;
  if (role === 'p2') RT.scores.p2 = score;
  updateScoreUI();

  // Show toast for the opponent's score change
  if (tag !== RT.myTag) {
    showRealtimeToast(`${tag} updated score: ${score}`, 'score');
  }
}

function handleMatchEvent(payload) {
  const { eventType, by } = payload;
  const msgs = {
    start:   `🟢 Match STARTED by ${by}`,
    pause:   `⏸️ Match paused by ${by}`,
    end:     `🏁 Match ENDED — check results`,
    dispute: `⚠️ ${by} raised a dispute`,
  };
  addChatMessage({ type: 'system', text: msgs[eventType] || `Event: ${eventType} by ${by}` });

  if (eventType === 'end') {
    showRealtimeToast(`Match ended! Final: ${RT.scores.p1} – ${RT.scores.p2}`, 'end');
    finaliseMatchScores();
  }
}

function addChatMessage(msg) {
  RT.chatHistory.push({ ...msg, id: Date.now() + Math.random() });
  if (RT.chatHistory.length > 200) RT.chatHistory.shift();
  renderChat();
}

// ── UI UPDATES ────────────────────────────────────────────────────────────────

function updateScoreUI() {
  // Live match section scores
  const p1Score = document.getElementById('liveP1Score');
  const p2Score = document.getElementById('liveP2Score');
  if (p1Score) {
    const old = parseInt(p1Score.textContent) || 0;
    p1Score.textContent = RT.scores.p1;
    if (RT.scores.p1 !== old) { p1Score.classList.remove('score-pop'); void p1Score.offsetWidth; p1Score.classList.add('score-pop'); }
  }
  if (p2Score) {
    const old = parseInt(p2Score.textContent) || 0;
    p2Score.textContent = RT.scores.p2;
    if (RT.scores.p2 !== old) { p2Score.classList.remove('score-pop'); void p2Score.offsetWidth; p2Score.classList.add('score-pop'); }
  }

  // RT panel scores
  const rtP1 = document.getElementById('rtScoreP1');
  const rtP2 = document.getElementById('rtScoreP2');
  if (rtP1) rtP1.textContent = RT.scores.p1;
  if (rtP2) rtP2.textContent = RT.scores.p2;
}

function updatePresenceUI() {
  const el    = document.getElementById('rtPresenceList');
  const count = document.getElementById('rtViewerCount');
  const people = Object.values(RT.presence).flat();

  if (count) count.textContent = people.length + ' online';
  if (!el) return;

  el.innerHTML = people.slice(0, 8).map(p => `
    <span class="rt-presence-chip" title="${escRt(p.role || 'spectator')}">
      <span class="rt-presence-dot ${p.role === 'p1' ? 'p1' : p.role === 'p2' ? 'p2' : ''}"></span>
      ${escRt(p.tag || '?')}
    </span>`).join('');

  if (people.length > 8) {
    el.innerHTML += `<span class="rt-presence-chip">+${people.length - 8} more</span>`;
  }
}

function updateConnectionUI(connected) {
  const indicator = document.getElementById('rtConnectionStatus');
  const panel     = document.getElementById('rtPanel');
  if (indicator) {
    indicator.textContent = connected ? '🟢 Live' : '🔴 Disconnected';
    indicator.className   = 'rt-connection-status ' + (connected ? 'connected' : 'disconnected');
  }
  if (panel) panel.style.display = connected ? 'flex' : 'none';
}

function renderChat() {
  const el = document.getElementById('rtChatMessages');
  if (!el) return;
  el.innerHTML = RT.chatHistory.slice(-50).map(m => {
    if (m.type === 'system') {
      return `<div class="rt-chat-system">${escRt(m.text)}</div>`;
    }
    const isMe = m.tag === RT.myTag;
    return `
      <div class="rt-chat-msg ${isMe ? 'mine' : ''}">
        <span class="rt-chat-tag ${m.role === 'p1' ? 'p1' : m.role === 'p2' ? 'p2' : ''}">${escRt(m.tag)}</span>
        <span class="rt-chat-text">${escRt(m.text)}</span>
      </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function showRealtimeToast(text, type) {
  const toast = document.createElement('div');
  toast.className = 'rt-toast ' + type;
  toast.innerHTML = `<ion-icon name="${type === 'score' ? 'trophy-outline' : 'flag-outline'}"></ion-icon> ${escRt(text)}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 50);
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 3500);
}

function finaliseMatchScores() {
  // Auto-fill the result form with the live scores
  const yourTag  = document.getElementById('resultYourTag');
  const oppTag   = document.getElementById('resultOpponentTag');
  const myScore  = document.getElementById('resultYourScore');
  const oppScore = document.getElementById('resultOppScore');
  if (!yourTag || !myScore) return;
  yourTag.value  = RT.myTag;
  oppTag.value   = RT.myRole === 'p1'
    ? Object.values(RT.presence).flat().find(p => p.role === 'p2')?.tag || ''
    : Object.values(RT.presence).flat().find(p => p.role === 'p1')?.tag || '';
  myScore.value  = RT.myRole === 'p1' ? RT.scores.p1 : RT.scores.p2;
  oppScore.value = RT.myRole === 'p1' ? RT.scores.p2 : RT.scores.p1;
}

function escRt(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── EXPOSE GLOBALS ────────────────────────────────────────────────────────────

window.RT = RT;
window.joinMatchRoom      = joinMatchRoom;
window.leaveMatchRoom     = leaveMatchRoom;
window.broadcastScore     = broadcastScore;
window.broadcastMatchEvent= broadcastMatchEvent;
window.broadcastChat      = broadcastChat;

// ── MATCH ROOM MODAL UI ───────────────────────────────────────────────────────

let myCurrentScore = 0;

function openMatchRoom(matchId, matchName, gameName, roundName, p1Tag, p2Tag) {
  const profile = typeof getProfile === 'function' ? getProfile() : null;
  const user    = typeof getUser    === 'function' ? getUser()    : null;

  if (!profile?.gamer_tag && !user) {
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }

  const myTag = profile?.gamer_tag || user?.email?.split('@')[0] || 'Spectator';
  let role = 'spectator';
  if (myTag === p1Tag) role = 'p1';
  else if (myTag === p2Tag) role = 'p2';

  myCurrentScore = 0;

  // Populate UI
  const modal = document.getElementById('matchRoomModal');
  if (!modal) return;

  document.getElementById('mrMatchTitle').textContent = matchName || 'Match Room';
  document.getElementById('mrGameName').textContent   = gameName  || '';
  document.getElementById('mrRoundName').textContent  = roundName || '';
  document.getElementById('mrP1Tag').textContent = p1Tag || 'Player 1';
  document.getElementById('mrP2Tag').textContent = p2Tag || 'Player 2';
  document.getElementById('mrMyScore').textContent = '0';

  // Show controls only for active players
  const controls = document.getElementById('mrControls');
  if (controls) controls.style.display = (role === 'p1' || role === 'p2') ? 'block' : 'none';

  // Load avatars from leaderboard if possible
  loadPlayerAvatars(p1Tag, p2Tag);

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Connect to Supabase Realtime
  joinMatchRoom(matchId, role, myTag);

  // Wire chat form
  const chatForm = document.getElementById('rtChatForm');
  if (chatForm && !chatForm._wired) {
    chatForm._wired = true;
    chatForm.addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('rtChatInput');
      if (input?.value.trim()) {
        broadcastChat(input.value.trim());
        input.value = '';
      }
    });
  }
}

function leaveAndCloseMatchRoom() {
  leaveMatchRoom();
  const modal = document.getElementById('matchRoomModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
  myCurrentScore = 0;
}

function changeMyScore(delta) {
  myCurrentScore = Math.max(0, myCurrentScore + delta);
  const el = document.getElementById('mrMyScore');
  if (el) {
    el.textContent = myCurrentScore;
    el.classList.remove('score-pop');
    void el.offsetWidth;
    el.classList.add('score-pop');
  }
  broadcastScore(RT.myRole, myCurrentScore);
}

function confirmEndMatch() {
  const p1 = RT.scores.p1;
  const p2 = RT.scores.p2;
  const winner = p1 > p2 ? document.getElementById('mrP1Tag')?.textContent
               : p2 > p1 ? document.getElementById('mrP2Tag')?.textContent
               : 'Draw';

  const confirmed = confirm(
    `End match?\n\nFinal Score: ${p1} – ${p2}\n` +
    (winner !== 'Draw' ? `Winner: ${winner}` : 'Result: Draw') +
    '\n\nThis will lock the result and notify both players.'
  );

  if (confirmed) {
    broadcastMatchEvent('end', { finalScore: `${p1}-${p2}`, winner });
    // Auto-fill submit form and switch to results tab
    finaliseMatchScores();
    setTimeout(() => {
      if (typeof switchArenaTab === 'function') switchArenaTab('results');
    }, 1500);
  }
}

async function loadPlayerAvatars(p1Tag, p2Tag) {
  try {
    // Try to fetch from leaderboard to get avatar URLs
    const res  = await fetch('/api/leaderboard?limit=100');
    const data = await res.json();
    const players = data.players || [];

    const setAvatar = (tag, imgId, fallbackId) => {
      const p = players.find(x => x.gamer_tag === tag);
      const url = p?.profiles?.avatar_url || null;
      const img = document.getElementById(imgId);
      const fb  = document.getElementById(fallbackId);
      if (img && url) {
        img.src = url;
        img.style.display = 'block';
        if (fb) fb.style.display = 'none';
      } else if (fb) {
        fb.textContent = (tag || '?').slice(0, 2).toUpperCase();
        fb.style.display = 'flex';
        if (img) img.style.display = 'none';
      }
    };

    setAvatar(p1Tag, 'mrP1AvatarImg', 'mrP1AvatarFallback');
    setAvatar(p2Tag, 'mrP2AvatarImg', 'mrP2AvatarFallback');
  } catch (_) {}
}

// ── HOOK INTO ARENA — open match room from tournament card ────────────────────

// Called from tournament cards when a match is ongoing
window.openMatchRoom = openMatchRoom;
window.leaveAndCloseMatchRoom = leaveAndCloseMatchRoom;
window.changeMyScore = changeMyScore;
window.confirmEndMatch = confirmEndMatch;

// ── WIRE INTO LIVE MATCH WATCH BUTTON ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Override the live match Watch button to open the match room instead
  const watchBtn = document.getElementById('liveWatchBtn');
  if (watchBtn) {
    watchBtn.addEventListener('click', e => {
      e.preventDefault();
      const match = typeof liveMatches !== 'undefined' && liveMatches[typeof currentLiveIndex !== 'undefined' ? currentLiveIndex : 0];
      if (match) {
        const id = match.id || 'demo-' + Date.now();
        openMatchRoom(id, match.tournament, match.game, match.round, match.p1?.tag, match.p2?.tag);
      }
    }, { once: false });
  }

  // Close on overlay click
  const modal = document.getElementById('matchRoomModal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) leaveAndCloseMatchRoom();
    });
  }

  // ESC to leave
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('matchRoomModal');
      if (modal?.classList.contains('active')) leaveAndCloseMatchRoom();
    }
  });
});
