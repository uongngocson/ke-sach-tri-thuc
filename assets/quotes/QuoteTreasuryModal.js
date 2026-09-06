/**
 * QuoteTreasuryModal.js
 * 🌟 KHO TÀNG TRI THỨC - THƯ VIỆN TRÍCH DẪN SỐ CÁO SÁCH 2026
 * Thiết kế giao diện 100% mới: Clean & Modern White Theme, Editorial Layout, Responsive toàn diện
 * Đồng bộ 100% dữ liệu thật từ PostgreSQL (books, users, teams)
 */

function getApiBase() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5000/api/v1';
  const hostname = window.location.hostname || 'localhost';
  const protocol = window.location.protocol || 'http:';
  const port = window.location.port;
  if (!port || port === '80' || port === '443') {
    return `${protocol}//${window.location.host}/api/v1`;
  }
  return `${protocol}//${hostname}:5000/api/v1`;
}

const TEAMS_INFO = {
  1: { id: 1, name: 'Đội 1', color: '#0054A6', lightBg: '#eff6ff', border: '#bfdbfe' },
  2: { id: 2, name: 'Đội 2', color: '#0284c7', lightBg: '#f0f9ff', border: '#bae6fd' },
  3: { id: 3, name: 'Đội 3', color: '#059669', lightBg: '#ecfdf5', border: '#a7f3d0' },
  4: { id: 4, name: 'Đội 4', color: '#16a34a', lightBg: '#f0fdf4', border: '#bbf7d0' },
  5: { id: 5, name: 'Đội 5', color: '#ea580c', lightBg: '#fff7ed', border: '#fed7aa' },
  6: { id: 6, name: 'Đội 6', color: '#d97706', lightBg: '#fffbeb', border: '#fde68a' },
  7: { id: 7, name: 'Đội 7', color: '#9333ea', lightBg: '#faf5ff', border: '#e9d5ff' },
  8: { id: 8, name: 'Đội 8', color: '#e11d48', lightBg: '#fff1f2', border: '#fecdd3' }
};

