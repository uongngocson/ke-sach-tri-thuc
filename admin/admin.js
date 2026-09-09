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
let teamsFilterDate = new Date().toISOString().slice(0, 10);
let usersFilterDate = new Date().toISOString().slice(0, 10);

function formatDateVN(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayISODate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

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
    if (isTabActive('moderation')) {
      loadBooks();
      fetchQueueStatus();
    }
    if (isTabActive('ledger')) loadLedger();
  });

  socket.on('admin:book:credibility_scored', (scoredBook) => {
    if (scoredBook && scoredBook.id) {
      updateBookCredibilityInDom(scoredBook);
    }
    fetchQueueStatus();
  });

  socket.on('book:credibility_scored', (scoredBook) => {
    if (scoredBook && scoredBook.id) {
      updateBookCredibilityInDom(scoredBook);
    }
    fetchQueueStatus();
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
    'deep-analytics': '📊 Báo Cáo Phân Tích Chuyên Sâu 3 Chiều',
    'teams': '🏆 Bảng Xếp Hạng & Phân Tích 8 Đội Thi Đua',
    'users': '👥 Danh Bạ & Trạng Thái 288 Nhân Sự',
    'moderation': '📚 Trung Tâm Hậu Kiểm Sách & Trích Dẫn',
    'ledger': '📑 Sổ Cái EXP Minh Bạch Toàn Giải',
    'content-rules': '🎨 Tùy Biến Thể Lệ & Giao Diện Chào Mừng',
    'tools': '⚙️ Công Cụ Điều Phối & Nhật Ký Kiểm Toán',
    'admin-accounts': '🛡️ Quản Trị Viên & Phân Quyền Command Center'
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
      if (tab === 'deep-analytics') loadDeepDiveAnalytics();
      if (tab === 'teams') renderTeamsTable();
      if (tab === 'users') loadUsers();
      if (tab === 'moderation') loadBooks();
      if (tab === 'ledger') loadLedger();
      if (tab === 'content-rules') loadContentSettings();
      if (tab === 'tools') loadAuditLogs();
      if (tab === 'admin-accounts') {
        loadAdminAccounts();
        loadAdminAccountStats();
      }
    });
  });
}

function bindActionEvents() {
  bindContentRulesEvents();
  bindAdminAccountEvents();
  bindPersonnelEvents();
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
  document.getElementById('users-filter-team')?.addEventListener('change', () => {
    usersPageState.page = 1;
    loadUsers();
  });
  document.getElementById('users-filter-status')?.addEventListener('change', () => {
    usersPageState.page = 1;
    loadUsers();
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

  // Export CSV (Single Date & All Days)
  document.getElementById('btn-export-users-csv')?.addEventListener('click', exportUsersCSV);
  document.getElementById('btn-export-users-all-csv')?.addEventListener('click', exportUsersAllDaysCSV);
  document.getElementById('btn-export-teams')?.addEventListener('click', exportTeamsCSV);
  document.getElementById('btn-export-teams-all')?.addEventListener('click', exportTeamsAllDaysCSV);

  // Books Subtabs (Active vs Deleted)
  document.getElementById('subtab-books-active')?.addEventListener('click', () => switchBookViewMode('active'));
  document.getElementById('subtab-books-deleted')?.addEventListener('click', () => switchBookViewMode('deleted'));

  // Books Refresh & Filters
  document.getElementById('btn-refresh-books')?.addEventListener('click', loadBooks);
  document.getElementById('btn-ai-scan-queue')?.addEventListener('click', triggerAiScanQueue);
  document.getElementById('btn-ai-batch-score')?.addEventListener('click', triggerAiBatchScore);
  document.getElementById('filter-search')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadBooks();
  });
  document.getElementById('filter-moderation')?.addEventListener('change', loadBooks);
  document.getElementById('filter-visibility')?.addEventListener('change', (e) => {
    // Tự động đồng bộ giao diện Subtab khi chọn dropdown visibility
    syncSubtabWithVisibility(e.target.value);
    loadBooks();
  });
  document.getElementById('filter-credibility')?.addEventListener('change', loadBooks);

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

  // Deep-Dive Analytics Controls
  bindDeepDiveAnalyticsEvents();

  // 8 Teams Date Filter Controls
  bindTeamsFilterEvents();

  // 288 Personnel Directory Date Filter Controls
  bindUsersFilterEvents();

  // Danger Zone: Wipe Full Operational Data
  bindWipeDataEvents();
}

