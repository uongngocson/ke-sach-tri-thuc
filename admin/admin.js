function getApiBase() {
  const hostname = window.location.hostname || 'localhost';
  const protocol = window.location.protocol || 'http:';
  const port = window.location.port;
  if (!port || port === '80' || port === '443' || port === '5000') return '/api/v1';
  return `${protocol}//${hostname}:5000/api/v1`;
}

function getSocketUrl() {
  const hostname = window.location.hostname || 'localhost';
  const protocol = window.location.protocol || 'http:';
  const port = window.location.port;
  if (!port || port === '80' || port === '443' || port === '5000') return undefined;
  return `${protocol}//${hostname}:5000`;
}

const API_BASE = getApiBase();
let authToken = localStorage.getItem('caosach_admin_token') || '';
let currentUser = JSON.parse(localStorage.getItem('caosach_admin_user') || 'null');
let socket = null;

// Global Data Caches
let analyticsCache = null;
let currentBookInModal = null;
let charts = {};

// Pagination States
let usersPageState = { page: 1, limit: 25, total: 0, totalPages: 1 };
let ledgerPageState = { page: 1, limit: 20, total: 0, totalPages: 1 };

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initAuthView();
  bindSidebarEvents();
  bindActionEvents();
});

function initAuthView() {
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');

  if (authToken && currentUser) {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    document.getElementById('admin-user-name').textContent = currentUser.fullName || currentUser.username;
    document.getElementById('admin-user-role').textContent = currentUser.role;
    
    initSocket();
    loadAllDashboardData();
  } else {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
}

function initSocket() {
  if (typeof io === 'undefined') return;
  
  const socketUrl = getSocketUrl();
  socket = socketUrl ? io(socketUrl) : io();
  const badge = document.getElementById('socket-status-badge');

  socket.on('connect', () => {
    if (badge) {
      badge.textContent = 'REALTIME ACTIVE';
      badge.className = 'text-[10px] font-extrabold text-emerald-400';
    }
  });

  socket.on('disconnect', () => {
    if (badge) {
      badge.textContent = 'DISCONNECTED';
      badge.className = 'text-[10px] font-extrabold text-rose-400';
    }
  });

  // Realtime updates
  socket.on('growth:updated', () => {
    loadAnalytics();
  });

  socket.on('book:created', () => {
    loadAnalytics();
    if (isTabActive('moderation')) loadBooks();
    if (isTabActive('ledger')) loadLedger();
  });

  socket.on('content:updated', () => {
    if (isTabActive('content-rules')) loadContentSettings();
  });
}

function isTabActive(tabName) {
  const pane = document.getElementById(`tab-pane-${tabName}`);
  return pane && pane.classList.contains('active');
}

// Bind Sidebar Nav
function bindSidebarEvents() {
  const navItems = document.querySelectorAll('#sidebar-nav .nav-item');
  const tabTitles = {
    'analytics': '📈 Tổng Quan & Biểu Đồ Phân Tích',
    'teams': '🏆 Bảng Xếp Hạng & Phân Tích 8 Đội Thi Đua',
    'users': '👥 Danh Bạ & Trạng Thái 288 Nhân Sự',
    'moderation': '📚 Trung Tâm Hậu Kiểm Sách & Trích Dẫn',
    'ledger': '📑 Sổ Cái EXP Minh Bạch Toàn Giải',
    'content-rules': '🎨 Tùy Biến Thể Lệ & Giao Diện Chào Mừng',
    'tools': '⚙️ Công Cụ Điều Phối & Nhật Ký Kiểm Toán'
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      if (!tab) return;

      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      document.querySelectorAll('.tab-content').forEach(pane => {
        pane.classList.remove('active');
      });

      const activePane = document.getElementById(`tab-pane-${tab}`);
      if (activePane) {
        activePane.classList.add('active');
      }

      const titleEl = document.getElementById('page-title');
      if (titleEl && tabTitles[tab]) {
        titleEl.innerHTML = `<span>${tabTitles[tab]}</span>`;
      }

      // Lazy load tab data
      if (tab === 'teams') renderTeamsTable();
      if (tab === 'users') loadUsers();
      if (tab === 'moderation') loadBooks();
      if (tab === 'ledger') loadLedger();
      if (tab === 'content-rules') loadContentSettings();
      if (tab === 'tools') loadAuditLogs();
    });
  });
}