export class QuoteTreasuryModal {
  constructor(options = {}) {
    this.modalId = 'quote-treasury-modal-overlay';
    this.onInspectTeam = options.onInspectTeam || null;
    this.allQuotes = [];
    this.displayedQuotes = [];
    this.teamCounts = { all: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
    this.isLoading = false;
    this.isOpen = false;

    // Filters
    this.selectedTeam = 'all';
    this.searchQuery = '';
    this.sortBy = 'most_liked'; // 'most_liked' | 'newest' | 'oldest' | 'title_az'

    this.initDOM();
  }

  initDOM() {
    if (document.getElementById(this.modalId)) return;
    this.injectStyles();
    this.createModalHtml();
    this.bindEvents();
  }

  injectStyles() {
    const existing = document.getElementById('quote-treasury-styles');
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = 'quote-treasury-styles';
    style.textContent = `
      /* ==========================================================================
         KHO TÀNG TRI THỨC - 100% REDESIGNED CLEAN WHITE THEME
         ========================================================================== */
      .qtm-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483641 !important;
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 12px;
        opacity: 0;
        transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        box-sizing: border-box;
      }
      .qtm-overlay.active {
        opacity: 1;
      }
      
      .qtm-card {
        position: relative;
        width: 98vw;
        max-width: 1580px;
        height: 95vh;
        max-height: 96vh;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 28px;
        box-shadow: 0 30px 90px -20px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(226, 232, 240, 0.85);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: scale(0.97) translateY(12px);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        color: #0f172a;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .qtm-overlay.active .qtm-card {
        transform: scale(1) translateY(0);
      }

      /* Top Header */
      .qtm-header {
        padding: 16px 28px;
        background: #ffffff;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
        gap: 16px;
      }
      .qtm-header-left {
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 0;
      }
      .qtm-header-icon {
        width: 46px;
        height: 46px;
        border-radius: 14px;
        background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        box-shadow: 0 8px 20px rgba(245, 158, 11, 0.28);
        flex-shrink: 0;
      }
      .qtm-title-area {
        min-width: 0;
      }
      .qtm-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .qtm-title {
        font-size: 21px;
        font-weight: 900;
        color: #0f172a;
        letter-spacing: -0.02em;
        margin: 0;
        line-height: 1.2;
      }
      .qtm-badge-total {
        font-size: 12px;
        font-weight: 800;
        padding: 3px 12px;
        border-radius: 9999px;
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fde68a;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .qtm-badge-exp {
        font-size: 11.5px;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 9999px;
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
        display: none;
      }
      @media (min-width: 768px) {
        .qtm-badge-exp {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
      }
      .qtm-subtitle {
        font-size: 13px;
        color: #64748b;
        margin: 3px 0 0 0;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .qtm-close-btn {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #64748b;
        font-size: 16px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.18s ease;
        flex-shrink: 0;
      }
      .qtm-close-btn:hover {
        background: #fee2e2;
        border-color: #fca5a5;
        color: #dc2626;
        transform: rotate(90deg);
      }

      /* Filter & Controls Toolbar */
      .qtm-filters-bar {
        padding: 14px 28px;
        background: #fafafa;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex-shrink: 0;
      }
      .qtm-search-row {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      @media (min-width: 768px) {
        .qtm-search-row {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }
      }
      .qtm-search-input-wrap {
        position: relative;
        flex: 1;
        min-width: 0;
      }
      .qtm-search-icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 14px;
        color: #94a3b8;
        pointer-events: none;
      }
      .qtm-search-input {
        width: 100%;
        height: 42px;
        padding: 0 38px 0 40px;
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        border-radius: 12px;
        font-size: 13.5px;
        font-weight: 500;
        color: #0f172a;
        outline: none;
        box-sizing: border-box;
        transition: all 0.2s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
      }
      .qtm-search-input::placeholder {
        color: #94a3b8;
      }
      .qtm-search-input:focus {
        border-color: #f59e0b;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.16);
      }
      .qtm-search-clear {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: #f1f5f9;
        border: none;
        color: #64748b;
        font-size: 11px;
        font-weight: bold;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
      }
      .qtm-search-clear:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
      .qtm-sort-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        align-self: flex-end;
      }
      .qtm-sort-label {
        font-size: 12.5px;
        font-weight: 700;
        color: #64748b;
        white-space: nowrap;
      }
      .qtm-sort-select {
        height: 42px;
        padding: 0 12px;
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 700;
        color: #1e293b;
        outline: none;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        transition: border-color 0.2s;
      }
      .qtm-sort-select:focus {
        border-color: #f59e0b;
      }

      /* Segmented Team Filter Tabs */
      .qtm-pills-row {
        display: flex;
        align-items: center;
        gap: 7px;
        overflow-x: auto;
        padding-bottom: 2px;
        scrollbar-width: thin;
      }
      .qtm-pills-row::-webkit-scrollbar {
        height: 4px;
      }
      .qtm-pills-row::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      .qtm-pills-label {
        font-size: 11.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
        white-space: nowrap;
        margin-right: 4px;
      }
      .qtm-team-pill {
        padding: 6px 13px;
        border-radius: 11px;
        font-size: 12.5px;
        font-weight: 700;
        background: #ffffff;
        border: 1.5px solid #e2e8f0;
        color: #475569;
        white-space: nowrap;
        cursor: pointer;
        transition: all 0.16s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .qtm-team-pill:hover {
        border-color: #f59e0b;
        color: #d97706;
        background: #fffbeb;
      }
      .qtm-team-pill.active {
        background: #0f172a;
        border-color: #0f172a;
        color: #ffffff;
        box-shadow: 0 3px 10px rgba(15, 23, 42, 0.25);
      }
      .qtm-pill-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }
      .qtm-pill-count {
        font-size: 11px;
        font-weight: 800;
        padding: 1px 6px;
        border-radius: 9999px;
        background: #f1f5f9;
        color: #475569;
        margin-left: 2px;
      }
      .qtm-team-pill.active .qtm-pill-count {
        background: rgba(255, 255, 255, 0.22);
        color: #ffffff;
      }

      /* Content Scroll Area */
      .qtm-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px 28px;
        background: #f8fafc;
      }
      .qtm-content::-webkit-scrollbar {
        width: 6px;
      }
      .qtm-content::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 6px;
      }

      /* Modern Responsive Grid */
      .qtm-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 20px;
      }
      @media (min-width: 640px) {
        .qtm-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (min-width: 1080px) {
        .qtm-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (min-width: 1480px) {
        .qtm-grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      /* Clean White Card */
      .qtm-quote-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        position: relative;
      }
      .qtm-quote-card:hover {
        border-color: #cbd5e1;
        box-shadow: 0 12px 30px -8px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(0, 0, 0, 0.03);
        transform: translateY(-3px);
      }

      .qtm-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
        gap: 8px;
      }
      .qtm-team-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 1px solid transparent;
        text-decoration: none;
      }
      .qtm-team-tag:hover {
        transform: scale(1.03);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      }
      .qtm-seed-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 700;
        color: #059669;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        padding: 3px 8px;
        border-radius: 8px;
      }

      /* Quote Content Block */
      .qtm-quote-body {
        position: relative;
        margin-bottom: 16px;
      }
      .qtm-quote-mark {
        position: absolute;
        top: -14px;
        left: -4px;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 42px;
        color: #fde68a;
        line-height: 1;
        user-select: none;
        pointer-events: none;
        opacity: 0.85;
      }
      .qtm-quote-text {
        font-size: 14px;
        line-height: 1.65;
        color: #1e293b;
        margin: 0;
        padding-left: 20px;
        font-style: italic;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif;
      }

      /* Book Spine Strip */
      .qtm-book-meta {
        padding: 10px 12px;
        background: #f8fafc;
        border: 1px solid #f1f5f9;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }
      .qtm-book-icon {
        width: 32px;
        height: 38px;
        background: linear-gradient(135deg, #0054A6 0%, #0284c7 100%);
        border-radius: 6px;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
        box-shadow: 0 4px 8px rgba(0, 84, 166, 0.2);
      }
      .qtm-book-info {
        min-width: 0;
        flex: 1;
      }
      .qtm-book-title {
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .qtm-book-author {
        font-size: 11.5px;
        color: #64748b;
        margin: 2px 0 0 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 500;
      }

      /* Card Footer & Action Toolbar */
      .qtm-card-footer {
        padding-top: 12px;
        border-top: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .qtm-contributor {
        font-size: 11.5px;
        color: #94a3b8;
        max-width: 130px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .qtm-contributor strong {
        color: #334155;
        font-weight: 700;
      }
      .qtm-actions {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .qtm-btn-like {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 9px;
        border-radius: 9px;
        font-size: 12px;
        font-weight: 800;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #64748b;
        cursor: pointer;
        transition: all 0.16s ease;
      }
      .qtm-btn-like:hover {
        background: #fff1f2;
        border-color: #fecdd3;
        color: #e11d48;
      }
      .qtm-btn-like.liked {
        background: #fff1f2;
        border-color: #fecdd3;
        color: #e11d48;
      }
      .qtm-btn-icon {
        width: 32px;
        height: 32px;
        border-radius: 9px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.16s ease;
      }
      .qtm-btn-icon:hover {
        background: #f1f5f9;
        color: #0f172a;
        transform: translateY(-1px);
      }
      .qtm-btn-icon.story {
        background: #fef3c7;
        border-color: #fde68a;
        color: #b45309;
      }
      .qtm-btn-icon.story:hover {
        background: #fde68a;
      }

      /* Loading & Empty States */
      .qtm-loading, .qtm-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 20px;
        text-align: center;
        color: #64748b;
      }
      .qtm-spinner {
        width: 42px;
        height: 42px;
        border: 4px solid #fde68a;
        border-top-color: #f59e0b;
        border-radius: 50%;
        animation: qtm-spin 0.8s linear infinite;
        margin-bottom: 14px;
      }
      @keyframes qtm-spin {
        to { transform: rotate(360deg); }
      }

      /* Footer Bar */
      .qtm-footer {
        padding: 14px 28px;
        background: #ffffff;
        border-top: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12.5px;
        color: #64748b;
        flex-shrink: 0;
      }
      .qtm-footer-highlight {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .qtm-pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
      }
    `;
    document.head.appendChild(style);
  }

  createModalHtml() {
    const overlay = document.createElement('div');
    overlay.id = this.modalId;
    overlay.className = 'qtm-overlay';

    overlay.innerHTML = `
      <div class="qtm-card" id="quote-treasury-card">
        
        <!-- Header -->
        <div class="qtm-header">
          <div class="qtm-header-left">
            <div class="qtm-header-icon">📚</div>
            <div class="qtm-title-area">
              <div class="qtm-title-row">
                <h2 class="qtm-title">Kho Tàng Tri Thức</h2>
                <span id="treasury-total-badge" class="qtm-badge-total">
                  <span>📖</span> 0 Trích dẫn tinh hoa
                </span>
                <span class="qtm-badge-exp">
                  <span>✨</span> +2 EXP / lượt yêu thích
                </span>
              </div>
              <p class="qtm-subtitle">Tuyển tập những trích dẫn sâu sắc & bài học giá trị từ 8 đội và cộng đồng yêu sách Cáo Sách</p>
            </div>
          </div>
          <button id="close-treasury-btn" class="qtm-close-btn" title="Đóng (Esc)">✕</button>
        </div>

        <!-- Filter & Control Toolbar -->
        <div class="qtm-filters-bar">
          <!-- Search & Sort Row -->
          <div class="qtm-search-row">
            <div class="qtm-search-input-wrap">
              <span class="qtm-search-icon">🔍</span>
              <input 
                type="text" 
                id="treasury-search-input" 
                class="qtm-search-input" 
                placeholder="Tìm kiếm theo trích dẫn, tên sách, tác giả, hoặc người chia sẻ..." 
                autocomplete="off"
              />
              <button id="treasury-search-clear" class="qtm-search-clear" style="display:none;">✕</button>
            </div>
            <div class="qtm-sort-wrap">
              <span class="qtm-sort-label">Sắp xếp:</span>
              <select id="treasury-sort-select" class="qtm-sort-select">
                <option value="most_liked">🔥 Được Yêu Thích Nhất</option>
                <option value="newest">🕒 Trích Dẫn Mới Nhất</option>
                <option value="oldest">🌟 Trích Dẫn Ban Đầu</option>
                <option value="title_az">🔤 Tên Sách (A-Z)</option>
              </select>
            </div>
          </div>

          <!-- Team Filter Segmented Tabs -->
          <div class="qtm-pills-row" id="treasury-team-pills">
            <span class="qtm-pills-label">Lọc Theo Đội:</span>
            <button class="qtm-team-pill active" data-team="all">
              <span>🌟 Tất Cả</span>
              <span class="qtm-pill-count" id="pill-count-all">0</span>
            </button>
            ${Array.from({ length: 8 }, (_, i) => {
              const teamId = i + 1;
              const team = TEAMS_INFO[teamId];
              return `
                <button class="qtm-team-pill" data-team="${teamId}">
                  <span class="qtm-pill-dot" style="background:${team.color}"></span>
                  <span>Đội ${teamId}</span>
                  <span class="qtm-pill-count" id="pill-count-${teamId}">0</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Main Quotes Content Viewport -->
        <div class="qtm-content" id="treasury-quotes-container">
          <!-- Loading State -->
          <div id="treasury-loading" class="qtm-loading">
            <div class="qtm-spinner"></div>
            <p style="font-weight:700; font-size:15px; color:#1e293b; margin:0 0 4px 0;">Đang mở Kho Tàng Tri Thức...</p>
            <p style="font-size:13px; color:#64748b; margin:0;">Đang kết xuất dữ liệu trích dẫn từ Cơ sở dữ liệu Cáo Sách</p>
          </div>

          <!-- Quotes Grid -->
          <div id="treasury-grid" class="qtm-grid" style="display:none;"></div>

          <!-- Empty State -->
          <div id="treasury-empty" class="qtm-empty" style="display:none;">
            <div style="font-size:42px; margin-bottom:12px;">🔍</div>
            <h3 style="font-size:17px; font-weight:800; color:#0f172a; margin:0 0 6px 0;">Chưa tìm thấy trích dẫn phù hợp</h3>
            <p style="font-size:13.5px; color:#64748b; margin:0 0 18px 0; max-width:400px;">Thử thay đổi từ khóa tìm kiếm hoặc chọn Đội thi khác để khám phá các cuốn sách đã gieo.</p>
            <button id="treasury-reset-filters" class="qtm-btn-like" style="padding:10px 20px; font-size:13px;">
              <span>↺</span>
              <span>Đặt lại bộ lọc ban đầu</span>
            </button>
          </div>
        </div>

        <!-- Footer Stats Bar -->
        <div class="qtm-footer">
          <div class="qtm-footer-highlight">
            <span class="qtm-pulse-dot"></span>
            <span>Mỗi lượt thả tim tiếp thêm <strong>+2 EXP</strong> giúp Cây Tri Thức vươn cành xanh mướt</span>
          </div>
          <div style="display:flex; align-items:center; gap:16px;">
            <span style="color:#94a3b8; font-weight:600;">Cáo Sách Tri Thức 2026</span>
            <button id="footer-close-btn" style="background:none; border:none; color:#d97706; font-weight:800; cursor:pointer; font-size:13px;">✕ Đóng</button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);
  }