function bindTeamsFilterEvents() {
  const dateInput = document.getElementById('teams-filter-date');
  const btnToday = document.getElementById('btn-teams-date-today');
  const btnYesterday = document.getElementById('btn-teams-date-yesterday');
  const btnApply = document.getElementById('btn-teams-apply-filter');
  const btnReset = document.getElementById('btn-teams-reset-filter');

  if (dateInput) {
    dateInput.value = teamsFilterDate || getTodayISODate();
    dateInput.addEventListener('change', () => {
      if (dateInput.value) {
        loadTeamsData(dateInput.value);
      }
    });
  }

  if (btnToday) {
    btnToday.addEventListener('click', () => {
      const today = getTodayISODate();
      if (dateInput) dateInput.value = today;
      loadTeamsData(today);
    });
  }

  if (btnYesterday) {
    btnYesterday.addEventListener('click', () => {
      const yesterday = getYesterdayISODate();
      if (dateInput) dateInput.value = yesterday;
      loadTeamsData(yesterday);
    });
  }

  if (btnApply) {
    btnApply.addEventListener('click', () => {
      const val = dateInput ? dateInput.value : '';
      if (val) {
        loadTeamsData(val);
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const today = getTodayISODate();
      if (dateInput) dateInput.value = today;
      loadTeamsData(today);
    });
  }
}

function bindUsersFilterEvents() {
  const dateInput = document.getElementById('users-filter-date');
  const btnToday = document.getElementById('btn-users-date-today');
  const btnYesterday = document.getElementById('btn-users-date-yesterday');
  const btnApply = document.getElementById('btn-users-apply-filter');
  const btnReset = document.getElementById('btn-users-reset-date');

  if (dateInput) {
    dateInput.value = usersFilterDate || getTodayISODate();
    dateInput.addEventListener('change', () => {
      if (dateInput.value) {
        usersFilterDate = dateInput.value;
        usersPageState.page = 1;
        loadUsers();
      }
    });
  }

  if (btnToday) {
    btnToday.addEventListener('click', () => {
      const today = getTodayISODate();
      usersFilterDate = today;
      if (dateInput) dateInput.value = today;
      usersPageState.page = 1;
      loadUsers();
    });
  }

  if (btnYesterday) {
    btnYesterday.addEventListener('click', () => {
      const yesterday = getYesterdayISODate();
      usersFilterDate = yesterday;
      if (dateInput) dateInput.value = yesterday;
      usersPageState.page = 1;
      loadUsers();
    });
  }

  if (btnApply) {
    btnApply.addEventListener('click', () => {
      const val = dateInput ? dateInput.value : '';
      if (val) {
        usersFilterDate = val;
        usersPageState.page = 1;
        loadUsers();
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const today = getTodayISODate();
      usersFilterDate = today;
      if (dateInput) dateInput.value = today;
      usersPageState.page = 1;
      loadUsers();
    });
  }
}

async function loadAllDashboardData() {
  await loadAnalytics();
  if (isTabActive('deep-analytics')) loadDeepDiveAnalytics();
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
    const url = teamsFilterDate 
      ? `${API_BASE}/admin/analytics/overview?date=${encodeURIComponent(teamsFilterDate)}`
      : `${API_BASE}/admin/analytics/overview`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) return;

    analyticsCache = data.data;
    updateKPICards(analyticsCache.kpi);
    renderCharts(analyticsCache);
    updateAdvanceRoundSelect(analyticsCache.rounds, analyticsCache.kpi.currentRound);
    if (isTabActive('teams')) renderTeamsTable();
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

  // --- CHART 2: 8 Teams Contribution Doughnut (Zero Book Categories - Only 8 Teams) ---
  const ctxCat = document.getElementById('chart-categories')?.getContext('2d');
  if (ctxCat) {
    if (charts.categories) charts.categories.destroy();

    const teamItems = (data.categories && data.categories.length > 0) 
      ? data.categories 
      : ((data.teams && data.teams.length > 0) ? data.teams : []);

    const defaultColors = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#70B928'];
    const catLabels = teamItems.map((t, idx) => t.display_name || t.name || t.category || `Đội ${t.id || (idx + 1)}`);
    const catCounts = teamItems.map(t => parseInt(t.count ?? t.total_books ?? t.books_count ?? t.tree_exp ?? 0, 10));
    const catColors = teamItems.map((t, idx) => t.color_code || defaultColors[idx % defaultColors.length]);

    charts.categories = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: catLabels.length ? catLabels : ['8 Đội Thi Đua'],
        datasets: [{
          data: catCounts.length ? catCounts : [1],
          backgroundColor: catColors,
          borderColor: '#0f172a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { 
            position: 'bottom', 
            labels: { 
              boxWidth: 10, 
              padding: 8, 
              font: { size: 10, weight: 'bold' },
              color: '#94a3b8'
            } 
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const val = ctx.raw || 0;
                return ` ${ctx.label}: ${val} sách đã gieo`;
              }
            }
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
// 1.5. PHÂN TÍCH CHUYÊN SÂU 3 CHIỀU (DEEP-DIVE ANALYTICS)
// =========================================================================
let deepAnalyticsCache = null;

function bindDeepDiveAnalyticsEvents() {
  const teamFilter = document.getElementById('deep-analytics-team-filter');
  const refreshBtn = document.getElementById('btn-refresh-deep-analytics');

  if (teamFilter) {
    teamFilter.addEventListener('change', () => {
      loadDeepDiveAnalytics(teamFilter.value);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadDeepDiveAnalytics(teamFilter ? teamFilter.value : '');
    });
  }
}

async function loadDeepDiveAnalytics(teamId = '') {
  const filterVal = (teamId !== undefined && teamId !== null) ? teamId : (document.getElementById('deep-analytics-team-filter')?.value || '');
  
  // Update scope badge
  const scopeBadge = document.getElementById('deep-scope-badge');
  if (scopeBadge) {
    scopeBadge.textContent = filterVal ? `Cây Số ${filterVal} (Đội ${filterVal})` : 'Toàn Vườn (8 Cây)';
    scopeBadge.className = filterVal 
      ? 'text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
      : 'text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30';
  }

  try {
    const url = `${API_BASE}/admin/analytics/deep-dive${filterVal ? `?teamId=${filterVal}` : ''}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success) {
      console.error('Failed to load deep-dive analytics:', result.message);
      return;
    }

    const data = result.data;
    deepAnalyticsCache = data;

    renderDeepContributors(data.contributors);
    renderDeepContent(data.content);
    renderDeepGrowth(data.growth);
  } catch (err) {
    console.error('Error fetching deep-dive analytics:', err);
  }
}

// -------------------------------------------------------------
// PHẦN 1: ĐÓNG GÓP CÁ NHÂN (HALL OF FAME)
// -------------------------------------------------------------
function renderDeepContributors(contributors) {
  if (!contributors) return;

  // 1.1: Top EXP
  const expContainer = document.getElementById('deep-top-exp-list');
  if (expContainer) {
    const list = contributors.topExp || [];
    if (list.length === 0) {
      expContainer.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Chưa có dữ liệu đóng góp EXP</div>';
    } else {
      expContainer.innerHTML = list.map((u, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        const color = u.team_color || '#38bdf8';
        return `
          <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-amber-400/40 transition">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-6 text-center text-xs font-black ${idx < 3 ? 'text-amber-400' : 'text-slate-500'}">${medal}</span>
              <div class="min-w-0">
                <div class="text-xs font-bold text-white truncate">${escapeHtml(u.nickname || 'Bút danh')}</div>
                <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span style="color: ${color};" class="font-bold">${escapeHtml(u.team_display_name || u.team_name || 'Đội ' + u.team_id)}</span>
                </div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="text-xs font-black text-amber-400 font-mono">+${Number(u.total_exp_earned || 0).toLocaleString()}</span>
              <div class="text-[9.5px] text-slate-500">${u.contributed_books_count || 0} sách</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 1.2: Top Waterers (kèm Streak)
  const waterContainer = document.getElementById('deep-top-waterers-list');
  if (waterContainer) {
    const list = contributors.topWaterers || [];
    if (list.length === 0) {
      waterContainer.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Chưa có lượt tưới cây nào</div>';
    } else {
      waterContainer.innerHTML = list.map((u, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        const color = u.team_color || '#38bdf8';
        return `
          <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-sky-400/40 transition">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-6 text-center text-xs font-black ${idx < 3 ? 'text-sky-400' : 'text-slate-500'}">${medal}</span>
              <div class="min-w-0">
                <div class="text-xs font-bold text-white truncate">${escapeHtml(u.nickname || 'Bút danh')}</div>
                <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span style="color: ${color};" class="font-bold">${escapeHtml(u.team_display_name || u.team_name || 'Đội ' + u.team_id)}</span>
                </div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="text-xs font-black text-sky-400">${u.total_dews || 0} giọt</span>
              <div class="text-[9.5px] text-emerald-400 font-bold">🔥 Chuỗi ${u.max_streak || 1} ngày</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 1.3: Top Seeders
  const seedContainer = document.getElementById('deep-top-seeders-list');
  if (seedContainer) {
    const list = contributors.topSeeders || [];
    if (list.length === 0) {
      seedContainer.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Chưa có mầm tri thức nào</div>';
    } else {
      seedContainer.innerHTML = list.map((u, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        const color = u.team_color || '#10b981';
        return `
          <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-emerald-400/40 transition">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-6 text-center text-xs font-black ${idx < 3 ? 'text-emerald-400' : 'text-slate-500'}">${medal}</span>
              <div class="min-w-0">
                <div class="text-xs font-bold text-white truncate">${escapeHtml(u.nickname || 'Bút danh')}</div>
                <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span style="color: ${color};" class="font-bold">${escapeHtml(u.team_display_name || u.team_name || 'Đội ' + u.team_id)}</span>
                </div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="text-xs font-black text-emerald-400">${u.books_count || 0} mầm</span>
              <div class="text-[9.5px] text-rose-400">❤️ ${u.total_likes_received || 0} tim</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// -------------------------------------------------------------
// PHẦN 2: PHÂN TÍCH NỘI DUNG TRI THỨC CỦA CÂY
// -------------------------------------------------------------
function renderDeepContent(content) {
  if (!content) return;

  // 2.1: Top Books Trích Dẫn Nhiều Nhất
  const booksTbody = document.getElementById('deep-top-books-tbody');
  if (booksTbody) {
    const list = content.topBooks || [];
    if (list.length === 0) {
      booksTbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Chưa có dữ liệu sách</td></tr>';
    } else {
      booksTbody.innerHTML = list.map(b => {
        const teamName = b.team_display_name || b.team_name || (b.team_id ? `Đội ${b.team_id}` : 'Toàn Vườn');
        const teamColor = b.team_color || '#38bdf8';
        return `
        <tr>
          <td>
            <div class="font-bold text-white text-xs">${escapeHtml(b.title)}</div>
            <div class="text-[10px] text-slate-400">${escapeHtml(b.author || 'Khuyết Danh')}</div>
          </td>
          <td>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border" style="color: ${teamColor}; border-color: ${teamColor}40; background-color: ${teamColor}15;">
              ${escapeHtml(teamName)}
            </span>
          </td>
          <td class="text-center font-black text-emerald-400 text-xs">${b.quote_count || 0}</td>
          <td class="text-center font-black text-rose-400 text-xs">❤️ ${b.total_likes || 0}</td>
        </tr>
      `;
      }).join('');
    }
  }

  // 2.2: Những câu cốt được tương tác / thích nhiều nhất
  const quotesCards = document.getElementById('deep-top-quotes-cards');
  if (quotesCards) {
    const list = content.topQuotes || [];
    if (list.length === 0) {
      quotesCards.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Chưa có câu cốt nào được chia sẻ</div>';
    } else {
      quotesCards.innerHTML = list.map(q => {
        const teamColor = q.team_color || '#38bdf8';
        return `
          <div class="p-3 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 transition space-y-2">
            <p class="text-xs text-slate-200 italic leading-relaxed border-l-2 border-emerald-400 pl-2.5">
              "${escapeHtml(q.quote)}"
            </p>
            <div class="flex items-center justify-between text-[10.5px] pt-1 border-t border-slate-800/60">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="font-bold text-white truncate">${escapeHtml(q.reader_name || 'Bút danh')}</span>
                <span class="text-slate-500">•</span>
                <span style="color: ${teamColor};" class="font-bold truncate">${escapeHtml(q.team_display_name || q.team_name || 'Đội ' + q.team_id)}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-slate-400 font-medium truncate max-w-[140px]">📖 ${escapeHtml(q.title)}</span>
                <span class="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-bold border border-rose-500/30">
                  ❤️ ${q.likes_count || 0}
                </span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// -------------------------------------------------------------
// PHẦN 3: SỰ PHÁT TRIỂN CỦA CÂY & SO SÁNH 8 CÂY
// -------------------------------------------------------------
const DEEP_ACTIVITY_LABELS = {
  'BOOK_CONTRIBUTION': '📚 Gieo Mầm Sách Mới',
  'DAILY_DEW': '💧 Tưới Nước Sương Sớm',
  'ROUND_COMPLETION': '🏆 Thưởng Hoàn Thành Vòng',
  'ADMIN_AWARD': '🎁 Khen Thưởng Ban Giám Đốc',
  'ADMIN_DEDUCTION': '⚠️ Điều Chỉnh Trừ Điểm'
};

function renderDeepGrowth(growth) {
  if (!growth) return;

  // 3.1: Trees Comparison Matrix Table
  const matrixTbody = document.getElementById('deep-trees-matrix-tbody');
  if (matrixTbody) {
    const trees = growth.treesComparison || [];
    if (trees.length === 0) {
      matrixTbody.innerHTML = '<tr><td colspan="10" class="p-6 text-center text-slate-500">Chưa có số liệu 8 cây</td></tr>';
    } else {
      matrixTbody.innerHTML = trees.map((t, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        const color = t.color_code || '#38bdf8';
        const pct = Math.min(100, Math.max(0, t.progressPercent || 0));
        return `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="text-center font-black text-sm ${idx < 3 ? 'text-amber-400' : 'text-slate-500'}">${medal}</td>
            <td>
              <div class="flex items-center gap-2">
                <span class="text-base">${t.icon || '🌳'}</span>
                <div>
                  <div class="font-black text-white text-xs" style="color: ${color};">${escapeHtml(t.display_name || t.name)}</div>
                  <div class="text-[10px] text-slate-400 italic">${escapeHtml(t.slogan || '')}</div>
                </div>
              </div>
            </td>
            <td>
              <div class="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
                <span>${escapeHtml(t.levelName || 'Mầm Non')}</span>
                <span class="text-sky-400">${pct}%</span>
              </div>
              <div class="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full" style="width: ${pct}%;"></div>
              </div>
            </td>
            <td class="text-right font-black font-mono text-white text-xs">
              ${Number(t.total_exp || t.tree_exp || 0).toLocaleString()}
            </td>
            <td class="text-center font-bold text-sky-400 text-xs">💧 ${t.total_dews || 0}</td>
            <td class="text-center font-bold text-emerald-400 text-xs">🌱 ${t.total_books || 0}</td>
            <td class="text-center font-bold text-rose-400 text-xs">❤️ ${t.total_likes || 0}</td>
            <td class="text-right font-mono font-black text-emerald-400 text-xs">
              +${Number(t.velocity_24h || 0).toLocaleString()}
            </td>
            <td class="text-right font-mono font-black text-sky-400 text-xs">
              +${Number(t.velocity_7d || 0).toLocaleString()}
            </td>
            <td class="text-center">
              <span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-extrabold text-xs border border-amber-500/30">
                ⚡ ${t.interactionScore || 0}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 3.2: Activity EXP Breakdown
  const actContainer = document.getElementById('deep-activity-breakdown-list');
  if (actContainer) {
    const list = growth.activityBreakdown || [];
    if (list.length === 0) {
      actContainer.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Chưa có giao dịch sổ cái</div>';
    } else {
      actContainer.innerHTML = list.map(act => {
        const label = DEEP_ACTIVITY_LABELS[act.type] || act.type;
        const pct = Math.min(100, Math.max(0, act.percentage || 0));
        return `
          <div class="space-y-1">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-white">${escapeHtml(label)}</span>
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-amber-400 font-bold">${Number(act.total_exp || 0).toLocaleString()} EXP</span>
                <span class="text-slate-400 font-bold text-[10px]">(${pct}%)</span>
              </div>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-amber-500 to-sky-400 transition-all duration-500" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 3.3: 8 Team MVPs Grid
  const mvpsGrid = document.getElementById('deep-team-mvps-grid');
  if (mvpsGrid) {
    const mvps = growth.teamMvps || [];
    if (mvps.length === 0) {
      mvpsGrid.innerHTML = '<div class="text-xs text-slate-500 text-center py-4 col-span-full">Chưa có danh sách MVP</div>';
    } else {
      mvpsGrid.innerHTML = mvps.map(m => {
        const color = m.team_color || '#38bdf8';
        const adminTeamNames = { 1: 'SCU_BO', 2: 'Hà Đông Tây Bắc', 3: 'Trung Đông Tây Nam', 4: 'Thập đại Miền Nam', 5: 'FPL_AU_FU', 6: 'FTIBU_BOM', 7: 'FTI BA_TU_BOP', 8: 'IMU_PSU' };
        const teamNameDisplay = m.team_display_name || m.team_name || adminTeamNames[m.team_id] || ('ĐỘI ' + m.team_id);
        return `
          <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-400/50 transition relative overflow-hidden flex flex-col justify-between">
            <div class="absolute top-0 right-0 px-2 py-0.5 rounded-bl-lg bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase">
              MVP ${escapeHtml(teamNameDisplay)}
            </div>
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">${m.team_icon || '🌱'}</span>
                <span class="text-[11px] font-black truncate" style="color: ${color};">${escapeHtml(m.team_display_name || m.team_name)}</span>
              </div>
              <div class="font-black text-white text-xs truncate">${escapeHtml(m.nickname || 'Bút danh')}</div>
              <div class="text-[10px] text-slate-400 truncate mb-2.5">Thành viên đội</div>
            </div>
            <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10.5px]">
              <span class="text-slate-400 font-medium">✨ ${m.contributed_books_count || 0} sách</span>
              <span class="font-black text-amber-400 font-mono">+${Number(m.total_exp_earned || 0).toLocaleString()} EXP</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// =========================================================================
// 2. 8 TEAMS MANAGEMENT & DETAIL MODAL
// =========================================================================
async function loadTeamsData(targetDate) {
  const dateStr = targetDate || teamsFilterDate || getTodayISODate();
  teamsFilterDate = dateStr;

  const dateInput = document.getElementById('teams-filter-date');
  if (dateInput) dateInput.value = dateStr;

  const tbody = document.getElementById('teams-table-body');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-slate-500 font-bold"><span class="inline-block animate-spin mr-2">⏳</span> Đang tải số liệu 8 đội ngày ${formatDateVN(dateStr)}...</td></tr>`;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/analytics/overview?date=${encodeURIComponent(dateStr)}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="11" class="p-6 text-center text-rose-400">Lỗi tải dữ liệu 8 đội</td></tr>';
      return;
    }

    if (!analyticsCache) analyticsCache = {};
    analyticsCache.teams = data.data.teams;
    analyticsCache.kpi = data.data.kpi;
    analyticsCache.filterDate = data.data.filterDate || dateStr;

    renderTeamsTable();
  } catch (err) {
    console.error('Error fetching teams data by date:', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="11" class="p-6 text-center text-rose-400">Lỗi kết nối máy chủ backend</td></tr>';
  }
}

function renderTeamsTable() {
  const tbody = document.getElementById('teams-table-body');
  if (!tbody || !analyticsCache || !analyticsCache.teams) return;

  const teams = analyticsCache.teams;
  const todayStr = getTodayISODate();
  const currentDate = teamsFilterDate || analyticsCache.filterDate || todayStr;
  const isToday = currentDate === todayStr;
  const formattedDate = formatDateVN(currentDate);

  // Update date badge
  const dateBadge = document.getElementById('teams-active-date-badge');
  if (dateBadge) {
    if (isToday) {
      dateBadge.textContent = `Đang xem: Hôm nay (${formattedDate})`;
      dateBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    } else {
      dateBadge.textContent = `Đang xem: Ngày ${formattedDate}`;
      dateBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
  }

  // Update summary counts for this date
  const totalDateParticipants = teams.reduce((acc, t) => acc + (t.date_participants !== undefined ? t.date_participants : (t.today_participants || 0)), 0);
  const totalDateBooks = teams.reduce((acc, t) => acc + (t.date_books_count || 0), 0);
  const totalDateDews = teams.reduce((acc, t) => acc + (t.date_dews_count || 0), 0);

  const summaryEl = document.getElementById('teams-date-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <span>👥 Cán bộ tham gia: <strong class="text-white font-mono font-bold">${totalDateParticipants}</strong></span>
      <span>•</span>
      <span>🌱 Sách gieo: <strong class="text-emerald-400 font-mono font-bold">${totalDateBooks}</strong></span>
      <span>•</span>
      <span>💧 Lượt tưới: <strong class="text-cyan-400 font-mono font-bold">${totalDateDews}</strong></span>
    `;
  }

  // Update table header text
  const thDateCol = document.getElementById('th-teams-date-col');
  if (thDateCol) {
    thDateCol.textContent = isToday ? 'Tham Gia Hôm Nay' : `Tham Gia (${formattedDate})`;
  }
  const thBooksCol = document.getElementById('th-teams-books-col');
  if (thBooksCol) {
    thBooksCol.textContent = isToday ? 'Sách Gieo' : `Sách Gieo (${formattedDate})`;
  }
  const thDewsCol = document.getElementById('th-teams-dews-col');
  if (thDewsCol) {
    thDewsCol.textContent = isToday ? 'Lượt Tưới' : `Lượt Tưới (${formattedDate})`;
  }
  const exportBtnText = document.getElementById('btn-export-teams-text');
  if (exportBtnText) {
    exportBtnText.textContent = `Xuất Báo Cáo Ngày ${formattedDate} (CSV)`;
  }

  const dateInput = document.getElementById('teams-filter-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = currentDate;
  }

  tbody.innerHTML = teams.map(t => {
    const partCount = t.date_participants !== undefined ? t.date_participants : (t.today_participants || 0);
    const partRate = t.date_participation_rate !== undefined ? t.date_participation_rate : (t.today_participation_rate || 0);
    const dateBooks = t.date_books_count !== undefined ? t.date_books_count : 0;
    const dateDews = t.date_dews_count !== undefined ? t.date_dews_count : 0;

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
          ${(parseInt(t.tree_exp || t.total_exp || 0, 10)).toLocaleString()}
        </td>
        <td class="p-3.5 font-extrabold text-amber-400">
          ${(() => {
            const exp = parseInt(t.tree_exp || t.total_exp || 0, 10);
            if (exp < 50) return `${exp}/50 EXP`;
            if (exp < 150) return `${exp}/150 EXP`;
            if (exp < 300) return `${exp}/300 EXP`;
            if (exp < 600) return `${exp}/600 EXP`;
            if (exp < 1200) return `${exp}/1.200 EXP`;
            return 'Max (1.200+)';
          })()}
        </td>
        <td class="p-3.5 font-bold text-slate-300">
          ${t.actual_members || 0} / ${t.target_members || 40}
        </td>
        <td class="p-3.5">
          <div class="font-extrabold text-white">${partRate}%</div>
          <div class="text-[10px] text-slate-400">${partCount} cán bộ ${isToday ? 'hôm nay' : 'ngày này'}</div>
        </td>
        <td class="p-3.5" title="Tỷ lệ TB = ${t.all_days_participants || 0} lượt / (${t.total_campaign_days || 1} ngày × ${t.target_members || 40} chỉ tiêu)">
          <div class="font-extrabold text-amber-300">${parseFloat(t.avg_participation_rate || 0).toFixed(1)}%</div>
          <div class="text-[10px] text-slate-400 font-normal">${t.all_days_participants || 0} lượt / ${t.total_campaign_days || 1} ngày</div>
        </td>
        <td class="p-3.5 font-extrabold text-emerald-400">
          <div>${dateBooks}</div>
          <div class="text-[10px] text-slate-400 font-normal">Tổng: ${t.books_count || 0}</div>
        </td>
        <td class="p-3.5 font-extrabold text-cyan-400">
          <div>${dateDews}</div>
          <div class="text-[10px] text-slate-400 font-normal">Tổng: ${t.dews_count || 0}</div>
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
  const dateTh = document.getElementById('team-modal-date-th');

  if (!modal || !tbody) return;

  const dateStr = teamsFilterDate || getTodayISODate();
  const dateLabel = formatDateVN(dateStr);
  const isToday = dateStr === getTodayISODate();

  if (dateTh) {
    dateTh.textContent = isToday ? 'Trạng Thái (Hôm Nay)' : `Trạng Thái (${dateLabel})`;
  }

  const team = analyticsCache?.teams?.find(t => t.id === teamId);
  if (team) {
    nameEl.innerHTML = `<span>🏆</span><span>${escapeHtml(team.display_name || team.name)}</span>`;
    const expVal = parseInt(team.tree_exp || team.total_exp || 0, 10);
    subEl.textContent = `Tổng cộng ${team.actual_members || 0} cán bộ · Đạt ${expVal.toLocaleString()} EXP · Ngày xem: ${dateLabel}`;
  }

  modal.classList.add('show');
  tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500 font-bold"><span class="inline-block animate-spin mr-2">⏳</span> Đang tải danh sách thành viên...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/teams/${teamId}/members?date=${encodeURIComponent(dateStr)}`);
    const data = await res.json();
    if (data.success && data.data) {
      tbody.innerHTML = data.data.map((m, idx) => `
        <tr class="hover:bg-slate-800/40">
          <td class="p-3 text-center text-slate-400 font-mono font-bold text-xs">${m.tt || (idx + 1)}</td>
          <td class="p-3">
            <div class="font-extrabold text-sky-300 text-xs">${escapeHtml(m.nickname || m.full_name || 'Chưa đặt bút danh')}</div>
            <div class="text-[10px] text-slate-400 font-normal">${escapeHtml(m.full_name || '')}</div>
          </td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${m.participated_on_date ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}">
              ${m.participated_on_date ? `✅ Đã tham gia (${dateLabel})` : '⏳ Chưa tham gia'}
            </span>
          </td>
          <td class="p-3 font-bold text-white text-xs">
            <div>${m.date_books_count || 0} (${dateLabel})</div>
            <div class="text-[10px] text-slate-500">Tổng: ${m.contributed_books_count || 0}</div>
          </td>
          <td class="p-3 font-extrabold text-sky-400 text-xs">${(m.total_exp_earned || 0).toLocaleString()}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-rose-400">Lỗi tải danh sách thành viên</td></tr>';
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

  const dateStr = usersFilterDate || getTodayISODate();
  usersFilterDate = dateStr;

  const dateInput = document.getElementById('users-filter-date');
  if (dateInput && !dateInput.value) dateInput.value = dateStr;

  let url = `${API_BASE}/admin/users?page=${usersPageState.page}&limit=${usersPageState.limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (teamId) url += `&teamId=${teamId}`;
  if (status) url += `&status=${status}`;
  if (dateStr) url += `&date=${encodeURIComponent(dateStr)}`;

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

  const todayStr = getTodayISODate();
  const currentDate = usersFilterDate || todayStr;
  const isToday = currentDate === todayStr;
  const formattedDate = formatDateVN(currentDate);

  // Update date column header
  const thDateCol = document.getElementById('th-users-date-col');
  if (thDateCol) {
    thDateCol.textContent = isToday ? 'Hôm Nay (1 Quote)' : `Ngày ${formattedDate.slice(0, 5)} (1 Quote)`;
  }

  // Update active date badge
  const dateBadge = document.getElementById('users-active-date-badge');
  if (dateBadge) {
    if (isToday) {
      dateBadge.textContent = `Đang xem: Hôm nay (${formattedDate})`;
      dateBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    } else {
      dateBadge.textContent = `Đang xem: Ngày ${formattedDate}`;
      dateBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
  }

  // Update export single date button text
  const exportUsersBtnText = document.getElementById('btn-export-users-text');
  if (exportUsersBtnText) {
    exportUsersBtnText.textContent = isToday ? 'Xuất Danh Sách Hôm Nay (CSV)' : `Xuất Danh Sách Ngày ${formattedDate} (CSV)`;
  }

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-500">Không tìm thấy bút danh nào phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map((u, idx) => `
    <tr class="hover:bg-slate-800/40 transition-colors">
      <td class="p-3 text-center text-slate-500 font-bold text-xs">${u.tt ? u.tt : ((usersPageState.page - 1) * usersPageState.limit + idx + 1)}</td>
      <td class="p-3 font-bold text-white">
        ${escapeHtml(u.nickname || 'Bút danh')}
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
      <td class="p-3 text-center">
        <div class="flex items-center justify-center gap-1.5">
          <button type="button" class="btn-personnel-detail p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 transition-colors" data-id="${u.id}" title="Xem chi tiết bút danh">
            👁️
          </button>
          <button type="button" class="btn-personnel-edit p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors" data-id="${u.id}" title="Chỉnh sửa bút danh">
            ✏️
          </button>
          <button type="button" class="btn-personnel-delete p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors" data-id="${u.id}" data-name="${escapeHtml(u.nickname || 'Bút danh')}" data-team="${escapeHtml(u.team_display_name || ('Đội ' + u.team_id))}" title="Xóa bút danh">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Attach click listeners to row action buttons
  tbody.querySelectorAll('.btn-personnel-detail').forEach(btn => {
    btn.addEventListener('click', () => viewPersonnelDetail(btn.getAttribute('data-id')));
  });
  tbody.querySelectorAll('.btn-personnel-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditPersonnelModal(btn.getAttribute('data-id')));
  });
  tbody.querySelectorAll('.btn-personnel-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const team = btn.getAttribute('data-team');
      openDeletePersonnelModal(id, '', name, team);
    });
  });
}

async function exportUsersCSV() {
  const btn = document.getElementById('btn-export-users-csv');
  const originalHtml = btn ? btn.innerHTML : '';
  try {
    if (btn) {
      btn.innerHTML = '<span>⏳</span><span>Đang xuất...</span>';
      btn.disabled = true;
    }
    const dateStr = usersFilterDate || getTodayISODate();
    const formattedDate = formatDateVN(dateStr);
    const dateLabel = (dateStr === getTodayISODate()) ? 'Gieo Hôm Nay' : `Gieo Ngày ${formattedDate}`;

    const res = await fetch(`${API_BASE}/admin/users?limit=300&date=${encodeURIComponent(dateStr)}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success || !data.data.users) {
      alert('Không thể tải danh sách nhân sự');
      return;
    }

    const rows = [
      ['STT', 'Bút Danh', 'Đội Thi Đua', 'Khối / Ban', 'Chức Danh', dateLabel, 'Sách Đã Gieo', 'EXP Kiếm Được']
    ];

    data.data.users.forEach((u, idx) => {
      rows.push([
        idx + 1,
        `"${u.nickname || 'Bút danh'}"`,
        `"${u.team_display_name || ('Đội ' + u.team_id)}"`,
        `"${(u.branch || '').replace(/"/g, '""')}"`,
        `"${(u.job_title || '').replace(/"/g, '""')}"`,
        `"${(u.participated_today || u.participated_current_round) ? `Đã gieo (${formattedDate})` : `Chưa gieo (${formattedDate})`}"`,
        u.contributed_books_count || 0,
        u.total_exp_earned || 0
      ]);
    });

    const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Danh_Ba_288_Nhan_Su_FOXREAD_${dateStr}.csv`;
    link.click();
  } catch (err) {
    console.error('Lỗi xuất file CSV:', err);
    alert('Lỗi xuất file CSV nhân sự');
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
}

async function exportUsersAllDaysCSV() {
  const btn = document.getElementById('btn-export-users-all-csv');
  const originalHtml = btn ? btn.innerHTML : '';
  try {
    if (btn) {
      btn.innerHTML = '<span>⏳</span><span>Đang xuất...</span>';
      btn.disabled = true;
    }

    const res = await fetch(`${API_BASE}/admin/users/all-days`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success || !result.data || !result.data.users) {
      alert(result.message || 'Không tải được dữ liệu nhân sự tất cả các ngày');
      return;
    }

    const { dates, users, total_days } = result.data;
    const todayStr = getTodayISODate();

    // Headers with individual date columns
    const dateHeaders = dates.map(d => `"Ngày ${formatDateVN(d)}"`);

    const rows = [
      ['=== BÁO CÁO CHUYÊN CẦN & THAM GIA 288 NHÂN SỰ - FOXREAD (TẤT CẢ CÁC NGÀY) ==='],
      [`Ngày xuất báo cáo: ${formatDateVN(todayStr)} | Tổng số cán bộ: ${users.length} | Ghi nhận: ${dates.length} ngày`],
      [],
      [
        'STT',
        'Bút Danh',
        'Đội Thi Đua',
        'Khối / Ban',
        'Chức Danh',
        `Tổng Ngày Tham Gia (${dates.length} Ngày)`,
        'Tỷ Lệ Chuyên Cần (%)',
        'Tổng Sách Đã Gieo',
        'Tổng Lượt Tưới',
        'Tổng EXP Kiếm Được',
        'Ngày Gieo Gần Nhất',
        ...dateHeaders
      ]
    ];

    users.forEach((u, idx) => {
      const dateValues = dates.map(d => {
        const st = u.daily_status && u.daily_status[d];
        if (st && st.participated) {
          return st.book_title ? `"Đã gieo (${st.book_title.replace(/"/g, '""')})"` : '"Đã gieo"';
        }
        return '"Chưa gieo"';
      });

      rows.push([
        idx + 1,
        `"${u.nickname || 'Bút danh'}"`,
        `"${u.team_name || ('Đội ' + u.team_id)}"`,
        `"${(u.branch || '').replace(/"/g, '""')}"`,
        `"${(u.job_title || '').replace(/"/g, '""')}"`,
        `"${u.total_days_participated}/${dates.length}"`,
        `"${u.attendance_rate}%"`,
        u.contributed_books_count || 0,
        u.total_dews_count || 0,
        u.total_exp_earned || 0,
        `"${u.latest_quote_date ? formatDateVN(u.latest_quote_date) : 'Chưa gieo'}"`,
        ...dateValues
      ]);
    });

    const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Bao_Cao_288_Nhan_Su_Tat_Ca_Cac_Ngay_FOXREAD_${todayStr}.csv`;
    link.click();
  } catch (err) {
    console.error('Lỗi xuất báo cáo nhân sự tất cả các ngày:', err);
    alert('Lỗi xuất file CSV nhân sự tất cả các ngày');
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
}

function exportTeamsCSV() {
  if (!analyticsCache || !analyticsCache.teams) return;
  const dateStr = teamsFilterDate || getTodayISODate();
  const dateLabel = formatDateVN(dateStr);

  const rows = [
    [
      'Hạng',
      'Mã Đội',
      'Tên Đội',
      'Cấp Độ Cây',
      'Tổng EXP Toàn Giải',
      'EXP Vươn Cấp',
      'Cán Bộ Thực Tế',
      'Chỉ Tiêu',
      `Số Cán Bộ Tham Gia (${dateLabel})`,
      `Tỷ Lệ Tham Gia (${dateLabel}) (%)`,
      'Tỷ Lệ TB Toàn Giải (%)',
      `Sách Gieo (${dateLabel})`,
      'Tổng Sách Gieo Toàn Giải',
      `Lượt Tưới (${dateLabel})`,
      'Tổng Lượt Tưới Toàn Giải'
    ]
  ];

  analyticsCache.teams.forEach(t => {
    const partCount = t.date_participants !== undefined ? t.date_participants : (t.today_participants || 0);
    const partRate = t.date_participation_rate !== undefined ? t.date_participation_rate : (t.today_participation_rate || 0);
    const dateBooks = t.date_books_count !== undefined ? t.date_books_count : 0;
    const dateDews = t.date_dews_count !== undefined ? t.date_dews_count : 0;
    const exp = t.tree_exp || 0;
    const nextTarget = exp < 50 ? '50 EXP' : exp < 150 ? '150 EXP' : exp < 300 ? '300 EXP' : exp < 600 ? '600 EXP' : exp < 1200 ? '1.200 EXP' : 'Max Level';

    rows.push([
      t.rank,
      `"${t.code}"`,
      `"${t.display_name || t.name}"`,
      `"${t.levelName}"`,
      t.tree_exp,
      `"${nextTarget}"`,
      t.actual_members,
      t.target_members,
      partCount,
      partRate,
      parseFloat(t.avg_participation_rate || 0).toFixed(1),
      dateBooks,
      t.books_count,
      dateDews,
      t.dews_count
    ]);
  });

  const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Bao_Cao_Xep_Hang_8_Doi_Ngay_${dateStr}_FOXREAD.csv`;
  link.click();
}

async function exportTeamsAllDaysCSV() {
  const btn = document.getElementById('btn-export-teams-all');
  const originalHtml = btn ? btn.innerHTML : '';
  try {
    if (btn) {
      btn.innerHTML = '<span>⏳</span><span>Đang xuất...</span>';
      btn.disabled = true;
    }

    const res = await fetch(`${API_BASE}/admin/analytics/teams/all-days`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success || !result.data) {
      alert(result.message || 'Không tải được dữ liệu 8 đội thi đua tất cả các ngày');
      return;
    }

    const { dates, teams_summary, daily_history } = result.data;
    const todayStr = getTodayISODate();

    const rows = [
      ['=== BÁO CÁO TOÀN GIẢI 8 ĐỘI THI ĐUA - FOXREAD (TẤT CẢ CÁC NGÀY) ==='],
      [`Ngày xuất báo cáo: ${formatDateVN(todayStr)} | Tổng số ngày ghi nhận: ${dates.length} ngày`],
      [],
      ['--- PHẦN 1: BẢNG TỔNG HỢP TOÀN GIẢI 8 ĐỘI THI ĐUA ---'],
      [
        'Hạng',
        'Mã Đội',
        'Tên Đội',
        'Cấp Độ Cây',
        'Tổng EXP Toàn Giải',
        'EXP Vươn Cấp',
        'Cán Bộ Thực Tế',
        'Chỉ Tiêu',
        'Tỷ Lệ TB Toàn Giải (%)',
        'Tổng Sách Đã Gieo',
        'Tổng Lượt Tưới'
      ]
    ];

    teams_summary.forEach(t => {
      const exp = t.tree_exp || 0;
      const nextTarget = exp < 50 ? '50 EXP' : exp < 150 ? '150 EXP' : exp < 300 ? '300 EXP' : exp < 600 ? '600 EXP' : exp < 1200 ? '1.200 EXP' : 'Max Level';
      rows.push([
        t.rank,
        `"${t.code}"`,
        `"${t.display_name || t.name}"`,
        `"${t.levelName}"`,
        t.tree_exp,
        `"${nextTarget}"`,
        t.actual_members,
        t.target_members,
        `"${t.avg_participation_rate}%"`,
        t.books_count,
        t.dews_count
      ]);
    });

    rows.push([]);
    rows.push(['--- PHẦN 2: CHI TIẾT THEO TỪNG NGÀY CỦA 8 ĐỘI THI ĐUA ---']);
    rows.push([
      'Ngày',
      'Hạng Toàn Giải',
      'Mã Đội',
      'Tên Đội',
      'Cấp Độ Cây',
      'Cán Bộ Thực Tế',
      'Chỉ Tiêu',
      'Số Cán Bộ Tham Gia Ngày Này',
      'Tỷ Lệ Tham Gia Ngày Này (%)',
      'Sách Gieo Ngày Này',
      'Lượt Tưới Ngày Này'
    ]);

    daily_history.forEach(h => {
      rows.push([
        `"${formatDateVN(h.date)}"`,
        h.rank,
        `"${h.team_code}"`,
        `"${h.team_name}"`,
        `"${h.level_name}"`,
        h.actual_members,
        h.target_members,
        h.participants_count,
        `"${h.participation_rate}%"`,
        h.books_count,
        h.dews_count
      ]);
    });

    const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Bao_Cao_8_Doi_Tat_Ca_Cac_Ngay_FOXREAD_${todayStr}.csv`;
    link.click();
  } catch (err) {
    console.error('Lỗi xuất báo cáo 8 đội tất cả các ngày:', err);
    alert('Lỗi xuất file CSV 8 đội tất cả các ngày');
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
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
    { title: '🌱 GIAI ĐOẠN 1: Ủ MẦM (Chặng 1 - 3)', desc: 'Tích lũy 50 EXP nảy mầm cây tri thức', rounds: rounds.slice(0, 3), color: 'emerald' },
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
let currentBookViewMode = 'active'; // 'active' | 'deleted'

function switchBookViewMode(mode) {
  currentBookViewMode = mode;
  const btnActive = document.getElementById('subtab-books-active');
  const btnDeleted = document.getElementById('subtab-books-deleted');
  const banner = document.getElementById('deleted-view-banner');
  const visFilter = document.getElementById('filter-visibility');

  if (mode === 'deleted') {
    btnDeleted?.classList.remove('bg-slate-900/90', 'text-slate-400', 'border-slate-800');
    btnDeleted?.classList.add('bg-rose-500/25', 'text-rose-300', 'border-rose-400/50', 'shadow-sm');

    btnActive?.classList.remove('bg-sky-500/20', 'text-sky-300', 'border-sky-400/40', 'shadow-sm');
    btnActive?.classList.add('bg-slate-900/90', 'text-slate-400', 'border-slate-800');

    banner?.classList.remove('hidden');
    if (visFilter) visFilter.value = 'deleted';
  } else {
    btnActive?.classList.remove('bg-slate-900/90', 'text-slate-400', 'border-slate-800');
    btnActive?.classList.add('bg-sky-500/20', 'text-sky-300', 'border-sky-400/40', 'shadow-sm');

    btnDeleted?.classList.remove('bg-rose-500/25', 'text-rose-300', 'border-rose-400/50', 'shadow-sm');
    btnDeleted?.classList.add('bg-slate-900/90', 'text-slate-400', 'border-slate-800');

    banner?.classList.add('hidden');
    if (visFilter && visFilter.value === 'deleted') visFilter.value = '';
  }

  loadBooks();
}

function syncSubtabWithVisibility(val) {
  const btnActive = document.getElementById('subtab-books-active');
  const btnDeleted = document.getElementById('subtab-books-deleted');
  const banner = document.getElementById('deleted-view-banner');

  if (val === 'deleted') {
    currentBookViewMode = 'deleted';
    btnDeleted?.classList.remove('bg-slate-900/90', 'text-slate-400', 'border-slate-800');
    btnDeleted?.classList.add('bg-rose-500/25', 'text-rose-300', 'border-rose-400/50', 'shadow-sm');

    btnActive?.classList.remove('bg-sky-500/20', 'text-sky-300', 'border-sky-400/40', 'shadow-sm');
    btnActive?.classList.add('bg-slate-900/90', 'text-slate-400', 'border-slate-800');

    banner?.classList.remove('hidden');
  } else {
    currentBookViewMode = 'active';
    btnActive?.classList.remove('bg-slate-900/90', 'text-slate-400', 'border-slate-800');
    btnActive?.classList.add('bg-sky-500/20', 'text-sky-300', 'border-sky-400/40', 'shadow-sm');

    btnDeleted?.classList.remove('bg-rose-500/25', 'text-rose-300', 'border-rose-400/50', 'shadow-sm');
    btnDeleted?.classList.add('bg-slate-900/90', 'text-slate-400', 'border-slate-800');

    banner?.classList.add('hidden');
  }
}

async function loadBooks() {
  const tbody = document.getElementById('books-table-body');
  if (!tbody) return;

  const search = document.getElementById('filter-search')?.value.trim() || '';
  const modStatus = document.getElementById('filter-moderation')?.value || '';
  const visStatus = document.getElementById('filter-visibility')?.value || '';
  const credFilter = document.getElementById('filter-credibility')?.value || '';

  let url = `${API_BASE}/admin/books?page=1&limit=50`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (modStatus) url += `&moderation_status=${modStatus}`;
  if (visStatus) url += `&visibility_status=${visStatus}`;
  if (credFilter) url += `&credibility=${encodeURIComponent(credFilter)}`;

  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) {
      renderBooksTable(data.data.books);
      fetchQueueStatus();

      // Cập nhật số lượng huy hiệu cho subtabs
      if (data.data.counts) {
        const activeCountEl = document.getElementById('badge-active-count');
        const deletedCountEl = document.getElementById('badge-deleted-count');
        if (activeCountEl) activeCountEl.innerText = data.data.counts.active ?? 0;
        if (deletedCountEl) deletedCountEl.innerText = data.data.counts.deleted ?? 0;
      }
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-rose-400">Lỗi tải danh sách sách</td></tr>';
  }
}

function renderCredibilityCell(b) {
  const status = b.credibility_status || 'unscored';
  const score = b.credibility_score;
  const rationale = b.credibility_rationale || '';

  if (status === 'scoring') {
    return `
      <div class="space-y-1">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-950/60 text-sky-300 border border-sky-700/60">
          <span class="inline-block animate-spin">⏳</span> Đang chấm AI...
        </span>
        <div class="text-[10px] text-slate-400">Pacing tuần tự chống quá tải</div>
      </div>
    `;
  }

  if (status === 'scored' && score !== null && score !== undefined) {
    let badgeClass = 'bg-emerald-950/70 text-emerald-300 border-emerald-600/60';
    let icon = '🛡️';
    let label = 'Chuẩn Mực';

    if (score >= 80) {
      badgeClass = 'bg-emerald-950/70 text-emerald-300 border-emerald-600/60';
      icon = '🛡️';
      label = 'Chuẩn Mực';
    } else if (score >= 60) {
      badgeClass = 'bg-amber-950/70 text-amber-300 border-amber-600/60';
      icon = '⚖️';
      label = 'Cần Xem Xét';
    } else {
      badgeClass = 'bg-rose-950/90 text-rose-300 border-rose-600/80 animate-pulse';
      icon = '🔴';
      label = 'Vi Phạm (<60đ) • AI Tự Xóa';
    }

    return `
      <div class="space-y-1 max-w-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${badgeClass}">
            <span>${icon}</span>
            <span>${score}/100</span>
            <span class="text-[9.5px] opacity-80 font-normal">(${label})</span>
          </span>
          <button onclick="scoreQuoteCredibilityRow('${b.id}', this)" class="text-[10px] text-slate-400 hover:text-sky-300 hover:underline transition-colors flex items-center gap-0.5" title="Kích hoạt AI Groq chấm lại trích dẫn này">
            <span>🔄</span> Chấm lại
          </button>
        </div>
        ${rationale ? `<div class="text-[10px] text-slate-400 font-medium">${escapeHtml(rationale)}</div>` : ''}
      </div>
    `;
  }

  if (status === 'failed') {
    return `
      <div class="space-y-1 max-w-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800">
            <span>⚠️</span><span>Lỗi chấm AI</span>
          </span>
          <button onclick="scoreQuoteCredibilityRow('${b.id}', this)" class="btn btn-ghost text-[10.5px] py-0.5 px-2 bg-rose-900/40 hover:bg-rose-800/60 text-rose-200 border border-rose-700/50 flex items-center gap-1">
            <span>🔄</span> Chấm lại
          </button>
        </div>
        ${rationale ? `<div class="text-[10px] text-rose-400 line-clamp-1" title="${escapeHtml(rationale)}">${escapeHtml(rationale)}</div>` : ''}
      </div>
    `;
  }

  // unscored / null
  return `
    <div class="flex items-center gap-2">
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        <span>⚪</span> Chưa chấm
      </span>
      <button onclick="scoreQuoteCredibilityRow('${b.id}', this)" class="btn btn-ghost text-[10.5px] py-0.5 px-2 bg-sky-950/50 hover:bg-sky-800/50 text-sky-300 border border-sky-700/50 font-bold flex items-center gap-1" title="Chấm điểm câu trích dẫn bằng AI Groq">
        <span>✨</span> Chấm AI
      </button>
    </div>
  `;
}

function renderBooksTable(books) {
  const tbody = document.getElementById('books-table-body');
  if (!tbody) return;

  if (!books || books.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">Không tìm thấy sách nào phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = books.map(b => {
    let modBadge = `<span class="badge badge-pending">Chờ Duyệt</span>`;
    if (b.moderation_status === 'reviewed') modBadge = `<span class="badge badge-reviewed">Đã Duyệt An Toàn</span>`;
    if (b.moderation_status === 'rejected') modBadge = `<span class="badge badge-rejected">Bị Loại Bỏ</span>`;

    let visBadge = `<span class="text-[10px] text-emerald-400 font-bold">🟢 Đang Hiện Trên Cây</span>`;
    if (b.visibility_status === 'hidden') {
      visBadge = `<span class="text-[10px] text-amber-400 font-bold">🟡 Đang Ẩn</span>`;
    } else if (b.visibility_status === 'deleted') {
      visBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-700/60"><span>🗑️</span><span>Đã Xóa</span></span>`;
    }

    const deletionInfo = (b.visibility_status === 'deleted' && b.deletion_reason)
      ? `<div class="text-[9.5px] text-rose-400 font-semibold mt-1 bg-rose-950/40 p-1.5 rounded border border-rose-900/60 max-w-xs" title="${escapeHtml(b.deletion_reason)}">
          <span class="font-bold">Lý do:</span> ${escapeHtml(b.deletion_reason)}
          ${b.deleted_at ? `<br><span class="text-[9px] text-slate-400 font-normal">Thời gian: ${new Date(b.deleted_at).toLocaleString('vi-VN')}</span>` : ''}
        </div>`
      : '';

    const isDeleted = b.visibility_status === 'deleted';
    const escapedTitle = escapeHtml(b.title).replace(/'/g, "\\'");

    return `
      <tr id="book-row-${b.id}" class="hover:bg-slate-800/40 transition-colors ${isDeleted ? 'bg-rose-950/10' : ''}">
        <td class="p-3.5 max-w-sm">
          <div class="font-black text-white text-sm flex items-center gap-1.5">
            ${isDeleted ? '<span class="text-rose-400 text-xs">🗑️</span>' : ''}
            <span>${escapeHtml(b.title)}</span>
          </div>
          <div class="text-[11px] text-sky-400 font-bold">${escapeHtml(b.author)}${b.team_display_name || b.team_name || (b.team_id ? ` · <span class="text-emerald-400 font-bold">${escapeHtml(b.team_display_name || b.team_name || `Đội ${b.team_id}`)}</span>` : '')}</div>
          <p class="text-slate-300 italic text-[11px] mt-1.5 line-clamp-2 bg-slate-950/40 p-2 rounded border border-slate-800">"${escapeHtml(b.quote)}"</p>
          ${deletionInfo}
        </td>
        <td class="p-3.5">
          <div class="font-bold text-white">${escapeHtml(b.reader_name)}</div>
          <div class="text-[10px] text-emerald-400 font-bold">${escapeHtml(b.team_display_name || b.team_name || (b.team_id ? `Đội ${b.team_id}` : 'Thành viên'))}</div>
          <div class="text-[9.5px] text-slate-500 mt-1">${new Date(b.created_at).toLocaleString('vi-VN')}</div>
        </td>
        <td class="p-3.5 space-y-1">
          <div>${modBadge}</div>
          <div>${visBadge}</div>
        </td>
        <td id="book-credibility-cell-${b.id}" class="p-3.5 min-w-[200px] transition-colors duration-500">
          ${renderCredibilityCell(b)}
        </td>
        <td class="p-3.5 font-black text-amber-400">
          ❤️ ${b.likes_count || 0}
        </td>
        <td class="p-3.5 text-right space-x-1 whitespace-nowrap">
          ${isDeleted ? `
            <button onclick="restoreDeletedBook('${b.id}', '${escapedTitle}')" class="btn btn-ghost text-[11px] py-1 px-2.5 bg-emerald-950/70 hover:bg-emerald-800/70 text-emerald-300 border border-emerald-600/60 font-black inline-flex items-center gap-1 shadow-sm" title="Khôi phục câu trích dẫn này lên cây">
              <span>♻️</span><span>Khôi Phục</span>
            </button>
            <button onclick="openModModal('${b.id}')" class="btn btn-ghost text-[11px] py-1 px-2 text-slate-400 hover:text-white" title="Chi tiết hậu kiểm">
              <span>⚙️</span>
            </button>
          ` : `
            <button onclick="openModModal('${b.id}')" class="btn btn-ghost text-[11px] py-1 px-3">
              <span>⚙️</span><span>Hậu Kiểm</span>
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

window.restoreDeletedBook = async function(bookId, bookTitle) {
  if (!confirm(`Bạn có chắc chắn muốn khôi phục trích dẫn "${bookTitle}" lên Cây Tri Thức không?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/books/${bookId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        visibility_status: 'visible',
        moderation_status: 'reviewed',
        moderation_notes: 'Khôi phục bởi Quản trị viên từ Danh Sách Đã Xóa'
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Khôi phục trích dẫn thành công!', 'success');
      loadBooks();
      loadAnalytics();
    } else {
      alert(data.message || 'Lỗi khôi phục');
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ');
  }
};

function updateBookCredibilityInDom(book) {
  if (!book || !book.id) return;
  const cell = document.getElementById(`book-credibility-cell-${book.id}`);
  if (cell) {
    cell.innerHTML = renderCredibilityCell(book);
    cell.classList.add('bg-emerald-500/20');
    setTimeout(() => {
      cell.classList.remove('bg-emerald-500/20');
    }, 2500);
  }
}

async function fetchQueueStatus() {
  if (!authToken) return;
  try {
    const res = await fetch(`${API_BASE}/admin/credibility/queue-status`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      updateQueueBadge(data.data);
    }
  } catch (err) {
    // Silent
  }
}

function updateQueueBadge(status) {
  const badgeText = document.getElementById('queue-status-text');
  const dot = document.getElementById('queue-status-dot');
  if (!badgeText || !dot) return;

  if (status.isProcessing || status.pendingCount > 0) {
    dot.className = 'inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping';
    badgeText.textContent = `Hàng đợi AI: ${status.pendingCount} đang chấm`;
  } else {
    dot.className = 'inline-block w-2 h-2 rounded-full bg-emerald-400';
    badgeText.textContent = `Hàng đợi AI: 0 chờ (${status.stats?.totalSucceeded || 0} đã chấm)`;
  }
}

async function triggerAiScanQueue() {
  if (!authToken) {
    alert('Vui lòng đăng nhập quản trị viên.');
    return;
  }
  const btn = document.getElementById('btn-ai-scan-queue');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block animate-spin">⏳</span><span>Đang nạp...</span>';
  }

  try {
    const res = await fetch(`${API_BASE}/admin/credibility/trigger-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ limit: 50 })
    });
    const data = await res.json();
    if (data.success) {
      alert(`⚡ ${data.message}`);
      fetchQueueStatus();
      await loadBooks();
    } else {
      alert(`❌ Lỗi quét nạp: ${data.message || 'Không thành công'}`);
    }
  } catch (err) {
    alert(`❌ Lỗi kết nối: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

window.scoreQuoteCredibilityRow = async function(bookId, btnEl) {
  if (!authToken) {
    alert('Vui lòng đăng nhập quản trị viên để chấm điểm.');
    return;
  }
  const originalHtml = btnEl ? btnEl.innerHTML : '';
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = '<span class="inline-block animate-spin">⏳</span> Đang chấm...';
  }

  try {
    const res = await fetch(`${API_BASE}/admin/books/${bookId}/score-credibility`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    const data = await res.json();
    if (data.success) {
      updateBookCredibilityInDom(data.data);
      fetchQueueStatus();
    } else {
      alert(`❌ Lỗi chấm điểm AI: ${data.message || 'Không thành công'}`);
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = originalHtml;
      }
    }
  } catch (err) {
    alert(`❌ Lỗi kết nối chấm AI: ${err.message}`);
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = originalHtml;
    }
  }
};

async function triggerAiBatchScore() {
  if (!authToken) {
    alert('Vui lòng đăng nhập quản trị viên.');
    return;
  }
  const btn = document.getElementById('btn-ai-batch-score');
  if (!confirm('Bạn có muốn kích hoạt AI Groq thẩm định tuần tự các câu trích dẫn chưa có điểm không?\\n(Hệ thống tự động điều tiết nhịp độ an toàn 800ms để không bao giờ vượt ngưỡng token/phút)')) {
    return;
  }

  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block animate-spin">⏳</span><span>Đang chấm tuần tự...</span>';
  }

  try {
    const res = await fetch(`${API_BASE}/admin/books/score-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ limit: 15, delayMs: 800, forceRescore: false })
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 ${data.message}`);
      await loadBooks();
    } else {
      alert(`❌ Lỗi chấm hàng loạt: ${data.message || 'Không thể thực hiện'}`);
    }
  } catch (err) {
    alert(`❌ Lỗi kết nối: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
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
    const senderTeam = book.team_display_name || book.team_name || (book.team_id ? `Đội ${book.team_id}` : 'Thành viên');
    document.getElementById('mod-book-sender').textContent = `Người gửi: ${book.reader_name} (${senderTeam}) - Gieo lúc: ${new Date(book.created_at).toLocaleString('vi-VN')}`;
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
    'BOOK_CONTRIBUTION': '📚 Gieo Sách (+5 EXP)',
    'DAILY_DEW': '💧 Tưới Sương (+2 EXP)',
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
          ${escapeHtml(item.nickname || 'Bút danh')}
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
  const subtitle = document.getElementById('cfg-welcome-subtitle')?.value || 'Mỗi Bút Danh Là Một Người Gieo Tri Thức';
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
    subtitle: getVal('cfg-welcome-subtitle') || 'Mỗi Bút Danh Là Một Người Gieo Tri Thức',
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
      alert('✅ Lưu cấu hình Popup Chào Mừng thành công! Mọi Bút danh đang mở trang sẽ thấy nội dung mới ngay lập tức.');
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
    badge: getVal('cfg-rules-badge') || 'THỂ LỆ',
    milestonesTitle: getVal('cfg-rules-milestones-title') || '4 GIAI ĐOẠN PHÁT TRIỂN CỦA CÂY TRI THỨC',
    milestones: milestones.length > 0 ? milestones : (currentRulesSettings?.milestones || []),
    interactionsTitle: getVal('cfg-rules-interactions-title') || 'CƠ CHẾ TƯƠNG TÁC & TÍCH LŨY EXP',
    interactions: interactions.length > 0 ? interactions : (currentRulesSettings?.interactions || []),
    regulationsTitle: currentRulesSettings?.regulationsTitle || 'QUY ĐỊNH THAM GIA',
    regulations: currentRulesSettings?.regulations || {
      time: 'Thời gian: 10/09/2026 – 05/10/2026',
      rules: 'Mỗi ngày là một lượt chơi. Các hoạt động chỉ được tính khi đáp ứng điều kiện hợp lệ của chương trình. EXP vẫn tiếp tục được tích lũy sau khi đội đạt 1.200 EXP.'
    },
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

// =========================================================================
// 8. DANGER ZONE: SYSTEM WIPE OPERATIONAL DATA
// =========================================================================
function bindWipeDataEvents() {
  const openBtn = document.getElementById('btn-open-wipe-modal');
  const closeBtn = document.getElementById('wipe-modal-close');
  const cancelBtn = document.getElementById('wipe-modal-cancel');
  const wipeModal = document.getElementById('modal-wipe-database');
  const togglePwdBtn = document.getElementById('btn-toggle-wipe-pwd');
  const pwdInput = document.getElementById('wipe-confirm-password');
  const wipeForm = document.getElementById('form-confirm-wipe');

  if (openBtn) openBtn.addEventListener('click', openWipeModal);
  if (closeBtn) closeBtn.addEventListener('click', closeWipeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeWipeModal);

  if (wipeModal) {
    wipeModal.addEventListener('click', (e) => {
      if (e.target === wipeModal) closeWipeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wipeModal?.classList.contains('show')) {
      closeWipeModal();
    }
  });

  if (togglePwdBtn && pwdInput) {
    togglePwdBtn.addEventListener('click', () => {
      const isPwd = pwdInput.type === 'password';
      pwdInput.type = isPwd ? 'text' : 'password';
      togglePwdBtn.textContent = isPwd ? '🙈' : '👁️';
    });
  }

  if (wipeForm) {
    wipeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = pwdInput ? pwdInput.value.trim() : '';
      const errEl = document.getElementById('wipe-pwd-error');
      const errMsgEl = document.getElementById('wipe-pwd-error-msg');
      const submitBtn = document.getElementById('btn-submit-wipe');
      const spinner = document.getElementById('wipe-spinner');
      const icon = document.getElementById('wipe-icon');
      const btnText = document.getElementById('wipe-btn-text');

      // Client-side quick check
      if (pwd !== 'Soncute@123') {
        if (errEl && errMsgEl) {
          errMsgEl.textContent = 'Mật khẩu xác nhận không chính xác! Vui lòng nhập đúng mật khẩu bảo vệ.';
          errEl.classList.remove('hidden');
        }
        if (pwdInput) {
          pwdInput.focus();
          pwdInput.classList.add('border-rose-500');
        }
        return;
      }

      if (errEl) errEl.classList.add('hidden');

      // Set loading state
      if (submitBtn) submitBtn.disabled = true;
      if (spinner) spinner.classList.remove('hidden');
      if (icon) icon.classList.add('hidden');
      if (btnText) btnText.textContent = 'Đang dọn sạch CSDL...';

      try {
        const res = await fetch(`${API_BASE}/admin/system/wipe-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ password: pwd })
        });

        const data = await res.json();
        if (data.success) {
          closeWipeModal();
          alert('🧹 ' + (data.message || 'Đã dọn sạch toàn bộ dữ liệu CSDL thành công (bảo lưu 288 tài khoản và 8 đội nhóm)!'));
          await loadAllDashboardData();
        } else {
          if (errEl && errMsgEl) {
            errMsgEl.textContent = data.message || 'Lỗi xử lý dọn sạch dữ liệu';
            errEl.classList.remove('hidden');
          }
        }
      } catch (err) {
        if (errEl && errMsgEl) {
          errMsgEl.textContent = 'Lỗi kết nối máy chủ backend';
          errEl.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        if (icon) icon.classList.remove('hidden');
        if (btnText) btnText.textContent = 'Xác Nhận Xóa Sạch';
      }
    });
  }
}

function openWipeModal() {
  const wipeModal = document.getElementById('modal-wipe-database');
  const pwdInput = document.getElementById('wipe-confirm-password');
  const errEl = document.getElementById('wipe-pwd-error');
  const togglePwdBtn = document.getElementById('btn-toggle-wipe-pwd');

  if (pwdInput) {
    pwdInput.value = '';
    pwdInput.type = 'password';
    pwdInput.classList.remove('border-rose-500');
  }
  if (togglePwdBtn) togglePwdBtn.textContent = '👁️';
  if (errEl) errEl.classList.add('hidden');

  if (wipeModal) {
    wipeModal.classList.add('show');
    setTimeout(() => pwdInput?.focus(), 150);
  }
}

function closeWipeModal() {
  const wipeModal = document.getElementById('modal-wipe-database');
  const pwdInput = document.getElementById('wipe-confirm-password');
  const errEl = document.getElementById('wipe-pwd-error');

  if (wipeModal) wipeModal.classList.remove('show');
  if (pwdInput) pwdInput.value = '';
  if (errEl) errEl.classList.add('hidden');
}

// =========================================================================
// ADMIN ACCOUNTS MANAGEMENT MODULE (CRUD)
// =========================================================================

let adminAccountsList = [];
let pendingDeleteAdminId = null;

function bindAdminAccountEvents() {
  // Search and Filter Events
  const searchInput = document.getElementById('admin-search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadAdminAccounts();
      }, 300);
    });
  }

  const roleFilter = document.getElementById('admin-filter-role');
  if (roleFilter) {
    roleFilter.addEventListener('change', () => loadAdminAccounts());
  }

  const statusFilter = document.getElementById('admin-filter-status');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => loadAdminAccounts());
  }

  const btnRefresh = document.getElementById('btn-refresh-admins');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadAdminAccounts();
      loadAdminAccountStats();
    });
  }

  // Create Modal Open
  const btnOpenCreate = document.getElementById('btn-open-create-admin');
  if (btnOpenCreate) {
    btnOpenCreate.addEventListener('click', () => openCreateAdminModal());
  }

  // Form Submit
  const adminForm = document.getElementById('form-admin-account');
  if (adminForm) {
    adminForm.addEventListener('submit', handleAdminFormSubmit);
  }

  // Form Modal Close
  const closeBtn = document.getElementById('admin-modal-close');
  const cancelBtn = document.getElementById('admin-modal-cancel');
  const modalAccount = document.getElementById('modal-admin-account');
  if (closeBtn) closeBtn.addEventListener('click', closeAdminModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeAdminModal);
  if (modalAccount) {
    modalAccount.addEventListener('click', (e) => {
      if (e.target === modalAccount) closeAdminModal();
    });
  }

  // Toggle Password Visibility in Modal
  const btnTogglePwd = document.getElementById('btn-toggle-admin-pwd');
  const pwdInput = document.getElementById('admin-form-password');
  if (btnTogglePwd && pwdInput) {
    btnTogglePwd.addEventListener('click', () => {
      const isPwd = pwdInput.type === 'password';
      pwdInput.type = isPwd ? 'text' : 'password';
      btnTogglePwd.textContent = isPwd ? '🙈' : '👁️';
    });
  }

  // Delete Modal Close
  const delCloseBtn = document.getElementById('admin-delete-modal-close');
  const delCancelBtn = document.getElementById('admin-delete-cancel');
  const modalDelete = document.getElementById('modal-admin-delete');
  if (delCloseBtn) delCloseBtn.addEventListener('click', closeDeleteAdminModal);
  if (delCancelBtn) delCancelBtn.addEventListener('click', closeDeleteAdminModal);
  if (modalDelete) {
    modalDelete.addEventListener('click', (e) => {
      if (e.target === modalDelete) closeDeleteAdminModal();
    });
  }

  // Confirm Delete Button
  const btnConfirmDelete = document.getElementById('btn-confirm-delete-admin');
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', handleConfirmDeleteAdmin);
  }

  // ESC key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalAccount?.classList.contains('show')) closeAdminModal();
      if (modalDelete?.classList.contains('show')) closeDeleteAdminModal();
    }
  });
}

async function loadAdminAccounts() {
  const tbody = document.getElementById('admin-accounts-table-body');
  if (!tbody) return;

  const search = document.getElementById('admin-search-input')?.value.trim() || '';
  const role = document.getElementById('admin-filter-role')?.value || '';
  const status = document.getElementById('admin-filter-status')?.value || '';

  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="p-8 text-center text-slate-500 font-bold">
        <span class="inline-block animate-spin mr-2">⏳</span> Đang tải danh sách quản trị viên...
      </td>
    </tr>
  `;

  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (role) params.append('role', role);
    if (status) params.append('status', status);

    const res = await fetch(`${API_BASE}/admin/accounts?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (res.status === 403) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-rose-400 font-bold">
            🔒 Bạn không có quyền xem danh sách quản trị viên (Chỉ dành riêng cho Superadmin).
          </td>
        </tr>
      `;
      return;
    }

    const data = await res.json();
    if (!data.success) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-rose-400 font-bold">
            ❌ Lỗi tải dữ liệu: ${data.message || 'Không thể kết nối đến máy chủ.'}
          </td>
        </tr>
      `;
      return;
    }

    adminAccountsList = data.data || [];
    renderAdminAccountsTable(adminAccountsList);
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-rose-400 font-bold">
          ❌ Không thể tải danh sách tài khoản: ${err.message}
        </td>
      </tr>
    `;
  }
}

function renderAdminAccountsTable(accounts) {
  const tbody = document.getElementById('admin-accounts-table-body');
  if (!tbody) return;

  if (accounts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-400 font-bold">
          📭 Không tìm thấy tài khoản quản trị nào phù hợp với điều kiện lọc.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = accounts.map(item => {
    const isSelf = currentUser && (currentUser.id === item.id || currentUser.username === item.username);
    
    // Role styling
    let roleBadge = '';
    let avatarGradient = 'linear-gradient(135deg, #64748b, #475569)';
    if (item.role === 'admin') {
      roleBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-purple-500/15 border border-purple-500/30 text-purple-300">👑 Superadmin</span>';
      avatarGradient = 'linear-gradient(135deg, #a855f7, #6366f1)';
    } else if (item.role === 'moderator') {
      roleBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">⚖️ Điều Phối Viên</span>';
      avatarGradient = 'linear-gradient(135deg, #06b6d4, #0284c7)';
    } else {
      roleBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-slate-500/15 border border-slate-500/30 text-slate-300">👀 Quan Sát</span>';
    }

    // Status styling
    const statusBadge = item.is_active 
      ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">🟢 Hoạt Động</span>'
      : '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-500/15 border border-rose-500/30 text-rose-400">🔴 Đang Khóa</span>';

    // Date formatting
    const createdDate = item.created_at ? new Date(item.created_at).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    }) : '—';

    // Initials for Avatar
    const initials = (item.full_name || item.username || 'AD')
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .slice(-2)
      .join('')
      .toUpperCase();

    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td>
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-md shrink-0" style="background: ${avatarGradient};">
              ${initials}
            </div>
            <div>
              <div class="font-bold text-white flex items-center gap-2">
                <span>${item.full_name}</span>
                ${isSelf ? '<span class="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[10px] font-extrabold border border-sky-400/30">Bạn</span>' : ''}
              </div>
              <div class="text-[11px] text-slate-400 font-mono">${item.id}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="font-mono text-xs font-bold text-sky-300">@${item.username}</span>
        </td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td>
          <span class="text-xs text-slate-300 font-bold">${createdDate}</span>
        </td>
        <td class="text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button class="btn btn-ghost px-2.5 py-1.5 text-xs text-sky-400 hover:text-white" 
              onclick="window.editAdminAccount('${item.id}')" title="Chỉnh sửa thông tin">
              ✏️ Sửa
            </button>
            
            ${isSelf ? `
              <button class="btn btn-ghost px-2.5 py-1.5 text-xs text-slate-600 cursor-not-allowed opacity-50" 
                title="Không thể tự khóa tài khoản của chính mình" disabled>
                🔒 Khóa
              </button>
              <button class="btn btn-ghost px-2.5 py-1.5 text-xs text-slate-600 cursor-not-allowed opacity-50" 
                title="Không thể tự xóa tài khoản của chính mình" disabled>
                🗑️
              </button>
            ` : `
              <button class="btn btn-ghost px-2.5 py-1.5 text-xs ${item.is_active ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}" 
                onclick="window.toggleAdminStatus('${item.id}', ${item.is_active})" 
                title="${item.is_active ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'}">
                ${item.is_active ? '🔒 Khóa' : '🔓 Mở'}
              </button>
              <button class="btn btn-ghost px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300" 
                onclick="window.openDeleteAdminModal('${item.id}', '${item.username}', '${item.full_name}', '${item.role}')" 
                title="Xóa vĩnh viễn tài khoản">
                🗑️
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadAdminAccountStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/accounts/stats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && data.data) {
      const s = data.data;
      const totalEl = document.getElementById('kpi-admin-total');
      const activeEl = document.getElementById('kpi-admin-active');
      const superEl = document.getElementById('kpi-admin-super');
      const modsEl = document.getElementById('kpi-admin-mods');

      if (totalEl) totalEl.textContent = s.total || 0;
      if (activeEl) activeEl.textContent = `${s.active || 0} đang hoạt động (${s.inactive || 0} bị khóa)`;
      if (superEl) superEl.textContent = s.admins || 0;
      if (modsEl) modsEl.textContent = s.moderators || 0;
    }
  } catch (err) {
    console.warn('Could not load admin stats:', err);
  }
}

function openCreateAdminModal() {
  const modal = document.getElementById('modal-admin-account');
  const title = document.getElementById('admin-modal-title');
  const idInput = document.getElementById('admin-form-id');
  const usernameInput = document.getElementById('admin-form-username');
  const fullnameInput = document.getElementById('admin-form-fullname');
  const pwdInput = document.getElementById('admin-form-password');
  const pwdRequired = document.getElementById('admin-pwd-required');
  const pwdLabel = document.getElementById('admin-pwd-label');
  const pwdHint = document.getElementById('admin-pwd-hint');
  const roleSelect = document.getElementById('admin-form-role');
  const activeCheck = document.getElementById('admin-form-active');
  const errBox = document.getElementById('admin-form-error');

  if (title) title.textContent = 'Thêm Quản Trị Viên Mới';
  if (idInput) idInput.value = '';
  if (usernameInput) {
    usernameInput.value = '';
    usernameInput.disabled = false;
    usernameInput.classList.remove('opacity-60', 'cursor-not-allowed');
  }
  if (fullnameInput) fullnameInput.value = '';
  if (pwdInput) {
    pwdInput.value = '';
    pwdInput.required = true;
    pwdInput.placeholder = 'Tối thiểu 6 ký tự...';
  }
  if (pwdRequired) pwdRequired.classList.remove('hidden');
  if (pwdLabel) pwdLabel.textContent = 'Mật Khẩu Đăng Nhập';
  if (pwdHint) pwdHint.textContent = 'Mật khẩu tối thiểu 6 ký tự được mã hóa an toàn bằng thuật toán Bcrypt.';
  if (roleSelect) roleSelect.value = 'moderator';
  if (activeCheck) activeCheck.checked = true;
  if (errBox) errBox.classList.add('hidden');

  if (modal) {
    modal.classList.add('show');
    setTimeout(() => usernameInput?.focus(), 150);
  }
}

function openEditAdminModal(account) {
  const modal = document.getElementById('modal-admin-account');
  const title = document.getElementById('admin-modal-title');
  const idInput = document.getElementById('admin-form-id');
  const usernameInput = document.getElementById('admin-form-username');
  const fullnameInput = document.getElementById('admin-form-fullname');
  const pwdInput = document.getElementById('admin-form-password');
  const pwdRequired = document.getElementById('admin-pwd-required');
  const pwdLabel = document.getElementById('admin-pwd-label');
  const pwdHint = document.getElementById('admin-pwd-hint');
  const roleSelect = document.getElementById('admin-form-role');
  const activeCheck = document.getElementById('admin-form-active');
  const errBox = document.getElementById('admin-form-error');

  if (title) title.textContent = `Chỉnh Sửa Tài Khoản: @${account.username}`;
  if (idInput) idInput.value = account.id;
  if (usernameInput) {
    usernameInput.value = account.username;
    usernameInput.disabled = true;
    usernameInput.classList.add('opacity-60', 'cursor-not-allowed');
  }
  if (fullnameInput) fullnameInput.value = account.full_name || '';
  if (pwdInput) {
    pwdInput.value = '';
    pwdInput.required = false;
    pwdInput.placeholder = 'Để trống nếu không muốn đổi mật khẩu';
  }
  if (pwdRequired) pwdRequired.classList.add('hidden');
  if (pwdLabel) pwdLabel.textContent = 'Đổi Mật Khẩu Mới (Tùy chọn)';
  if (pwdHint) pwdHint.textContent = 'Nhập mật khẩu mới nếu muốn cấp lại cho thành viên, hoặc để trống để giữ nguyên.';
  if (roleSelect) roleSelect.value = account.role || 'moderator';
  if (activeCheck) activeCheck.checked = Boolean(account.is_active);
  if (errBox) errBox.classList.add('hidden');

  if (modal) {
    modal.classList.add('show');
    setTimeout(() => fullnameInput?.focus(), 150);
  }
}

function closeAdminModal() {
  const modal = document.getElementById('modal-admin-account');
  if (modal) modal.classList.remove('show');
  const errBox = document.getElementById('admin-form-error');
  if (errBox) errBox.classList.add('hidden');
}

async function handleAdminFormSubmit(e) {
  e.preventDefault();
  const idInput = document.getElementById('admin-form-id');
  const usernameInput = document.getElementById('admin-form-username');
  const fullnameInput = document.getElementById('admin-form-fullname');
  const pwdInput = document.getElementById('admin-form-password');
  const roleSelect = document.getElementById('admin-form-role');
  const activeCheck = document.getElementById('admin-form-active');
  const errBox = document.getElementById('admin-form-error');
  const errMsg = document.getElementById('admin-form-error-msg');
  const submitBtn = document.getElementById('btn-submit-admin-form');
  const spinner = document.getElementById('admin-form-spinner');

  const id = idInput ? idInput.value : '';
  const isEditing = Boolean(id);

  const payload = {
    full_name: fullnameInput.value.trim(),
    role: roleSelect.value,
    is_active: activeCheck.checked
  };

  if (!isEditing) {
    payload.username = usernameInput.value.trim();
    payload.password = pwdInput.value;
  } else {
    if (pwdInput.value && pwdInput.value.trim().length >= 6) {
      payload.password = pwdInput.value.trim();
    }
  }

  // Clear previous errors
  if (errBox) errBox.classList.add('hidden');
  if (submitBtn) submitBtn.disabled = true;
  if (spinner) spinner.classList.remove('hidden');

  try {
    const url = isEditing 
      ? `${API_BASE}/admin/accounts/${id}` 
      : `${API_BASE}/admin/accounts`;
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Thao tác không thành công.');
    }

    closeAdminModal();
    loadAdminAccounts();
    loadAdminAccountStats();
  } catch (err) {
    if (errBox && errMsg) {
      errMsg.textContent = err.message || 'Có lỗi xảy ra.';
      errBox.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
  }
}

async function toggleAdminStatus(id, currentStatus) {
  try {
    const res = await fetch(`${API_BASE}/admin/accounts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ is_active: !currentStatus })
    });

    const data = await res.json();
    if (!data.success) {
      alert(`⚠️ ${data.message}`);
      return;
    }

    loadAdminAccounts();
    loadAdminAccountStats();
  } catch (err) {
    alert(`❌ Không thể thay đổi trạng thái: ${err.message}`);
  }
}

function openDeleteAdminModal(id, username, fullName, role) {
  pendingDeleteAdminId = id;
  const modal = document.getElementById('modal-admin-delete');
  const nameEl = document.getElementById('delete-admin-fullname');
  const usernameEl = document.getElementById('delete-admin-username');
  const roleEl = document.getElementById('delete-admin-role');
  const errBox = document.getElementById('delete-admin-error');

  if (nameEl) nameEl.textContent = fullName;
  if (usernameEl) usernameEl.textContent = `@${username}`;
  if (roleEl) roleEl.textContent = role === 'admin' ? 'Superadmin' : (role === 'moderator' ? 'Điều Phối Viên' : 'Người Quan Sát');
  if (errBox) errBox.classList.add('hidden');

  if (modal) modal.classList.add('show');
}

function closeDeleteAdminModal() {
  pendingDeleteAdminId = null;
  const modal = document.getElementById('modal-admin-delete');
  if (modal) modal.classList.remove('show');
  const errBox = document.getElementById('delete-admin-error');
  if (errBox) errBox.classList.add('hidden');
}

async function handleConfirmDeleteAdmin() {
  if (!pendingDeleteAdminId) return;

  const btnConfirm = document.getElementById('btn-confirm-delete-admin');
  const spinner = document.getElementById('admin-delete-spinner');
  const errBox = document.getElementById('delete-admin-error');
  const errMsg = document.getElementById('delete-admin-error-msg');

  if (btnConfirm) btnConfirm.disabled = true;
  if (spinner) spinner.classList.remove('hidden');
  if (errBox) errBox.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/admin/accounts/${pendingDeleteAdminId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Không thể xóa tài khoản này.');
    }

    closeDeleteAdminModal();
    loadAdminAccounts();
    loadAdminAccountStats();
  } catch (err) {
    if (errBox && errMsg) {
      errMsg.textContent = err.message || 'Có lỗi xảy ra.';
      errBox.classList.remove('hidden');
    }
  } finally {
    if (btnConfirm) btnConfirm.disabled = false;
    if (spinner) spinner.classList.add('hidden');
  }
}

// Attach global window handlers
window.editAdminAccount = function(id) {
  const account = adminAccountsList.find(a => a.id === id);
  if (account) {
    openEditAdminModal(account);
  }
};
window.toggleAdminStatus = toggleAdminStatus;
window.openDeleteAdminModal = openDeleteAdminModal;

// =========================================================================
// 288 PERSONNEL MANAGEMENT MODULE (FULL CRUD)
// =========================================================================

let pendingDeletePersonnel = null;

function bindPersonnelEvents() {
  // Create Modal Open
  const btnOpenCreate = document.getElementById('btn-open-create-personnel');
  if (btnOpenCreate) {
    btnOpenCreate.addEventListener('click', openCreatePersonnelModal);
  }

  // Form Submit
  const formEl = document.getElementById('form-personnel');
  if (formEl) {
    formEl.addEventListener('submit', handlePersonnelFormSubmit);
  }

  // Form Modal Close
  const closeBtn = document.getElementById('personnel-modal-close');
  const cancelBtn = document.getElementById('personnel-modal-cancel');
  const modalForm = document.getElementById('modal-personnel-form');
  if (closeBtn) closeBtn.addEventListener('click', closePersonnelModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closePersonnelModal);
  if (modalForm) {
    modalForm.addEventListener('click', (e) => {
      if (e.target === modalForm) closePersonnelModal();
    });
  }

  // Detail Modal Close
  const detailCloseBtn = document.getElementById('personnel-detail-close');
  const detailOkBtn = document.getElementById('personnel-detail-ok');
  const modalDetail = document.getElementById('modal-personnel-detail');
  if (detailCloseBtn) detailCloseBtn.addEventListener('click', closePersonnelDetailModal);
  if (detailOkBtn) detailOkBtn.addEventListener('click', closePersonnelDetailModal);
  if (modalDetail) {
    modalDetail.addEventListener('click', (e) => {
      if (e.target === modalDetail) closePersonnelDetailModal();
    });
  }

  // Delete Modal Close & Confirm
  const delCloseBtn = document.getElementById('personnel-delete-modal-close');
  const delCancelBtn = document.getElementById('personnel-delete-cancel');
  const modalDelete = document.getElementById('modal-personnel-delete');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete-personnel');

  if (delCloseBtn) delCloseBtn.addEventListener('click', closeDeletePersonnelModal);
  if (delCancelBtn) delCancelBtn.addEventListener('click', closeDeletePersonnelModal);
  if (modalDelete) {
    modalDelete.addEventListener('click', (e) => {
      if (e.target === modalDelete) closeDeletePersonnelModal();
    });
  }
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', handleConfirmDeletePersonnel);
  }

  // ESC Key listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalForm?.classList.contains('show')) closePersonnelModal();
      if (modalDetail?.classList.contains('show')) closePersonnelDetailModal();
      if (modalDelete?.classList.contains('show')) closeDeletePersonnelModal();
    }
  });
}

