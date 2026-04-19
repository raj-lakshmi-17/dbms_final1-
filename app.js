/* ============================================================
   APP.JS — Core App: Router, Theme, Utils, Auth Guard, Toast
   ============================================================ */

'use strict';

// ─── App State ───────────────────────────────────────────────
const DNB = {
  version:    '1.0.0',
  apiBase:    'http://localhost:8080/api',
  currentUser: null,
  currentPage: 'dashboard',
  notices:    [],
  users:      [],
  notifCount: 0,
  theme:      localStorage.getItem('dnb-theme') || 'light',
  view:       'grid',
};

// ─── Initialization ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(DNB.theme);
  initApp();
});

function initApp() {
  const user = getStoredUser();
  if (!user) {
    // If on dashboard, redirect to login
    if (window.location.pathname.includes('dashboard')) {
      window.location.href = 'index.html';
      return;
    }
    return;
  }

  DNB.currentUser = user;
  setupUI();
  showPage('dashboard');
  initRealtime();
  initPushNotifications();
  checkExpiredNotices();
}

function setupUI() {
  const u = DNB.currentUser;
  if (!u) return;

  // Update sidebar & topbar
  const avatar   = u.name ? u.name.charAt(0).toUpperCase() : 'U';
  const sidebarAv = document.getElementById('sidebarAvatar');
  const topbarAv  = document.getElementById('topbarAvatar');
  if (sidebarAv) sidebarAv.textContent = avatar + (sidebarAv.innerHTML.includes('status-dot') ? '' : '');
  if (topbarAv)  topbarAv.textContent   = avatar;

  const sidebarName = document.getElementById('sidebarName');
  const sidebarRole = document.getElementById('sidebarRole');
  const menuName    = document.getElementById('menuName');
  const menuEmail   = document.getElementById('menuEmail');

  if (sidebarName) sidebarName.textContent = u.name;
  if (sidebarRole) sidebarRole.textContent = formatRole(u.role);
  if (menuName)    menuName.textContent    = u.name;
  if (menuEmail)   menuEmail.textContent   = u.email;

  // Role-based nav
  const adminSections = document.querySelectorAll('.admin-only, #adminNavSection');
  if (u.role === 'user') {
    adminSections.forEach(el => el.style.display = 'none');
  } else {
    adminSections.forEach(el => el.style.display = '');
  }

  // Mobile hamburger
  const hamburger = document.getElementById('sidebarToggle');
  if (hamburger && window.innerWidth <= 768) hamburger.style.display = 'flex';

  setWelcomeMessage();
  updateThemeBtn();
}

function setWelcomeMessage() {
  const el = document.getElementById('welcomeMsg');
  if (!el) return;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  el.textContent = `${greeting}, ${DNB.currentUser?.name?.split(' ')[0] || 'User'}! 👋`;
}

// ─── Page Router ─────────────────────────────────────────────
function showPage(page) {
  DNB.currentPage = page;

  // Hide all pages
  document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));

  // Show target page
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('animate-fade-in');
    setTimeout(() => target.classList.remove('animate-fade-in'), 600);
  }

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');

  // Update topbar title
  const titles = {
    dashboard:    ['Dashboard',          'Welcome back to your notice board'],
    allnotices:   ['All Notices',        'Browse and filter all notices'],
    pinned:       ['Pinned Notices',     'Important notices pinned by admins'],
    scheduled:    ['Scheduled Notices',  'Posts scheduled for future publishing'],
    liked:        ['Liked Notices',      'Notices you have liked or acknowledged'],
    mycomments:   ['My Comments',        'Your comments and feedback on notices'],
    admin:        ['Manage Notices',     'Create, edit and schedule notices'],
    users:        ['User Management',    'Manage users and their roles'],
    analytics:    ['Analytics',          'Engagement and usage statistics'],
    notifications:['Send Notification',  'Broadcast alerts via Push, Email or SMS'],
    profile:      ['My Profile',         'Your account settings'],
    settings:     ['Settings',           'Preferences and configuration'],
  };

  const titleEl    = document.getElementById('pageTitle');
  const subtitleEl = document.getElementById('pageSubtitle');
  if (titleEl && titles[page]) titleEl.textContent    = titles[page][0];
  if (subtitleEl && titles[page]) subtitleEl.textContent = titles[page][1];

  // View toggle visibility
  const viewToggle = document.getElementById('viewToggle');
  if (viewToggle) {
    viewToggle.style.display = (page === 'allnotices' || page === 'dashboard') ? 'flex' : 'none';
  }

  // Page-specific setup
  if (page === 'dashboard')    renderDashboard();
  if (page === 'allnotices')   renderAllNotices();
  if (page === 'pinned')       renderPinnedPage();
  if (page === 'scheduled')    renderScheduledPage();
  if (page === 'liked')        renderLikedPage();
  if (page === 'mycomments')   renderMyComments();
  if (page === 'admin')        renderAdminPage();
  if (page === 'users')        renderUsersPage();
  if (page === 'analytics')    renderAnalyticsPage();

  // Close mobile sidebar
  if (window.innerWidth <= 768) closeSidebar();
}

