import { MockDataStore } from '../data/MockDataStore.js';
import { APP_CONFIG } from '../config/appEnv.js';

export class TesterPanel {
  constructor() {
    this.isOpen = false;

    // Check if Tester is allowed:
    // - If on main branch OR production domain -> HIDDEN by default
    // - Only accessible if explicitly forced via URL param (?tester=true)
    const urlParams = new URLSearchParams(window.location.search);
    const forceTester = urlParams.get('tester') === 'true' || urlParams.get('dev') === 'true';

    const isProductionDomain = window.location.hostname === 'caosach.soninfra.cloud';
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
          <span>BẢNG ĐIỀU KHIỂN TESTER (QUY TRÌNH 50 HẠT)</span>
        </div>
        <button class="tester-close-btn" id="tester-close-btn" title="Đóng bảng">✕</button>
      </div>

      <div class="tester-body">
        <!-- 1. Quick Stage Jumpers -->
        <div class="tester-section">
          <label class="tester-section-label">⚡ Chuyển Giai Đoạn Nhanh</label>
          <div class="tester-grid-2">
            <button class="tester-btn stage-btn" id="stage-btn-0-seeds">🌰 0 Hạt (Mặt Đất Trống)</button>
            <button class="tester-btn stage-btn" id="stage-btn-15-seeds">🌰 Gieo 15 Hạt Giống</button>
            <button class="tester-btn stage-btn" id="stage-btn-30-seeds">🌰 Gieo 30 Hạt Giống</button>
            <button class="tester-btn stage-btn" id="stage-btn-45-seeds">🌰 Gieo 45 Hạt (Sắp Mầm)</button>
            <button class="tester-btn stage-btn" id="stage-btn-50-sprout" style="color:#70B928; font-weight:bold;">🌱 Lvl 1: Nảy Mầm (50 Hạt)</button>
            <button class="tester-btn stage-btn" data-level="2">🌿 Lvl 2: Đâm Chồi (150 EXP)</button>
            <button class="tester-btn stage-btn" data-level="3">🌳 Lvl 3: Cây Tơ (400 EXP)</button>
            <button class="tester-btn stage-btn" data-level="4">🌲 Lvl 4: Trưởng Thành (1000 EXP)</button>
          </div>
          <button class="tester-btn stage-btn" data-level="5" style="width:100%; margin-top:6px;">✨ Lvl 5: Đại Cổ Thụ (2500+ EXP)</button>
        </div>

        <!-- 2. Continuous EXP Slider -->
        <div class="tester-section">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label class="tester-section-label" style="margin:0;">🎚️ Kéo Tăng Trưởng Liên Tục</label>
            <span class="tester-exp-val" id="tester-exp-val">0 Hạt</span>
          </div>
          <input type="range" min="0" max="3000" step="5" value="0" class="tester-slider" id="tester-exp-slider" />
          <div class="tester-slider-labels">
            <span>0 (Trống)</span>
            <span>50 (Nảy Mầm)</span>
            <span>150</span>
            <span>400</span>
            <span>1000</span>
            <span>2500+</span>
          </div>
        </div>

        <!-- 3. Direct Live Interactivity Simulations -->
        <div class="tester-section">
          <label class="tester-section-label">🎮 Mô Phỏng Tương Tác Trực Tiếp</label>
          <div class="tester-grid-2">
            <button class="tester-btn" id="tester-sim-1-seed">🌰 +1 Hạt Giống</button>
            <button class="tester-btn" id="tester-sim-10-seeds">🌰 +10 Hạt Giống</button>
            <button class="tester-btn" id="tester-sim-50-seeds" style="color:#70B928; font-weight:bold;">🌱 +50 Hạt (Nảy Mầm Ngay)</button>
            <button class="tester-btn" id="tester-sim-heart">❤️ +10 Tim (+20 EXP)</button>
          </div>
          <button class="tester-btn-reset" id="tester-sim-reset-all" style="margin-top:6px;">↺ Reset Về Ban Đầu (0 Hạt, Mặt Đất Trống)</button>
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

    const toggle = () => {
      this.isOpen = !this.isOpen;
      panel.style.display = this.isOpen ? 'block' : 'none';
      toggleBtn.classList.toggle('active', this.isOpen);
      if (this.isOpen) {
        this.syncCurrentState();
      }
    };

    toggleBtn.addEventListener('click', toggle);
    if (closeBtn) closeBtn.addEventListener('click', toggle);

    // Keyboard shortcut: Press 'T' or 't'
    window.addEventListener('keydown', (e) => {
      if (e.key === 't' || e.key === 'T') {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          e.preventDefault();
          toggle();
        }
      }
    });

