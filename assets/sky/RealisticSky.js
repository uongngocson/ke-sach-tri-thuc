/**
 * RealisticSky.js
 * Master Entry Point for the Realistic Day/Night Celestial Sky System
 * Runs 100% automatically in background with ZERO UI buttons/overlays.
 */
import { SkyCanvas } from './components/SkyCanvas.js?v=20260909_v6';
import { getVietnamDecimalHour } from './lib/astronomy.js';

class RealisticSkySystem {
  constructor() {
    this.canvasContainer = null;
    this.skyCanvas = null;
    this.lastThemeDark = false;
    this.currentHour = 12.0;
    this.targetHour = 12.0;
    this.isTransitioning = false;
    this.lastTime = performance.now();

    this.init();
  }

  getVietnamHour() {
    return getVietnamDecimalHour(new Date());
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

    // 2. Initialize Sky Canvas
    this.skyCanvas = new SkyCanvas(this.canvasContainer);
    window.skyCanvasInstance = this.skyCanvas;

    // 3. Resolve Initial Hour synced with Theme & Vietnam Local Time
    const isDarkInitial = document.documentElement.classList.contains('dark');
    this.lastThemeDark = isDarkInitial;
    const vnH = this.getVietnamHour();

    if (isDarkInitial) {
      // Dark mode active: target night sky (22:00)
      this.currentHour = (vnH < 6.0 || vnH >= 18.0) ? vnH : 22.0;
      this.targetHour = this.currentHour;
    } else {
      // Day mode active: target real daytime hour if between 6-18h, else crisp noon 12:00
      this.currentHour = (vnH >= 6.0 && vnH < 18.0) ? vnH : 12.0;
      this.targetHour = this.currentHour;
    }

    // 4. Listen to Theme Changes (Ban Đêm / Ban Ngày) strictly when .dark toggles
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          // Only trigger transition if the 'dark' state actually changed (prevents loops with sky-night-active)
          if (isDark !== this.lastThemeDark) {
            this.lastThemeDark = isDark;
            if (isDark) {
              this.targetHour = 22.0;
              this.isTransitioning = true;
            } else {
              const currentVn = this.getVietnamHour();
              this.targetHour = (currentVn >= 6.0 && currentVn < 18.0) ? currentVn : 12.0;
              this.isTransitioning = true;
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // 5. Expose instance for testing & telemetry
    window.realisticSkySystem = this;

    // 6. Start Animation Loop
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    console.log(`🌌 Realistic Sky System Initialized (Hour: ${this.currentHour.toFixed(2)}, Dark: ${isDarkInitial})`);
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
    } else {
      // Advance by real-time progression
      this.currentHour = (this.currentHour + (deltaSec / 3600)) % 24;
    }

    // Broadcast night state to documentElement for crystal-clear UI contrast
    const isNightNow = (this.currentHour < 6.0 || this.currentHour >= 18.0);
    if (document.documentElement) {
      if (isNightNow && !document.documentElement.classList.contains('sky-night-active')) {
        document.documentElement.classList.add('sky-night-active');
      } else if (!isNightNow && document.documentElement.classList.contains('sky-night-active')) {
        document.documentElement.classList.remove('sky-night-active');
      }
    }

    // Render WebGL frame
    if (this.skyCanvas) {
      this.skyCanvas.render(this.currentHour);
    }

    requestAnimationFrame(this.loop);
  }
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new RealisticSkySystem());
  } else {
    new RealisticSkySystem();
  }
}

export { RealisticSkySystem };