// ─── Theme ───────────────────────────────────────────────────
function toggleTheme() {
  DNB.theme = DNB.theme === 'light' ? 'dark' : 'light';
  applyTheme(DNB.theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('dnb-theme', theme);
  DNB.theme = theme;
  updateThemeBtn();
}

function updateThemeBtn() {
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = DNB.theme === 'dark' ? '☀️' : '🌙';
  const authBtn = document.getElementById('themeToggleAuth');
  if (authBtn) authBtn.textContent = DNB.theme === 'dark' ? '☀️' : '🌙';
}

// ─── Sidebar ─────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('open');
}

function closeSidebar() {
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.remove('open');
}

// ─── User Menu ───────────────────────────────────────────────
function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  if (menu) menu.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('userMenu');
  if (menu && !menu.classList.contains('hidden')) {
    if (!e.target.closest('#userMenu') && !e.target.closest('#sidebarAvatar') &&
        !e.target.closest('#topbarAvatar')) {
      menu.classList.add('hidden');
    }
  }
  const notifPanel = document.getElementById('notifPanel');
  if (notifPanel && !notifPanel.classList.contains('hidden')) {
    if (!e.target.closest('#notifPanel') && !e.target.closest('#notifBtn')) {
      notifPanel.classList.add('hidden');
    }
  }
});

// ─── Logout ──────────────────────────────────────────────────
function handleLogout() {
  localStorage.removeItem('dnb-user');
  localStorage.removeItem('dnb-token');
  showToast('Logged out successfully', 'info');
  setTimeout(() => window.location.href = 'index.html', 800);
}

// ─── Auth Helpers ─────────────────────────────────────────────
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('dnb-user')); } catch { return null; }
}

function storeUser(user) {
  localStorage.setItem('dnb-user', JSON.stringify(user));
}

function getToken() { return localStorage.getItem('dnb-token'); }
function storeToken(t) { localStorage.setItem('dnb-token', t); }

// ─── API Helper ──────────────────────────────────────────────
async function apiRequest(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const resp = await fetch(`${DNB.apiBase}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (resp.status === 401) {
      handleLogout();
      return null;
    }

    return await resp.json();
  } catch (err) {
    // Backend not available — use localStorage
    console.warn('API not available, using local data:', err.message);
    return null;
  }
}

// ─── Toast Notifications ─────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span>${message}</span>
    <span class="toast-close" onclick="removeToast(this.parentElement)">✕</span>`;

  container.appendChild(toast);

  setTimeout(() => removeToast(toast), duration);
}

function removeToast(el) {
  if (!el || !el.parentElement) return;
  el.classList.add('removing');
  setTimeout(() => el.remove(), 300);
}

// ─── Modal Helpers ────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function closeModalOutside(event, id) {
  if (event.target === event.currentTarget) closeModal(id);
}

// ─── Search ──────────────────────────────────────────────────
let searchTimer;
function handleSearch(query) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = query.toLowerCase().trim();
    if (DNB.currentPage === 'dashboard' || DNB.currentPage === 'allnotices') {
      showPage('allnotices');
      renderAllNotices(q);
    }
  }, 300);
}

// ─── View Toggle ─────────────────────────────────────────────
function setView(v) {
  DNB.view = v;
  document.getElementById('gridViewBtn')?.classList.toggle('active', v === 'grid');
  document.getElementById('listViewBtn')?.classList.toggle('active', v === 'list');

  ['allNoticesGrid','recentNoticesGrid','pinnedGrid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('list-view', v === 'list');
    }
  });
}

