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
let currentBookInModal = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initAuthView();
  bindEvents();
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
    loadDashboardStats();
    loadBooks();
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
      badge.textContent = '🟢 REALTIME ACTIVE';
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
    }
  });

  socket.on('disconnect', () => {
    if (badge) {
      badge.textContent = '🔴 DISCONNECTED';
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40';
    }
  });

  // Listen to live community events
  socket.on('growth:updated', (growth) => {
    updateGrowthUI(growth);
  });

  socket.on('book:created', (book) => {
    loadBooks();
    loadDashboardStats();
  });
}

function bindEvents() {
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
        const res = await fetch(`${getApiBase()}/admin/auth/login`, {
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
        console.error('Login error:', err);
        errEl.textContent = 'Lỗi kết nối máy chủ backend. Vui lòng kiểm tra server cổng 5000.';
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

  // Tabs
  const tabBooksBtn = document.getElementById('tab-books-btn');
  const tabTreeBtn = document.getElementById('tab-tree-btn');
  const tabAuditBtn = document.getElementById('tab-audit-btn');

  const contentBooks = document.getElementById('tab-books-content');
  const contentTree = document.getElementById('tab-tree-content');
  const contentAudit = document.getElementById('tab-audit-content');

  function switchTab(activeBtn, activeContent) {
    [tabBooksBtn, tabTreeBtn, tabAuditBtn].forEach(b => {
      if (b) b.className = 'btn btn-ghost text-xs font-bold';
    });
    [contentBooks, contentTree, contentAudit].forEach(c => {
      if (c) c.classList.add('hidden');
    });

    if (activeBtn) activeBtn.className = 'btn btn-primary text-xs font-bold';
    if (activeContent) activeContent.classList.remove('hidden');
  }

  if (tabBooksBtn) {
    tabBooksBtn.addEventListener('click', () => {
      switchTab(tabBooksBtn, contentBooks);
      loadBooks();
    });
  }
  if (tabTreeBtn) {
    tabTreeBtn.addEventListener('click', () => {
      switchTab(tabTreeBtn, contentTree);
    });
  }
  if (tabAuditBtn) {
    tabAuditBtn.addEventListener('click', () => {
      switchTab(tabAuditBtn, contentAudit);
      loadAuditLogs();
    });
  }

  // Filters & Refresh
  const refreshBtn = document.getElementById('btn-refresh-books');
  if (refreshBtn) refreshBtn.addEventListener('click', loadBooks);
  
  const searchInput = document.getElementById('filter-search');
  if (searchInput) searchInput.addEventListener('input', debounce(loadBooks, 300));
  
  const modFilter = document.getElementById('filter-moderation');
  if (modFilter) modFilter.addEventListener('change', loadBooks);

  const visFilter = document.getElementById('filter-visibility');
  if (visFilter) visFilter.addEventListener('change', loadBooks);

  // Bonus EXP Form
  const bonusForm = document.getElementById('bonus-exp-form');
  if (bonusForm) {
    bonusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseInt(document.getElementById('bonus-amount').value, 10);
      const reason = document.getElementById('bonus-reason').value;

      try {
        const res = await fetch(`${getApiBase()}/admin/growth/bonus`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ amount, reason })
        });
        const data = await res.json();
        if (data.success) {
          alert(`🎉 Đã tặng +${amount} EXP thành công!`);
          bonusForm.reset();
          loadDashboardStats();
        } else {
          alert(data.message || 'Lỗi xử lý');
        }
      } catch (err) {
        alert('Lỗi kết nối máy chủ');
      }
    });
  }

  // Modal handlers
  const closeModBtn = document.getElementById('mod-modal-close');
  if (closeModBtn) closeModBtn.addEventListener('click', closeModal);

  const modReviewedBtn = document.getElementById('mod-btn-reviewed');
  if (modReviewedBtn) modReviewedBtn.addEventListener('click', () => handleModalAction('reviewed', 'visible'));

  const modHideBtn = document.getElementById('mod-btn-hide');
  if (modHideBtn) modHideBtn.addEventListener('click', () => handleModalAction('rejected', 'deleted'));
}