  bindEvents() {
    const overlay = document.getElementById(this.modalId);
    if (!overlay) return;

    const closeBtn = overlay.querySelector('#close-treasury-btn');
    const footerCloseBtn = overlay.querySelector('#footer-close-btn');
    const searchInput = overlay.querySelector('#treasury-search-input');
    const searchClear = overlay.querySelector('#treasury-search-clear');
    const sortSelect = overlay.querySelector('#treasury-sort-select');
    const resetFiltersBtn = overlay.querySelector('#treasury-reset-filters');

    const closeModal = () => this.close();

    closeBtn?.addEventListener('click', closeModal);
    footerCloseBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        closeModal();
      }
    });

    // Search with instant client debounce
    let debounceTimer;
    searchInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (searchClear) searchClear.style.display = val.length > 0 ? 'flex' : 'none';
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = val;
        this.applyFilterAndRender();
      }, 200);
    });

    searchClear?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (searchClear) searchClear.style.display = 'none';
      this.searchQuery = '';
      this.applyFilterAndRender();
    });

    // Sort select
    sortSelect?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.applyFilterAndRender();
    });

    // Team Filter Tabs
    overlay.querySelectorAll('.qtm-team-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.qtm-team-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTeam = btn.dataset.team;
        this.applyFilterAndRender();
      });
    });

    resetFiltersBtn?.addEventListener('click', () => {
      this.resetFilters();
    });

    // Grid action delegation
    const grid = overlay.querySelector('#treasury-grid');
    grid?.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const quoteId = target.dataset.quoteId;
      const quote = this.allQuotes.find(q => String(q.id) === String(quoteId));

      if (action === 'like') {
        await this.handleLikeQuote(target, quote);
      } else if (action === 'copy') {
        this.handleCopyQuote(target, quote);
      } else if (action === 'export-story') {
        this.handleExportStory(quote);
      } else if (action === 'inspect-team') {
        const teamId = target.dataset.teamId;
        if (teamId && teamId !== 'null' && teamId !== 'undefined') {
          this.close();
          if (typeof this.onInspectTeam === 'function') {
            this.onInspectTeam(teamId);
          }
        }
      }
    });
  }

  resetFilters() {
    this.selectedTeam = 'all';
    this.searchQuery = '';
    this.sortBy = 'most_liked';

    const overlay = document.getElementById(this.modalId);
    if (!overlay) return;

    const searchInput = overlay.querySelector('#treasury-search-input');
    const searchClear = overlay.querySelector('#treasury-search-clear');
    const sortSelect = overlay.querySelector('#treasury-sort-select');

    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    if (sortSelect) sortSelect.value = 'most_liked';

    overlay.querySelectorAll('.qtm-team-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.team === 'all');
    });

    this.applyFilterAndRender();
  }

  open(initialTeamId = null) {
    const overlay = document.getElementById(this.modalId);
    if (!overlay) return;

    this.isOpen = true;

    if (initialTeamId) {
      this.selectedTeam = String(initialTeamId);
      overlay.querySelectorAll('.qtm-team-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.team === String(initialTeamId));
      });
    }

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    this.fetchMasterQuotes();
  }

  close() {
    const overlay = document.getElementById(this.modalId);
    if (!overlay) return;

    this.isOpen = false;
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 250);
  }

  async fetchMasterQuotes() {
    if (this.isLoading) return;
    this.isLoading = true;

    const overlay = document.getElementById(this.modalId);
    if (!overlay) return;

    const loading = overlay.querySelector('#treasury-loading');
    const grid = overlay.querySelector('#treasury-grid');
    const empty = overlay.querySelector('#treasury-empty');

    if (loading) loading.style.display = 'flex';
    if (grid) grid.style.display = 'none';
    if (empty) empty.style.display = 'none';

    try {
      const res = await fetch(`${getApiBase()}/quotes?page=1&limit=200&_t=${Date.now()}`);
      const json = await res.json();
      
      let quotesList = [];
      if (json.success && json.data && Array.isArray(json.data.quotes)) {
        quotesList = json.data.quotes;
      } else if (json.data && Array.isArray(json.data)) {
        quotesList = json.data;
      }

      this.allQuotes = quotesList;
      this.updateTeamCounts();
      this.applyFilterAndRender();

      if (loading) loading.style.display = 'none';
    } catch (err) {
      console.error('[QuoteTreasuryModal] Error fetching master quotes:', err);
      if (loading) loading.style.display = 'none';
      if (empty) empty.style.display = 'flex';
    } finally {
      this.isLoading = false;
    }
  }

  updateTeamCounts() {
    const counts = { all: this.allQuotes.length, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
    for (const q of this.allQuotes) {
      const tId = q.team_id ? parseInt(q.team_id, 10) : null;
      if (tId && counts[tId] !== undefined) {
        counts[tId] += 1;
      }
    }
    this.teamCounts = counts;

    const overlay = document.getElementById(this.modalId);
    if (!overlay) return;

    const pillAll = overlay.querySelector('#pill-count-all');
    if (pillAll) pillAll.textContent = counts.all;

    for (let i = 1; i <= 8; i++) {
      const pill = overlay.querySelector(`#pill-count-${i}`);
      if (pill) pill.textContent = counts[i];
    }
  }

  applyFilterAndRender() {
    const overlay = document.getElementById(this.modalId);
    if (!overlay) return;

    const grid = overlay.querySelector('#treasury-grid');
    const empty = overlay.querySelector('#treasury-empty');
    const badge = overlay.querySelector('#treasury-total-badge');

    let filtered = [...this.allQuotes];

    // Filter by Team
    if (this.selectedTeam !== 'all') {
      const targetTeamId = parseInt(this.selectedTeam, 10);
      filtered = filtered.filter(q => parseInt(q.team_id, 10) === targetTeamId);
    }

    // Filter by Search Query
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const title = (item.title || '').toLowerCase();
        const author = (item.author || '').toLowerCase();
        const quote = (item.quote || '').toLowerCase();
        const reader = (item.reader_name || '').toLowerCase();
        return title.includes(q) || author.includes(q) || quote.includes(q) || reader.includes(q);
      });
    }

    // Sort
    if (this.sortBy === 'most_liked') {
      filtered.sort((a, b) => (parseInt(b.likes_count, 10) || 0) - (parseInt(a.likes_count, 10) || 0));
    } else if (this.sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (this.sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (this.sortBy === 'title_az') {
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'vi'));
    }

    this.displayedQuotes = filtered;

    if (badge) {
      badge.innerHTML = `<span>📖</span> ${filtered.length} Trích dẫn tinh hoa`;
    }

    if (filtered.length === 0) {
      if (grid) grid.style.display = 'none';
      if (empty) empty.style.display = 'flex';
    } else {
      if (empty) empty.style.display = 'none';
      if (grid) {
        grid.style.display = 'grid';
        grid.innerHTML = filtered.map(quote => this.buildQuoteCardHtml(quote)).join('');
      }
    }
  }

  buildQuoteCardHtml(quote) {
    const rawTeamId = quote.team_id;
    const teamId = rawTeamId ? parseInt(rawTeamId, 10) : null;
    const teamInfo = (teamId && TEAMS_INFO[teamId]) 
      ? TEAMS_INFO[teamId] 
      : { name: quote.team_name || 'Cộng Đồng Độc Giả', color: '#0054A6', lightBg: '#eff6ff', border: '#bfdbfe' };

    const likesCount = parseInt(quote.likes_count, 10) || 0;
    const store = window.MockDataStore || window.ApiDataStore;
    const isLiked = store?.isLikedByUser ? store.isLikedByUser(quote.id) : false;

    const bookTitle = quote.title || 'Sách Tri Thức';
    const authorName = quote.author || 'Khuyết danh';
    const readerName = quote.reader_name || 'Độc giả Cáo Sách';
    const quoteContent = quote.quote || '';

    const teamButtonHtml = teamId 
      ? `
        <button 
          class="qtm-team-tag" 
          data-action="inspect-team" 
          data-team-id="${teamId}"
          style="background:${teamInfo.lightBg}; color:${teamInfo.color}; border-color:${teamInfo.border};"
          title="Ghé thăm Cây Tri Thức của ${teamInfo.name}"
        >
          <span class="qtm-pill-dot" style="background:${teamInfo.color}; width:6px; height:6px;"></span>
          <span>${teamInfo.name}</span>
        </button>
      `
      : `
        <span class="qtm-team-tag" style="background:#f1f5f9; color:#475569; border-color:#e2e8f0; cursor:default;">
          <span>🌐</span>
          <span>${teamInfo.name}</span>
        </span>
      `;

    return `
      <div class="qtm-quote-card" data-quote-id="${quote.id}">
        <div>
          <div class="qtm-card-header">
            ${teamButtonHtml}
            <span class="qtm-seed-badge">
              <span>🌱</span>
              <span>Đã Gieo Mầm</span>
            </span>
          </div>

          <div class="qtm-quote-body">
            <span class="qtm-quote-mark">“</span>
            <p class="qtm-quote-text">${this.escapeHtml(quoteContent)}</p>
          </div>

          <div class="qtm-book-meta">
            <div class="qtm-book-icon" style="background: linear-gradient(135deg, ${teamInfo.color} 0%, #0284c7 100%);">
              📖
            </div>
            <div class="qtm-book-info">
              <h4 class="qtm-book-title" title="${this.escapeHtml(bookTitle)}">
                ${this.escapeHtml(bookTitle)}
              </h4>
              <p class="qtm-book-author" title="${this.escapeHtml(authorName)}">
                ✍️ ${this.escapeHtml(authorName)}
              </p>
            </div>
          </div>
        </div>

        <div class="qtm-card-footer">
          <div class="qtm-contributor" title="Gieo bởi: ${this.escapeHtml(readerName)}">
            Gieo bởi <strong>${this.escapeHtml(readerName)}</strong>
          </div>

          <div class="qtm-actions">
            <!-- Thả Tim (+2 EXP) -->
            <button 
              class="qtm-btn-like ${isLiked ? 'liked' : ''}" 
              data-action="like" 
              data-quote-id="${quote.id}" 
              title="Thả tim (+2 EXP cho Cây Tri Thức)"
            >
              <span>${isLiked ? '❤️' : '🤍'}</span>
              <span class="like-num">${likesCount}</span>
            </button>

            <!-- Sao Chép -->
            <button 
              class="qtm-btn-icon" 
              data-action="copy" 
              data-quote-id="${quote.id}" 
              title="Sao chép trích dẫn hay"
            >
              📋
            </button>

            <!-- Xuất Ảnh Story -->
            <button 
              class="qtm-btn-icon story" 
              data-action="export-story" 
              data-quote-id="${quote.id}" 
              title="Xuất ảnh Story đẹp để chia sẻ"
            >
              🎨
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async handleLikeQuote(btn, quote) {
    if (!quote) return;
    const store = window.MockDataStore || window.ApiDataStore;
    const numSpan = btn.querySelector('.like-num');
    const heartSpan = btn.querySelector('span:first-child');
    let currentCount = parseInt(numSpan?.textContent || '0', 10);

    const isLiked = store?.isLikedByUser ? store.isLikedByUser(quote.id) : btn.classList.contains('liked');

    if (isLiked) {
      currentCount = Math.max(0, currentCount - 1);
      btn.classList.remove('liked');
      if (heartSpan) heartSpan.textContent = '🤍';
      if (numSpan) numSpan.textContent = currentCount;
      quote.likes_count = currentCount;
      if (store?.unlikeQuote) await store.unlikeQuote(quote.id);
    } else {
      currentCount += 1;
      btn.classList.add('liked');
      if (heartSpan) heartSpan.textContent = '❤️';
      if (numSpan) numSpan.textContent = currentCount;
      quote.likes_count = currentCount;
      this.showToast('❤️ Đã thả tim trích dẫn (+2 EXP cho Cây Tri Thức)!');
      if (store?.likeQuote) await store.likeQuote(quote.id);
    }
  }

  handleCopyQuote(btn, quote) {
    if (!quote) return;
    const bookTitle = quote.title || 'Sách Tri Thức';
    const authorName = quote.author || 'Khuyết danh';
    const readerName = quote.reader_name || 'Độc giả Cáo Sách';
    const quoteContent = quote.quote || '';

    const text = `“${quoteContent}”\n— Trích từ sách "${bookTitle}" (Tác giả: ${authorName}) • Gieo bởi ${readerName} ✨ Cáo Sách 2026`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('📋 Đã sao chép trích dẫn vào bộ nhớ tạm!');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }

  fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      this.showToast('📋 Đã sao chép trích dẫn vào bộ nhớ tạm!');
    } catch (e) {
      this.showToast('Không thể sao chép tự động.');
    }
    document.body.removeChild(textArea);
  }

  handleExportStory(quote) {
    if (!quote) return;
    const bookTitle = quote.title || 'Sách Tri Thức';
    const authorName = quote.author || 'Khuyết danh';
    const readerName = quote.reader_name || 'Độc giả Cáo Sách';
    const quoteContent = quote.quote || '';
    const likesCount = parseInt(quote.likes_count, 10) || 0;

    const exporter = window.QuoteCardExporter;
    if (exporter && typeof exporter.exportQuoteImage === 'function') {
      this.showToast('🎨 Đang kết xuất ảnh Story độ nét cao...');
      exporter.exportQuoteImage({
        book: bookTitle,
        author: authorName,
        quote: quoteContent,
        reader: readerName,
        likes: likesCount,
        format: 'story'
      });
    } else {
      import('../services/QuoteCardExporter.js?v=20260906_v14').then(module => {
        if (module.QuoteCardExporter && typeof module.QuoteCardExporter.exportQuoteImage === 'function') {
          this.showToast('🎨 Đang kết xuất ảnh Story độ nét cao...');
          module.QuoteCardExporter.exportQuoteImage({
            book: bookTitle,
            author: authorName,
            quote: quoteContent,
            reader: readerName,
            likes: likesCount,
            format: 'story'
          });
        }
      }).catch(err => {
        console.error('Error exporting quote story:', err);
      });
    }
  }

  showToast(message) {
    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }
    const existing = document.getElementById('treasury-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'treasury-toast';
    toast.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:2147483647; background:#0f172a; color:#ffffff; font-size:13px; font-weight:700; padding:12px 20px; border-radius:14px; box-shadow:0 12px 32px rgba(0,0,0,0.4); border:1px solid #334155; display:flex; align-items:center; gap:8px;';
    toast.innerHTML = `<span>✨</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