// ─── Utility ─────────────────────────────────────────────────
function formatRole(r) {
  return { admin: '👑 Admin', staff: '👔 Staff', user: '👤 User' }[r] || r;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr) {
  const d   = new Date(dateStr);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  const soon   = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
  return expiry > new Date() && expiry <= soon;
}

function checkExpiredNotices() {
  const notices = getNotices();
  const now = new Date();
  let changed = false;
  notices.forEach(n => {
    if (n.expiry && new Date(n.expiry) < now && !n.expired) {
      n.expired = true;
      changed = true;
    }
  });
  if (changed) saveNotices(notices);
}

// ─── LocalStorage DB ─────────────────────────────────────────
function getNotices() {
  try { return JSON.parse(localStorage.getItem('dnb-notices')) || getSeedNotices(); }
  catch { return getSeedNotices(); }
}

function saveNotices(notices) {
  localStorage.setItem('dnb-notices', JSON.stringify(notices));
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem('dnb-users')) || getSeedUsers(); }
  catch { return getSeedUsers(); }
}

function saveUsers(users) {
  localStorage.setItem('dnb-users', JSON.stringify(users));
}

function getNotifications() {
  try { return JSON.parse(localStorage.getItem('dnb-notifications')) || []; }
  catch { return []; }
}

function saveNotifications(n) { localStorage.setItem('dnb-notifications', JSON.stringify(n)); }

// ─── Seed Data ────────────────────────────────────────────────
function getSeedUsers() {
  const users = [
    { id: 'u1', name: 'Admin User',  email: 'admin@notice.com', password: 'admin123', role: 'admin',  dept: 'Administration', active: true,  joined: '2025-01-01' },
    { id: 'u2', name: 'Staff Member',email: 'staff@notice.com', password: 'staff123', role: 'staff',  dept: 'Academics',       active: true,  joined: '2025-02-15' },
    { id: 'u3', name: 'Regular User', email: 'user@notice.com',  password: 'user123',  role: 'user',   dept: 'Student',         active: true,  joined: '2025-03-10' },
    { id: 'u4', name: 'Priya Sharma', email: 'priya@notice.com', password: 'priya123', role: 'staff',  dept: 'Cultural',        active: true,  joined: '2025-01-20' },
  ];
  localStorage.setItem('dnb-users', JSON.stringify(users));
  return users;
}

