/* ============================================================
   NOTIFICATIONS.JS — Push Notifications, Browser Alerts,
                       Notification Panel, Email/SMS (simulated)
   ============================================================ */

'use strict';

// ─── Initialize Push Notifications ───────────────────────────
function initPushNotifications() {
  if ('Notification' in window && Notification.permission === 'default') {
    // Request permission after a short delay
    setTimeout(() => requestNotifPermission(), 3000);
  }
  renderNotifPanel();
}

async function requestNotifPermission() {
  try {
    const status = await Notification.requestPermission();
    if (status === 'granted') {
      showToast('🔔 Push notifications enabled!', 'success');
    }
  } catch { /* denied */ }
}

// ─── Push a Browser Notification ─────────────────────────────
function pushBrowserNotif(title, body, icon = '📋') {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const notif = new Notification(title, {
    body,
    icon: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${icon}</text></svg>`,
    badge: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📋</text></svg>`,
    tag: 'noticeboard',
    renotify: true,
  });

  notif.onclick = () => {
    window.focus();
    notif.close();
  };

  setTimeout(() => notif.close(), 8000);
}

// ─── In-App Notification Storage ─────────────────────────────
function addNotification(notif) {
  const notifs = getNotifications();
  notifs.unshift(notif);
  // Keep only latest 50
  if (notifs.length > 50) notifs.splice(50);
  saveNotifications(notifs);
  updateNotifBadge();
  renderNotifPanel();
  pushBrowserNotif(notif.title, notif.text, '📢');
}

// ─── Render Notification Panel ────────────────────────────────
function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) renderNotifPanel();
}

function renderNotifPanel() {
  const body = document.getElementById('notifBody');
  if (!body) return;

  const notifs = getNotifications();
  if (!notifs.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding:30px;">
        <div class="empty-icon">🔔</div>
        <h3>No notifications</h3>
        <p>You're all caught up!</p>
      </div>`;
    return;
  }

  body.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markRead('${n.id}')">
      ${!n.read ? '<div class="notif-dot"></div>' : '<div style="width:8px;"></div>'}
      <div>
        <div class="notif-text">${n.title}</div>
        <div class="notif-text" style="margin-top:2px;color:var(--text);">${n.text}</div>
        <div class="notif-time">🕐 ${timeAgo(n.time)}</div>
      </div>
    </div>`).join('');
}

function markRead(id) {
  const notifs = getNotifications();
  const n = notifs.find(x => x.id === id);
  if (n) { n.read = true; saveNotifications(notifs); updateNotifBadge(); renderNotifPanel(); }
}

function markAllRead() {
  const notifs = getNotifications();
  notifs.forEach(n => n.read = true);
  saveNotifications(notifs);
  updateNotifBadge();
  renderNotifPanel();
  showToast('All notifications marked as read', 'success');
}

// ─── Send Notification (Admin) ────────────────────────────────
function selectNotifType(type, btn) {
  document.getElementById('notifType').value = type;
  document.querySelectorAll('.notif-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Show/hide type-specific fields
  document.getElementById('emailFields').classList.toggle('hidden', type !== 'email');
  document.getElementById('smsFields').classList.toggle('hidden', type !== 'sms');
}

async function sendNotification() {
  const type    = document.getElementById('notifType').value;
  const target  = document.getElementById('notifTarget').value;
  const title   = document.getElementById('notifTitle').value.trim();
  const message = document.getElementById('notifMessage').value.trim();

  if (!title || !message) {
    showToast('Title and message are required', 'error'); return;
  }

  const typeLabels = { push: '🔔 Push', email: '✉️ Email', sms: '📱 SMS' };

  // Simulate sending
  showToast(`Sending ${typeLabels[type]} notification to ${target} users…`, 'info');

  // Try API
  try {
    await apiRequest('POST', '/notifications/send', { type, target, title, message });
  } catch { /* fallback */ }

  await new Promise(r => setTimeout(r, 1200));

  if (type === 'push') {
    // Push to all local users as in-app notif
    addNotification({
      id: generateId(), type: 'admin', title, text: message,
      time: new Date().toISOString(), read: false,
    });
    pushBrowserNotif(title, message, '📢');
  }

  showToast(`${typeLabels[type]} notification sent successfully! ✅`, 'success');

  // Clear form
  document.getElementById('notifTitle').value   = '';
  document.getElementById('notifMessage').value = '';
}

function scheduleNotification() {
  showToast('Scheduled notifications require backend integration (Spring @Scheduled)', 'info');
}

// ─── Seed Notifications ───────────────────────────────────────
(function seedNotifications() {
  const existing = JSON.parse(localStorage.getItem('dnb-notifications') || 'null');
  if (!existing) {
    const seed = [
      { id: 'notif1', type: 'notice',  title: '📢 New Notice Added',      text: 'Annual Tech Fest 2026 — Registration Open!', time: new Date(Date.now()-3600000).toISOString(),  read: false },
      { id: 'notif2', type: 'notice',  title: '🚨 Urgent Notice',          text: 'FYP Submission Deadline Extended',            time: new Date(Date.now()-7200000).toISOString(),  read: false },
      { id: 'notif3', type: 'system',  title: '✅ System',                  text: 'Welcome to Digital Notice Board System',      time: new Date(Date.now()-86400000).toISOString(), read: true  },
      { id: 'notif4', type: 'publish', title: '💼 Placement Drive Notice',  text: 'TCS, Infosys, Wipro campus drive scheduled',  time: new Date(Date.now()-1800000).toISOString(),  read: false },
    ];
    saveNotifications(seed);
  }
})();