function bindActionEvents() {
  bindContentRulesEvents();
  // Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value.trim();
      const p = document.getElementById('login-password').value.trim();
      const errEl = document.getElementById('login-error');
      errEl.classList.add('hidden');

      try {
        const res = await fetch(`${API_BASE}/admin/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        if (data.success) {
          authToken = data.data.token;
          currentUser = data.data.user;
          localStorage.setItem('caosach_admin_token', authToken);
          localStorage.setItem('caosach_admin_user', JSON.stringify(currentUser));
          initAuthView();
        } else {
          errEl.textContent = data.message || 'Tên đăng nhập hoặc mật khẩu không chính xác';
          errEl.classList.remove('hidden');
        }
      } catch (err) {
        errEl.textContent = 'Lỗi kết nối máy chủ backend (Port 5000)';
        errEl.classList.remove('hidden');
      }
    });
  }

  // Logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('caosach_admin_token');
      localStorage.removeItem('caosach_admin_user');
      authToken = '';
      currentUser = null;
      if (socket) socket.disconnect();
      initAuthView();
    });
  }

  // Global Refresh Button
  const refreshBtn = document.getElementById('btn-global-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadAllDashboardData();
    });
  }

  // Users Filters & Search
  const btnSearchUsers = document.getElementById('btn-search-users');
  if (btnSearchUsers) {
    btnSearchUsers.addEventListener('click', () => {
      usersPageState.page = 1;
      loadUsers();
    });
  }
  const btnResetUsers = document.getElementById('btn-reset-users-filter');
  if (btnResetUsers) {
    btnResetUsers.addEventListener('click', () => {
      document.getElementById('users-search').value = '';
      document.getElementById('users-filter-team').value = '';
      document.getElementById('users-filter-status').value = '';
      usersPageState.page = 1;
      loadUsers();
    });
  }
  document.getElementById('users-search')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { usersPageState.page = 1; loadUsers(); }
  });

  // Users Pagination
  document.getElementById('users-prev-page')?.addEventListener('click', () => {
    if (usersPageState.page > 1) {
      usersPageState.page--;
      loadUsers();
    }
  });
  document.getElementById('users-next-page')?.addEventListener('click', () => {
    if (usersPageState.page < usersPageState.totalPages) {
      usersPageState.page++;
      loadUsers();
    }
  });

  // Export Users CSV
  document.getElementById('btn-export-users-csv')?.addEventListener('click', exportUsersCSV);
  document.getElementById('btn-export-teams')?.addEventListener('click', exportTeamsCSV);

  // Books Refresh & Filters
  document.getElementById('btn-refresh-books')?.addEventListener('click', loadBooks);
  document.getElementById('filter-search')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadBooks();
  });
  document.getElementById('filter-moderation')?.addEventListener('change', loadBooks);
  document.getElementById('filter-visibility')?.addEventListener('change', loadBooks);

  // Ledger Filter & Pagination
  document.getElementById('btn-filter-ledger')?.addEventListener('click', () => {
    ledgerPageState.page = 1;
    loadLedger();
  });
  document.getElementById('ledger-prev-page')?.addEventListener('click', () => {
    if (ledgerPageState.page > 1) {
      ledgerPageState.page--;
      loadLedger();
    }
  });
  document.getElementById('ledger-next-page')?.addEventListener('click', () => {
    if (ledgerPageState.page < ledgerPageState.totalPages) {
      ledgerPageState.page++;
      loadLedger();
    }
  });

  // Advance Round
  document.getElementById('btn-advance-round')?.addEventListener('click', async () => {
    const sel = document.getElementById('select-advance-round');
    const targetRound = parseInt(sel.value, 10);
    if (!confirm(`Bạn có chắc chắn muốn kích hoạt Chặng ${targetRound} không?`)) return;

    try {
      const res = await fetch(`${API_BASE}/admin/rounds/advance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ roundNumber: targetRound })
      });
      const data = await res.json();
      if (data.success) {
        alert(`🎉 ${data.message}`);
        loadAllDashboardData();
      } else {
        alert(data.message || 'Lỗi chuyển chặng');
      }
    } catch (e) {
      alert('Lỗi kết nối máy chủ');
    }
  });

  // Bonus EXP Form
  const bonusForm = document.getElementById('bonus-exp-form');
  if (bonusForm) {
    bonusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseInt(document.getElementById('bonus-amount').value, 10);
      const reason = document.getElementById('bonus-reason').value.trim();
      const teamId = document.getElementById('bonus-team-id').value;

      try {
        const res = await fetch(`${API_BASE}/admin/growth/bonus`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ amount, reason, teamId: teamId ? parseInt(teamId, 10) : undefined })
        });
        const data = await res.json();
        if (data.success) {
          alert(`🎉 Đã tặng +${amount} EXP thành công!`);
          bonusForm.reset();
          loadAnalytics();
          loadAuditLogs();
        } else {
          alert(data.message || 'Lỗi xử lý tặng điểm');
        }
      } catch (err) {
        alert('Lỗi kết nối máy chủ');
      }
    });
  }

  // Modals Close
  document.getElementById('mod-modal-close')?.addEventListener('click', closeModModal);
  document.getElementById('team-modal-close')?.addEventListener('click', closeTeamModal);

  // Modal Actions
  document.getElementById('mod-btn-reviewed')?.addEventListener('click', () => handleModalAction('reviewed', 'visible'));
  document.getElementById('mod-btn-hide')?.addEventListener('click', () => handleModalAction('rejected', 'deleted'));
}

async function loadAllDashboardData() {
  await loadAnalytics();
  if (isTabActive('teams')) renderTeamsTable();
  if (isTabActive('users')) loadUsers();
  if (isTabActive('rounds')) renderRoundsTimeline();
  if (isTabActive('moderation')) loadBooks();
  if (isTabActive('ledger')) loadLedger();
  if (isTabActive('tools')) loadAuditLogs();
}