function getSeedNotices() {
  const now   = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1);
  const nextWeek = new Date(now); nextWeek.setDate(nextWeek.getDate()+7);
  const nextMonth = new Date(now); nextMonth.setDate(nextMonth.getDate()+30);
  const past  = new Date(now); past.setDate(past.getDate()-2);

  const notices = [
    {
      id: 'n1', title: '🎓 Annual Tech Fest 2026 — Registration Open!',
      content: 'We are thrilled to announce that the Annual Tech Fest 2026 is here! This year\'s fest will feature hackathons, coding competitions, robotics showcases, AI exhibitions, and guest lectures from industry leaders.\n\nRegistration is now open for all students. Teams of 2-4 members are encouraged. Various prizes worth ₹5 Lakhs+ are up for grabs!\n\nLast date to register: April 10, 2026.',
      category: 'event', priority: 'high', author: 'Admin User', authorId: 'u1',
      pinned: true, likes: 42, likedBy: [], comments: [], views: 320,
      createdAt: new Date(now.getTime()-86400000*2).toISOString(),
      expiry: nextMonth.toISOString(), expired: false, scheduled: false,
      mediaUrl: null,
    },
    {
      id: 'n2', title: '🚨 Urgent: Submission Deadline Extended — Final Year Project',
      content: 'Due to technical issues with the submission portal, the deadline for Final Year Project submissions has been extended to March 28, 2026.\n\nStudents must submit a soft copy via the portal and a hard copy to their respective departments.\n\nFor queries, contact: fyp@university.edu | +91-9876543210',
      category: 'urgent', priority: 'critical', author: 'Staff Member', authorId: 'u2',
      pinned: true, likes: 88, likedBy: [], comments: [], views: 654,
      createdAt: new Date(now.getTime()-86400000*1).toISOString(),
      expiry: new Date(now.getTime()+86400000*9).toISOString(), expired: false, scheduled: false,
      mediaUrl: null,
    },
    {
      id: 'n3', title: '📅 Mid-Semester Examination Schedule Released',
      content: 'The Mid-Semester Examination (MSE) schedule for the Spring 2026 semester has been officially released. Students can download the complete timetable from the academic portal.\n\nExam dates: April 5–15, 2026\nVenue: Examination Hall, Block B\n\nNote: Students must carry their ID cards and admit cards.',
      category: 'exam', priority: 'high', author: 'Admin User', authorId: 'u1',
      pinned: false, likes: 65, likedBy: [], comments: [], views: 410,
      createdAt: new Date(now.getTime()-86400000*3).toISOString(),
      expiry: new Date(now.getTime()+86400000*20).toISOString(), expired: false, scheduled: false,
      mediaUrl: null,
    },
    {
      id: 'n4', title: '💼 Campus Placement Drive — TCS, Infosys, Wipro',
      content: 'A mega campus placement drive is scheduled for March 25–27, 2026. The following companies will be visiting:\n\n🏢 TCS — 150+ openings (B.E/B.Tech)\n🏢 Infosys — 80+ openings (All branches)\n🏢 Wipro — 60+ openings (CS, IT, Electronics)\n\nEligibility: 60%+ throughout, no active backlogs.\nRegistration deadline: March 22, 2026\n\nContact the Placement Cell for details.',
      category: 'placement', priority: 'high', author: 'Priya Sharma', authorId: 'u4',
      pinned: true, likes: 120, likedBy: [], comments: [], views: 890,
      createdAt: new Date(now.getTime()-86400000*1).toISOString(),
      expiry: new Date(now.getTime()+86400000*6).toISOString(), expired: false, scheduled: false,
      mediaUrl: null,
    },
    {
      id: 'n5', title: '🎨 Cultural Fest Rehearsals — Venue Change',
      content: 'Kindly note that the Cultural Fest rehearsals scheduled for this week have been shifted to the Main Auditorium (Ground Floor, Block A) instead of the originally announced Open Air Theatre.\n\nThis change is due to renovation work at the Open Air Theatre. Inconvenience is regretted.',
      category: 'cultural', priority: 'normal', author: 'Priya Sharma', authorId: 'u4',
      pinned: false, likes: 23, likedBy: [], comments: [], views: 155,
      createdAt: new Date(now.getTime()-86400000*4).toISOString(),
      expiry: tomorrow.toISOString(), expired: false, scheduled: false,
      mediaUrl: null,
    },
    {
      id: 'n6', title: '📚 Library Extended Hours During Exams',
      content: 'The central library will remain open 24/7 during the examination period (April 1–20, 2026). Students can access all reading rooms, digital lab, and reference materials round the clock.\n\nWifi password for extended hours: Library@2026\n\nSilence must be maintained at all times.',
      category: 'academic', priority: 'normal', author: 'Staff Member', authorId: 'u2',
      pinned: false, likes: 45, likedBy: [], comments: [], views: 298,
      createdAt: new Date(now.getTime()-86400000*5).toISOString(),
      expiry: new Date(now.getTime()+86400000*32).toISOString(), expired: false, scheduled: false,
      mediaUrl: null,
    },
    {
      id: 'n7', title: '⚽ Inter-College Sports Tournament Registration',
      content: 'Registrations are now open for the Annual Inter-College Sports Tournament 2026. Events include:\n\n🏏 Cricket, ⚽ Football, 🏸 Badminton, 🏊 Swimming, 🏃 Athletics\n\nTeams must register before March 30. Contact the Sports Department or visit sproreg.university.edu',
      category: 'sports', priority: 'normal', author: 'Admin User', authorId: 'u1',
      pinned: false, likes: 31, likedBy: [], comments: [], views: 187,
      createdAt: new Date(now.getTime()-86400000*2).toISOString(),
      expiry: new Date(now.getTime()+86400000*11).toISOString(), expired: false, scheduled: false,
      mediaUrl: null,
    },
    {
      id: 'n8', title: '📢 Holiday Notice — Holi Festival',
      content: 'The institution will remain closed on March 25, 2026 on account of Holi – The Festival of Colors.\n\nClasses, labs, and administrative offices will resume on March 26, 2026. Enjoy the festival responsibly!',
      category: 'general', priority: 'normal', author: 'Admin User', authorId: 'u1',
      pinned: false, likes: 56, likedBy: [], comments: [], views: 432,
      createdAt: new Date(now.getTime()-86400000*1).toISOString(),
      expiry: new Date(now.getTime()+86400000*7).toISOString(), expired: false, scheduled: false,
      mediaUrl: null,
    },
    {
      id: 'n9', title: '🔬 Guest Lecture: AI & Machine Learning Trends',
      content: 'The Computer Science Department is pleased to announce a Guest Lecture by Dr. Rajesh Kumar, Senior Researcher at Google DeepMind.\n\nTopic: "AI Trends Shaping the Future of Technology"\nDate: April 2, 2026 | Time: 11:00 AM – 1:00 PM\nVenue: Seminar Hall, Block C\n\nAll students are encouraged to attend.',
      category: 'academic', priority: 'high', author: 'Staff Member', authorId: 'u2',
      pinned: false, likes: 78, likedBy: [], comments: [], views: 512,
      createdAt: new Date(now.getTime()-86400000*1).toISOString(),
      expiry: new Date(now.getTime()+86400000*14).toISOString(), expired: false, scheduled: false,
      mediaUrl: null,
    },
    {
      id: 'n10', title: '⏰ Scheduled: Scholarship Application Open (April)',
      content: 'Merit-based scholarship applications for the academic year 2026-27 will open on April 1, 2026. Students with 8.0+ CGPA are eligible to apply.\n\nScholarship amounts range from ₹10,000 to ₹1,00,000 per year.',
      category: 'academic', priority: 'high', author: 'Admin User', authorId: 'u1',
      pinned: false, likes: 0, likedBy: [], comments: [], views: 0,
      createdAt: now.toISOString(),
      publishAt: new Date(now.getTime()+86400000*13).toISOString(),
      expiry: new Date(now.getTime()+86400000*60).toISOString(), expired: false, scheduled: true,
      mediaUrl: null,
    },
  ];

  localStorage.setItem('dnb-notices', JSON.stringify(notices));
  return notices;
}