function openCreatePersonnelModal() {
  const modal = document.getElementById('modal-personnel-form');
  const form = document.getElementById('form-personnel');
  const errBox = document.getElementById('personnel-form-error');

  if (form) form.reset();
  document.getElementById('personnel-form-id').value = '';
  document.getElementById('personnel-form-nickname').value = '';
  document.getElementById('personnel-form-team').value = '1';
  document.getElementById('personnel-modal-title').textContent = 'Thêm Bút Danh Mới';
  document.getElementById('personnel-form-btn-text').textContent = 'Lưu Bút Danh';
  if (errBox) errBox.classList.add('hidden');

  if (modal) {
    modal.classList.add('show');
    setTimeout(() => document.getElementById('personnel-form-nickname')?.focus(), 150);
  }
}

function closePersonnelModal() {
  const modal = document.getElementById('modal-personnel-form');
  const errBox = document.getElementById('personnel-form-error');
  if (modal) modal.classList.remove('show');
  if (errBox) errBox.classList.add('hidden');
}

async function openEditPersonnelModal(id) {
  const modal = document.getElementById('modal-personnel-form');
  const errBox = document.getElementById('personnel-form-error');
  if (errBox) errBox.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success || !data.data) {
      alert(data.message || 'Không thể lấy thông tin bút danh.');
      return;
    }

    const u = data.data;
    document.getElementById('personnel-form-id').value = u.id || '';
    document.getElementById('personnel-form-nickname').value = u.nickname || '';
    document.getElementById('personnel-form-team').value = u.team_id || '1';

    document.getElementById('personnel-modal-title').textContent = `Chỉnh Sửa Bút Danh: ${u.nickname || 'Bút danh'}`;
    document.getElementById('personnel-form-btn-text').textContent = 'Cập Nhật Bút Danh';

    if (modal) {
      modal.classList.add('show');
      setTimeout(() => document.getElementById('personnel-form-nickname')?.focus(), 150);
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ: ' + err.message);
  }
}

