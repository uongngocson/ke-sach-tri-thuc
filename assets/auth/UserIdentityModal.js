/**
 * assets/auth/UserIdentityModal.js
 * User Identification & Team Onboarding Modal
 * Features:
 * - Smart real-time autocomplete for 288 BGD/TDV/CLB members by Email / Employee Code / Name
 * - Auto-assigns user to their exact team in PostgreSQL
 * - Stores session in localStorage
 * - Guest mode support
 * - Account switcher trigger
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

export class UserIdentityModal {
  constructor(options = {}) {
    this.onUserIdentified = options.onUserIdentified || (() => {});
    this.isOpen = false;
    this.debounceTimer = null;
    this.initDOM();
  }

  static getStoredSession() {
    try {
      const data = localStorage.getItem('caosach_user_session');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static saveSession(user) {
    try {
      localStorage.setItem('caosach_user_session', JSON.stringify(user));
      if (user.team_id) {
        localStorage.setItem('caosach_current_team_id', user.team_id.toString());
      }
    } catch (e) {
      console.warn('Cannot save session to localStorage', e);
    }
  }

  static clearSession() {
    localStorage.removeItem('caosach_user_session');
    localStorage.removeItem('caosach_current_team_id');
  }

  initDOM() {
    // Check if modal container already exists
    if (document.getElementById('user-identity-modal-overlay')) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'user-identity-modal-overlay';
    overlay.className = 'ui-identity-overlay';
    overlay.style.display = 'none';

    overlay.innerHTML = `
      <div class="ui-identity-card" id="user-identity-card">
        <div class="ui-identity-glow-1"></div>
        <div class="ui-identity-glow-2"></div>

        <!-- Header -->
        <div class="ui-identity-header">
          <div class="ui-identity-badge">
            <span>🦊</span>
            <span>CÁO ĐỌC 30 • FOXREAD 2026</span>
          </div>
          <button class="ui-identity-close" id="ui-identity-close-btn" title="Đóng (Esc)">✕</button>
        </div>

        <div class="ui-identity-title-block">
          <h2 class="ui-identity-title">Chào Mừng Đến Vườn Cây Tri Thức</h2>
          <p class="ui-identity-subtitle">
            Nhập <strong>Email FPT</strong> hoặc <strong>Mã Nhân Viên</strong> để nhận diện Đội và cùng đồng đội chăm sóc Cây Tri Thức của bạn.
          </p>
        </div>

        <!-- Input & Autocomplete Form -->
        <div class="ui-identity-form-group">
          <label class="ui-identity-label">
            <span>👤</span>
            <span>Email FPT hoặc Mã Nhân Viên:</span>
          </label>
          <div class="ui-identity-input-wrapper">
            <input 
              type="text" 
              id="ui-identity-input" 
              class="ui-identity-input" 
              placeholder="Ví dụ: thuhuong@fpt.com hoặc 00000295..."
              autocomplete="off"
            />
            <button class="ui-identity-clear-btn" id="ui-identity-clear-btn" style="display:none;">✕</button>
          </div>

          <!-- Real-time Suggestions Dropdown -->
          <div class="ui-identity-suggestions" id="ui-identity-suggestions" style="display:none;">
            <!-- Rendered by JS -->
          </div>
        </div>

        <!-- User Selected Preview Box -->
        <div class="ui-identity-preview" id="ui-identity-preview" style="display:none;">
          <div class="ui-identity-preview-inner">
            <div class="ui-identity-preview-avatar" id="ui-preview-avatar">🦊</div>
            <div class="ui-identity-preview-info">
              <h4 class="ui-preview-name" id="ui-preview-name">Nguyễn Thu Hương</h4>
              <p class="ui-preview-meta" id="ui-preview-meta">thuhuong@fpt.com • 00000295</p>
              <div class="ui-preview-team-tag" id="ui-preview-team">
                <span id="ui-preview-team-icon">⚡</span>
                <span id="ui-preview-team-name">Đội 1</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Feedback message -->
        <div class="ui-identity-feedback" id="ui-identity-feedback" style="display:none;"></div>

        <!-- Action Buttons -->
        <div class="ui-identity-actions">
          <button class="ui-identity-submit-btn" id="ui-identity-submit-btn" disabled>
            <span>🌱</span>
            <span>Vào Chăm Cây Của Đội</span>
          </button>
          <button class="ui-identity-guest-btn" id="ui-identity-guest-btn" type="button">
            <span>👀</span>
            <span>Khám Phá Với Tư Cách Khách</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.injectStyles();
    this.bindEvents(overlay);
  }

  injectStyles() {
    if (document.getElementById('user-identity-styles')) return;

    const style = document.createElement('style');
    style.id = 'user-identity-styles';
    style.textContent = `
      .ui-identity-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483640;
        background: rgba(4, 9, 24, 0.85);
        backdrop-filter: blur(16px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .ui-identity-overlay.active {
        opacity: 1;
        pointer-events: auto;
      }
      .ui-identity-card {
        position: relative;
        width: 100%;
        max-width: 480px;
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(0, 84, 166, 0.25);
        color: #f8fafc;
        transform: scale(0.92) translateY(10px);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: hidden;
      }
      .ui-identity-overlay.active .ui-identity-card {
        transform: scale(1) translateY(0);
      }
      .ui-identity-glow-1 {
        position: absolute;
        top: -80px;
        left: -80px;
        width: 200px;
        height: 200px;
        background: radial-gradient(circle, rgba(0, 84, 166, 0.35) 0%, transparent 70%);
        pointer-events: none;
      }
      .ui-identity-glow-2 {
        position: absolute;
        bottom: -80px;
        right: -80px;
        width: 220px;
        height: 220px;
        background: radial-gradient(circle, rgba(243, 111, 33, 0.25) 0%, transparent 70%);
        pointer-events: none;
      }
      .ui-identity-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      .ui-identity-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        background: rgba(0, 84, 166, 0.25);
        border: 1px solid rgba(0, 84, 166, 0.4);
        color: #60a5fa;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.5px;
      }
      .ui-identity-close {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #94a3b8;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 14px;
      }
      .ui-identity-close:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        transform: rotate(90deg);
      }
      .ui-identity-title-block {
        text-align: center;
        margin-bottom: 20px;
      }
      .ui-identity-title {
        font-size: 20px;
        font-weight: 900;
        color: #ffffff;
        margin: 0 0 6px 0;
        line-height: 1.3;
      }
      .ui-identity-subtitle {
        font-size: 13px;
        color: #94a3b8;
        margin: 0;
        line-height: 1.5;
      }
      .ui-identity-form-group {
        position: relative;
        margin-bottom: 16px;
      }
      .ui-identity-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        font-weight: 700;
        color: #cbd5e1;
        margin-bottom: 8px;
      }
      .ui-identity-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }
      .ui-identity-input {
        width: 100%;
        height: 48px;
        background: rgba(15, 23, 42, 0.8);
        border: 1.5px solid rgba(255, 255, 255, 0.18);
        border-radius: 14px;
        padding: 0 40px 0 16px;
        color: #ffffff;
        font-size: 14px;
        font-weight: 600;
        outline: none;
        transition: all 0.2s;
      }
      .ui-identity-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
        background: rgba(15, 23, 42, 0.95);
      }
      .ui-identity-clear-btn {
        position: absolute;
        right: 12px;
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 14px;
        cursor: pointer;
        padding: 4px;
      }
      .ui-identity-suggestions {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        background: rgba(15, 23, 42, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 16px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
        max-height: 240px;
        overflow-y: auto;
        z-index: 100;
        padding: 6px;
      }
      .ui-suggestion-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.15s;
        gap: 8px;
      }
      .ui-suggestion-item:hover {
        background: rgba(59, 130, 246, 0.2);
      }
      .ui-suggestion-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .ui-suggestion-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0054A6, #F36F21);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 800;
        color: #fff;
        flex-shrink: 0;
      }
      .ui-suggestion-details {
        min-width: 0;
      }
      .ui-suggestion-name {
        font-size: 13px;
        font-weight: 700;
        color: #ffffff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ui-suggestion-meta {
        font-size: 11px;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ui-suggestion-team-tag {
        font-size: 10.5px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        flex-shrink: 0;
      }
      .ui-identity-preview {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        padding: 14px;
        margin-bottom: 16px;
      }
      .ui-identity-preview-inner {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .ui-identity-preview-avatar {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: linear-gradient(135deg, #0054A6, #70B928);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      }
      .ui-preview-name {
        font-size: 15px;
        font-weight: 800;
        color: #ffffff;
        margin: 0 0 2px 0;
      }
      .ui-preview-meta {
        font-size: 11.5px;
        color: #94a3b8;
        margin: 0 0 6px 0;
      }
      .ui-preview-team-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        border-radius: 8px;
        background: rgba(112, 185, 40, 0.2);
        border: 1px solid rgba(112, 185, 40, 0.4);
        color: #86efac;
        font-size: 11px;
        font-weight: 800;
      }
      .ui-identity-feedback {
        padding: 8px 12px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 14px;
        text-align: center;
      }
      .ui-identity-feedback.error {
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }
      .ui-identity-feedback.success {
        background: rgba(34, 197, 94, 0.2);
        border: 1px solid rgba(34, 197, 94, 0.4);
        color: #86efac;
      }
      .ui-identity-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ui-identity-submit-btn {
        width: 100%;
        height: 48px;
        border-radius: 14px;
        background: linear-gradient(135deg, #0054A6 0%, #0284c7 100%);
        border: none;
        color: #ffffff;
        font-size: 14px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 15px rgba(0, 84, 166, 0.35);
      }
      .ui-identity-submit-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(0, 84, 166, 0.5);
      }
      .ui-identity-submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .ui-identity-guest-btn {
        width: 100%;
        height: 40px;
        border-radius: 12px;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #94a3b8;
        font-size: 12.5px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .ui-identity-guest-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
      }
    `;
    document.head.appendChild(style);
  }

  bindEvents(overlay) {
    const input = overlay.querySelector('#ui-identity-input');
    const clearBtn = overlay.querySelector('#ui-identity-clear-btn');
    const suggestionsBox = overlay.querySelector('#ui-identity-suggestions');
    const submitBtn = overlay.querySelector('#ui-identity-submit-btn');
    const guestBtn = overlay.querySelector('#ui-identity-guest-btn');
    const closeBtn = overlay.querySelector('#ui-identity-close-btn');
    const feedback = overlay.querySelector('#ui-identity-feedback');
    const previewBox = overlay.querySelector('#ui-identity-preview');

    let selectedUser = null;

    // Open/Close
    closeBtn.addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Clear input
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      suggestionsBox.style.display = 'none';
      previewBox.style.display = 'none';
      submitBtn.disabled = true;
      selectedUser = null;
      feedback.style.display = 'none';
      input.focus();
    });

    // Real-time Autocomplete Debounce
    input.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      clearBtn.style.display = val.length > 0 ? 'block' : 'none';
      feedback.style.display = 'none';

      if (val.length < 2) {
        suggestionsBox.style.display = 'none';
        previewBox.style.display = 'none';
        submitBtn.disabled = true;
        selectedUser = null;
        return;
      }

      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`${getApiBase()}/users/suggest?q=${encodeURIComponent(val)}&limit=6`);
          const json = await res.json();

          if (json.success && json.data && json.data.length > 0) {
            this.renderSuggestions(json.data, suggestionsBox, (user) => {
              selectedUser = user;
              input.value = `${user.full_name} (${user.email})`;
              suggestionsBox.style.display = 'none';
              this.showPreview(user, previewBox);
              submitBtn.disabled = false;
            });
            suggestionsBox.style.display = 'block';
          } else {
            suggestionsBox.style.display = 'none';
          }
        } catch (err) {
          console.warn('Error fetching suggestions:', err);
        }
      }, 150);
    });

    // Enter key submit
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedUser) {
          this.confirmUser(selectedUser);
        } else {
          // Direct lookup
          const val = input.value.trim();
          if (val) {
            await this.directLookup(val, feedback, previewBox, submitBtn, (u) => {
              selectedUser = u;
              this.confirmUser(u);
            });
          }
        }
      }
    });

    // Submit button click
    submitBtn.addEventListener('click', async () => {
      if (selectedUser) {
        this.confirmUser(selectedUser);
      } else {
        const val = input.value.trim();
        if (val) {
          await this.directLookup(val, feedback, previewBox, submitBtn, (u) => {
            selectedUser = u;
            this.confirmUser(u);
          });
        }
      }
    });

    // Guest button click
    guestBtn.addEventListener('click', () => {
      const guestSession = {
        id: 'guest',
        full_name: 'Khách Tham Quan',
        email: 'guest@fpt.com',
        isGuest: true,
        team_id: null, // Guests do not belong to any team
        team_display_name: 'Khách Tham Quan'
      };
      UserIdentityModal.saveSession(guestSession);
      this.close();
      this.onUserIdentified(guestSession);
    });
  }

  renderSuggestions(users, container, onSelect) {
    container.innerHTML = users.map(u => `
      <div class="ui-suggestion-item" data-id="${u.id}">
        <div class="ui-suggestion-left">
          <div class="ui-suggestion-avatar">${u.full_name.slice(0, 1)}</div>
          <div class="ui-suggestion-details">
            <div class="ui-suggestion-name">${u.full_name}</div>
            <div class="ui-suggestion-meta">${u.email} • ${u.employee_code}</div>
          </div>
        </div>
        <div class="ui-suggestion-team-tag" style="border-left: 2px solid ${u.team_color || '#3b82f6'};">
          ${u.team_id ? 'Đội ' + u.team_id : 'Đội'}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.ui-suggestion-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        onSelect(users[index]);
      });
    });
  }

  showPreview(user, previewBox) {
    const avatar = previewBox.querySelector('#ui-preview-avatar');
    const name = previewBox.querySelector('#ui-preview-name');
    const meta = previewBox.querySelector('#ui-preview-meta');
    const team = previewBox.querySelector('#ui-preview-team-name');

    avatar.textContent = user.gender === 'Nữ' ? '🌸' : '⚡';
    name.textContent = user.full_name;
    meta.textContent = `${user.email} • Mã NV: ${user.employee_code}`;
    team.textContent = user.team_id ? `Đội ${user.team_id}` : 'Đội';

    previewBox.style.display = 'block';
  }

  async directLookup(query, feedback, previewBox, submitBtn, onSuccess) {
    try {
      const res = await fetch(`${getApiBase()}/users/lookup?q=${encodeURIComponent(query)}`);
      const json = await res.json();

      if (json.success && json.data) {
        feedback.className = 'ui-identity-feedback success';
        feedback.textContent = `✓ Đã tìm thấy: ${json.data.full_name} (Đội ${json.data.team_id})`;
        feedback.style.display = 'block';
        this.showPreview(json.data, previewBox);
        submitBtn.disabled = false;
        onSuccess(json.data);
      } else {
        feedback.className = 'ui-identity-feedback error';
        feedback.textContent = '❌ Không tìm thấy nhân sự trong danh sách. Vui lòng kiểm tra lại email hoặc mã NV.';
        feedback.style.display = 'block';
        previewBox.style.display = 'none';
        submitBtn.disabled = true;
      }
    } catch (err) {
      feedback.className = 'ui-identity-feedback error';
      feedback.textContent = '❌ Lỗi kết nối máy chủ. Vui lòng thử lại.';
      feedback.style.display = 'block';
    }
  }

  confirmUser(user) {
    UserIdentityModal.saveSession(user);
    this.close();

    // Trigger toast notification
    if (typeof window.showToast === 'function') {
      window.showToast(`Chào mừng ${user.full_name} đã gia nhập Đội ${user.team_id}! ✨`);
    }

    this.onUserIdentified(user);
  }

  open() {
    const overlay = document.getElementById('user-identity-modal-overlay');
    if (!overlay) return;
    this.isOpen = true;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      overlay.classList.add('active');
      const input = overlay.querySelector('#ui-identity-input');
      if (input) input.focus();
    });
  }

  close() {
    const overlay = document.getElementById('user-identity-modal-overlay');
    if (!overlay) return;
    this.isOpen = false;
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }
}
