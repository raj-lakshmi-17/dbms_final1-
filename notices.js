/* ============================================================
   NOTICES.JS — CRUD, Pin, Like, Filter, Search, Expiry, Admin
   ============================================================ */

'use strict';

let currentFilter = 'all';

// ─── Render All Notices ───────────────────────────────────────
function renderAllNotices(searchQuery = '') {
  const grid    = document.getElementById('allNoticesGrid');
  const noMsg   = document.getElementById('noNoticesMsg');
  if (!grid) return;

  let notices = getNotices().filter(n => !n.expired && !n.scheduled);

  // Category filter
  if (currentFilter !== 'all') {
    notices = notices.filter(n => n.category === currentFilter);
  }

  // Search
  if (searchQuery) {
    notices = notices.filter(n =>
      n.title.toLowerCase().includes(searchQuery) ||
      n.content.toLowerCase().includes(searchQuery) ||
      n.author.toLowerCase().includes(searchQuery) ||
      n.category.toLowerCase().includes(searchQuery)
    );
  }

  // Sort: pinned first, then newest
  notices.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  if (!notices.length) {
    grid.innerHTML   = '';
    noMsg?.classList.remove('hidden');
    return;
  }

  noMsg?.classList.add('hidden');
  grid.innerHTML = notices.map((n, i) => buildNoticeCard(n, i)).join('');
}

// ─── Render Pinned Page ───────────────────────────────────────
function renderPinnedPage() {
  const grid  = document.getElementById('pinnedGrid');
  const noMsg = document.getElementById('noPinnedMsg');
  if (!grid) return;

  const notices = getNotices().filter(n => n.pinned && !n.expired && !n.scheduled);
  if (!notices.length) {
    grid.innerHTML = '';
    noMsg?.classList.remove('hidden');
    return;
  }
  noMsg?.classList.add('hidden');
  grid.innerHTML = notices.map((n,i) => buildNoticeCard(n,i)).join('');
}

// ─── Render Scheduled Page ────────────────────────────────────
function renderScheduledPage() {
  const grid  = document.getElementById('scheduledGrid');
  const noMsg = document.getElementById('noScheduledMsg');
  if (!grid) return;

  const user = DNB.currentUser;
  let notices = getNotices().filter(n => n.scheduled);
  if (user?.role !== 'admin') {
    notices = notices.filter(n => n.authorId === user?.id);
  }

  if (!notices.length) {
    grid.innerHTML = '';
    noMsg?.classList.remove('hidden');
    return;
  }
  noMsg?.classList.add('hidden');
  grid.innerHTML = notices.map((n,i) => `
    <div class="notice-card delay-${Math.min(i+1,5)}" style="animation-delay:${i*0.07}s;">
      <div class="category-bar cat-${n.category}"></div>
      <div class="notice-body">
        <div class="flex gap-2 items-center mb-2">
          <span class="badge badge-${getCatClass(n.category)}">${getCatEmoji(n.category)} ${capitalize(n.category)}</span>
          <span class="scheduled-badge">⏰ Scheduled</span>
        </div>
        <div class="notice-title">${n.title}</div>
        <div class="notice-excerpt">${n.content.substring(0,100)}…</div>
        <div class="notice-meta" style="margin-top:12px;">
          <span class="notice-meta-item">📅 Publishes: ${formatDateTime(n.publishAt)}</span>
        </div>
        <div class="notice-meta">
          <span class="notice-meta-item">⌛ Expires: ${n.expiry ? formatDateTime(n.expiry) : 'Never'}</span>
        </div>
      </div>
      <div class="notice-footer">
        ${user?.role === 'admin' || n.authorId === user?.id ? `
          <button class="notice-action-btn" onclick="publishNow('${n.id}')">🚀 Publish Now</button>
          <button class="notice-action-btn" style="color:var(--danger);" onclick="confirmDelete('${n.id}')">🗑️ Delete</button>
        ` : '<span class="text-muted text-xs">View only</span>'}
      </div>
    </div>`).join('');
}

