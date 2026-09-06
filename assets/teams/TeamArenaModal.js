/**
 * assets/teams/TeamArenaModal.js
 * 8-Tree Forest Ecosystem & Arena Modal
 * Features:
 * - Real-time leaderboard ranking of all 8 teams
 * - Displays exact EXP, seeds, stage, participation rate
 * - "Thăm Cây Này" button to inspect any team's 3D tree and ground
 * - Highlights user's own team
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

export class TeamArenaModal {
  constructor(options = {}) {
    this.onInspectTeam = options.onInspectTeam || (() => {});
    this.isOpen = false;
    this.initDOM();
  }

  initDOM() {
    if (document.getElementById('team-arena-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'team-arena-modal-overlay';
    overlay.className = 'tam-overlay';
    overlay.style.display = 'none';

    overlay.innerHTML = `
      <div class="tam-card" id="team-arena-card">
        <div class="tam-glow-1"></div>
        <div class="tam-glow-2"></div>

        <!-- Header -->
        <div class="tam-header">
          <div class="tam-badge">
            <span>🌳</span>
            <span>TOÀN CẢNH 8 CÂY TRI THỨC • HỆ SINH THÁI ĐỘI NHÓM</span>
          </div>
          <button class="tam-close" id="tam-close-btn" title="Đóng (Esc)">✕</button>
        </div>

        <div class="tam-title-block">
          <h2 class="tam-title">Bảng Xếp Hạng & Tiến Trình 8 Đội</h2>
          <p class="tam-subtitle">
            Quy đổi chuẩn 40 người công bằng tuyệt đối • Khám phá và ghé thăm Cây Tri Thức của các đơn vị
          </p>
        </div>

        <!-- 8 Teams Grid Container -->
        <div class="tam-grid" id="tam-teams-grid">
          <div class="tam-loading">Đang tải tiến trình 8 cây...</div>
        </div>

        <!-- Footer -->
        <div class="tam-footer">
          <div class="tam-legend">
            <span>🌱 Level 1: Nảy Mầm (50 Hạt)</span>
            <span>🌿 Lvl 2 (150 EXP)</span>
            <span>🌳 Lvl 3 (400 EXP)</span>
            <span>🌲 Lvl 4 (1.000 EXP)</span>
            <span>✨ Lvl 5 (2.500+ EXP)</span>
          </div>
          <button class="tam-dismiss-btn" id="tam-dismiss-btn">
            <span>✓ Đóng Bảng So Sánh</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.injectStyles();
    this.bindEvents(overlay);
  }

  injectStyles() {
    if (document.getElementById('team-arena-styles')) return;

    const style = document.createElement('style');
    style.id = 'team-arena-styles';
    style.textContent = `
      .tam-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483642;
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
      .tam-overlay.active {
        opacity: 1;
        pointer-events: auto;
      }
      .tam-card {
        position: relative;
        width: 100%;
        max-width: 960px;
        max-height: 90vh;
        background: rgba(15, 23, 42, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 50px rgba(0, 84, 166, 0.2);
        color: #f8fafc;
        display: flex;
        flex-direction: column;
        transform: scale(0.94) translateY(10px);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: hidden;
      }
      .tam-overlay.active .tam-card {
        transform: scale(1) translateY(0);
      }
      .tam-glow-1 {
        position: absolute;
        top: -100px;
        left: -100px;
        width: 250px;
        height: 250px;
        background: radial-gradient(circle, rgba(112, 185, 40, 0.25) 0%, transparent 70%);
        pointer-events: none;
      }
      .tam-glow-2 {
        position: absolute;
        bottom: -100px;
        right: -100px;
        width: 250px;
        height: 250px;
        background: radial-gradient(circle, rgba(0, 84, 166, 0.25) 0%, transparent 70%);
        pointer-events: none;
      }
      .tam-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        flex-shrink: 0;
      }
      .tam-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        background: rgba(112, 185, 40, 0.2);
        border: 1px solid rgba(112, 185, 40, 0.4);
        color: #86efac;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.5px;
      }
      .tam-close {
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
      .tam-close:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        transform: rotate(90deg);
      }
      .tam-title-block {
        margin-bottom: 16px;
        flex-shrink: 0;
      }
      .tam-title {
        font-size: 20px;
        font-weight: 900;
        color: #ffffff;
        margin: 0 0 4px 0;
      }
      .tam-subtitle {
        font-size: 12.5px;
        color: #94a3b8;
        margin: 0;
      }
      .tam-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 12px;
        overflow-y: auto;
        padding-right: 4px;
        margin-bottom: 16px;
        flex: 1;
      }
      .tam-team-card {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 14px;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
      }
      .tam-team-card:hover {
        background: rgba(255, 255, 255, 0.08);
        transform: translateY(-2px);
        border-color: rgba(255, 255, 255, 0.25);
      }
      .tam-team-card.is-my-team {
        background: rgba(0, 84, 166, 0.15);
        border-color: rgba(59, 130, 246, 0.5);
        box-shadow: 0 0 20px rgba(0, 84, 166, 0.2);
      }
      .tam-card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      .tam-card-rank-badge {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 900;
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        flex-shrink: 0;
      }
      .tam-card-rank-badge.rank-1 { background: linear-gradient(135deg, #eab308, #ca8a04); color: #000; }
      .tam-card-rank-badge.rank-2 { background: linear-gradient(135deg, #94a3b8, #64748b); color: #fff; }
      .tam-card-rank-badge.rank-3 { background: linear-gradient(135deg, #d97706, #b45309); color: #fff; }

      .tam-team-info {
        min-width: 0;
        flex: 1;
      }
      .tam-team-name-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;
      }
      .tam-team-icon {
        font-size: 16px;
      }
      .tam-team-name {
        font-size: 14px;
        font-weight: 800;
        color: #ffffff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tam-my-team-pill {
        font-size: 9px;
        font-weight: 900;
        padding: 1px 6px;
        border-radius: 4px;
        background: #3b82f6;
        color: #fff;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .tam-team-comp {
        font-size: 11px;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tam-card-stats {
        margin-bottom: 12px;
      }
      .tam-stats-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11.5px;
        margin-bottom: 4px;
      }
      .tam-stats-label {
        color: #94a3b8;
        font-weight: 600;
      }
      .tam-stats-val {
        color: #f8fafc;
        font-weight: 800;
      }
      .tam-progress-track {
        width: 100%;
        height: 6px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
        overflow: hidden;
      }
      .tam-progress-bar {
        height: 100%;
        border-radius: 999px;
        transition: width 0.4s ease;
      }
      .tam-card-action {
        margin-top: 4px;
      }
      .tam-inspect-btn {
        width: 100%;
        height: 34px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #cbd5e1;
        font-size: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .tam-inspect-btn:hover {
        background: rgba(59, 130, 246, 0.25);
        border-color: #3b82f6;
        color: #fff;
      }
      .tam-inspect-btn.active-inspect {
        background: rgba(112, 185, 40, 0.3);
        border-color: #70B928;
        color: #86efac;
      }
      .tam-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 14px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        flex-shrink: 0;
        gap: 12px;
        flex-wrap: wrap;
      }
      .tam-legend {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 10.5px;
        color: #94a3b8;
        flex-wrap: wrap;
      }
      .tam-dismiss-btn {
        padding: 8px 18px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #fff;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.2s;
      }
      .tam-dismiss-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      .tam-loading {
        grid-column: 1 / -1;
        text-align: center;
        padding: 40px;
        color: #94a3b8;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }

  bindEvents(overlay) {
    const closeBtn = overlay.querySelector('#tam-close-btn');
    const dismissBtn = overlay.querySelector('#tam-dismiss-btn');

    closeBtn.addEventListener('click', () => this.close());
    dismissBtn.addEventListener('click', () => this.close());

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  async open() {
    const overlay = document.getElementById('team-arena-modal-overlay');
    if (!overlay) return;
    this.isOpen = true;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    await this.fetchAndRenderTeams();
  }

  close() {
    const overlay = document.getElementById('team-arena-modal-overlay');
    if (!overlay) return;
    this.isOpen = false;
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }

  async fetchAndRenderTeams() {
    const grid = document.getElementById('tam-teams-grid');
    if (!grid) return;

    try {
      const res = await fetch(`${getApiBase()}/teams`);
      const json = await res.json();

      if (!json.success || !json.data) {
        grid.innerHTML = '<div class="tam-loading">Không thể tải dữ liệu 8 đội.</div>';
        return;
      }

      const teams = json.data;
      const currentTeamId = localStorage.getItem('caosach_current_team_id') || '1';
      const userSession = JSON.parse(localStorage.getItem('caosach_user_session') || '{}');
      const myTeamId = userSession.team_id ? userSession.team_id.toString() : null;

      grid.innerHTML = teams.map((t, idx) => {
        const isMyTeam = myTeamId === t.id.toString();
        const isCurrentlyInspecting = currentTeamId === t.id.toString();
        const rankClass = t.rank === 1 ? 'rank-1' : (t.rank === 2 ? 'rank-2' : (t.rank === 3 ? 'rank-3' : ''));
        const medal = t.rank === 1 ? '🥇' : (t.rank === 2 ? '🥈' : (t.rank === 3 ? '🥉' : `#${t.rank}`));
        const color = t.color_code || t.color_primary || '#3b82f6';

        // Stage & progress logic
        const isSprouted = t.is_sprouted || t.level >= 1;
        const progressLabel = !isSprouted 
          ? `${t.tree_seeds || 0}/50 Hạt (Ủ Mầm)` 
          : `${t.total_exp} EXP (${t.level_name})`;

        return `
          <div class="tam-team-card ${isMyTeam ? 'is-my-team' : ''}" style="border-top: 3px solid ${color};">
            <div class="tam-card-top">
              <div class="tam-card-rank-badge ${rankClass}">${medal}</div>
              <div class="tam-team-info">
                <div class="tam-team-name-row">
                  <span class="tam-team-icon">${t.icon || '🌳'}</span>
                  <span class="tam-team-name" title="Đội ${t.id}">Đội ${t.id}</span>
                  ${isMyTeam ? '<span class="tam-my-team-pill">Đội của bạn</span>' : ''}
                </div>
                <div class="tam-team-comp">${t.display_name || ('Đội ' + t.id)}</div>
              </div>
            </div>

            <div class="tam-card-stats">
              <div class="tam-stats-row">
                <span class="tam-stats-label">Giai đoạn cây:</span>
                <span class="tam-stats-val" style="color:${color};">${t.level_name}</span>
              </div>
              <div class="tam-stats-row">
                <span class="tam-stats-label">Điểm tích lũy:</span>
                <span class="tam-stats-val">${progressLabel}</span>
              </div>
              <div class="tam-stats-row">
                <span class="tam-stats-label">Tỷ lệ tham gia:</span>
                <span class="tam-stats-val">${t.avg_participation_rate || 0}%</span>
              </div>
              <div class="tam-progress-track">
                <div class="tam-progress-bar" style="width:${t.progress_percent || 0}%; background:${color};"></div>
              </div>
            </div>

            <div class="tam-card-action">
              <button 
                class="tam-inspect-btn ${isCurrentlyInspecting ? 'active-inspect' : ''}" 
                data-team-id="${t.id}"
              >
                <span>${isCurrentlyInspecting ? '📍 Đang xem cây này' : '👁️ Thăm Cây Này'}</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      grid.querySelectorAll('.tam-inspect-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const tid = parseInt(e.currentTarget.dataset.teamId, 10);
          const selectedTeam = teams.find(t => t.id === tid);
          if (selectedTeam) {
            this.close();
            this.onInspectTeam(selectedTeam);
          }
        });
      });

    } catch (err) {
      grid.innerHTML = '<div class="tam-loading">Lỗi kết nối máy chủ.</div>';
    }
  }
}
