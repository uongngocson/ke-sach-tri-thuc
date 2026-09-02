import { MockDataStore } from '../data/MockDataStore.js';

export class TesterPanel {
  constructor() {
    this.isOpen = false;
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

        <!-- 3. Simulate Live Community Events -->
        <div class="tester-section">
          <label class="tester-section-label">🎮 Mô Phỏng Tương Tác Trực Tiếp</label>
          <div class="tester-grid-2">
            <button class="tester-btn sim-btn" id="sim-add-1-seed">🌰 +1 Hạt Giống</button>
            <button class="tester-btn sim-btn" id="sim-add-10-seeds">🌰 +10 Hạt Giống</button>
            <button class="tester-btn sim-btn" id="sim-add-50-seeds" style="color:#70B928; font-weight:800;">🌱 +50 Hạt (Nảy Mầm Ngay)</button>
            <button class="tester-btn sim-btn" id="sim-add-20-likes">❤️ +10 Tim (+20 EXP)</button>
          </div>
        </div>

        <!-- 4. Reset & Cache Control -->
        <div class="tester-section" style="margin-bottom:0; display:flex; flex-direction:column; gap:6px;">
          <button class="tester-btn-reset" id="tester-reset-btn">↺ Reset Về Ban Đầu (0 Hạt, Mặt Đất Trống)</button>
          <button class="tester-btn-reset" id="tester-wipe-db-btn" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;">🧹 Dọn Sạch CSDL (Empty CSDL - Giữ Tài Khoản)</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    toggleBtn.addEventListener('click', () => this.togglePanel());
    panel.querySelector('#tester-close-btn').addEventListener('click', () => this.togglePanel(false));

    window.addEventListener('keydown', (e) => {
      if ((e.key === 't' || e.key === 'T') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        this.togglePanel();
      }
    });

    // 1. Stage Jumpers (0, 15, 30, 45, 50, Lvl 2, 3, 4, 5)
    panel.querySelector('#stage-btn-0-seeds').addEventListener('click', async () => {
      await MockDataStore.setTesterEXP(0, 0);
      this.updateTesterUI();
    });

    panel.querySelector('#stage-btn-15-seeds').addEventListener('click', async () => {
      await MockDataStore.setTesterEXP(15, 15);
      this.updateTesterUI();
    });

    panel.querySelector('#stage-btn-30-seeds').addEventListener('click', async () => {
      await MockDataStore.setTesterEXP(30, 30);
      this.updateTesterUI();
    });

    panel.querySelector('#stage-btn-45-seeds').addEventListener('click', async () => {
      await MockDataStore.setTesterEXP(45, 45);
      this.updateTesterUI();
    });

    panel.querySelector('#stage-btn-50-sprout').addEventListener('click', async () => {
      await MockDataStore.setTesterEXP(50, 50);
      this.updateTesterUI();
    });

    panel.querySelectorAll('.stage-btn[data-level]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lvl = parseInt(btn.getAttribute('data-level'), 10);
        const expMap = { 2: 150, 3: 400, 4: 1000, 5: 2500 };
        const seedsMap = { 2: 60, 3: 80, 4: 120, 5: 200 };
        await MockDataStore.setTesterEXP(expMap[lvl] || 150, seedsMap[lvl] || 60);
        this.updateTesterUI();
      });
    });

    // 2. Slider
    const slider = panel.querySelector('#tester-exp-slider');
    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.updateSliderLabel(val);
    });

    slider.addEventListener('change', async (e) => {
      const val = parseInt(e.target.value, 10);
      await MockDataStore.setTesterEXP(val);
      this.updateTesterUI();
    });

    // 3. Simulators (+1 seed, +10 seeds, +50 seeds, +10 likes)
    panel.querySelector('#sim-add-1-seed').addEventListener('click', async () => {
      await MockDataStore.simulateSeedContribution(1);
      this.updateTesterUI();
    });

    panel.querySelector('#sim-add-10-seeds').addEventListener('click', async () => {
      await MockDataStore.simulateSeedContribution(10);
      this.updateTesterUI();
    });

    panel.querySelector('#sim-add-50-seeds').addEventListener('click', async () => {
      await MockDataStore.simulateSeedContribution(50);
      this.updateTesterUI();
    });

    panel.querySelector('#sim-add-20-likes').addEventListener('click', async () => {
      const curGrowth = await MockDataStore.getCommunityGrowth();
      await MockDataStore.setTesterEXP(curGrowth.totalEXP + 20);
      this.updateTesterUI();
    });

    // 4. Reset
    panel.querySelector('#tester-reset-btn').addEventListener('click', async () => {
      await MockDataStore.resetToInitialState();
      this.updateTesterUI();
    });

    panel.querySelector('#tester-wipe-db-btn').addEventListener('click', async () => {
      if (confirm('Bạn có chắc chắn muốn xóa sạch toàn bộ sách và dữ liệu về Empty (Vẫn giữ nguyên tài khoản Admin)?')) {
        await MockDataStore.wipeDatabaseExceptAccounts();
        this.updateTesterUI();
        if (typeof window.showToast === 'function') {
          window.showToast('🧹 Đã dọn sạch cơ sở dữ liệu về Empty (Giữ nguyên tài khoản Admin)!');
        }
      }
    });

    // Sync on growth events
    MockDataStore.subscribe('growth:updated', () => {
      this.updateTesterUI();
    });

    this.updateTesterUI();
  }

  togglePanel(forceState) {
    const panel = document.getElementById('tester-panel-card');
    if (!panel) return;
    this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
    panel.style.display = this.isOpen ? 'block' : 'none';
    if (this.isOpen) this.updateTesterUI();
  }

  async updateTesterUI() {
    const panel = document.getElementById('tester-panel-card');
    if (!panel) return;

    const growth = await MockDataStore.getCommunityGrowth();
    const slider = panel.querySelector('#tester-exp-slider');
    if (slider) slider.value = growth.totalEXP;

    this.updateSliderLabel(growth.totalEXP, growth);

    // Active button highlight
    panel.querySelectorAll('.stage-btn').forEach(b => b.classList.remove('active-stage'));

    if (growth.level === 0) {
      if (growth.totalEXP === 0) panel.querySelector('#stage-btn-0-seeds')?.classList.add('active-stage');
      else if (growth.totalEXP === 15) panel.querySelector('#stage-btn-15-seeds')?.classList.add('active-stage');
      else if (growth.totalEXP === 30) panel.querySelector('#stage-btn-30-seeds')?.classList.add('active-stage');
      else if (growth.totalEXP === 45) panel.querySelector('#stage-btn-45-seeds')?.classList.add('active-stage');
    } else if (growth.level === 1) {
      panel.querySelector('#stage-btn-50-sprout')?.classList.add('active-stage');
    } else {
      const targetBtn = panel.querySelector(`.stage-btn[data-level="${growth.level}"]`);
      if (targetBtn) targetBtn.classList.add('active-stage');
    }
  }

  updateSliderLabel(val, growthData) {
    const label = document.getElementById('tester-exp-val');
    if (!label) return;

    if (val < 50) {
      label.textContent = `${val} Hạt (Giai Đoạn Gieo Mầm)`;
      label.style.color = '#38bdf8';
    } else {
      const level = val >= 2500 ? 5 : (val >= 1000 ? 4 : (val >= 400 ? 3 : (val >= 150 ? 2 : 1)));
      label.textContent = `${val} EXP (Lvl ${level})`;
      label.style.color = '#70B928';
    }
  }
}