// ─── Expiry Check Scheduler ───────────────────────────────────
setInterval(checkExpiredNotices, 60000); // check every minute

// ─── Dashboard Stats ─────────────────────────────────────────
function renderDashboard() {
  const notices = getNotices().filter(n => !n.expired && !n.scheduled);

  animateCounter('stat-total',    notices.length);
  animateCounter('stat-pinned',   notices.filter(n => n.pinned).length);
  animateCounter('stat-likes',    notices.reduce((a,n) => a + (n.likes||0), 0));
  animateCounter('stat-comments', notices.reduce((a,n) => a + (n.comments?.length||0), 0));
  animateCounter('stat-active',   notices.filter(n => !isExpired(n.expiry)).length);

  const badge = document.getElementById('noticeCountBadge');
  if (badge) badge.textContent = notices.length;

  renderPinnedScroll();
  renderRecentNotices();
  updateNotifBadge();
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = 0;
  const dur   = 1200;
  const step  = 16;
  const inc   = (target - start) / (dur / step);
  let current = start;
  const timer = setInterval(() => {
    current = Math.min(current + inc, target);
    el.textContent = Math.round(current).toLocaleString();
    if (current >= target) clearInterval(timer);
  }, step);
}

function renderPinnedScroll() {
  const container = document.getElementById('pinnedScrollDash');
  if (!container) return;
  const pinned = getNotices().filter(n => n.pinned && !n.expired && !n.scheduled);
  if (!pinned.length) {
    const section = document.getElementById('pinnedSectionDash');
    if (section) section.style.display = 'none';
    return;
  }
  container.innerHTML = pinned.map(n => `
    <div class="pinned-mini-card" onclick="openNoticeDetail('${n.id}')">
      <span class="pinned-indicator">📌</span>
      <div class="mini-title">${n.title}</div>
      <div class="mini-date">${formatDate(n.createdAt)}</div>
      <div style="margin-top:8px;display:flex;gap:6px;">
        <span class="badge badge-${getCatClass(n.category)}">${n.category}</span>
      </div>
    </div>`).join('');
}