// ─── Render Liked Page ────────────────────────────────────────
function renderLikedPage() {
  const grid  = document.getElementById('likedGrid');
  const noMsg = document.getElementById('noLikedMsg');
  if (!grid) return;

  const userId  = DNB.currentUser?.id;
  const notices = getNotices().filter(n => n.likedBy?.includes(userId));

  if (!notices.length) {
    grid.innerHTML = '';
    noMsg?.classList.remove('hidden');
    return;
  }
  noMsg?.classList.add('hidden');
  grid.innerHTML = notices.map((n,i) => buildNoticeCard(n,i)).join('');
}

// ─── Admin Page ───────────────────────────────────────────────
function renderAdminPage() {
  const tbody = document.getElementById('adminNoticesBody');
  const count = document.getElementById('adminNoticeCount');
  if (!tbody) return;

  const notices = getNotices();
  if (count) count.textContent = `${notices.length} notices`;

  tbody.innerHTML = notices.map(n => `
    <tr>
      <td>
        <div style="font-weight:600;font-size:0.83rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${n.pinned ? '📌 ' : ''}${n.title}
        </div>
      </td>
      <td><span class="badge badge-${getCatClass(n.category)}">${n.category}</span></td>
      <td>
        ${n.scheduled ? '<span class="badge badge-info">⏰ Scheduled</span>' :
          n.expired   ? '<span class="badge badge-danger">⛔ Expired</span>'  :
          isExpiringSoon(n.expiry) ? '<span class="badge badge-warning">⚠️ Expiring</span>' :
          '<span class="badge badge-success">✅ Active</span>'}
      </td>
      <td>${n.author}</td>
      <td style="font-size:0.75rem;color:var(--text-muted);">${n.expiry ? formatDate(n.expiry) : '—'}</td>
      <td><span class="badge badge-primary">❤️ ${n.likes||0}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-secondary" onclick="editNotice('${n.id}')">✏️</button>
          <button class="btn btn-sm" style="background:rgba(253,203,110,0.2);color:#e17055;" onclick="togglePin('${n.id}')">${n.pinned?'📌':'📌'}</button>
          <button class="btn btn-sm btn-danger"    onclick="confirmDelete('${n.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

// ─── Users Page ───────────────────────────────────────────────
function renderUsersPage() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const users = getUsers();
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="user-avatar" style="width:30px;height:30px;font-size:0.75rem;">${u.name.charAt(0)}</div>
          <span style="font-weight:600;">${u.name}</span>
        </div>
      </td>
      <td style="font-size:0.8rem;">${u.email}</td>
      <td><span class="badge role-${u.role}">${formatRole(u.role)}</span></td>
      <td style="color:var(--text-muted);font-size:0.8rem;">${u.dept||'—'}</td>
      <td>
        ${u.active
          ? '<span class="badge badge-success">✅ Active</span>'
          : '<span class="badge badge-danger">🔴 Inactive</span>'}
      </td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-secondary" onclick="changeRole('${u.id}')">Role</button>
          <button class="btn btn-sm btn-danger"    onclick="toggleUserStatus('${u.id}')">${u.active?'Deactivate':'Activate'}</button>
        </div>
      </td>
    </tr>`).join('');
}

// ─── Add / Edit Notice Modal ──────────────────────────────────
function openAddNoticeModal() {
  document.getElementById('editNoticeId').value  = '';
  document.getElementById('noticeTitle').value   = '';
  document.getElementById('noticeContent').value = '';
  document.getElementById('noticeCat').value     = 'general';
  document.getElementById('noticePriority').value= 'normal';
  document.getElementById('noticeExpiry').value  = '';
  document.getElementById('noticePin').checked   = false;
  document.getElementById('noticeSendNotif').checked = true;
  document.getElementById('uploadPreview').classList.add('hidden');
  document.getElementById('uploadLabel').textContent = 'Click to upload or drag & drop';
  document.getElementById('noticeModalTitle').textContent = '📝 Add New Notice';
  openModal('noticeModal');
}

