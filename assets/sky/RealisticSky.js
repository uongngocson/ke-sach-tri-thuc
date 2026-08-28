/**
 * RealisticSky.js
 * Master Entry Point for the Realistic Day/Night Celestial Sky System
 */
import { SkyCanvas } from './components/SkyCanvas.js';
import { DevScrubber } from './components/DevScrubber.js';

class RealisticSkySystem {
  constructor() {
    this.canvasContainer = null;
    this.skyCanvas = null;
    this.devScrubber = null;
    this.currentHour = 12.0;
    this.targetHour = 12.0;
    this.isTransitioning = false;
    this.lastTime = performance.now();

    this.init();
  }

  init() {
    // 1. Mount Sky Container behind all UI layers
    let container = document.getElementById('realistic-sky-root');
    if (!container) {
      container = document.createElement('div');
      container.id = 'realistic-sky-root';
      container.style.cssText = 'position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden;';
      document.body.prepend(container);
    }
    this.canvasContainer = container;

    // 2. Initialize Sky Canvas & Dev Scrubber
    this.skyCanvas = new SkyCanvas(this.canvasContainer);
    this.devScrubber = new DevScrubber({
      onTimeChange: (newHour) => {
        this.currentHour = newHour;
        this.targetHour = newHour;
        this.isTransitioning = false;
      }
    });

    // Check if initial theme is dark
    const isDarkInitial = document.documentElement.classList.contains('dark');
    if (isDarkInitial && this.devScrubber.isRealTime) {
      const realH = this.devScrubber.getLocalDecimalHour();
      if (realH >= 6 && realH < 18) {
        // If user explicitly saved dark theme, start in night mode (22:00)
        this.currentHour = 22.0;
        this.targetHour = 22.0;
        this.devScrubber.currentHour = 22.0;
        this.devScrubber.isRealTime = false;
        if (this.devScrubber.slider) this.devScrubber.slider.value = 22.0;
      } else {
        this.currentHour = realH;
        this.targetHour = realH;
      }
    } else {
      this.currentHour = this.devScrubber.getLocalDecimalHour();
      this.targetHour = this.currentHour;
    }

    // 3. Listen to Theme Changes (Ban Đêm / Ban Ngày buttons)
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          if (isDark && (this.currentHour >= 6.0 && this.currentHour <= 18.0)) {
            // Smoothly shift to night
            this.targetHour = 22.0;
            this.isTransitioning = true;
            this.devScrubber.isRealTime = false;
          } else if (!isDark && (this.currentHour < 6.0 || this.currentHour > 18.0)) {
            // Smoothly shift to day
            this.targetHour = 12.0;
            this.isTransitioning = true;
            this.devScrubber.isRealTime = false;
          }
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // 4. Start Animation Loop
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    console.log('🌌 Realistic Sky System Initialized (24h Day/Night Cycle Active)');
  }

  loop(currentTime) {
    const deltaSec = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    // Smooth transition when switching themes
    if (this.isTransitioning) {
      let diff = this.targetHour - this.currentHour;
      if (Math.abs(diff) > 12) {
        diff = diff > 0 ? diff - 24 : diff + 24;
      }
      this.currentHour = (this.currentHour + diff * Math.min(1.0, deltaSec * 4.0) + 24) % 24;
      if (Math.abs(diff) < 0.05) {
        this.currentHour = this.targetHour;
        this.isTransitioning = false;
      }
      if (this.devScrubber) {
        this.devScrubber.currentHour = this.currentHour;
        if (this.devScrubber.slider && document.activeElement !== this.devScrubber.slider) {
          this.devScrubber.slider.value = this.currentHour;
        }
      }
    } else if (this.devScrubber) {
      this.currentHour = this.devScrubber.tick(deltaSec);
    }

    // Render WebGL frame
    if (this.skyCanvas) {
      const state = this.skyCanvas.render(this.currentHour);
      if (state && this.devScrubber) {
        this.devScrubber.updateState(state);
      }
    }

    requestAnimationFrame(this.loop);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new RealisticSkySystem());
} else {
  new RealisticSkySystem();
}