// =========================================================================
// 1. ANALYTICS & CHARTS
// =========================================================================
async function loadAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/admin/analytics/overview`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) return;

    analyticsCache = data.data;
    updateKPICards(analyticsCache.kpi);
    renderCharts(analyticsCache);
    updateAdvanceRoundSelect(analyticsCache.rounds, analyticsCache.kpi.currentRound);
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

function updateKPICards(kpi) {
  if (!kpi) return;

  // KPI 1: EXP & Level
  document.getElementById('kpi-total-exp').textContent = (kpi.totalExp || 0).toLocaleString();
  document.getElementById('kpi-level-name').textContent = kpi.levelName || 'Cấp 0';
  document.getElementById('kpi-level-pct').textContent = `${kpi.progressPercent || 0}%`;
  document.getElementById('kpi-level-bar').style.width = `${kpi.progressPercent || 0}%`;

  // KPI 2: Books
  document.getElementById('kpi-total-books').textContent = (kpi.totalBooks || 0).toLocaleString();
  const revPct = kpi.totalBooks > 0 ? Math.round((kpi.reviewedBooks / kpi.totalBooks) * 100) : 100;
  document.getElementById('kpi-reviewed-pct').textContent = `${revPct}%`;

  // Pending badge in sidebar
  const pendingBadge = document.getElementById('nav-pending-badge');
  if (pendingBadge) {
    if (kpi.pendingBooks > 0) {
      pendingBadge.textContent = kpi.pendingBooks;
      pendingBadge.classList.remove('hidden');
    } else {
      pendingBadge.classList.add('hidden');
    }
  }

  // KPI 3: Dews
  document.getElementById('kpi-total-dews').textContent = (kpi.totalDews || 0).toLocaleString();

  // KPI 4: Likes
  document.getElementById('kpi-total-likes').textContent = (kpi.totalLikes || 0).toLocaleString();

  // KPI 5: Site Visitors
  document.getElementById('kpi-site-visitors').textContent = (kpi.siteVisitors || 1).toLocaleString();

  // KPI 6: Today Participation Rate (1 quote/day)
  document.getElementById('kpi-round-rate').textContent = `${kpi.todayParticipationRate ?? kpi.overallParticipationRate ?? 0}%`;
  document.getElementById('kpi-round-users').textContent = `${kpi.todayActiveUsers ?? kpi.activeRoundUsers ?? 0}/${kpi.totalMembers || 288}`;

  // Mode Pill
  const pill = document.getElementById('top-round-pill');
  if (pill) {
    pill.textContent = `🌱 Vườn Tri Thức • 1 Quote / Ngày / Thành Viên`;
  }
}

function renderCharts(data) {
  if (typeof Chart === 'undefined') return;

  // Default Chart Dark Theme Options
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Quicksand', sans-serif";
  Chart.defaults.font.weight = '600';

  // --- CHART 1: 14-Day Trends Combo ---
  const ctxDaily = document.getElementById('chart-daily-trend')?.getContext('2d');
  if (ctxDaily) {
    if (charts.daily) charts.daily.destroy();

    const labels = data.timeline.map(t => t.label);
    const expData = data.timeline.map(t => t.exp);
    const booksData = data.timeline.map(t => t.books);

    charts.daily = new Chart(ctxDaily, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Điểm EXP Tích Lũy',
            data: expData,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            yAxisID: 'yExp'
          },
          {
            type: 'bar',
            label: 'Sách Đã Gieo',
            data: booksData,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: '#10b981',
            borderWidth: 1.5,
            borderRadius: 6,
            yAxisID: 'yBooks'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 14, font: { weight: 'bold' } } }
        },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.04)' } },
          yExp: {
            type: 'linear',
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            title: { display: true, text: 'EXP', color: '#38bdf8' }
          },
          yBooks: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Số Sách', color: '#10b981' }
          }
        }
      }
    });
  }

  // --- CHART 2: Book Categories Doughnut ---
  const ctxCat = document.getElementById('chart-categories')?.getContext('2d');
  if (ctxCat) {
    if (charts.categories) charts.categories.destroy();

    const catLabels = data.categories.map(c => c.category);
    const catCounts = data.categories.map(c => parseInt(c.count, 10));
    const catColors = ['#38bdf8', '#10b981', '#f59e0b', '#a855f7', '#f43f5e', '#3b82f6', '#14b8a6', '#eab308'];

    charts.categories = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: catLabels.length ? catLabels : ['Chưa có dữ liệu'],
        datasets: [{
          data: catCounts.length ? catCounts : [1],
          backgroundColor: catColors.slice(0, Math.max(1, catLabels.length)),
          borderColor: '#0f172a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } }
        }
      }
    });
  }

  // --- CHART 3: 8 Teams Standings Horizontal Bar ---
  const ctxTeams = document.getElementById('chart-teams-exp')?.getContext('2d');
  if (ctxTeams) {
    if (charts.teams) charts.teams.destroy();

    const teamLabels = data.teams.map(t => `#${t.id} ${t.shortName}`);
    const teamExp = data.teams.map(t => parseInt(t.tree_exp, 10));
    const teamColors = data.teams.map(t => t.color_code || '#0284c7');

    charts.teams = new Chart(ctxTeams, {
      type: 'bar',
      data: {
        labels: teamLabels,
        datasets: [{
          label: 'Tổng EXP Cây Tri Thức',
          data: teamExp,
          backgroundColor: teamColors,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.15)'
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `EXP: ${ctx.raw.toLocaleString()} EXP`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { callback: (v) => v.toLocaleString() }
          },
          y: { grid: { display: false } }
        }
      }
    });
  }

  // --- CHART 4: Branch Distribution ---
  const ctxBranches = document.getElementById('chart-branches')?.getContext('2d');
  if (ctxBranches) {
    if (charts.branches) charts.branches.destroy();

    const branchLabels = data.branches.map(b => b.branch);
    const totalMembers = data.branches.map(b => parseInt(b.total_members, 10));
    const activeMembers = data.branches.map(b => parseInt(b.active_round_members, 10));

    charts.branches = new Chart(ctxBranches, {
      type: 'bar',
      data: {
        labels: branchLabels,
        datasets: [
          {
            label: 'Tổng Nhân Sự',
            data: totalMembers,
            backgroundColor: 'rgba(56, 189, 248, 0.65)',
            borderRadius: 5
          },
          {
            label: 'Đã Tham Gia Vòng Này',
            data: activeMembers,
            backgroundColor: 'rgba(243, 111, 33, 0.85)',
            borderRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, padding: 8, font: { size: 10 } } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, beginAtZero: true }
        }
      }
    });
  }

  // --- CHART 5: 8 Teams Radar Multi-Criteria Analysis ---
  const ctxRadar = document.getElementById('chart-radar-teams')?.getContext('2d');
  if (ctxRadar && data.teams.length) {
    if (charts.radar) charts.radar.destroy();

    // Normalize metrics 0 - 100 for top 4 teams
    const top4 = data.teams.slice(0, 4);
    const maxExp = Math.max(...data.teams.map(t => parseInt(t.tree_exp, 10)), 1);
    const maxBooks = Math.max(...data.teams.map(t => t.books_count), 1);
    const maxDews = Math.max(...data.teams.map(t => t.dews_count), 1);

    const radarDatasets = top4.map(t => ({
      label: t.shortName,
      data: [
        Math.round((t.tree_exp / maxExp) * 100),
        Math.round((t.books_count / maxBooks) * 100),
        Math.round((t.dews_count / maxDews) * 100),
        Math.round(t.current_participation_rate || 0),
        Math.round(parseFloat(t.avg_participation_rate || 0))
      ],
      borderColor: t.color_code || '#38bdf8',
      backgroundColor: (t.color_code || '#38bdf8') + '33',
      borderWidth: 2,
      pointRadius: 3
    }));

    charts.radar = new Chart(ctxRadar, {
      type: 'radar',
      data: {
        labels: ['Tổng EXP', 'Sách Đã Gieo', 'Lượt Tưới', 'Tham Gia Vòng Này (%)', 'Tỷ Lệ TB Giải (%)'],
        datasets: radarDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, padding: 12 } }
        },
        scales: {
          r: {
            angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
            grid: { color: 'rgba(255, 255, 255, 0.08)' },
            suggestedMin: 0,
            suggestedMax: 100,
            pointLabels: { font: { size: 11, weight: 'bold' }, color: '#cbd5e1' }
          }
        }
      }
    });
  }
}

function updateAdvanceRoundSelect(rounds, currentRound) {
  const sel = document.getElementById('select-advance-round');
  if (!sel || !rounds) return;

  sel.innerHTML = rounds.map(r => `
    <option value="${r.round_number}" ${r.round_number === currentRound.round_number ? 'selected' : ''}>
      Chặng ${r.round_number}: ${r.label}
    </option>
  `).join('');
}