function editNotice(id) {
  const notices = getNotices();
  const n = notices.find(x => x.id === id);
  if (!n) return;

  document.getElementById('editNoticeId').value   = id;
  document.getElementById('noticeTitle').value    = n.title;
  document.getElementById('noticeContent').value  = n.content;
  document.getElementById('noticeCat').value      = n.category;
  document.getElementById('noticePriority').value = n.priority || 'normal';
  document.getElementById('noticeExpiry').value   = n.expiry ? n.expiry.slice(0,16) : '';
  document.getElementById('noticePin').checked    = n.pinned || false;
  document.getElementById('noticeSendNotif').checked = false;
  document.getElementById('noticeModalTitle').textContent = '✏️ Edit Notice';

  if (n.mediaUrl) {
    const preview = document.getElementById('uploadPreview');
    preview.src = n.mediaUrl;
    preview.classList.remove('hidden');
  }
  openModal('noticeModal');
}

function saveNotice(e) {
  e.preventDefault();
  const id      = document.getElementById('editNoticeId').value;
  const title   = document.getElementById('noticeTitle').value.trim();
  const content = document.getElementById('noticeContent').value.trim();
  const category= document.getElementById('noticeCat').value;
  const priority= document.getElementById('noticePriority').value;
  const expiry  = document.getElementById('noticeExpiry').value;
  const pin     = document.getElementById('noticePin').checked;
  const sendNotif = document.getElementById('noticeSendNotif').checked;
  const preview = document.getElementById('uploadPreview');
  const mediaUrl= preview.classList.contains('hidden') ? null : preview.src || null;

  if (!title || !content) { showToast('Title and content are required', 'error'); return; }

  const notices = getNotices();

  if (id) {
    // Edit
    const idx = notices.findIndex(n => n.id === id);
    if (idx > -1) {
      notices[idx] = { ...notices[idx], title, content, category, priority, pinned: pin,
        expiry: expiry || null, mediaUrl, updatedAt: new Date().toISOString() };
      showToast('Notice updated successfully ✅', 'success');
    }
  } else {
    // Add new
    const user = DNB.currentUser;
    const newNotice = {
      id: generateId(),
      title, content, category, priority,
      author: user.name, authorId: user.id,
      pinned: pin, likes: 0, likedBy: [], comments: [],
      views: 0, expired: false, scheduled: false,
      createdAt: new Date().toISOString(),
      expiry: expiry || null, mediaUrl,
    };
    notices.unshift(newNotice);
    showToast('Notice published successfully 🎉', 'success');

    if (sendNotif) {
      addNotification({
        id: generateId(), type: 'notice',
        title: '📢 New Notice Published',
        text: title, time: new Date().toISOString(), read: false,
      });
    }
  }

  saveNotices(notices);
  closeModal('noticeModal');
  renderDashboard();
  renderAdminPage();
  renderAllNotices();
  updateTicker();
}

// ─── Delete Notice ────────────────────────────────────────────
let deleteTargetId = null;

function confirmDelete(id) {
  deleteTargetId = id;
  openModal('confirmModal');
  document.getElementById('confirmDeleteBtn').onclick = () => deleteNotice(id);
}

function deleteNotice(id) {
  const notices = getNotices().filter(n => n.id !== id);
  saveNotices(notices);
  closeModal('confirmModal');
  showToast('Notice deleted', 'info');
  renderDashboard();
  renderAllNotices();
  renderAdminPage();
  updateTicker();
}

// ─── Pin / Unpin ──────────────────────────────────────────────
function togglePin(id) {
  if (DNB.currentUser?.role !== 'admin') {
    showToast('Only admins can pin notices', 'warning'); return;
  }
  const notices = getNotices();
  const n = notices.find(x => x.id === id);
  if (!n) return;
  n.pinned = !n.pinned;
  saveNotices(notices);
  showToast(n.pinned ? '📌 Notice pinned!' : 'Notice unpinned', 'success');
  renderDashboard();
  renderAllNotices();
  renderAdminPage();
  renderPinnedPage();
}

