/* ============================================================
   ANALYTICS.JS — Charts, Dashboard Analytics with Chart.js
   ============================================================ */

'use strict';

let analyticsCharts = {};

// ─── Render Analytics Page ────────────────────────────────────
function renderAnalyticsPage() {
  const notices  = getNotices();
  const users    = getUsers();

  // Update stat cards
  const totalViews = notices.reduce((a,n) => a+(n.views||0), 0);
  const totalLikes = notices.reduce((a,n) => a+(n.likes||0), 0);
  const totalComments = notices.reduce((a,n) => a+(n.comments?.length||0), 0);

  animateCounter('a-views',    totalViews);
  animateCounter('a-likes',    totalLikes);
  animateCounter('a-comments', totalComments);
  animateCounter('a-users',    users.length);

  // Destroy previous charts
  Object.values(analyticsCharts).forEach(c => c?.destroy());
  analyticsCharts = {};

  setTimeout(() => {
    renderActivityChart(notices);
    renderCategoryChart(notices);
    renderEngagementChart(notices);
    renderTopNotices(notices);
  }, 100);
}

// ─── Activity Chart (Line) ────────────────────────────────────
function renderActivityChart(notices) {
  const ctx = document.getElementById('activityChart');
  if (!ctx) return;

  const days   = getLast7Days();
  const labels = days.map(d => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }));

  const noticeData = days.map(day => {
    return notices.filter(n => {
      const d = new Date(n.createdAt);
      return d.getDate() === day.getDate() && d.getMonth() === day.getMonth();
    }).length;
  });

  const likesData = days.map(day => {
    return notices.filter(n => {
      const d = new Date(n.createdAt);
      return d.getDate() === day.getDate() && d.getMonth() === day.getMonth();
    }).reduce((a,n) => a+(n.likes||0), 0);
  });

  analyticsCharts.activity = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Notices Published',
          data: noticeData,
          borderColor: '#6c63ff',
          backgroundColor: 'rgba(108,99,255,0.1)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6c63ff',
          pointRadius: 4,
        },
        {
          label: 'Likes Received',
          data: likesData,
          borderColor: '#fd79a8',
          backgroundColor: 'rgba(253,121,168,0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#fd79a8',
          pointRadius: 4,
        }
      ]
    },
    options: getChartOptions('line', true),
  });
}

// ─── Category Distribution (Doughnut) ────────────────────────
function renderCategoryChart(notices) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;

  const cats   = ['general','urgent','event','academic','sports','cultural','exam','placement'];
  const emojis = ['📋','🚨','🎉','🎓','⚽','🎨','📝','💼'];
  const colors = ['#6c63ff','#d63031','#00b894','#0984e3','#fdcb6e','#fd79a8','#e17055','#00cec9'];

  const data  = cats.map(cat => notices.filter(n => n.category === cat).length);
  const labels= cats.map((cat,i) => `${emojis[i]} ${capitalize(cat)}`);

  analyticsCharts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverBorderWidth: 3,
                   hoverBorderColor: '#fff', borderRadius: 4 }]
    },
    options: {
      ...getChartOptions('doughnut'),
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: getTextColor(), font: { size: 11 }, padding: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} notices` } }
      }
    }
  });
}

// ─── User Engagement (Bar) ────────────────────────────────────
function renderEngagementChart(notices) {
  const ctx = document.getElementById('engagementChart');
  if (!ctx) return;

  const cats   = ['general','urgent','event','academic','sports','cultural','exam','placement'];
  const labels = cats.map(c => capitalize(c));
  const views  = cats.map(cat => notices.filter(n => n.category === cat).reduce((a,n) => a+(n.views||0), 0));
  const likes  = cats.map(cat => notices.filter(n => n.category === cat).reduce((a,n) => a+(n.likes||0), 0));

  analyticsCharts.engagement = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '👁️ Views', data: views, backgroundColor: 'rgba(108,99,255,0.7)', borderRadius: 6, borderSkipped: false },
        { label: '❤️ Likes', data: likes, backgroundColor: 'rgba(253,121,168,0.7)', borderRadius: 6, borderSkipped: false },
      ]
    },
    options: {
      ...getChartOptions('bar'),
      scales: {
        x: { ticks: { color: getTextColor(), font:{size:9} }, grid: { color: getBorderColor() } },
        y: { ticks: { color: getTextColor() }, grid: { color: getBorderColor() } },
      }
    }
  });
}

// ─── Top Notices ─────────────────────────────────────────────
function renderTopNotices(notices) {
  const el = document.getElementById('topNoticesList');
  if (!el) return;

  const sorted = [...notices]
    .sort((a,b) => ((b.likes||0) + (b.views||0)*0.1) - ((a.likes||0) + (a.views||0)*0.1))
    .slice(0, 5);

  const maxScore = (sorted[0]?.likes||1) + (sorted[0]?.views||1)*0.1;

  el.innerHTML = sorted.map((n,i) => {
    const score = (n.likes||0) + (n.views||0)*0.1;
    const pct   = Math.round((score / maxScore) * 100);
    return `
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
        <div style="font-size:0.8rem;font-weight:600;color:var(--text);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${n.title}
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);">❤️${n.likes||0} 👁️${n.views||0}</div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%;"></div>
      </div>
    </div>`;
  }).join('');
}

// ─── Chart helpers ────────────────────────────────────────────
function getChartOptions(type, hasLegend = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1200, easing: 'easeInOutQuart' },
    plugins: {
      legend: {
        display: hasLegend,
        labels: { color: getTextColor(), font: { size: 11 }, usePointStyle: true }
      },
      tooltip: {
        backgroundColor: 'rgba(20,20,40,0.9)',
        titleColor: '#fff',
        bodyColor: '#bbb',
        cornerRadius: 8,
        padding: 10,
      }
    },
  };
}

function getTextColor()   { return document.documentElement.getAttribute('data-theme') === 'dark' ? '#8888aa' : '#636e72'; }
function getBorderColor() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(108,99,255,0.15)' : 'rgba(108,99,255,0.1)'; }

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0,0,0,0);
    days.push(new Date(d));
  }
  return days;
}