async function handlePersonnelFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('personnel-form-id').value;
  const nickname = document.getElementById('personnel-form-nickname').value.trim();
  const teamId = parseInt(document.getElementById('personnel-form-team').value, 10);

  const errBox = document.getElementById('personnel-form-error');
  const errMsg = document.getElementById('personnel-form-error-msg');
  const btnSubmit = document.getElementById('btn-submit-personnel-form');
  const spinner = document.getElementById('personnel-form-spinner');

  if (!nickname) {
    if (errBox && errMsg) {
      errMsg.textContent = 'Vui lòng nhập bút danh.';
      errBox.classList.remove('hidden');
    }
    return;
  }

  if (errBox) errBox.classList.add('hidden');

  const payload = {
    nickname: nickname,
    team_id: teamId
  };

  // UI loading
  if (btnSubmit) btnSubmit.disabled = true;
  if (spinner) spinner.classList.remove('hidden');

  try {
    const isEdit = !!id;
    const url = isEdit ? `${API_BASE}/admin/users/${id}` : `${API_BASE}/admin/users`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      if (errBox && errMsg) {
        errMsg.textContent = data.message || (data.errors ? data.errors[0]?.message : 'Lỗi xử lý');
        errBox.classList.remove('hidden');
      }
      return;
    }

    closePersonnelModal();
    alert(data.message || (isEdit ? 'Cập nhật thành công!' : 'Thêm bút danh thành công!'));
    loadUsers();
    loadAnalytics();
  } catch (err) {
    if (errBox && errMsg) {
      errMsg.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
      errBox.classList.remove('hidden');
    }
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
    if (spinner) spinner.classList.add('hidden');
  }
}