// ─── Like / Acknowledge ───────────────────────────────────────
function toggleLike(id) {
  const user = DNB.currentUser;
  if (!user) { showToast('Please login to like notices', 'warning'); return; }

  const notices = getNotices();
  const n = notices.find(x => x.id === id);
  if (!n) return;

  if (!Array.isArray(n.likedBy)) n.likedBy = [];
  const alreadyLiked = n.likedBy.includes(user.id);

  if (alreadyLiked) {
    n.likedBy = n.likedBy.filter(uid => uid !== user.id);
    n.likes   = Math.max(0, (n.likes||1) - 1);
  } else {
    n.likedBy.push(user.id);
    n.likes = (n.likes||0) + 1;
  }

  saveNotices(notices);

  // Update DOM without re-render
  const countEl = document.getElementById(`likeCount-${id}`);
  if (countEl) countEl.textContent = n.likes;
  const btn = countEl?.closest('.notice-action-btn');
  if (btn) {
    btn.classList.toggle('liked', !alreadyLiked);
    btn.innerHTML = `${!alreadyLiked ? '❤️' : '🤍'} <span id="likeCount-${id}">${n.likes}</span>`;
  }
}

// ─── Category Filter ──────────────────────────────────────────
function filterByCategory(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAllNotices();
}

// ─── Open Notice Detail ───────────────────────────────────────
function openNoticeDetail(id) {
  const notices = getNotices();
  const n = notices.find(x => x.id === id);
  if (!n) return;

  // Increment views
  n.views = (n.views || 0) + 1;
  saveNotices(notices);

  const user    = DNB.currentUser;
  const liked   = n.likedBy?.includes(user?.id);
  const content = document.getElementById('noticeDetailContent');
  const title   = document.getElementById('detailTitle');

  if (title) title.textContent = n.title;
  if (!content) return;

  content.innerHTML = `
    <div class="notice-detail-header">
      <span class="badge badge-${getCatClass(n.category)}">${getCatEmoji(n.category)} ${capitalize(n.category)}</span>
      ${n.priority === 'critical' ? '<span class="badge badge-danger">🔴 Critical</span>' : ''}
      ${n.pinned ? '<span class="badge badge-warning">📌 Pinned</span>' : ''}
    </div>
    ${n.mediaUrl ? `<img class="notice-detail-image" src="${n.mediaUrl}" alt="Notice attachment"/>` : ''}
    <div class="notice-detail-body">${n.content}</div>
    <div class="notice-meta" style="flex-wrap:wrap;gap:14px;margin-top:6px;">
      <span class="notice-meta-item">👤 <strong>${n.author}</strong></span>
      <span class="notice-meta-item">📅 ${formatDateTime(n.createdAt)}</span>
      ${n.expiry ? `<span class="notice-meta-item">⌛ Expires: ${formatDate(n.expiry)}</span>` : ''}
      <span class="notice-meta-item">👁️ ${n.views} views</span>
    </div>
    <div class="notice-footer" style="padding:0;margin-top:8px;border:none;">
      <button class="notice-action-btn ${liked?'liked':''}" onclick="toggleLike('${n.id}');refreshDetailLike('${n.id}')">
        ${liked?'❤️':'🤍'} <span id="detailLikeCount">${n.likes||0}</span> Likes
      </button>
    </div>
    <div class="comments-section" id="commentsSection-${n.id}">
    </div>`;

  renderComments(n.id);
  openModal('detailModal');
}

