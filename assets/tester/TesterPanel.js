import { MockDataStore } from '../data/MockDataStore.js?v=20260907_v3';
import { APP_CONFIG } from '../config/appEnv.js?v=20260907_v1';

export class TesterPanel {
  constructor() {
    this.isOpen = false;

    // Check if Tester is allowed:
    // - If on main branch OR production domain -> HIDDEN by default
    // - Only accessible if explicitly forced via URL param (?tester=true)
    const urlParams = new URLSearchParams(window.location.search);
    const forceTester = urlParams.get('tester') === 'true' || urlParams.get('dev') === 'true';

    const isProductionDomain = window.location.hostname === 'foxread.soninfra.cloud';
    const isMainBranch = APP_CONFIG.BRANCH === 'main' || !APP_CONFIG.SHOW_TESTER;

    if ((isMainBranch || isProductionDomain) && !forceTester) {
      return; // Completely hidden on main branch and production
    }

    this.initUI();
  }

  async initUI() {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'tester-panel-toggle-btn';
    toggleBtn.className = 'tester-toggle-btn';
    toggleBtn.innerHTML = '<span>🧪</span><span class="tester-text-full">Tester Option</span><span class="tester-text-mobile">Tester</span>';
    toggleBtn.title = 'Mở Bảng Điều Khiển Tester (Phím tắt: T)';
    document.body.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.id = 'tester-panel-card';
    panel.className = 'tester-panel-card';
    panel.style.display = 'none';

    panel.innerHTML = `
      <div class="tester-header">
        <div class="tester-title">
          <span>🧪</span>
          <span>BẢNG ĐIỀU KHIỂN TESTER (8 CÂY TRI THỨC)</span>
        </div>
        <button class="tester-close-btn" id="tester-close-btn" title="Đóng bảng">✕</button>
      </div>

      <div class="tester-body">
        <!-- 0. Multi-Team Target Selector -->
        <div class="tester-section" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label class="tester-section-label" style="margin:0; color:#38bdf8; font-weight:800;">🎯 Thử Nghiệm Cho Đội:</label>
            <span id="tester-current-badge" style="font-size:10px; font-weight:700; padding:1px 6px; border-radius:8px; background:#0284c7; color:#fff;">Đang xem</span>
          </div>
          <select id="tester-team-select" style="width:100%; padding:7px 10px; border-radius:8px; background:#0f172a; color:#f8fafc; border:1px solid #334155; font-size:12px; font-weight:700; cursor:pointer; outline:none;">
            <option value="active">🌳 Đội Đang Xem (Tự động theo màn hình)</option>
            <option value="all">🌐 Toàn Bộ 8 Đội (Đồng bộ tất cả cây)</option>
            <option value="1">Đội 1: SCU_BO</option>
            <option value="2">Đội 2: Hà Đông Tây Bắc</option>
            <option value="3">Đội 3: Trung Đông Tây Nam</option>
            <option value="4">Đội 4: Thập đại Miền Nam</option>
            <option value="5">Đội 5: FPL_AU_FU</option>
            <option value="6">Đội 6: FTIBU_BOM</option>
            <option value="7">Đội 7: FTI BA_TU_BOP</option>
            <option value="8">Đội 8: IMU_PSU</option>
          </select>
        </div>

        <!-- 1. Quick Stage Jumpers -->
        <div class="tester-section">
          <label class="tester-section-label">⚡ Chuyển Giai Đoạn Nhanh</label>
          <div class="tester-grid-2">
            <button class="tester-btn stage-btn" id="stage-btn-0-seeds">🌰 0 EXP (0 hạt mầm)</button>
            <button class="tester-btn stage-btn" id="stage-btn-15-seeds">🌰 15 EXP (3 hạt mầm)</button>
            <button class="tester-btn stage-btn" id="stage-btn-30-seeds">🌰 30 EXP (6 hạt mầm)</button>
            <button class="tester-btn stage-btn" id="stage-btn-45-seeds">🌰 45 EXP (9 hạt mầm)</button>
            <button class="tester-btn stage-btn" id="stage-btn-50-sprout" style="color:#70B928; font-weight:bold;">🌱 Lvl 1: Mầm Non (50 EXP)</button>
            <button class="tester-btn stage-btn" data-level="2">🌿 Lvl 2: Cây Con (150 EXP)</button>
            <button class="tester-btn stage-btn" data-level="3">🌳 Lvl 3: Trưởng Thành (300 EXP)</button>
            <button class="tester-btn stage-btn" data-level="4">🌲 Lvl 4: Cổ Thụ (600 EXP)</button>
          </div>
          <button class="tester-btn stage-btn" data-level="5" style="width:100%; margin-top:6px; color:#f59e0b; font-weight:bold;">✨ Lvl 5: Đại Cổ Thụ (1200+ EXP)</button>
        </div>

        <!-- 2. Continuous EXP Slider -->
        <div class="tester-section">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label class="tester-section-label" style="margin:0;">🎚️ Kéo Tăng Trưởng Liên Tục</label>
            <span class="tester-exp-val" id="tester-exp-val">0 EXP</span>
          </div>
          <input type="range" min="0" max="3000" step="5" value="0" class="tester-slider" id="tester-exp-slider" />
          <div class="tester-slider-labels">
            <span>0 (Ủ Mầm)</span>
            <span>50 (Mầm Non)</span>
            <span>150 (Cây Con)</span>
            <span>300 (Trưởng Thành)</span>
            <span>600 (Cổ Thụ)</span>
            <span>1200+ (Đại Cổ Thụ)</span>
          </div>
        </div>

        <!-- 3. Direct Live Interactivity Simulations -->
        <div class="tester-section">
          <label class="tester-section-label">🎮 Mô Phỏng Tương Tác Trực Tiếp</label>
          <div class="tester-grid-2">
            <button class="tester-btn" id="tester-sim-1-seed">🌰 +5 EXP (1 Sách/Quote)</button>
            <button class="tester-btn" id="tester-sim-10-seeds">🌰 +25 EXP (5 Sách)</button>
            <button class="tester-btn" id="tester-sim-50-seeds" style="color:#70B928; font-weight:bold;">🌱 +50 EXP (Nảy Mầm Ngay)</button>
            <button class="tester-btn" id="tester-sim-heart" style="color:#ec4899; font-weight:bold;">❤️ +10 Tim (+20 EXP)</button>
          </div>
          <button class="tester-btn-reset" id="tester-sim-reset-all" style="margin-top:6px;">↺ Reset Về Ban Đầu (0 EXP, Mặt Đất Trống)</button>
          <button class="tester-btn-reset" id="tester-db-empty" style="margin-top:6px; background:#7f1d1d; border-color:#ef4444; color:#fca5a5;">🧹 Dọn Sạch CSDL (Empty CSDL - Giữ Tài Khoản)</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.bindEvents(toggleBtn, panel);
  }

  bindEvents(toggleBtn, panel) {
    const closeBtn = panel.querySelector('#tester-close-btn');
    const slider = panel.querySelector('#tester-exp-slider');
    const expVal = panel.querySelector('#tester-exp-val');
    const teamSelect = panel.querySelector('#tester-team-select');
    const currentBadge = panel.querySelector('#tester-current-badge');

    const getTargetTeamId = () => {
      if (!teamSelect) return 'active';
      const val = teamSelect.value;
      if (val === 'all') return 'all';
      if (val === 'active') {
        if (typeof window.getActiveTeam === 'function' && window.getActiveTeam()) {
          return window.getActiveTeam().id;
        }
        return 1;
      }
      return parseInt(val, 10);
    };

    const toggle = () => {
      this.isOpen = !this.isOpen;
      panel.style.display = this.isOpen ? 'block' : 'none';
      toggleBtn.classList.toggle('active', this.isOpen);
      if (this.isOpen) {
        if (typeof window.closeWelcomeModal === 'function') {
          window.closeWelcomeModal();
        }
        this.syncCurrentState();
      }
    };

    toggleBtn.addEventListener('click', toggle);
    if (closeBtn) closeBtn.addEventListener('click', toggle);

    // Keyboard shortcut: Press 'T' or 't'
    window.addEventListener('keydown', (e) => {
      if (e.key === 't' || e.key === 'T') {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
          e.preventDefault();
          toggle();
        }
      }
    });

    // Team selector change
    if (teamSelect) {
      teamSelect.addEventListener('change', async (e) => {
        const val = e.target.value;
        if (val === 'all') {
          if (currentBadge) currentBadge.textContent = 'Cả 8 Đội';
        } else if (val === 'active') {
          if (currentBadge) currentBadge.textContent = 'Đang xem';
        } else {
          const tId = parseInt(val, 10);
          if (currentBadge) currentBadge.textContent = `Đội ${tId}`;
          let teams = (typeof window.getAllTeams === 'function' ? window.getAllTeams() : []) || [];
          if (!teams.length && typeof MockDataStore.getTeams === 'function') {
            teams = await MockDataStore.getTeams();
          }
          const target = teams.find(t => t.id === tId);
          if (target && typeof window.inspectTeam === 'function') {
            await window.inspectTeam(target, false);
          }
        }
        await this.syncCurrentState();
      });
    }

    // Refresh ground & UI helper
    const refreshUI = async () => {
      if (typeof window.loadUserTeamAndSync === 'function') {
        await window.loadUserTeamAndSync();
      } else if (typeof window.renderGroundSeeds === 'function') {
        await window.renderGroundSeeds();
      }
      this.syncCurrentState();
    };

    // Slider
    if (slider) {
      slider.addEventListener('input', async (e) => {
        const val = parseInt(e.target.value, 10);
        this.updateExpLabel(val, expVal);
        const seeds = val < 50 ? Math.floor(val / 5) : 0;
        const teamId = getTargetTeamId();
        if (typeof MockDataStore.setTesterEXP === 'function') {
          await MockDataStore.setTesterEXP(val, seeds, teamId);
        } else if (typeof MockDataStore.setExp === 'function') {
          await MockDataStore.setExp(val, seeds, teamId);
        }
        await refreshUI();
      });
    }

    // Stage buttons
    panel.querySelectorAll('.stage-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        let targetExp = 0;
        let seedsCount = 0;
        if (btn.id === 'stage-btn-0-seeds') { targetExp = 0; seedsCount = 0; }
        else if (btn.id === 'stage-btn-15-seeds') { targetExp = 15; seedsCount = 3; }
        else if (btn.id === 'stage-btn-30-seeds') { targetExp = 30; seedsCount = 6; }
        else if (btn.id === 'stage-btn-45-seeds') { targetExp = 45; seedsCount = 9; }
        else if (btn.id === 'stage-btn-50-sprout') { targetExp = 50; seedsCount = 0; }
        else if (btn.dataset.level) {
          const lvl = parseInt(btn.dataset.level, 10);
          const map = { 1: 50, 2: 150, 3: 300, 4: 600, 5: 1200 };
          targetExp = map[lvl] || 0;
          seedsCount = 0;
        }
        if (slider) slider.value = targetExp;
        this.updateExpLabel(targetExp, expVal);

        const teamId = getTargetTeamId();
        if (typeof MockDataStore.setTesterEXP === 'function') {
          await MockDataStore.setTesterEXP(targetExp, seedsCount, teamId);
        } else if (typeof MockDataStore.setExp === 'function') {
          await MockDataStore.setExp(targetExp, seedsCount, teamId);
        }
        await refreshUI();
      });
    });

    // Sim buttons
    const btnSim1 = panel.querySelector('#tester-sim-1-seed');
    if (btnSim1) btnSim1.addEventListener('click', async () => {
      const teamId = getTargetTeamId();
      if (typeof MockDataStore.simulateSeedContribution === 'function') {
        await MockDataStore.simulateSeedContribution(1, teamId);
      } else if (typeof MockDataStore.addSeeds === 'function') {
        await MockDataStore.addSeeds(1, teamId);
      }
      await refreshUI();
    });

    const btnSim10 = panel.querySelector('#tester-sim-10-seeds');
    if (btnSim10) btnSim10.addEventListener('click', async () => {
      const teamId = getTargetTeamId();
      if (typeof MockDataStore.simulateSeedContribution === 'function') {
        await MockDataStore.simulateSeedContribution(5, teamId);
      } else if (typeof MockDataStore.addSeeds === 'function') {
        await MockDataStore.addSeeds(5, teamId);
      }
      await refreshUI();
    });

    const btnSim50 = panel.querySelector('#tester-sim-50-seeds');
    if (btnSim50) btnSim50.addEventListener('click', async () => {
      const teamId = getTargetTeamId();
      if (typeof MockDataStore.simulateSeedContribution === 'function') {
        await MockDataStore.simulateSeedContribution(10, teamId);
      } else if (typeof MockDataStore.addSeeds === 'function') {
        await MockDataStore.addSeeds(10, teamId);
      }
      await refreshUI();
    });

    const btnSimHeart = panel.querySelector('#tester-sim-heart');
    if (btnSimHeart) btnSimHeart.addEventListener('click', async () => {
      const teamId = getTargetTeamId();
      if (typeof MockDataStore.simulateHeart === 'function') {
        await MockDataStore.simulateHeart(10, 20, teamId);
      } else if (typeof MockDataStore.addHeart === 'function') {
        await MockDataStore.addHeart(10, 20, teamId);
      }
      await refreshUI();
    });

    const btnResetAll = panel.querySelector('#tester-sim-reset-all');
    if (btnResetAll) btnResetAll.addEventListener('click', async () => {
      const teamId = getTargetTeamId();
      if (typeof MockDataStore.resetToInitialState === 'function') {
        await MockDataStore.resetToInitialState(teamId);
      } else if (typeof MockDataStore.setExp === 'function') {
        await MockDataStore.setExp(0, 0, teamId);
      }
      if (slider) slider.value = 0;
      this.updateExpLabel(0, expVal);
      await refreshUI();
    });

    const btnDbEmpty = panel.querySelector('#tester-db-empty');
    if (btnDbEmpty) btnDbEmpty.addEventListener('click', async () => {
      if (confirm('Bạn có chắc chắn muốn dọn sạch dữ liệu CSDL? (Giữ lại tất cả tài khoản & đội nhóm)')) {
        if (typeof MockDataStore.wipeDatabaseExceptAccounts === 'function') {
          await MockDataStore.wipeDatabaseExceptAccounts();
        } else if (typeof MockDataStore.resetDatabase === 'function') {
          await MockDataStore.resetDatabase();
        }
        if (slider) slider.value = 0;
        this.updateExpLabel(0, expVal);
        await refreshUI();
      }
    });

    // Listen to changes from MockDataStore PubSub & CustomEvent
    const updateUiFromGrowth = (detail) => {
      if (detail && typeof detail.totalEXP === 'number') {
        const exp = detail.totalEXP;
        if (slider) slider.value = exp;
        this.updateExpLabel(exp, expVal);
      }
    };

    window.addEventListener('fpt-growth-updated', (e) => {
      if (e.detail) updateUiFromGrowth(e.detail);
    });

    if (typeof MockDataStore.subscribe === 'function') {
      MockDataStore.subscribe('growth:updated', (data) => {
        updateUiFromGrowth(data);
      });
      MockDataStore.subscribe('teams:updated', () => {
        this.syncCurrentState();
      });
    }
  }

  async syncCurrentState() {
    const slider = document.getElementById('tester-exp-slider');
    const expVal = document.getElementById('tester-exp-val');
    const teamSelect = document.getElementById('tester-team-select');
    const currentBadge = document.getElementById('tester-current-badge');

    let targetTeam = null;
    if (teamSelect && teamSelect.value !== 'all' && teamSelect.value !== 'active') {
      const tId = parseInt(teamSelect.value, 10);
      if (typeof window.getAllTeams === 'function') {
        targetTeam = window.getAllTeams().find(t => t.id === tId);
      }
    } else {
      if (typeof window.getActiveTeam === 'function') {
        targetTeam = window.getActiveTeam();
      }
    }

    if (targetTeam) {
      const isSprouted = targetTeam.is_sprouted || targetTeam.level >= 1 || (targetTeam.total_exp || 0) >= 50 || (targetTeam.tree_seeds || 0) >= 10;
      const exp = targetTeam.total_exp || 0;
      if (slider) slider.value = exp;
      this.updateExpLabel(exp, expVal);
      if (currentBadge && (!teamSelect || teamSelect.value === 'active')) {
        currentBadge.textContent = `Đội ${targetTeam.id}`;
      }
    } else {
      let current = null;
      if (typeof MockDataStore.getState === 'function') {
        current = MockDataStore.getState();
      }
      if (slider && current) {
        const exp = typeof current.totalEXP === 'number' ? current.totalEXP : 0;
        slider.value = exp;
        this.updateExpLabel(exp, expVal);
      }
    }
  }

  updateExpLabel(val, expValEl) {
    if (!expValEl) return;
    if (val < 50) {
      const seeds = Math.floor(val / 5);
      expValEl.textContent = `${val}/50 EXP (${seeds} hạt mầm)`;
    } else {
      expValEl.textContent = `${val} EXP`;
    }
  }
}