// =========================================================================
// 2. 8 TEAMS MANAGEMENT & DETAIL MODAL
// =========================================================================
function renderTeamsTable() {
  const tbody = document.getElementById('teams-table-body');
  if (!tbody || !analyticsCache || !analyticsCache.teams) return;

  const teams = analyticsCache.teams;
  tbody.innerHTML = teams.map(t => {
    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="p-3.5">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${t.rank === 1 ? 'bg-amber-400 text-slate-950 shadow-md' : (t.rank <= 3 ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400')}">
            ${t.rank}
          </span>
        </td>
        <td class="p-3.5 font-black text-white">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full shrink-0" style="background: ${t.color_code || '#0284c7'};"></span>
            <span>${escapeHtml(t.display_name || t.name)}</span>
          </div>
          <div class="text-[10px] text-slate-500 font-mono">${t.code}</div>
        </td>
        <td class="p-3.5">
          <span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            ${t.levelName}
          </span>
        </td>
        <td class="p-3.5 font-extrabold text-sky-400 text-sm">
          ${(t.tree_exp || 0).toLocaleString()}
        </td>
        <td class="p-3.5 font-extrabold text-amber-400">
          ${t.tree_seeds || 0}/50
        </td>
        <td class="p-3.5 font-bold text-slate-300">
          ${t.actual_members || 0} / ${t.target_members || 40}
        </td>
        <td class="p-3.5">
          <div class="font-extrabold text-white">${t.today_participation_rate ?? t.current_participation_rate ?? 0}%</div>
          <div class="text-[10px] text-slate-400">${t.today_participants ?? t.current_round_participants ?? 0} cán bộ hôm nay</div>
        </td>
        <td class="p-3.5 font-bold text-slate-400">
          ${parseFloat(t.avg_participation_rate || 0).toFixed(1)}%
        </td>
        <td class="p-3.5 font-extrabold text-emerald-400">
          ${t.books_count || 0}
        </td>
        <td class="p-3.5 font-extrabold text-cyan-400">
          ${t.dews_count || 0}
        </td>
        <td class="p-3.5 text-right">
          <button onclick="openTeamModal(${t.id})" class="btn btn-ghost text-[11px] py-1 px-2.5">
            <span>👥</span><span>Chi Tiết</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.openTeamModal = async function(teamId) {
  const modal = document.getElementById('modal-team-detail');
  const tbody = document.getElementById('team-modal-members-body');
  const nameEl = document.getElementById('team-modal-name');
  const subEl = document.getElementById('team-modal-sub');

  if (!modal || !tbody) return;

  const team = analyticsCache?.teams?.find(t => t.id === teamId);
  if (team) {
    nameEl.innerHTML = `<span>🏆</span><span>${escapeHtml(team.display_name || team.name)}</span>`;
    subEl.textContent = `Tổng cộng ${team.actual_members || 0} cán bộ · Đạt ${team.tree_exp.toLocaleString()} EXP`;
  }

  modal.classList.add('show');
  tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-500">Đang tải danh sách thành viên...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/teams/${teamId}/members`);
    const data = await res.json();
    if (data.success && data.data) {
      tbody.innerHTML = data.data.map(m => `
        <tr class="hover:bg-slate-800/40">
          <td class="p-3 font-mono text-slate-400 text-xs">${escapeHtml(m.employee_code || '')}</td>
          <td class="p-3 font-bold text-white">${escapeHtml(m.full_name)}</td>
          <td class="p-3 text-slate-400">${escapeHtml(m.email)}</td>
          <td class="p-3 text-slate-400">${escapeHtml(m.branch || m.parent_department || 'FPT')}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${m.contributed_books_count > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}">
              ${m.contributed_books_count > 0 ? '✅ Đã tham gia' : '⏳ Chưa tham gia'}
            </span>
          </td>
          <td class="p-3 font-bold text-white">${m.contributed_books_count || 0}</td>
          <td class="p-3 font-extrabold text-sky-400">${(m.total_exp_earned || 0).toLocaleString()}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-rose-400">Lỗi tải danh sách thành viên</td></tr>';
  }
};

function closeTeamModal() {
  document.getElementById('modal-team-detail')?.classList.remove('show');
}

// =========================================================================
// 3. 288 USERS DIRECTORY & EXPORT CSV
// =========================================================================
async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  const search = document.getElementById('users-search')?.value.trim() || '';
  const teamId = document.getElementById('users-filter-team')?.value || '';
  const status = document.getElementById('users-filter-status')?.value || '';

  let url = `${API_BASE}/admin/users?page=${usersPageState.page}&limit=${usersPageState.limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (teamId) url += `&teamId=${teamId}`;
  if (status) url += `&status=${status}`;

  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) {
      usersPageState.total = data.data.pagination.total;
      usersPageState.totalPages = data.data.pagination.totalPages;

      // Update Pagination UI
      document.getElementById('users-current-page').textContent = usersPageState.page;
      const start = (usersPageState.page - 1) * usersPageState.limit + 1;
      const end = Math.min(usersPageState.total, usersPageState.page * usersPageState.limit);
      document.getElementById('users-pagination-info').textContent = 
        `Hiển thị ${usersPageState.total > 0 ? start : 0} - ${end} / ${usersPageState.total} nhân sự`;

      renderUsersTable(data.data.users);
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-rose-400">Lỗi tải danh sách nhân sự</td></tr>';
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-500">Không tìm thấy nhân sự nào phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr class="hover:bg-slate-800/40 transition-colors">
      <td class="p-3 font-mono text-slate-400 text-xs">${escapeHtml(u.employee_code || '')}</td>
      <td class="p-3 font-bold text-white">
        ${escapeHtml(u.full_name)}
        <div class="text-[10px] text-slate-500">${escapeHtml(u.job_title || '')}</div>
      </td>
      <td class="p-3 text-slate-400">${escapeHtml(u.email)}</td>
      <td class="p-3 text-slate-300">
        <span class="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold">
          ${escapeHtml(u.branch || 'BGD/TDV/CLB')}
        </span>
      </td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded text-[10.5px] font-bold" style="background: ${(u.team_color || '#0284c7')}22; color: ${u.team_color || '#38bdf8'}; border: 1px solid ${(u.team_color || '#0284c7')}44;">
          ${escapeHtml(u.team_display_name || ('Đội ' + u.team_id))}
        </span>
      </td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${(u.participated_today || u.participated_current_round) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}">
          ${(u.participated_today || u.participated_current_round) ? '✅ Đã gieo' : '⏳ Chưa gieo'}
        </span>
      </td>
      <td class="p-3 font-bold text-emerald-400">${u.contributed_books_count || 0}</td>
      <td class="p-3 font-extrabold text-sky-400">${(u.total_exp_earned || 0).toLocaleString()}</td>
    </tr>
  `).join('');
}

async function exportUsersCSV() {
  try {
    const res = await fetch(`${API_BASE}/admin/users?limit=300`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success || !data.data.users) return;

    const rows = [
      ['Mã Nhân Viên', 'Họ Tên', 'Email', 'Giới Tính', 'Chi Nhánh / Khối', 'Phòng Ban', 'Chức Danh', 'Đội Thi Đua', 'Gieo Hôm Nay', 'Sách Đã Gieo', 'EXP Kiếm Được']
    ];

    data.data.users.forEach(u => {
      rows.push([
        `"${u.employee_code || ''}"`,
        `"${u.full_name || ''}"`,
        `"${u.email || ''}"`,
        `"${u.gender || ''}"`,
        `"${u.branch || ''}"`,
        `"${u.parent_department || ''}"`,
        `"${u.job_title || ''}"`,
        `"${u.team_display_name || ('Đội ' + u.team_id)}"`,
        `"${(u.participated_today || u.participated_current_round) ? 'Đã gieo hôm nay' : 'Chưa gieo hôm nay'}"`,
        u.contributed_books_count || 0,
        u.total_exp_earned || 0
      ]);
    });

    const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Danh_Ba_288_Nhan_Su_FoxREAD_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  } catch (err) {
    alert('Lỗi xuất file CSV');
  }
}

function exportTeamsCSV() {
  if (!analyticsCache || !analyticsCache.teams) return;
  const rows = [
    ['Hạng', 'Mã Đội', 'Tên Đội', 'Cấp Độ Cây', 'Tổng EXP', 'Hạt Giống', 'Thực Tế', 'Chỉ Tiêu', 'Tỷ Lệ Vòng Này (%)', 'Tỷ Lệ TB Giải (%)', 'Sách Gieo', 'Lượt Tưới']
  ];

  analyticsCache.teams.forEach(t => {
    rows.push([
      t.rank,
      `"${t.code}"`,
      `"${t.display_name || t.name}"`,
      `"${t.levelName}"`,
      t.tree_exp,
      t.tree_seeds,
      t.actual_members,
      t.target_members,
      t.current_participation_rate,
      parseFloat(t.avg_participation_rate || 0).toFixed(1),
      t.books_count,
      t.dews_count
    ]);
  });

  const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Bang_Xep_Hang_8_Doi_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

// =========================================================================
// 4. 15-ROUND TRACKER & MATRIX
// =========================================================================
function renderRoundsTimeline() {
  const container = document.getElementById('rounds-stages-container');
  const tbody = document.getElementById('rounds-table-body');
  if (!analyticsCache || !analyticsCache.rounds) return;

  const rounds = analyticsCache.rounds;

  // Stages Cards
  const stages = [
    { title: '🌱 GIAI ĐOẠN 1: Ủ MẦM (Chặng 1 - 3)', desc: 'Tích lũy 50 hạt giống nảy mầm cây tri thức', rounds: rounds.slice(0, 3), color: 'emerald' },
    { title: '🌲 GIAI ĐOẠN 2: VƯƠN MÌNH (Chặng 4 - 12)', desc: 'Gieo sách hàng ngày, mở rộng cành lá và đơm hoa', rounds: rounds.slice(3, 12), color: 'sky' },
    { title: '🌟 GIAI ĐOẠN 3: VỀ ĐÍCH (Chặng 13 - 15)', desc: 'Bứt phá điểm số, kết trái vàng và xác lập Đại Cổ Thụ', rounds: rounds.slice(12, 15), color: 'amber' }
  ];

  if (container) {
    container.innerHTML = stages.map(s => `
      <div class="p-4 rounded-xl bg-slate-900/80 border border-${s.color}-500/30 space-y-3">
        <h4 class="text-xs font-black text-${s.color}-400">${s.title}</h4>
        <p class="text-[11px] text-slate-400">${s.desc}</p>
        <div class="space-y-1.5 pt-1">
          ${s.rounds.map(r => `
            <div class="flex items-center justify-between p-2 rounded-lg ${r.is_active ? 'bg-sky-500/20 border border-sky-400/40 text-white font-black' : 'bg-slate-950/60 text-slate-300'} text-xs">
              <span class="flex items-center gap-1.5">
                <span>${r.is_active ? '🔥' : '📍'}</span>
                <span>Chặng ${r.round_number}</span>
              </span>
              <span class="text-[10px] text-slate-400 font-mono">${new Date(r.start_date).toLocaleDateString('vi-VN')} - ${new Date(r.end_date).toLocaleDateString('vi-VN')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  // Table
  if (tbody) {
    tbody.innerHTML = rounds.map(r => `
      <tr class="hover:bg-slate-800/40 ${r.is_active ? 'bg-sky-500/10' : ''}">
        <td class="p-3 font-bold text-white">#${r.round_number}</td>
        <td class="p-3 font-black text-white">${escapeHtml(r.label)}</td>
        <td class="p-3"><span class="badge badge-info">${r.stage_type}</span></td>
        <td class="p-3 text-slate-400 font-mono text-[11px]">
          ${new Date(r.start_date).toLocaleDateString('vi-VN')} ➔ ${new Date(r.end_date).toLocaleDateString('vi-VN')}
        </td>
        <td class="p-3 font-bold text-white">${r.total_participants || 0} cán bộ</td>
        <td class="p-3 font-bold text-emerald-400">${parseFloat(r.avg_rate || 0).toFixed(1)}%</td>
        <td class="p-3 font-extrabold text-sky-400">${(r.total_raw_exp || 0).toLocaleString()} EXP</td>
        <td class="p-3">
          ${r.is_active ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black">🟢 ĐANG DIỄN RA</span>' : '<span class="text-[10px] text-slate-500 font-bold">Chờ kích hoạt</span>'}
        </td>
      </tr>
    `).join('');
  }
}

// =========================================================================
// 5. BOOKS MODERATION HUB
// =========================================================================
async function loadBooks() {
  const tbody = document.getElementById('books-table-body');
  if (!tbody) return;

  const search = document.getElementById('filter-search')?.value.trim() || '';
  const modStatus = document.getElementById('filter-moderation')?.value || '';
  const visStatus = document.getElementById('filter-visibility')?.value || '';

  let url = `${API_BASE}/admin/books?page=1&limit=50`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (modStatus) url += `&moderation_status=${modStatus}`;
  if (visStatus) url += `&visibility_status=${visStatus}`;

  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) {
      renderBooksTable(data.data.books);
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-rose-400">Lỗi tải danh sách sách</td></tr>';
  }
}

function renderBooksTable(books) {
  const tbody = document.getElementById('books-table-body');
  if (!tbody) return;

  if (!books || books.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500">Không tìm thấy sách nào phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = books.map(b => {
    let modBadge = `<span class="badge badge-pending">Chờ Duyệt</span>`;
    if (b.moderation_status === 'reviewed') modBadge = `<span class="badge badge-reviewed">Đã Duyệt An Toàn</span>`;
    if (b.moderation_status === 'rejected') modBadge = `<span class="badge badge-rejected">Bị Loại Bỏ</span>`;

    let visBadge = `<span class="text-[10px] text-emerald-400 font-bold">🟢 Đang Hiện Trên Cây</span>`;
    if (b.visibility_status !== 'visible') visBadge = `<span class="text-[10px] text-rose-400 font-bold">🔴 Ẩn</span>`;

    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="p-3.5 max-w-sm">
          <div class="font-black text-white text-sm">${escapeHtml(b.title)}</div>
          <div class="text-[11px] text-sky-400 font-bold">${escapeHtml(b.author)} · <span class="text-slate-400">${escapeHtml(b.category || '')}</span></div>
          <p class="text-slate-300 italic text-[11px] mt-1.5 line-clamp-2 bg-slate-950/40 p-2 rounded border border-slate-800">"${escapeHtml(b.quote)}"</p>
        </td>
        <td class="p-3.5">
          <div class="font-bold text-white">${escapeHtml(b.reader_name)}</div>
          <div class="text-[10px] text-slate-400">${b.reader_email ? escapeHtml(b.reader_email) : 'Không có email'}</div>
          <div class="text-[9.5px] text-slate-500 mt-1">${new Date(b.created_at).toLocaleString('vi-VN')}</div>
        </td>
        <td class="p-3.5 space-y-1">
          <div>${modBadge}</div>
          <div>${visBadge}</div>
        </td>
        <td class="p-3.5 font-black text-amber-400">
          ❤️ ${b.likes_count || 0}
        </td>
        <td class="p-3.5 text-right space-x-1 whitespace-nowrap">
          <button onclick="openModModal('${b.id}')" class="btn btn-ghost text-[11px] py-1 px-3">
            <span>⚙️</span><span>Hậu Kiểm</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.openModModal = async function(bookId) {
  try {
    const res = await fetch(`${API_BASE}/admin/books?page=1&limit=50`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    const book = data.data.books.find(x => x.id === bookId);
    if (!book) return;

    currentBookInModal = book;
    document.getElementById('mod-book-title').textContent = book.title;
    document.getElementById('mod-book-author').textContent = book.author;
    document.getElementById('mod-book-quote').textContent = `"${book.quote}"`;
    document.getElementById('mod-book-sender').textContent = `Người gửi: ${book.reader_name} (${book.reader_email || 'N/A'}) - Gieo lúc: ${new Date(book.created_at).toLocaleString('vi-VN')}`;
    document.getElementById('mod-notes').value = book.moderation_notes || '';
    document.getElementById('mod-deduct-exp').checked = false;

    document.getElementById('mod-modal').classList.add('show');
  } catch (err) {
    console.error(err);
  }
};

function closeModModal() {
  document.getElementById('mod-modal')?.classList.remove('show');
  currentBookInModal = null;
}

async function handleModalAction(modStatus, visStatus) {
  if (!currentBookInModal) return;

  const notes = document.getElementById('mod-notes').value;
  const deductExp = document.getElementById('mod-deduct-exp').checked;

  try {
    const res = await fetch(`${API_BASE}/admin/books/${currentBookInModal.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        moderation_status: modStatus,
        visibility_status: visStatus,
        moderation_notes: notes,
        deductExp
      })
    });
    const data = await res.json();
    if (data.success) {
      closeModModal();
      loadBooks();
      loadAnalytics();
    } else {
      alert(data.message || 'Lỗi cập nhật');
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ');
  }
}

// =========================================================================
// 6. EXP LEDGER
// =========================================================================
async function loadLedger() {
  const tbody = document.getElementById('ledger-table-body');
  if (!tbody) return;

  const type = document.getElementById('ledger-filter-type')?.value || '';
  const teamId = document.getElementById('ledger-filter-team')?.value || '';

  let url = `${API_BASE}/admin/ledger?page=${ledgerPageState.page}&limit=${ledgerPageState.limit}`;
  if (type) url += `&type=${type}`;
  if (teamId) url += `&teamId=${teamId}`;

  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) {
      ledgerPageState.total = data.data.pagination.total;
      ledgerPageState.totalPages = data.data.pagination.totalPages;

      // Update Pagination UI
      document.getElementById('ledger-current-page').textContent = ledgerPageState.page;
      const start = (ledgerPageState.page - 1) * ledgerPageState.limit + 1;
      const end = Math.min(ledgerPageState.total, ledgerPageState.page * ledgerPageState.limit);
      document.getElementById('ledger-pagination-info').textContent = 
        `Hiển thị ${ledgerPageState.total > 0 ? start : 0} - ${end} / ${ledgerPageState.total} giao dịch`;

      renderLedgerTable(data.data.ledger);
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-rose-400">Lỗi tải sổ cái EXP</td></tr>';
  }
}

function renderLedgerTable(ledger) {
  const tbody = document.getElementById('ledger-table-body');
  if (!tbody) return;

  if (!ledger || ledger.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">Chưa có giao dịch EXP nào.</td></tr>';
    return;
  }

  const typeLabels = {
    'BOOK_CONTRIBUTION': '📚 Gieo Sách (+15 EXP)',
    'DAILY_DEW': '💧 Tưới Sương (+1 EXP)',
    'QUOTE_LIKE': '❤️ Thích Trích Dẫn (+2 EXP)',
    'FRUIT_HARVEST': '🍎 Hái Quả (+5 EXP)',
    'ADMIN_BONUS': '🎁 Thưởng Sự Kiện',
    'MODERATION_PENALTY': '🚫 Phạt Vi Phạm'
  };

  tbody.innerHTML = ledger.map(item => {
    const isPositive = item.amount >= 0;
    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="p-3 text-slate-400 font-mono text-xs">
          ${new Date(item.created_at).toLocaleString('vi-VN')}
        </td>
        <td class="p-3 font-bold text-white">
          <span class="px-2 py-0.5 rounded text-[10.5px] ${isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}">
            ${typeLabels[item.type] || item.type}
          </span>
        </td>
        <td class="p-3 font-extrabold text-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'}">
          ${isPositive ? '+' : ''}${item.amount} EXP
        </td>
        <td class="p-3 font-bold text-slate-200">
          ${escapeHtml(item.user_name || 'Khách vãng lai')}
          <div class="text-[10px] text-slate-500">${escapeHtml(item.user_email || item.user_fingerprint?.slice(0, 12) || '')}</div>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10.5px] font-bold" style="background: ${(item.team_color || '#0284c7')}22; color: ${item.team_color || '#38bdf8'};">
            ${escapeHtml(item.team_display_name || (item.team_id ? 'Đội ' + item.team_id : 'Cây Chung'))}
          </span>
        </td>
        <td class="p-3 font-mono text-[10px] text-slate-500 truncate max-w-xs">
          ${item.reference_id || 'N/A'}
        </td>
      </tr>
    `;
  }).join('');
}

// =========================================================================
// 7. AUDIT LOGS
// =========================================================================
async function loadAuditLogs() {
  const tbody = document.getElementById('audit-table-body');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      tbody.innerHTML = data.data.map(a => `
        <tr class="hover:bg-slate-800/40">
          <td class="p-3 text-slate-400 font-mono text-xs">${new Date(a.created_at).toLocaleString('vi-VN')}</td>
          <td class="p-3 font-bold text-sky-300">${escapeHtml(a.admin_username || 'System')}</td>
          <td class="p-3"><span class="badge badge-reviewed">${escapeHtml(a.action)}</span></td>
          <td class="p-3 text-slate-300 font-mono text-xs">${escapeHtml(a.target_type)}</td>
          <td class="p-3 font-mono text-[10px] text-slate-400 max-w-sm truncate">${escapeHtml(JSON.stringify(a.metadata || {}))}</td>
          <td class="p-3 text-slate-500 font-mono text-[10px]">${escapeHtml(a.ip_address || '127.0.0.1')}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-rose-400">Lỗi tải nhật ký kiểm toán</td></tr>';
  }
}


// =========================================================================
// 8. CONTENT & RULES CUSTOMIZER
// =========================================================================
let currentRulesSettings = null;

function bindContentRulesEvents() {
  // Subtab switching
  const subtabWelcome = document.getElementById('subtab-btn-welcome');
  const subtabRules = document.getElementById('subtab-btn-rules');
  const subpaneWelcome = document.getElementById('subpane-welcome');
  const subpaneRules = document.getElementById('subpane-rules');

  if (subtabWelcome && subtabRules && subpaneWelcome && subpaneRules) {
    subtabWelcome.addEventListener('click', () => {
      subtabWelcome.className = 'btn btn-primary text-xs py-1.5 px-3';
      subtabRules.className = 'btn btn-ghost text-xs py-1.5 px-3';
      subpaneWelcome.classList.remove('hidden');
      subpaneRules.classList.add('hidden');
    });

    subtabRules.addEventListener('click', () => {
      subtabRules.className = 'btn btn-primary text-xs py-1.5 px-3';
      subtabWelcome.className = 'btn btn-ghost text-xs py-1.5 px-3';
      subpaneRules.classList.remove('hidden');
      subpaneWelcome.classList.add('hidden');
    });
  }

  // Welcome Live Preview listeners
  ['cfg-welcome-badge', 'cfg-welcome-title', 'cfg-welcome-subtitle', 'cfg-welcome-metaphor', 'cfg-welcome-pillar1', 'cfg-welcome-pillar2', 'cfg-welcome-pillar3', 'cfg-welcome-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', syncWelcomePreview);
  });

  // Welcome Save & Reset
  const btnSaveWelcome = document.getElementById('btn-save-welcome');
  if (btnSaveWelcome) {
    btnSaveWelcome.addEventListener('click', saveWelcomeSettings);
  }

  const btnResetWelcome = document.getElementById('btn-reset-welcome');
  if (btnResetWelcome) {
    btnResetWelcome.addEventListener('click', () => resetContentSetting('welcome_content'));
  }

  // Rules Save & Reset
  const btnSaveRules = document.getElementById('btn-save-rules');
  if (btnSaveRules) {
    btnSaveRules.addEventListener('click', saveRulesSettings);
  }

  const btnResetRules = document.getElementById('btn-reset-rules');
  if (btnResetRules) {
    btnResetRules.addEventListener('click', () => resetContentSetting('rules_content'));
  }
}

function syncWelcomePreview() {
  const badge = document.getElementById('cfg-welcome-badge')?.value || '🌱 VƯỜN TRI THỨC';
  const title = document.getElementById('cfg-welcome-title')?.value || 'Mỗi Cuốn Sách Là Một Hạt Mầm';
  const subtitle = document.getElementById('cfg-welcome-subtitle')?.value || 'Mỗi Độc Giả Là Một Người Gieo Tri Thức';
  const metaphor = document.getElementById('cfg-welcome-metaphor')?.value || '';
  const p1 = document.getElementById('cfg-welcome-pillar1')?.value || 'Gieo Hạt Tri Thức';
  const p2 = document.getElementById('cfg-welcome-pillar2')?.value || 'Lan Tỏa Tri Thức';
  const p3 = document.getElementById('cfg-welcome-pillar3')?.value || 'Nhật Ký Tri Thức';
  const btn = document.getElementById('cfg-welcome-btn')?.value || 'Khám Phá Vườn Tri Thức';

  const prevBadge = document.getElementById('preview-welcome-badge');
  const prevTitle = document.getElementById('preview-welcome-title');
  const prevSubtitle = document.getElementById('preview-welcome-subtitle');
  const prevMetaphor = document.getElementById('preview-welcome-metaphor');
  const prevP1 = document.getElementById('preview-welcome-p1');
  const prevP2 = document.getElementById('preview-welcome-p2');
  const prevP3 = document.getElementById('preview-welcome-p3');
  const prevBtn = document.getElementById('preview-welcome-btn');

  if (prevBadge) prevBadge.textContent = badge;
  if (prevTitle) prevTitle.textContent = title;
  if (prevSubtitle) prevSubtitle.textContent = subtitle;
  if (prevMetaphor) prevMetaphor.textContent = metaphor;
  if (prevP1) prevP1.textContent = p1;
  if (prevP2) prevP2.textContent = p2;
  if (prevP3) prevP3.textContent = p3;
  if (prevBtn) prevBtn.textContent = btn;
}

async function loadContentSettings() {
  try {
    const res = await fetch(`${API_BASE}/admin/content-settings`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const settings = data.data;

    // 1. Populate Welcome
    if (settings.welcome_content) {
      const w = settings.welcome_content;
      setVal('cfg-welcome-badge', w.badge || '');
      setVal('cfg-welcome-title', w.title || '');
      setVal('cfg-welcome-subtitle', w.subtitle || '');
      setVal('cfg-welcome-metaphor', w.metaphor || '');
      setVal('cfg-welcome-pillar1', w.pillar1 || '');
      setVal('cfg-welcome-pillar2', w.pillar2 || '');
      setVal('cfg-welcome-pillar3', w.pillar3 || '');
      setVal('cfg-welcome-btn', w.buttonText || '');
      syncWelcomePreview();
    }

    // 2. Populate Rules
    if (settings.rules_content) {
      const r = settings.rules_content;
      currentRulesSettings = r;

      setVal('cfg-rules-badge', r.badge || '');
      setVal('cfg-rules-milestones-title', r.milestonesTitle || '🌱 5 GIAI ĐOẠN SINH TRƯỞNG CỦA CÂY TRI THỨC');
      renderMilestonesEditor(r.milestones || []);

      setVal('cfg-rules-interactions-title', r.interactionsTitle || 'Cơ Chế Tương Tác & Điểm EXP Nuôi Cây');
      renderInteractionsEditor(r.interactions || []);

      setVal('cfg-rules-confirm-btn', r.confirmButton || '');
    }
  } catch (err) {
    console.error('Error loading content settings:', err);
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function renderMilestonesEditor(milestones) {
  const container = document.getElementById('cfg-rules-milestones-container');
  if (!container) return;

  container.innerHTML = milestones.map((m, idx) => `
    <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 milestone-item" data-index="${idx}">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">${m.level}</span>
          <input type="text" class="m-label px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold text-xs w-72" value="${escapeHtml(m.label || m.title || ('Giai đoạn ' + m.level))}">
        </div>
        <input type="text" class="m-range px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-sky-400 text-xs w-48 text-right font-mono" value="${escapeHtml(m.range || '')}" placeholder="Mốc EXP / Hạt">
      </div>
      <textarea class="m-effect w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-xs" rows="2">${escapeHtml(m.effect || m.desc || '')}</textarea>
    </div>
  `).join('');
}

function renderInteractionsEditor(interactions) {
  const container = document.getElementById('cfg-rules-interactions-container');
  if (!container) return;

  container.innerHTML = interactions.map((item, idx) => `
    <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 interaction-item" data-index="${idx}">
      <div class="flex items-center justify-between gap-2">
        <input type="text" class="i-action px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold text-xs flex-1" value="${escapeHtml(item.action || (item.icon ? item.icon + ' ' : '') + (item.title || ''))}">
        <input type="text" class="i-exp px-2 py-1 rounded bg-slate-900 border border-slate-700 text-amber-400 font-bold text-xs flex-1 text-right" value="${escapeHtml(item.exp || '+5 EXP')}">
      </div>
      <textarea class="i-note w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-400 text-xs" rows="2">${escapeHtml(item.note || item.desc || '')}</textarea>
    </div>
  `).join('');
}

async function saveWelcomeSettings() {
  const btn = document.getElementById('btn-save-welcome');
  const payload = {
    badge: getVal('cfg-welcome-badge') || '🌱 VƯỜN TRI THỨC',
    title: getVal('cfg-welcome-title') || 'Mỗi Cuốn Sách Là Một Hạt Mầm',
    subtitle: getVal('cfg-welcome-subtitle') || 'Mỗi Độc Giả Là Một Người Gieo Tri Thức',
    metaphor: getVal('cfg-welcome-metaphor'),
    pillar1: getVal('cfg-welcome-pillar1') || 'Gieo Hạt Tri Thức',
    pillar2: getVal('cfg-welcome-pillar2') || 'Lan Tỏa Tri Thức',
    pillar3: getVal('cfg-welcome-pillar3') || 'Nhật Ký Tri Thức',
    buttonText: getVal('cfg-welcome-btn') || 'Khám Phá Vườn Tri Thức'
  };

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span><span>Đang lưu...</span>';
    }
    const res = await fetch(`${API_BASE}/admin/content-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ key: 'welcome_content', value: payload })
    });
    const data = await res.json();
    if (data.success) {
      alert('✅ Lưu cấu hình Popup Chào Mừng thành công! Mọi độc giả đang mở trang sẽ thấy nội dung mới ngay lập tức.');
    } else {
      alert('❌ Lỗi: ' + (data.message || 'Không thể lưu'));
    }
  } catch (err) {
    alert('❌ Lỗi kết nối máy chủ');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>💾</span><span>Lưu Cấu Hình Chào Mừng</span>';
    }
  }
}

async function saveRulesSettings() {
  const btn = document.getElementById('btn-save-rules');

  // Gather milestones
  const milestoneEls = document.querySelectorAll('.milestone-item');
  const milestones = [];
  milestoneEls.forEach((el, idx) => {
    milestones.push({
      level: idx,
      label: el.querySelector('.m-label')?.value || '',
      range: el.querySelector('.m-range')?.value || '',
      effect: el.querySelector('.m-effect')?.value || ''
    });
  });

  // Gather interactions
  const interactionEls = document.querySelectorAll('.interaction-item');
  const interactions = [];
  interactionEls.forEach(el => {
    interactions.push({
      action: el.querySelector('.i-action')?.value || '',
      exp: el.querySelector('.i-exp')?.value || '',
      note: el.querySelector('.i-note')?.value || ''
    });
  });

  const payload = {
    badge: getVal('cfg-rules-badge') || 'THỂ LỆ & QUY TRÌNH NUÔI DƯỠNG CÂY TRI THỨC',
    milestonesTitle: getVal('cfg-rules-milestones-title') || '🌱 5 GIAI ĐOẠN SINH TRƯỞNG CỦA CÂY TRI THỨC',
    milestones: milestones.length > 0 ? milestones : (currentRulesSettings?.milestones || []),
    interactionsTitle: getVal('cfg-rules-interactions-title') || 'Cơ Chế Tương Tác & Điểm EXP Nuôi Cây',
    interactions: interactions.length > 0 ? interactions : (currentRulesSettings?.interactions || []),
    confirmButton: getVal('cfg-rules-confirm-btn') || '🌱 Đã Hiểu & Bắt Đầu Gieo Mầm Nuôi Cây'
  };

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span><span>Đang lưu...</span>';
    }
    const res = await fetch(`${API_BASE}/admin/content-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ key: 'rules_content', value: payload })
    });
    const data = await res.json();
    if (data.success) {
      alert('✅ Lưu cấu hình Thể Lệ thành công! Nội dung thể lệ trên giao diện người đọc đã được cập nhật.');
    } else {
      alert('❌ Lỗi: ' + (data.message || 'Không thể lưu'));
    }
  } catch (err) {
    alert('❌ Lỗi kết nối máy chủ');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>💾</span><span>Lưu Cấu Hình Thể Lệ</span>';
    }
  }
}

async function resetContentSetting(key) {
  const name = key === 'welcome_content' ? 'Popup Chào Mừng' : 'Thể Lệ 15 Lượt';
  if (!confirm(`Bạn có chắc chắn muốn khôi phục nội dung [${name}] về mặc định của BTC?`)) return;

  try {
    const res = await fetch(`${API_BASE}/admin/content-settings/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Đã khôi phục [${name}] về mặc định thành công!`);
      loadContentSettings();
    } else {
      alert('❌ Lỗi: ' + (data.message || 'Không thể khôi phục'));
    }
  } catch (err) {
    alert('❌ Lỗi kết nối máy chủ');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