async function viewPersonnelDetail(id) {
  const modal = document.getElementById('modal-personnel-detail');
  const contentEl = document.getElementById('personnel-detail-content');
  if (!modal || !contentEl) return;

  contentEl.innerHTML = `
    <div class="p-8 text-center text-slate-500 font-bold">
      <span class="inline-block animate-spin mr-2">⏳</span> Đang tải thông tin chi tiết bút danh...
    </div>
  `;
  modal.classList.add('show');

  try {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();

    if (!data.success || !data.data) {
      contentEl.innerHTML = `
        <div class="p-6 text-center text-rose-400 font-bold">
          ❌ Không tìm thấy thông tin bút danh.
        </div>
      `;
      return;
    }

    const u = data.data;
    const teamColor = u.team_color || '#0284c7';
    const recentQuotes = Array.isArray(u.recent_quotes) ? u.recent_quotes : [];

    contentEl.innerHTML = `
      <!-- Header Profile Card -->
      <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg flex-shrink-0"
             style="background: linear-gradient(135deg, ${teamColor}, ${teamColor}99);">
          ${escapeHtml((u.nickname || 'BD').slice(0, 2).toUpperCase())}
        </div>
        <div class="space-y-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="text-sm font-black text-white truncate">${escapeHtml(u.nickname || 'Bút danh')}</h4>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black" style="background: ${teamColor}22; color: ${teamColor}; border: 1px solid ${teamColor}44;">
              ${escapeHtml(u.team_display_name || ('Đội ' + u.team_id))}
            </span>
          </div>
          <p class="text-xs text-slate-400">Thành viên đội thi đua</p>
        </div>
      </div>

      <!-- Stats Counters -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div class="text-lg font-black text-sky-400">${(u.total_exp_earned || 0).toLocaleString()}</div>
          <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">EXP Cá Nhân</div>
        </div>
        <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div class="text-lg font-black text-emerald-400">${u.contributed_books_count || 0}</div>
          <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sách Đã Gieo</div>
        </div>
        <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div class="text-lg font-black text-amber-400">${u.total_quotes_count || 0}</div>
          <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng Quote</div>
        </div>
        <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div class="text-lg font-black text-purple-400">${u.total_dews_count || 0}</div>
          <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lượt Tưới</div>
        </div>
      </div>

      <!-- Recent Quotes Activity -->
      <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <div class="text-[11px] font-black text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center justify-between">
          <span class="flex items-center gap-1.5"><span>📖</span><span>Trích Dẫn Gần Nhất (${recentQuotes.length})</span></span>
        </div>
        ${recentQuotes.length === 0 ? `
          <p class="text-xs text-slate-500 italic py-2 text-center">Chưa có trích dẫn sách nào được ghi nhận.</p>
        ` : `
          <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
            ${recentQuotes.map(q => `
              <div class="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/60 space-y-1">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="font-bold text-sky-300 truncate max-w-[280px]">📚 ${escapeHtml(q.book_title || 'Không rõ sách')}</span>
                  <span class="text-[10px] font-mono text-slate-400">${q.quote_date ? formatDateVN(q.quote_date) : ''}</span>
                </div>
                ${q.book_quote ? `<p class="text-[11px] text-slate-300 italic line-clamp-2">“${escapeHtml(q.book_quote)}”</p>` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  } catch (err) {
    contentEl.innerHTML = `
      <div class="p-6 text-center text-rose-400 font-bold">
        ❌ Không thể tải thông tin: ${err.message}
      </div>
    `;
  }
}

function closePersonnelDetailModal() {
  const modal = document.getElementById('modal-personnel-detail');
  if (modal) modal.classList.remove('show');
}

function openDeletePersonnelModal(id, code, name, team) {
  pendingDeletePersonnel = { id, code, name, team };
  const modal = document.getElementById('modal-personnel-delete');
  const errBox = document.getElementById('delete-personnel-error');

  const nameEl = document.getElementById('delete-personnel-name');
  if (nameEl) nameEl.textContent = name || '...';
  const teamEl = document.getElementById('delete-personnel-team');
  if (teamEl) teamEl.textContent = team || '...';
  if (errBox) errBox.classList.add('hidden');

  if (modal) modal.classList.add('show');
}

function closeDeletePersonnelModal() {
  const modal = document.getElementById('modal-personnel-delete');
  const errBox = document.getElementById('delete-personnel-error');
  if (modal) modal.classList.remove('show');
  if (errBox) errBox.classList.add('hidden');
  pendingDeletePersonnel = null;
}

async function handleConfirmDeletePersonnel() {
  if (!pendingDeletePersonnel) return;

  const btnConfirm = document.getElementById('btn-confirm-delete-personnel');
  const spinner = document.getElementById('personnel-delete-spinner');
  const errBox = document.getElementById('delete-personnel-error');
  const errMsg = document.getElementById('delete-personnel-error-msg');

  if (btnConfirm) btnConfirm.disabled = true;
  if (spinner) spinner.classList.remove('hidden');
  if (errBox) errBox.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/admin/users/${pendingDeletePersonnel.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Không thể xóa bút danh này.');
    }

    closeDeletePersonnelModal();
    alert(data.message || 'Đã xóa bút danh thành công!');
    loadUsers();
    loadAnalytics();
  } catch (err) {
    if (errBox && errMsg) {
      errMsg.textContent = err.message || 'Có lỗi xảy ra khi xóa.';
      errBox.classList.remove('hidden');
    }
  } finally {
    if (btnConfirm) btnConfirm.disabled = false;
    if (spinner) spinner.classList.add('hidden');
  }
}

// Window global bindings
window.openCreatePersonnelModal = openCreatePersonnelModal;
window.openEditPersonnelModal = openEditPersonnelModal;
window.viewPersonnelDetail = viewPersonnelDetail;
window.openDeletePersonnelModal = openDeletePersonnelModal;

