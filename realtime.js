/* ============================================================
   REALTIME.JS — SSE / Polling for Real-Time Updates
   ============================================================ */

'use strict';

let eventSource  = null;
let pollInterval = null;
let lastNoticeTs = null;

// ─── Initialize Real-Time ─────────────────────────────────────
function initRealtime() {
  lastNoticeTs = Date.now();

  // Try SSE first (requires backend)
  trySSE();

  // Fallback: polling every 15 seconds
  pollInterval = setInterval(pollForUpdates, 15000);

  // Also check scheduled notices every minute
  setInterval(checkScheduledNotices, 60000);
}

function trySSE() {
  try {
    const token = getToken();
    if (!token || token.startsWith('local-')) {
      console.log('[Realtime] Using polling (no backend token)');
      return;
    }
    eventSource = new EventSource(
      `${DNB.apiBase}/notices/stream?token=${encodeURIComponent(token)}`
    );
    eventSource.onmessage = handleSSEMessage;
    eventSource.onerror   = () => {
      eventSource?.close();
      eventSource = null;
      console.log('[Realtime] SSE failed, using polling');
    };
    console.log('[Realtime] SSE connected');
  } catch (err) {
    console.warn('[Realtime] SSE not available:', err.message);
  }
}

function handleSSEMessage(e) {
  try {
    const data = JSON.parse(e.data);
    handleRealtimeEvent(data);
  } catch { /* ignore parse errors */ }
}

// ─── Polling ─────────────────────────────────────────────────
function pollForUpdates() {
  // Simulate real-time by checking if notices changed externally
  const notices = getNotices();
  const latest  = notices[0]?.createdAt ? new Date(notices[0].createdAt).getTime() : 0;

  // Check scheduled notices ready to publish
  checkScheduledNotices();

  // Simulate occasional new notices in demo mode
  if (Math.random() < 0.05 && DNB.currentUser) { // 5% chance
    simulateRealtimeNotice();
  }
}

function simulateRealtimeNotice() {
  // Show "new notice" banner on relevant pages
  if (DNB.currentPage === 'allnotices' || DNB.currentPage === 'dashboard') {
    showRealtimeBanner('📢 New content available — click to refresh');
  }
}

// ─── Check Scheduled ─────────────────────────────────────────
function checkScheduledNotices() {
  const now     = Date.now();
  const notices = getNotices();
  let   updated = false;

  notices.forEach(n => {
    if (n.scheduled && n.publishAt) {
      if (new Date(n.publishAt).getTime() <= now) {
        n.scheduled = false;
        n.publishAt = null;
        n.createdAt = new Date().toISOString();
        updated     = true;
        showToast(`📢 Scheduled notice "${truncate(n.title, 40)}" is now live!`, 'info');
        addNotification({
          id: generateId(), type: 'publish',
          title: '📢 Scheduled Notice Published',
          text: n.title, time: new Date().toISOString(), read: false,
        });
      }
    }
    // Auto-expire
    if (!n.expired && n.expiry && new Date(n.expiry).getTime() <= now) {
      n.expired = true;
      updated   = true;
    }
  });

  if (updated) {
    saveNotices(notices);
    updateTicker();
    if (DNB.currentPage === 'dashboard') renderDashboard();
  }
}

// ─── Handle Events ────────────────────────────────────────────
function handleRealtimeEvent(data) {
  switch (data.type) {
    case 'NOTICE_CREATED':
      handleNewNotice(data.payload);
      break;
    case 'NOTICE_UPDATED':
      handleNoticeUpdated(data.payload);
      break;
    case 'NOTICE_DELETED':
      handleNoticeDeleted(data.payload.id);
      break;
    case 'NOTICE_PINNED':
      handleNoticePinned(data.payload);
      break;
    default:
      break;
  }
}

function handleNewNotice(notice) {
  const notices = getNotices();
  if (!notices.find(n => n.id === notice.id)) {
    notices.unshift(notice);
    saveNotices(notices);
    showToast(`📢 New notice: "${truncate(notice.title, 40)}"`, 'info');
    showRealtimeBanner('📢 New notice received!');
    updateTicker();
    addNotification({
      id: generateId(), type: 'notice',
      title: '📢 New Notice',
      text: notice.title,
      time: new Date().toISOString(),
      read: false,
    });
    if (DNB.currentPage === 'dashboard') renderDashboard();
    if (DNB.currentPage === 'allnotices') renderAllNotices();
  }
}

function handleNoticeUpdated(notice) {
  const notices = getNotices();
  const idx = notices.findIndex(n => n.id === notice.id);
  if (idx > -1) {
    notices[idx] = { ...notices[idx], ...notice };
    saveNotices(notices);
    showToast(`✏️ Notice updated: "${truncate(notice.title, 35)}"`, 'info');
    if (DNB.currentPage === 'dashboard' || DNB.currentPage === 'allnotices') {
      renderDashboard();
      renderAllNotices();
    }
  }
}

function handleNoticeDeleted(id) {
  const notices = getNotices().filter(n => n.id !== id);
  saveNotices(notices);
  showToast('🗑️ A notice was removed', 'info');
  if (DNB.currentPage === 'dashboard') renderDashboard();
  if (DNB.currentPage === 'allnotices') renderAllNotices();
}

function handleNoticePinned(notice) {
  const notices = getNotices();
  const n = notices.find(x => x.id === notice.id);
  if (n) {
    n.pinned = notice.pinned;
    saveNotices(notices);
    if (DNB.currentPage === 'dashboard') renderPinnedScroll();
  }
}

// ─── Real-Time Banner ─────────────────────────────────────────
let banner = null;
function showRealtimeBanner(text) {
  if (banner) banner.remove();
  banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;top:110px;left:50%;transform:translateX(-50%);
    background:var(--grad-primary);color:#fff;
    padding:10px 20px;border-radius:30px;font-size:0.85rem;font-weight:600;
    z-index:900;cursor:pointer;
    box-shadow:0 4px 20px rgba(108,99,255,0.4);
    animation:slideDown 0.3s ease;
  `;
  banner.textContent = text;
  banner.onclick = () => {
    banner.remove();
    if (DNB.currentPage === 'dashboard') renderDashboard();
    if (DNB.currentPage === 'allnotices') renderAllNotices();
  };
  document.body.appendChild(banner);
  setTimeout(() => banner?.remove(), 8000);
}

// ─── Cleanup ──────────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  eventSource?.close();
  clearInterval(pollInterval);
});

function truncate(str, len) {
  return str.length > len ? str.substring(0, len) + '…' : str;
}