function renderRecentNotices() {
  const grid = document.getElementById('recentNoticesGrid');
  if (!grid) return;
  const notices = getNotices().filter(n => !n.expired && !n.scheduled).slice(0, 6);
  grid.innerHTML = notices.map((n,i) => buildNoticeCard(n, i)).join('');
}

// ─── Category Color ───────────────────────────────────────────
function getCatClass(cat) {
  const m = { urgent:'danger', event:'success', academic:'info', sports:'warning',
               cultural:'accent', exam:'danger', placement:'primary', general:'primary' };
  return m[cat] || 'primary';
}

function getCatEmoji(cat) {
  const m = { urgent:'🚨', event:'🎉', academic:'🎓', sports:'⚽',
               cultural:'🎨', exam:'📝', placement:'💼', general:'📋' };
  return m[cat] || '📋';
}

// ─── Build Notice Card HTML ───────────────────────────────────
function buildNoticeCard(n, idx = 0) {
  const user    = DNB.currentUser;
  const liked   = n.likedBy?.includes(user?.id);
  const canEdit = user?.role === 'admin' || (user?.role === 'staff' && n.authorId === user?.id);
  const expSoon = isExpiringSoon(n.expiry);
  const exp     = isExpired(n.expiry) && n.expiry;
  const delay   = Math.min(idx+1, 5);

  return `
  <div class="notice-card delay-${delay} ${n.pinned?'pinned':''} ${expSoon?'expiring-soon':''}"
       id="card-${n.id}" style="animation-delay:${idx*0.06}s;">
    ${n.pinned ? '<span class="pinned-indicator">📌</span>' : ''}
    <div class="category-bar cat-${n.category}"></div>
    ${n.mediaUrl ? `<img class="notice-media" src="${n.mediaUrl}" alt="notice media" style="display:block;" loading="lazy"/>` : ''}
    <div class="notice-body">
      <div class="notice-header-row">
        <span class="badge notice-category-badge badge-${getCatClass(n.category)}">${getCatEmoji(n.category)} ${capitalize(n.category)}</span>
        ${n.priority === 'critical' ? '<span class="badge badge-danger">🔴 Critical</span>' : ''}
        ${n.priority === 'high' && n.priority !== 'critical' ? '<span class="badge badge-warning">⚡ High</span>' : ''}
      </div>
      <div class="notice-title" onclick="openNoticeDetail('${n.id}')">${n.title}</div>
      <div class="notice-excerpt">${n.content.substring(0,120)}…</div>
      <div class="notice-meta">
        <span class="notice-meta-item">👤 ${n.author}</span>
        <span class="notice-meta-item">📅 ${timeAgo(n.createdAt)}</span>
        ${n.expiry ? `<span class="notice-meta-item expiry-badge ${exp?'expired':expSoon?'expiring':'active'}">
          ${exp ? '⛔ Expired' : expSoon ? '⚠️ Expiring soon' : '✅ Active'}
        </span>` : ''}
      </div>
    </div>
    <div class="notice-footer">
      <button class="notice-action-btn ${liked?'liked':''}" onclick="toggleLike('${n.id}')">
        ${liked ? '❤️' : '🤍'} <span id="likeCount-${n.id}">${n.likes||0}</span>
      </button>
      <button class="notice-action-btn" onclick="openNoticeDetail('${n.id}')">
        💬 <span>${n.comments?.length||0}</span>
      </button>
      <button class="notice-action-btn" onclick="openNoticeDetail('${n.id}')">
        👁️ <span>${n.views||0}</span>
      </button>
      ${canEdit ? `
      <div class="notice-actions-admin">
        <button class="notice-action-btn" onclick="editNotice('${n.id}')" title="Edit">✏️</button>
        ${user.role === 'admin' ? `
          <button class="notice-action-btn" onclick="togglePin('${n.id}')" title="${n.pinned?'Unpin':'Pin'}">📌</button>
          <button class="notice-action-btn" style="color:var(--danger);" onclick="confirmDelete('${n.id}')" title="Delete">🗑️</button>
        ` : ''}
      </div>` : ''}
    </div>
  </div>`;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