async function loadDashboardStats() {
  try {
    const res = await fetch(`${getApiBase()}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      updateGrowthUI(data.data.growth);
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

function updateGrowthUI(growth) {
  if (!growth) return;
  const levelEl = document.getElementById('stat-level-name');
  if (levelEl) levelEl.textContent = growth.levelName || `Level ${growth.level}`;
  
  const descEl = document.getElementById('stat-level-desc');
  if (descEl) descEl.textContent = growth.levelDesc || '';
  
  const badgeEl = document.getElementById('stat-level-badge');
  if (badgeEl) badgeEl.textContent = `Level ${growth.level}`;
  
  const expEl = document.getElementById('stat-total-exp');
  if (expEl) expEl.textContent = (growth.totalEXP || 0).toLocaleString();
  
  const pctEl = document.getElementById('stat-progress-percent');
  if (pctEl) pctEl.textContent = `${growth.progressPercent || 0}%`;
  
  const barEl = document.getElementById('stat-progress-bar');
  if (barEl) barEl.style.width = `${growth.progressPercent || 0}%`;
  
  const booksEl = document.getElementById('stat-total-books');
  if (booksEl) booksEl.textContent = (growth.totalBooks || 0).toLocaleString();
  
  const dewsEl = document.getElementById('stat-total-dews');
  if (dewsEl) dewsEl.textContent = (growth.totalDews || 0).toLocaleString();
  
  const likesEl = document.getElementById('stat-total-likes');
  if (likesEl) likesEl.textContent = (growth.totalLikes || 0).toLocaleString();
  
  const readersEl = document.getElementById('stat-active-readers');
  if (readersEl) readersEl.textContent = (growth.activeReaders || 1).toLocaleString();
}

async function loadBooks() {
  const tbody = document.getElementById('books-table-body');
  if (!tbody) return;

  const search = document.getElementById('filter-search')?.value || '';
  const modStatus = document.getElementById('filter-moderation')?.value || '';
  const visStatus = document.getElementById('filter-visibility')?.value || '';

  let url = `${getApiBase()}/admin/books?page=1&limit=50`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (modStatus) url += `&moderation_status=${modStatus}`;
  if (visStatus) url += `&visibility_status=${visStatus}`;

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
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
    if (b.moderation_status === 'reviewed') modBadge = `<span class="badge badge-reviewed">Đã Duyệt</span>`;
    if (b.moderation_status === 'rejected') modBadge = `<span class="badge badge-hidden">Bị Loại</span>`;

    let visBadge = `<span class="text-[10px] text-emerald-400 font-bold">🟢 Hiện</span>`;
    if (b.visibility_status !== 'visible') visBadge = `<span class="text-[10px] text-rose-400 font-bold">🔴 Ẩn</span>`;

    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="p-3.5 max-w-sm">
          <div class="font-black text-white text-sm">${escapeHtml(b.title)}</div>
          <div class="text-[11px] text-sky-400 font-bold">${escapeHtml(b.author)} · <span class="text-slate-400">${escapeHtml(b.category || '')}</span></div>
          <p class="text-slate-300 italic text-[11px] mt-1 line-clamp-2">"${escapeHtml(b.quote)}"</p>
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
        <td class="p-3.5">
          <span class="font-black text-amber-400">❤️ ${b.likes_count || 0}</span>
        </td>
        <td class="p-3.5 text-right space-x-1 whitespace-nowrap">
          <button onclick="openModModal('${b.id}')" class="btn btn-ghost text-[11px] py-1 px-2.5">
            <span>⚙️</span><span>Hậu Kiểm</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.openModModal = async function(bookId) {
  try {
    const res = await fetch(`${getApiBase()}/admin/books?page=1&limit=50`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    const book = data.data.books.find(x => x.id === bookId);
    if (!book) return;

    currentBookInModal = book;
    document.getElementById('mod-book-title').textContent = book.title;
    document.getElementById('mod-book-author').textContent = book.author;
    document.getElementById('mod-book-quote').textContent = `"${book.quote}"`;
    document.getElementById('mod-notes').value = book.moderation_notes || '';
    document.getElementById('mod-deduct-exp').checked = false;

    document.getElementById('mod-modal').classList.add('show');
  } catch (err) {
    console.error(err);
  }
};

function closeModal() {
  const modal = document.getElementById('mod-modal');
  if (modal) modal.classList.remove('show');
  currentBookInModal = null;
}

async function handleModalAction(modStatus, visStatus) {
  if (!currentBookInModal) return;

  const notes = document.getElementById('mod-notes').value;
  const deductExp = document.getElementById('mod-deduct-exp').checked;

  try {
    const res = await fetch(`${getApiBase()}/admin/books/${currentBookInModal.id}/status`, {
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
      closeModal();
      loadBooks();
      loadDashboardStats();
    } else {
      alert(data.message || 'Lỗi cập nhật');
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ');
  }
}

async function loadAuditLogs() {
  const tbody = document.getElementById('audit-table-body');
  if (!tbody) return;

  try {
    const res = await fetch(`${getApiBase()}/admin/audit-logs`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      tbody.innerHTML = data.data.map(a => `
        <tr class="hover:bg-slate-800/40">
          <td class="p-3 text-slate-400">${new Date(a.created_at).toLocaleString('vi-VN')}</td>
          <td class="p-3 font-bold text-sky-300">${escapeHtml(a.admin_username || 'System')}</td>
          <td class="p-3"><span class="badge badge-reviewed">${escapeHtml(a.action)}</span></td>
          <td class="p-3 text-slate-300">${escapeHtml(a.target_type)}</td>
          <td class="p-3 font-mono text-[10px] text-slate-400 max-w-xs truncate">${escapeHtml(JSON.stringify(a.metadata || {}))}</td>
          <td class="p-3 text-slate-500 font-mono text-[10px]">${escapeHtml(a.ip_address || '')}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-rose-400">Lỗi tải nhật ký kiểm toán</td></tr>';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
