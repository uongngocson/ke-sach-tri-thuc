/**
 * QuoteTreasuryModal.js
 * Modal Kho Tàng Tri Thức - Thư viện trích dẫn số toàn diện từ 8 Đội Thi & Độc Giả
 * Giao diện Clean White Full-Screen hiện đại, Responsive chuẩn Production, Lọc trực tiếp từ CSDL
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
  1: { id: 1, name: 'Đội 1', color: '#0054A6' },
  2: { id: 2, name: 'Đội 2', color: '#0284c7' },
  3: { id: 3, name: 'Đội 3', color: '#059669' },
  4: { id: 4, name: 'Đội 4', color: '#16a34a' },
  5: { id: 5, name: 'Đội 5', color: '#ea580c' },
  6: { id: 6, name: 'Đội 6', color: '#d97706' },
  7: { id: 7, name: 'Đội 7', color: '#9333ea' },
  8: { id: 8, name: 'Đội 8', color: '#e11d48' }
};

export class QuoteTreasuryModal {
  constructor(options = {}) {
    this.modalId = 'quote-treasury-modal-overlay';
    this.onInspectTeam = options.onInspectTeam || null;
    this.quotes = [];
    this.totalQuotes = 0;
    this.page = 1;
    this.limit = 24;
    this.hasMore = false;
    this.isLoading = false;
    this.isOpen = false;

    // Filter states
    this.selectedTeam = 'all';
    this.searchQuery = '';
    this.sortBy = 'most_liked'; // 'most_liked' | 'newest' | 'oldest'

    this.initDOM();
  }

  initDOM() {
    if (document.getElementById(this.modalId)) return;
    this.injectStyles();
    this.createModalHtml();
    this.bindEvents();
  }

  injectStyles() {
    if (document.getElementById('quote-treasury-styles')) return;

    const style = document.createElement('style');
    style.id = 'quote-treasury-styles';
    style.textContent = `
      .qtm-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483641 !important;
        background: rgba(15, 23, 42, 0.72);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
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
      
      /* Full-width and full-height expansive modal card */
      .qtm-card {
        position: relative;
        width: 98vw;
        max-width: 1560px;
        height: 95vh;
        max-height: 95vh;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 26px;
        box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.8);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: scale(0.97) translateY(10px);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        color: #0f172a;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      .qtm-overlay.active .qtm-card {
        transform: scale(1) translateY(0);
      }

      /* Clean White Header */
      .qtm-header {
        padding: 16px 28px;
        background: #ffffff;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
        z-index: 10;
      }
      .qtm-header-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .qtm-header-icon {
        width: 48px;
        height: 48px;
        border-radius: 16px;
        background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        box-shadow: 0 10px 20px rgba(245, 158, 11, 0.25);
        flex-shrink: 0;
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
        font-size: 13.5px;
        color: #64748b;
        margin: 4px 0 0 0;
        font-weight: 500;
      }
      .qtm-close-btn {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #475569;
        font-size: 18px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.18s ease;
      }
      .qtm-close-btn:hover {
        background: #fee2e2;
        border-color: #fca5a5;
        color: #dc2626;
        transform: rotate(90deg);
      }

      /* Control & Filter Center */
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
        gap: 12px;
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
        font-size: 15px;
        color: #94a3b8;
        pointer-events: none;
      }
      .qtm-search-input {
        width: 100%;
        height: 42px;
        padding: 0 38px 0 42px;
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        border-radius: 14px;
        font-size: 13.5px;
        font-weight: 500;
        color: #0f172a;
        outline: none;
        box-sizing: border-box;
        transition: all 0.2s;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      }
      .qtm-search-input::placeholder {
        color: #94a3b8;
      }
      .qtm-search-input:focus {
        border-color: #f59e0b;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
        background: #ffffff;
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
        gap: 10px;
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
        padding: 0 14px;
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        border-radius: 14px;
        font-size: 13px;
        font-weight: 700;
        color: #1e293b;
        outline: none;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        transition: border-color 0.2s;
      }
      .qtm-sort-select:focus {
        border-color: #f59e0b;
      }

      /* Filter Pill Rows */
      .qtm-pills-row {
        display: flex;
        align-items: center;
        gap: 8px;
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
        padding: 7px 14px;
        border-radius: 12px;
        font-size: 12.5px;
        font-weight: 700;
        background: #ffffff;
        border: 1.5px solid #e2e8f0;
        color: #475569;
        white-space: nowrap;
        cursor: pointer;
        transition: all 0.18s ease;
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
        background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
        border-color: transparent;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
      }

      /* Main Content Grid */
      .qtm-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px 28px;
        background: #f8fafc;
      }
      .qtm-content::-webkit-scrollbar {
        width: 7px;
      }
      .qtm-content::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 6px;
      }

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
      @media (min-width: 1100px) {
        .qtm-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (min-width: 1500px) {
        .qtm-grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      /* Quote Card Architecture */
      .qtm-quote-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        position: relative;
      }
      .qtm-quote-card:hover {
        border-color: #f59e0b;
        box-shadow: 0 14px 30px -8px rgba(245, 158, 11, 0.18), 0 2px 6px rgba(0, 0, 0, 0.04);
        transform: translateY(-3px);
      }
      .qtm-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
        gap: 8px;
      }
      .qtm-team-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 800;
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fde68a;
        cursor: pointer;
        transition: all 0.15s;
        text-decoration: none;
      }
      .qtm-team-tag:hover {
        background: #fde68a;
        transform: scale(1.02);
      }
      .qtm-seed-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11.5px;
        font-weight: 700;
        color: #059669;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        padding: 3px 8px;
        border-radius: 8px;
      }
      .qtm-quote-body {
        position: relative;
        margin-bottom: 16px;
      }
      .qtm-quote-quote-icon {
        position: absolute;
        top: -12px;
        left: -6px;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 38px;
        color: #fde68a;
        line-height: 1;
        user-select: none;
        pointer-events: none;
        opacity: 0.9;
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
        font-family: Georgia, -apple-system, sans-serif;
      }
      .qtm-book-meta {
        padding-top: 12px;
        border-top: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .qtm-book-icon {
        width: 34px;
        height: 42px;
        background: linear-gradient(135deg, #0054A6 0%, #0284c7 100%);
        border-radius: 6px;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        flex-shrink: 0;
        box-shadow: 0 4px 10px rgba(0, 84, 166, 0.22);
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
        margin: 3px 0 0 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 500;
      }
      .qtm-card-footer {
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .qtm-contributor {
        font-size: 11.5px;
        color: #94a3b8;
        max-width: 125px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .qtm-contributor strong {
        color: #475569;
        font-weight: 700;
      }
      .qtm-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .qtm-btn-like {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 800;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #64748b;
        cursor: pointer;
        transition: all 0.18s;
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
        border-radius: 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.18s;
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

      /* States: Loading & Empty */
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
        width: 44px;
        height: 44px;
        border: 4px solid #fde68a;
        border-top-color: #f59e0b;
        border-radius: 50%;
        animation: qtm-spin 0.8s linear infinite;
        margin-bottom: 16px;
      }
      @keyframes qtm-spin {
        to { transform: rotate(360deg); }
      }
      .qtm-load-more-wrap {
        text-align: center;
        margin: 32px 0 16px 0;
      }
      .qtm-load-more-btn {
        padding: 12px 28px;
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        border-radius: 16px;
        font-size: 13.5px;
        font-weight: 800;
        color: #1e293b;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .qtm-load-more-btn:hover {
        background: #fffbeb;
        border-color: #f59e0b;
        color: #b45309;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(245, 158, 11, 0.2);
      }

      /* Footer */
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
            <div>
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

        <!-- Filter & Control Center -->
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
              </select>
            </div>
          </div>

          <!-- Team Filter Pills -->
          <div class="qtm-pills-row">
            <span class="qtm-pills-label">Lọc Theo Đội:</span>
            <button class="qtm-team-pill active" data-team="all">
              <span>🌟</span> Tất Cả (8 Đội)
            </button>
            ${Array.from({ length: 8 }, (_, i) => {
              const teamId = i + 1;
              return `
                <button class="qtm-team-pill" data-team="${teamId}">
                  <span>🌱</span> Đội ${teamId}
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
            <p style="font-size:13px; color:#64748b; margin:0;">Đang kết xuất dữ liệu trích dẫn & xếp hạng yêu thích</p>
          </div>

          <!-- Quotes Grid -->
          <div id="treasury-grid" class="qtm-grid" style="display:none;"></div>

          <!-- Empty State -->
          <div id="treasury-empty" class="qtm-empty" style="display:none;">
            <div style="font-size:42px; margin-bottom:12px;">🔍</div>
            <h3 style="font-size:17px; font-weight:800; color:#0f172a; margin:0 0 6px 0;">Chưa tìm thấy trích dẫn phù hợp</h3>
            <p style="font-size:13.5px; color:#64748b; margin:0 0 18px 0; max-width:400px;">Thử thay đổi từ khóa tìm kiếm hoặc chọn Đội thi khác để khám phá các cuốn sách đã gieo.</p>
            <button id="treasury-reset-filters" class="qtm-load-more-btn" style="padding:10px 20px;">
              <span>↺</span>
              <span>Đặt lại bộ lọc ban đầu</span>
            </button>
          </div>

          <!-- Load More Button -->
          <div id="treasury-load-more-wrap" class="qtm-load-more-wrap" style="display:none;">
            <button id="treasury-load-more-btn" class="qtm-load-more-btn">
              <span>Khám phá thêm trích dẫn</span>
              <span style="font-size:16px;">↓</span>
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
    const loadMoreBtn = overlay.querySelector('#treasury-load-more-btn');

    const closeModal = () => this.close();

    closeBtn?.addEventListener('click', closeModal);
    footerCloseBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        closeModal();
      }
    });

    // Search input with debounce
    let debounceTimer;
    searchInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (searchClear) searchClear.style.display = val.length > 0 ? 'flex' : 'none';
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = val;
        this.page = 1;
        this.fetchQuotes();
      }, 300);
    });

    searchClear?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (searchClear) searchClear.style.display = 'none';
      this.searchQuery = '';
      this.page = 1;
      this.fetchQuotes();
    });

    // Sort select
    sortSelect?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.page = 1;
      this.fetchQuotes();
    });

    // Team Filter Pills
    overlay.querySelectorAll('.qtm-team-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.qtm-team-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTeam = btn.dataset.team;
        this.page = 1;
        this.fetchQuotes();
      });
    });

    // Reset filters
    resetFiltersBtn?.addEventListener('click', () => {
      this.resetFilters();
    });

    // Load more
    loadMoreBtn?.addEventListener('click', () => {
      if (this.hasMore && !this.isLoading) {
        this.page += 1;
        this.fetchQuotes(true);
      }
    });

    // Action Delegation (Like, Copy, Export, Inspect Team)
    const grid = overlay.querySelector('#treasury-grid');
    grid?.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const quoteId = target.dataset.quoteId;
      const quote = this.quotes.find(q => String(q.id) === String(quoteId));

      if (action === 'like') {
        await this.handleLikeQuote(target, quote);
      } else if (action === 'copy') {
        this.handleCopyQuote(target, quote);
      } else if (action === 'export-story') {
        this.handleExportStory(quote);
      } else if (action === 'inspect-team') {
        const teamId = target.dataset.teamId;
        this.close();
        if (typeof this.onInspectTeam === 'function') {
          this.onInspectTeam(teamId);
        }
      }
    });
  }

  resetFilters() {
    this.selectedTeam = 'all';
    this.searchQuery = '';
    this.sortBy = 'most_liked';
    this.page = 1;

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

    this.fetchQuotes();
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

    this.page = 1;
    this.fetchQuotes();
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

  async fetchQuotes(append = false) {
    if (this.isLoading) return;
    this.isLoading = true;

    const overlay = document.getElementById(this.modalId);
    if (!overlay) return;

    const loading = overlay.querySelector('#treasury-loading');
    const grid = overlay.querySelector('#treasury-grid');
    const empty = overlay.querySelector('#treasury-empty');
    const loadMoreWrap = overlay.querySelector('#treasury-load-more-wrap');
    const badge = overlay.querySelector('#treasury-total-badge');

    if (!append) {
      if (loading) loading.style.display = 'flex';
      if (grid) grid.style.display = 'none';
      if (empty) empty.style.display = 'none';
      if (loadMoreWrap) loadMoreWrap.style.display = 'none';
    }

    try {
      const options = {
        page: this.page,
        limit: this.limit,
        search: this.searchQuery,
        sortBy: this.sortBy,
        teamId: this.selectedTeam
      };

      let result = null;
      const dataStore = window.MockDataStore || window.ApiDataStore;
      if (dataStore && typeof dataStore.getPublicQuotes === 'function') {
        result = await dataStore.getPublicQuotes(options);
      } else {
        const queryParams = new URLSearchParams({
          page: options.page,
          limit: options.limit,
          search: options.search || '',
          sortBy: options.sortBy || 'most_liked',
          teamId: options.teamId || 'all'
        });
        const res = await fetch(`${getApiBase()}/quotes?${queryParams.toString()}`);
        const json = await res.json();
        if (json.success && json.data) {
          result = json.data;
        }
      }

      const newQuotes = (result && result.quotes) ? result.quotes : [];
      this.totalQuotes = (result && typeof result.total === 'number') ? result.total : newQuotes.length;
      this.hasMore = result ? !!result.hasMore : false;

      if (badge) {
        badge.innerHTML = `<span>📖</span> ${this.totalQuotes} Trích dẫn tinh hoa`;
      }

      if (append) {
        this.quotes = [...this.quotes, ...newQuotes];
        this.renderQuotes(newQuotes, true);
      } else {
        this.quotes = newQuotes;
        this.renderQuotes(this.quotes, false);
      }

      if (loading) loading.style.display = 'none';

      if (this.quotes.length === 0) {
        if (grid) grid.style.display = 'none';
        if (empty) empty.style.display = 'flex';
        if (loadMoreWrap) loadMoreWrap.style.display = 'none';
      } else {
        if (grid) grid.style.display = 'grid';
        if (empty) empty.style.display = 'none';
        if (loadMoreWrap) loadMoreWrap.style.display = this.hasMore ? 'block' : 'none';
      }
    } catch (err) {
      console.error('[QuoteTreasuryModal] Error fetching quotes:', err);
      if (loading) loading.style.display = 'none';
      if (this.quotes.length === 0 && empty) {
        empty.style.display = 'flex';
      }
    } finally {
      this.isLoading = false;
    }
  }

  renderQuotes(quotes, append = false) {
    const overlay = document.getElementById(this.modalId);
    const grid = overlay?.querySelector('#treasury-grid');
    if (!grid) return;

    const cardsHtml = quotes.map(quote => this.buildQuoteCardHtml(quote)).join('');

    if (append) {
      grid.insertAdjacentHTML('beforeend', cardsHtml);
    } else {
      grid.innerHTML = cardsHtml;
    }
  }

  buildQuoteCardHtml(quote) {
    const teamId = quote.teamId || quote.team_id || 1;
    const teamInfo = TEAMS_INFO[teamId] || { name: `Đội ${teamId}` };
    const likesCount = quote.likesCount || quote.likes || 0;
    const isLiked = (window.MockDataStore && window.MockDataStore.isQuoteLiked) 
      ? window.MockDataStore.isQuoteLiked(quote.id) 
      : false;

    return `
      <div class="qtm-quote-card" data-quote-id="${quote.id}">
        <div>
          <div class="qtm-card-top">
            <button 
              class="qtm-team-tag" 
              data-action="inspect-team" 
              data-team-id="${teamId}"
              title="Ghé thăm Cây Tri Thức của ${teamInfo.name}"
            >
              <span>🌱</span>
              <span>${teamInfo.name}</span>
            </button>
            <span class="qtm-seed-badge">
              <span>🌰</span>
              <span>Đã Gieo Mầm</span>
            </span>
          </div>

          <div class="qtm-quote-body">
            <span class="qtm-quote-quote-icon">“</span>
            <p class="qtm-quote-text">${this.escapeHtml(quote.quote)}</p>
          </div>

          <div class="qtm-book-meta">
            <div class="qtm-book-icon">📖</div>
            <div class="qtm-book-info">
              <h4 class="qtm-book-title" title="${this.escapeHtml(quote.bookTitle || '')}">
                ${this.escapeHtml(quote.bookTitle || 'Sách Tinh Hoa')}
              </h4>
              <p class="qtm-book-author" title="${this.escapeHtml(quote.author || '')}">
                ✍️ ${this.escapeHtml(quote.author || 'Khuyết danh')}
              </p>
            </div>
          </div>
        </div>

        <div class="qtm-card-footer">
          <div class="qtm-contributor" title="Gieo bởi: ${this.escapeHtml(quote.contributor || 'Thành viên')}">
            Gieo bởi <strong>${this.escapeHtml(quote.contributor || 'Thành viên')}</strong>
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
    const isCurrentlyLiked = store?.isQuoteLiked ? store.isQuoteLiked(quote.id) : false;
    const numSpan = btn.querySelector('.like-num');
    const heartSpan = btn.querySelector('span:first-child');
    let currentCount = parseInt(numSpan?.textContent || '0', 10);

    if (isCurrentlyLiked) {
      currentCount = Math.max(0, currentCount - 1);
      btn.classList.remove('liked');
      if (heartSpan) heartSpan.textContent = '🤍';
      if (numSpan) numSpan.textContent = currentCount;
      quote.likesCount = currentCount;
      if (store?.unlikeQuote) await store.unlikeQuote(quote.id);
    } else {
      currentCount += 1;
      btn.classList.add('liked');
      if (heartSpan) heartSpan.textContent = '❤️';
      if (numSpan) numSpan.textContent = currentCount;
      quote.likesCount = currentCount;
      this.showToast('❤️ Đã thả tim trích dẫn (+2 EXP cho Cây Tri Thức)!');
      if (store?.likeQuote) await store.likeQuote(quote.id);
    }
  }

  handleCopyQuote(btn, quote) {
    if (!quote) return;
    const text = `“${quote.quote}”\n— Trích từ sách "${quote.bookTitle}" (Tác giả: ${quote.author || 'Khuyết danh'}) • Gieo bởi ${quote.contributor || 'Độc giả Cáo Sách'}`;
    
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
    const exporter = window.QuoteCardExporter;
    if (exporter && typeof exporter.exportQuoteImage === 'function') {
      this.showToast('🎨 Đang kết xuất ảnh Story độ nét cao...');
      exporter.exportQuoteImage({
        book: quote.bookTitle || quote.book,
        author: quote.author,
        quote: quote.quote,
        reader: quote.contributor || quote.reader,
        likes: quote.likesCount || quote.likes || 120,
        format: 'story'
      });
    } else {
      import('../services/QuoteCardExporter.js?v=20260906_v7').then(module => {
        if (module.QuoteCardExporter && typeof module.QuoteCardExporter.exportQuoteImage === 'function') {
          this.showToast('🎨 Đang kết xuất ảnh Story độ nét cao...');
          module.QuoteCardExporter.exportQuoteImage({
            book: quote.bookTitle || quote.book,
            author: quote.author,
            quote: quote.quote,
            reader: quote.contributor || quote.reader,
            likes: quote.likesCount || quote.likes || 120,
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
