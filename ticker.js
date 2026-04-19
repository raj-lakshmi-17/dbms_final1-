/* ============================================================
   TICKER.JS — Scrolling Notice Display (Marquee)
   ============================================================ */

'use strict';

// ─── Initialize Ticker ───────────────────────────────────────
function updateTicker() {
  const tickerContent = document.getElementById('tickerContent');
  if (!tickerContent) return;

  const notices = getNotices()
    .filter(n => !n.expired && !n.scheduled)
    .sort((a,b) => {
      if (a.priority === 'critical' && b.priority !== 'critical') return -1;
      if (b.priority === 'critical' && a.priority !== 'critical') return 1;
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, 12); // show top 12

  if (!notices.length) {
    tickerContent.innerHTML = `<span class="ticker-item">📋 No active notices at the moment</span>`;
    return;
  }

  // Duplicate content for seamless loop
  const items = notices.map(n => {
    const urgent = n.priority === 'critical' ? '🔴 ' : n.priority === 'high' ? '⚡ ' : '';
    const pin    = n.pinned ? '📌 ' : '';
    return `<span class="ticker-item" onclick="openTickerNotice('${n.id}')" style="cursor:pointer;">
      ${urgent}${pin}${n.title} — ${n.author}
    </span>`;
  }).join('');

  // Double the items for seamless infinite scroll
  tickerContent.innerHTML = items + items;

  // Adjust animation speed based on content length
  const totalLen = notices.reduce((a,n) => a + n.title.length, 0);
  const speed    = Math.max(30, Math.min(80, totalLen * 0.5));
  tickerContent.style.animationDuration = `${speed}s`;
}

function openTickerNotice(id) {
  openNoticeDetail(id);
}

// Initialize ticker on load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(updateTicker, 500);
});