    // Slider
    if (slider) {
      slider.addEventListener('input', async (e) => {
        const val = parseInt(e.target.value, 10);
        this.updateExpLabel(val, expVal);
        if (typeof MockDataStore.setExp === 'function') {
          await MockDataStore.setExp(val);
        } else if (typeof MockDataStore.setTesterEXP === 'function') {
          await MockDataStore.setTesterEXP(val);
        }
      });
    }

    // Stage buttons
    panel.querySelectorAll('.stage-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        let targetExp = 0;
        if (btn.id === 'stage-btn-0-seeds') targetExp = 0;
        else if (btn.id === 'stage-btn-15-seeds') targetExp = 15;
        else if (btn.id === 'stage-btn-30-seeds') targetExp = 30;
        else if (btn.id === 'stage-btn-45-seeds') targetExp = 45;
        else if (btn.id === 'stage-btn-50-sprout') targetExp = 50;
        else if (btn.dataset.level) {
          const lvl = parseInt(btn.dataset.level, 10);
          const map = { 1: 50, 2: 150, 3: 400, 4: 1000, 5: 2500 };
          targetExp = map[lvl] || 0;
        }
        if (slider) slider.value = targetExp;
        this.updateExpLabel(targetExp, expVal);
        if (typeof MockDataStore.setExp === 'function') {
          await MockDataStore.setExp(targetExp);
        } else if (typeof MockDataStore.setTesterEXP === 'function') {
          await MockDataStore.setTesterEXP(targetExp);
        }
      });
    });

    // Sim buttons
    const btnSim1 = panel.querySelector('#tester-sim-1-seed');
    if (btnSim1) btnSim1.addEventListener('click', async () => {
      if (typeof MockDataStore.addSeeds === 'function') await MockDataStore.addSeeds(1);
      else if (typeof MockDataStore.simulateSeedContribution === 'function') await MockDataStore.simulateSeedContribution(1);
    });

    const btnSim10 = panel.querySelector('#tester-sim-10-seeds');
    if (btnSim10) btnSim10.addEventListener('click', async () => {
      if (typeof MockDataStore.addSeeds === 'function') await MockDataStore.addSeeds(10);
      else if (typeof MockDataStore.simulateSeedContribution === 'function') await MockDataStore.simulateSeedContribution(10);
    });

    const btnSim50 = panel.querySelector('#tester-sim-50-seeds');
    if (btnSim50) btnSim50.addEventListener('click', async () => {
      if (typeof MockDataStore.addSeeds === 'function') await MockDataStore.addSeeds(50);
      else if (typeof MockDataStore.simulateSeedContribution === 'function') await MockDataStore.simulateSeedContribution(50);
    });

    const btnSimHeart = panel.querySelector('#tester-sim-heart');
    if (btnSimHeart) btnSimHeart.addEventListener('click', async () => {
      if (typeof MockDataStore.addHeart === 'function') await MockDataStore.addHeart();
    });

    const btnResetAll = panel.querySelector('#tester-sim-reset-all');
    if (btnResetAll) btnResetAll.addEventListener('click', async () => {
      if (typeof MockDataStore.resetToInitialState === 'function') await MockDataStore.resetToInitialState();
      else if (typeof MockDataStore.setExp === 'function') await MockDataStore.setExp(0);
      if (slider) slider.value = 0;
      this.updateExpLabel(0, expVal);
    });

    const btnDbEmpty = panel.querySelector('#tester-db-empty');
    if (btnDbEmpty) btnDbEmpty.addEventListener('click', async () => {
      if (confirm('Bạn có chắc chắn muốn dọn sạch dữ liệu CSDL? (Giữ lại tài khoản Admin)')) {
        if (typeof MockDataStore.resetDatabase === 'function') {
          await MockDataStore.resetDatabase();
        } else if (typeof MockDataStore.wipeDatabaseExceptAccounts === 'function') {
          await MockDataStore.wipeDatabaseExceptAccounts();
        }
        if (slider) slider.value = 0;
        this.updateExpLabel(0, expVal);
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
    }
  }

  async syncCurrentState() {
    let current = null;
    if (typeof MockDataStore.getState === 'function') {
      current = MockDataStore.getState();
    }
    if (!current || typeof current.totalEXP === 'undefined') {
      if (typeof MockDataStore.getCommunityGrowth === 'function') {
        current = await MockDataStore.getCommunityGrowth();
      }
    }
    const slider = document.getElementById('tester-exp-slider');
    const expVal = document.getElementById('tester-exp-val');
    if (slider && current) {
      const exp = typeof current.totalEXP === 'number' ? current.totalEXP : (current.totalSeeds || 0);
      slider.value = exp;
      this.updateExpLabel(exp, expVal);
    }
  }

  updateExpLabel(val, expValEl) {
    if (!expValEl) return;
    if (val < 50) {
      expValEl.textContent = `${val} Hạt (Giai Đoạn Gieo Mầm)`;
    } else {
      expValEl.textContent = `${val} EXP`;
    }
  }
}
