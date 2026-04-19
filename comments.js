/* ============================================================
   COMMENTS.JS — Comment / Feedback Section per Notice
   ============================================================ */

'use strict';

// ─── Render Comments ──────────────────────────────────────────
function renderComments(noticeId) {
  const container = document.getElementById(`commentsSection-${noticeId}`);
  if (!container) return;

  const notices = getNotices();
  const n = notices.find(x => x.id === noticeId);
  if (!n) return;

  const comments = n.comments || [];

  container.innerHTML = `
    <h4>💬 Comments <span style="color:var(--text-muted);font-weight:400;">(${comments.length})</span></h4>
    <div class="comment-form">
      <textarea class="comment-input" id="commentInput-${noticeId}"
        placeholder="Add a comment or feedback…" rows="2"></textarea>
      <button class="btn btn-primary btn-sm" onclick="postComment('${noticeId}')"
        style="white-space:nowrap;align-self:flex-end;">
        💬 Post
      </button>
    </div>
    <div id="commentsList-${noticeId}">
      ${renderCommentList(comments)}
    </div>
  `;

  // Allow Enter key to post (Shift+Enter = new line)
  const input = document.getElementById(`commentInput-${noticeId}`);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        postComment(noticeId);
      }
    });
  }
}

function renderCommentList(comments) {
  if (!comments.length) {
    return `<div style="text-align:center;color:var(--text-muted);font-size:0.82rem;padding:20px 0;">
      No comments yet. Be the first to comment! 💬</div>`;
  }
  return comments.map(c => `
    <div class="comment-item" id="comment-${c.id}">
      <div class="comment-avatar">${c.author.charAt(0).toUpperCase()}</div>
      <div class="comment-content">
        <div class="comment-author">${c.author}
          <span class="badge role-${c.role}" style="font-size:0.65rem;padding:2px 7px;margin-left:6px;">
            ${formatRole(c.role)}
          </span>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:6px;">
          <div class="comment-time">🕐 ${timeAgo(c.time)}</div>
          <button class="notice-action-btn" style="padding:3px 8px;font-size:0.7rem;"
            onclick="likeComment('${c.id}', '${c.noticeId}')">
            👍 <span id="clc-${c.id}">${c.likes||0}</span>
          </button>
          ${(DNB.currentUser?.id === c.authorId || DNB.currentUser?.role === 'admin') ? `
            <button class="notice-action-btn" style="padding:3px 8px;font-size:0.7rem;color:var(--danger);"
              onclick="deleteComment('${c.id}', '${c.noticeId}')">
              🗑️ Delete
            </button>` : ''}
        </div>
      </div>
    </div>`).join('');
}

// ─── Post Comment ─────────────────────────────────────────────
async function postComment(noticeId) {
  const input = document.getElementById(`commentInput-${noticeId}`);
  const text  = input?.value.trim();
  if (!text) return;

  const user = DNB.currentUser;
  if (!user) { showToast('Please login to comment', 'warning'); return; }

  const comment = {
    id: generateId(),
    noticeId,
    authorId: user.id,
    author:   user.name,
    role:     user.role,
    text,
    time:     new Date().toISOString(),
    likes:    0,
    likedBy:  [],
  };

  // Try API
  try {
    await apiRequest('POST', '/comments', { noticeId, text });
  } catch { /* fallback */ }

  // Save locally
  const notices = getNotices();
  const n = notices.find(x => x.id === noticeId);
  if (n) {
    if (!Array.isArray(n.comments)) n.comments = [];
    n.comments.push(comment);
    saveNotices(notices);
  }

  input.value = '';
  input.style.height = 'auto';

  // Update comment list
  const listEl = document.getElementById(`commentsList-${noticeId}`);
  if (listEl) listEl.innerHTML = renderCommentList((getNotices().find(x=>x.id===noticeId)?.comments||[]));

  showToast('Comment posted! 💬', 'success');
  updateCommentCount(noticeId);
}

// ─── Like Comment ─────────────────────────────────────────────
function likeComment(commentId, noticeId) {
  const user = DNB.currentUser;
  if (!user) return;

  const notices = getNotices();
  const n = notices.find(x => x.id === noticeId);
  if (!n) return;

  const c = n.comments?.find(x => x.id === commentId);
  if (!c) return;

  if (!Array.isArray(c.likedBy)) c.likedBy = [];
  const liked = c.likedBy.includes(user.id);
  if (liked) { c.likedBy = c.likedBy.filter(id => id !== user.id); c.likes = Math.max(0,(c.likes||1)-1); }
  else        { c.likedBy.push(user.id); c.likes = (c.likes||0)+1; }

  saveNotices(notices);
  const el = document.getElementById(`clc-${commentId}`);
  if (el) el.textContent = c.likes;
}

// ─── Delete Comment ───────────────────────────────────────────
function deleteComment(commentId, noticeId) {
  const notices = getNotices();
  const n = notices.find(x => x.id === noticeId);
  if (!n) return;
  n.comments = (n.comments||[]).filter(c => c.id !== commentId);
  saveNotices(notices);

  const el = document.getElementById(`comment-${commentId}`);
  if (el) { el.style.opacity='0'; el.style.transform='scale(0.9)'; setTimeout(()=>el.remove(),300); }
  showToast('Comment deleted', 'info');
  updateCommentCount(noticeId);
}

// ─── Update comment count on card ────────────────────────────
function updateCommentCount(noticeId) {
  const notices = getNotices();
  const n = notices.find(x => x.id === noticeId);
  // Update any visible card
  const card = document.getElementById(`card-${noticeId}`);
  if (card && n) {
    const commentBtns = card.querySelectorAll('.notice-action-btn');
    if (commentBtns[1]) {
      commentBtns[1].innerHTML = `💬 <span>${n.comments?.length||0}</span>`;
    }
  }
}

// ─── My Comments Page ────────────────────────────────────────
function renderMyComments() {
  const list   = document.getElementById('myCommentsList');
  const noMsg  = document.getElementById('noCommentsMsg');
  if (!list) return;

  const userId  = DNB.currentUser?.id;
  const notices = getNotices();
  const myComments = [];

  notices.forEach(n => {
    (n.comments||[]).forEach(c => {
      if (c.authorId === userId) {
        myComments.push({ ...c, noticeTitle: n.title, noticeId: n.id });
      }
    });
  });

  myComments.sort((a,b) => new Date(b.time) - new Date(a.time));

  if (!myComments.length) {
    list.innerHTML = '';
    noMsg?.classList.remove('hidden');
    return;
  }

  noMsg?.classList.add('hidden');
  list.innerHTML = myComments.map(c => `
    <div class="glass" style="padding:16px;margin-bottom:12px;animation:slideInLeft 0.4s ease;">
      <div style="font-size:0.75rem;color:var(--primary);font-weight:600;margin-bottom:6px;cursor:pointer;"
        onclick="openNoticeDetail('${c.noticeId}')">
        📄 ${c.noticeTitle}
      </div>
      <div style="font-size:0.88rem;color:var(--text);margin-bottom:8px;">${escapeHtml(c.text)}</div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:0.72rem;color:var(--text-muted);">🕐 ${timeAgo(c.time)}</span>
        <span style="font-size:0.72rem;color:var(--text-muted);">👍 ${c.likes||0} likes</span>
        <button class="notice-action-btn" style="padding:3px 8px;font-size:0.72rem;color:var(--danger);"
          onclick="deleteComment('${c.id}','${c.noticeId}');renderMyComments()">🗑️ Delete</button>
      </div>
    </div>`).join('');
}

// ─── HTML Escape ──────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;')
            .replace(/\n/g,'<br/>');
}