function refreshDetailLike(id) {
  setTimeout(() => {
    const notices = getNotices();
    const n   = notices.find(x => x.id === id);
    const user = DNB.currentUser;
    if (!n) return;
    const liked = n.likedBy?.includes(user?.id);
    const btn   = document.querySelector('#detailModal .notice-action-btn');
    const count = document.getElementById('detailLikeCount');
    if (btn && count) {
      btn.className = `notice-action-btn ${liked?'liked':''}`;
      btn.innerHTML = `${liked?'❤️':'🤍'} <span id="detailLikeCount">${n.likes||0}</span> Likes`;
    }
  }, 100);
}

// ─── Publish Scheduled Notice ────────────────────────────────
function publishNow(id) {
  const notices = getNotices();
  const n = notices.find(x => x.id === id);
  if (!n) return;
  n.scheduled = false;
  n.publishAt = null;
  n.createdAt = new Date().toISOString();
  saveNotices(notices);
  showToast('Notice published immediately! 🚀', 'success');
  renderScheduledPage();
  updateTicker();
}

// ─── Schedule Notice ──────────────────────────────────────────
function scheduleNotice(e) {
  e.preventDefault();
  const title    = document.getElementById('schedTitle').value.trim();
  const content  = document.getElementById('schedContent').value.trim();
  const category = document.getElementById('schedCat').value;
  const publish  = document.getElementById('schedPublish').value;
  const expiry   = document.getElementById('schedExpiry').value;

  if (!title || !publish) { showToast('Title and publish date are required', 'error'); return; }

  const user = DNB.currentUser;
  const newNotice = {
    id: generateId(), title, content: content || title,
    category, priority: 'normal',
    author: user.name, authorId: user.id,
    pinned: false, likes: 0, likedBy: [], comments: [], views: 0,
    expired: false, scheduled: true,
    createdAt: new Date().toISOString(),
    publishAt: new Date(publish).toISOString(),
    expiry: expiry ? new Date(expiry).toISOString() : null,
    mediaUrl: null,
  };

  const notices = getNotices();
  notices.unshift(newNotice);
  saveNotices(notices);

  // Auto-publish at scheduled time
  const delay = new Date(publish).getTime() - Date.now();
  if (delay > 0 && delay < 86400000) { // within 24h
    setTimeout(() => publishNow(newNotice.id), delay);
  }

  showToast(`Notice scheduled for ${formatDateTime(publish)} ⏰`, 'success');
  e.target.reset();
  renderAdminPage();
}

// ─── Multimedia File Handling ─────────────────────────────────
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.add('drag-over');
}

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFilePreview(file);
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (file) loadFilePreview(file);
}

function loadFilePreview(file) {
  if (file.size > 5 * 1024 * 1024) {
    showToast('File too large (max 5MB)', 'error'); return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('uploadPreview');
    const label   = document.getElementById('uploadLabel');
    if (file.type.startsWith('image/')) {
      preview.src = e.target.result;
      preview.classList.remove('hidden');
    }
    label.textContent = `📎 ${file.name}`;
  };
  reader.readAsDataURL(file);
}

// ─── User Management ─────────────────────────────────────────
function openAddUserModal() {
  showToast('User invitation form — integrate with email service', 'info');
}

function changeRole(userId) {
  const users   = getUsers();
  const u       = users.find(x => x.id === userId);
  if (!u) return;
  const roles   = ['admin','staff','user'];
  const current = roles.indexOf(u.role);
  u.role        = roles[(current + 1) % roles.length];
  saveUsers(users);
  showToast(`${u.name}'s role changed to ${u.role}`, 'success');
  renderUsersPage();
}

function toggleUserStatus(userId) {
  const users = getUsers();
  const u     = users.find(x => x.id === userId);
  if (!u) return;
  u.active    = !u.active;
  saveUsers(users);
  showToast(`${u.name} ${u.active ? 'activated' : 'deactivated'}`, 'info');
  renderUsersPage();
}

function updateNotifBadge() {
  const notifs = getNotifications().filter(n => !n.read);
  const dot    = document.getElementById('notifDot');
  if (dot) dot.style.display = notifs.length ? 'block' : 'none';
}
