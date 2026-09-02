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
        <div class="tester-section" style="margin-bottom:0;">
          <button class="tester-btn-reset" id="tester-reset-btn">↺ Reset Về Ban Đầu (0 Hạt, Mặt Đất Trống)</button>
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

    panel.querySelector('#stage-btn-0-seeds').addEventListener('click', async () => {
      await MockDataStore.setTesterLevel(0);
      this.updateTesterUI();
    });

    panel.querySelector('#stage-btn-15-seeds').addEventListener('click', async () => {
      await MockDataStore.setTesterEXP(15);
      this.updateTesterUI();
    });

    panel.querySelector('#stage-btn-30-seeds').addEventListener('click', async () => {
      await MockDataStore.setTesterEXP(30);
      this.updateTesterUI();
    });

    panel.querySelector('#stage-btn-45-seeds').addEventListener('click', async () => {
      await MockDataStore.setTesterEXP(45);
      this.updateTesterUI();
    });

    panel.querySelector('#stage-btn-50-sprout').addEventListener('click', async () => {
      await MockDataStore.setTesterEXP(50);
      this.updateTesterUI();
    });

    panel.querySelectorAll('.stage-btn[data-level]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const lvl = parseInt(e.currentTarget.getAttribute('data-level'));
        await MockDataStore.setTesterLevel(lvl);
        this.updateTesterUI();
      });
    });

    const slider = panel.querySelector('#tester-exp-slider');
    const expVal = panel.querySelector('#tester-exp-val');
    slider.addEventListener('input', async (e) => {
      const val = parseInt(e.target.value);
      if (expVal) expVal.textContent = val + ' EXP';
      await MockDataStore.setTesterEXP(val);
    });

    panel.querySelector('#sim-add-1-seed').addEventListener('click', async () => {
      await MockDataStore.plantSeed({
        book: 'Hạt Giống Tâm Hồn',
        author: 'First News',
        quote: 'Một hạt giống gieo xuống sẽ nuôi dưỡng mầm non.',
        category: 'Sách Tinh Hoa'
      });
      this.updateTesterUI();
    });

    panel.querySelector('#sim-add-10-seeds').addEventListener('click', async () => {
      for (let i = 0; i < 10; i++) {
        await MockDataStore.plantSeed({
          book: 'Tủ Sách Tri Thức ' + (i + 1),
          author: 'Cộng đồng',
          quote: 'Tri thức là sức mạnh.',
          category: 'Sách Tư Duy'
        });
      }
      this.updateTesterUI();
    });

    panel.querySelector('#sim-add-50-seeds').addEventListener('click', async () => {
      await MockDataStore.setTesterEXP(50);
      this.updateTesterUI();
    });

    panel.querySelector('#sim-add-20-likes').addEventListener('click', async () => {
      await MockDataStore.simulateAddEXP(20);
      this.updateTesterUI();
    });

    panel.querySelector('#tester-reset-btn').addEventListener('click', async () => {
      await MockDataStore.resetAllData();
      this.updateTesterUI();
    });

    MockDataStore.subscribe('growth:updated', (growth) => {
      this.syncGrowthToTesterUI(growth);
    });

    const initialGrowth = await MockDataStore.getCommunityGrowth();
    this.syncGrowthToTesterUI(initialGrowth);
  }

  togglePanel(forceState) {
    const panel = document.getElementById('tester-panel-card');
    const toggleBtn = document.getElementById('tester-panel-toggle-btn');
    if (!panel) return;

    this.isOpen = (forceState !== undefined) ? forceState : !this.isOpen;
    if (this.isOpen) {
      panel.style.display = 'block';
      toggleBtn?.classList.add('active');
    } else {
      panel.style.display = 'none';
      toggleBtn?.classList.remove('active');
    }
  }

  syncGrowthToTesterUI(growth) {
    const slider = document.getElementById('tester-exp-slider');
    const expVal = document.getElementById('tester-exp-val');
    if (slider) slider.value = growth.totalEXP;
    if (expVal) {
      if (growth.level === 0) {
        expVal.textContent = `${growth.totalEXP}/50 Hạt (Gieo Hạt)`;
      } else {
        expVal.textContent = `${growth.totalEXP} EXP (Lvl ${growth.level}: ${growth.levelName})`;
      }
    }

    document.querySelectorAll('.stage-btn').forEach(btn => btn.classList.remove('active-stage'));

    if (growth.totalEXP === 0) {
      document.getElementById('stage-btn-0-seeds')?.classList.add('active-stage');
    } else if (growth.totalEXP >= 10 && growth.totalEXP < 20) {
      document.getElementById('stage-btn-15-seeds')?.classList.add('active-stage');
    } else if (growth.totalEXP >= 25 && growth.totalEXP < 35) {
      document.getElementById('stage-btn-30-seeds')?.classList.add('active-stage');
    } else if (growth.totalEXP >= 40 && growth.totalEXP < 50) {
      document.getElementById('stage-btn-45-seeds')?.classList.add('active-stage');
    } else if (growth.level === 1) {
      document.getElementById('stage-btn-50-sprout')?.classList.add('active-stage');
    } else if (growth.level >= 2) {
      document.querySelector(`.stage-btn[data-level="${growth.level}"]`)?.classList.add('active-stage');
    }
  }

  async updateTesterUI() {
    const growth = await MockDataStore.getCommunityGrowth();
    this.syncGrowthToTesterUI(growth);
  }
}
