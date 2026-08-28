/**
 * components/DevScrubber.js
 * Developer Time Scrubber & Celestial Simulation Controller
 */

export class DevScrubber {
  constructor(options = {}) {
    this.onTimeChange = options.onTimeChange || (() => {});
    this.isRealTime = true;
    this.currentHour = this.getLocalDecimalHour();
    this.timeScale = 1.0; // 1x, 60x, 300x
    this.isPaused = false;
    this.isCollapsed = true;

    this.container = null;
    this.slider = null;
    this.timeDisplay = null;
    this.stageDisplay = null;
    this.moonDisplay = null;

    this.initUI();
  }

  getLocalDecimalHour() {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  }

  formatTime(decimalHour) {
    const h = Math.floor(decimalHour);
    const m = Math.floor((decimalHour - h) * 60);
    const s = Math.floor(((decimalHour - h) * 60 - m) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  initUI() {
    const el = document.createElement('div');
    el.id = 'realistic-sky-dev-control';
    el.className = 'fixed bottom-4 right-4 z-50 pointer-events-auto font-sans select-none transition-all duration-300';
    el.innerHTML = `
      <div id="sky-dev-panel" class="hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xl rounded-2xl p-3.5 w-72 text-xs text-slate-800 dark:text-slate-100 flex flex-col gap-2.5">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div class="flex items-center gap-1.5 font-bold text-sky-600 dark:text-sky-400">
            <span>🌌</span>
            <span>Bầu Trời Động 24h</span>
          </div>
          <button id="sky-dev-close-btn" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold px-1 rounded cursor-pointer">✕</button>
        </div>

        <!-- Time & Celestial Stage -->
        <div class="flex items-center justify-between px-1">
          <span id="sky-dev-time" class="font-mono text-sm font-bold text-slate-900 dark:text-white">12:00:00</span>
          <span id="sky-dev-stage" class="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 font-semibold text-[10px]">NOON</span>
        </div>

        <!-- Scrubber Slider -->
        <div class="flex flex-col gap-1">
          <input id="sky-dev-slider" type="range" min="0" max="24" step="0.05" value="12" class="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div class="flex justify-between text-[9px] text-slate-400 px-0.5">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>

        <!-- Quick Celestial Presets -->
        <div class="grid grid-cols-4 gap-1 text-[10px]">
          <button data-preset="6.0" class="sky-preset-btn py-1 px-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/40 text-center font-medium transition-colors cursor-pointer">🌅 Bình minh</button>
          <button data-preset="12.0" class="sky-preset-btn py-1 px-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/40 text-center font-medium transition-colors cursor-pointer">☀️ Trưa</button>
          <button data-preset="18.25" class="sky-preset-btn py-1 px-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/40 text-center font-medium transition-colors cursor-pointer">🌇 Hoàng hôn</button>
          <button data-preset="22.5" class="sky-preset-btn py-1 px-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/40 text-center font-medium transition-colors cursor-pointer">🌌 Đêm sao</button>
        </div>

        <!-- Mode & Speed Controls -->
        <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 text-[10px]">
          <button id="sky-dev-realtime-btn" class="px-2 py-1 rounded bg-sky-500 text-white font-bold transition-all shadow-xs cursor-pointer">⏱️ Real-time</button>
          <div class="flex items-center gap-1">
            <button id="sky-dev-speed-1x" class="sky-speed-btn px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-medium cursor-pointer">1x</button>
            <button id="sky-dev-speed-60x" class="sky-speed-btn px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium cursor-pointer">60x</button>
            <button id="sky-dev-speed-300x" class="sky-speed-btn px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium cursor-pointer">300x</button>
            <button id="sky-dev-pause-btn" class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium cursor-pointer">⏸️</button>
          </div>
        </div>
      </div>

      <!-- Floating Trigger Button -->
      <button id="sky-dev-toggle-btn" class="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-300 dark:border-slate-700 shadow-xl text-slate-800 dark:text-slate-100 text-xs font-bold hover:scale-105 transition-all cursor-pointer">
        <span class="text-sm">🌤️</span>
        <span id="sky-dev-btn-label">Bầu Trời</span>
      </button>
    `;

    document.body.appendChild(el);
    this.container = el;

    // Element references
    const panel = el.querySelector('#sky-dev-panel');
    const toggleBtn = el.querySelector('#sky-dev-toggle-btn');
    const closeBtn = el.querySelector('#sky-dev-close-btn');
    this.slider = el.querySelector('#sky-dev-slider');
    this.timeDisplay = el.querySelector('#sky-dev-time');
    this.stageDisplay = el.querySelector('#sky-dev-stage');
    const realtimeBtn = el.querySelector('#sky-dev-realtime-btn');
    const pauseBtn = el.querySelector('#sky-dev-pause-btn');

    // Toggle panel
    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('hidden');
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.add('hidden');
    });

    // Slider interaction
    this.slider.addEventListener('input', (e) => {
      this.isRealTime = false;
      this.currentHour = parseFloat(e.target.value);
      this.updateRealtimeBtnState(realtimeBtn);
      this.onTimeChange(this.currentHour);
    });

    // Preset buttons
    el.querySelectorAll('.sky-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.isRealTime = false;
        this.currentHour = parseFloat(btn.dataset.preset);
        this.slider.value = this.currentHour;
        this.updateRealtimeBtnState(realtimeBtn);
        this.onTimeChange(this.currentHour);
      });
    });

    // Realtime button
    realtimeBtn.addEventListener('click', () => {
      this.isRealTime = true;
      this.isPaused = false;
      this.timeScale = 1.0;
      this.currentHour = this.getLocalDecimalHour();
      this.slider.value = this.currentHour;
      this.updateRealtimeBtnState(realtimeBtn);
      this.onTimeChange(this.currentHour);
    });

    // Speed buttons
    const speedBtns = {
      '1x': el.querySelector('#sky-dev-speed-1x'),
      '60x': el.querySelector('#sky-dev-speed-60x'),
      '300x': el.querySelector('#sky-dev-speed-300x')
    };

    const setSpeed = (scale, activeBtn) => {
      this.isRealTime = false;
      this.isPaused = false;
      this.timeScale = scale;
      this.updateRealtimeBtnState(realtimeBtn);
      Object.values(speedBtns).forEach(b => {
        b.className = 'sky-speed-btn px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium cursor-pointer';
      });
      activeBtn.className = 'sky-speed-btn px-1.5 py-0.5 rounded bg-sky-500 text-white font-bold cursor-pointer';
    };

    speedBtns['1x'].addEventListener('click', () => setSpeed(1.0, speedBtns['1x']));
    speedBtns['60x'].addEventListener('click', () => setSpeed(60.0, speedBtns['60x']));
    speedBtns['300x'].addEventListener('click', () => setSpeed(300.0, speedBtns['300x']));

    pauseBtn.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      pauseBtn.textContent = this.isPaused ? '▶️' : '⏸️';
    });
  }

  updateRealtimeBtnState(btn) {
    if (this.isRealTime) {
      btn.className = 'px-2 py-1 rounded bg-sky-500 text-white font-bold transition-all shadow-xs cursor-pointer';
    } else {
      btn.className = 'px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 transition-all cursor-pointer';
    }
  }

  tick(deltaSec) {
    if (this.isRealTime) {
      this.currentHour = this.getLocalDecimalHour();
    } else if (!this.isPaused) {
      // Advance simulated time
      const hourDelta = (deltaSec * this.timeScale) / 3600;
      this.currentHour = (this.currentHour + hourDelta) % 24;
    }

    if (this.slider && document.activeElement !== this.slider) {
      this.slider.value = this.currentHour;
    }

    if (this.timeDisplay) {
      this.timeDisplay.textContent = this.formatTime(this.currentHour);
    }

    return this.currentHour;
  }

  updateState(celestialState) {
    if (this.stageDisplay) {
      this.stageDisplay.textContent = celestialState.stage;
    }
  }
}
