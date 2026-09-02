/**
 * assets/effects/NourishmentFX.js
 * Botanical Particle & Bio-luminescence Effects Coordinator
 * Renders high-performance particle streams for Fertilizer (Golden Spores) and Watering (Dew Drops)
 */
import { MockDataStore } from '../data/MockDataStore.js';

export class NourishmentFX {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.ripples = [];
    this.rafId = null;
    this.isRunning = false;

    this.initCanvas();
    this.bindEvents();
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'fpt-nourishment-fx-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 99998;
    `;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  bindEvents() {
    // Subscribe to DataStore events for automatic, decoupled triggering
    MockDataStore.subscribe('book:contributed', () => {
      this.triggerFertilizerShower();
    });

    MockDataStore.subscribe('quote:liked', () => {
      this.triggerDewDropPulse();
    });

    MockDataStore.subscribe('dew:collected', () => {
      this.triggerDewDropPulse(window.innerWidth / 2, window.innerHeight * 0.45);
    });
  }

  /**
   * Golden Fertilizer Spores Stream (Bón Phân & Phù Sa Vàng Nuôi Cây)
   */
  triggerFertilizerShower(startX = window.innerWidth / 2, startY = window.innerHeight * 0.35) {
    const count = 45;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const speed = 1.5 + Math.random() * 4.5;
      const targetY = window.innerHeight * (0.68 + Math.random() * 0.22);

      this.particles.push({
        type: 'fertilizer',
        x: startX + (Math.random() - 0.5) * 80,
        y: startY + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed * 0.8,
        vy: Math.sin(angle) * speed * 0.6 - 1.5,
        gravity: 0.12 + Math.random() * 0.08,
        targetY: targetY,
        radius: 2.2 + Math.random() * 2.8,
        color: Math.random() > 0.3 ? '#F36F21' : (Math.random() > 0.5 ? '#F5CE42' : '#70B928'),
        alpha: 1.0,
        decay: 0.008 + Math.random() * 0.012
      });
    }

    this.startLoop();
  }

  /**
   * Crystalline Dew Droplets Shower (Giọt Sương Tưới Mát Quang Hợp)
   */
  triggerDewDropPulse(startX = window.innerWidth / 2, startY = window.innerHeight * 0.38) {
    const count = 35;
    for (let i = 0; i < count; i++) {
      const spreadX = (Math.random() - 0.5) * 160;
      const spreadY = (Math.random() - 0.5) * 80;
      const targetY = window.innerHeight * (0.65 + Math.random() * 0.25);

      this.particles.push({
        type: 'dew',
        x: startX + spreadX,
        y: startY + spreadY,
        vx: (Math.random() - 0.5) * 1.8,
        vy: 1.2 + Math.random() * 3.5,
        gravity: 0.15,
        targetY: targetY,
        radius: 2.0 + Math.random() * 2.5,
        color: Math.random() > 0.4 ? '#38bdf8' : (Math.random() > 0.5 ? '#67e8f9' : '#a7f3d0'),
        alpha: 0.95,
        decay: 0.01 + Math.random() * 0.01
      });
    }

    this.startLoop();
  }

  startLoop() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.loop();
    }
  }

  loop() {
    if (!this.isRunning) return;

    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Update & Render Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.alpha -= p.decay;

      // Contact with ground creates soft ripple
      if (p.y >= p.targetY) {
        this.ripples.push({
          x: p.x,
          y: p.y,
          radius: 2,
          maxRadius: 18 + Math.random() * 12,
          color: p.color,
          alpha: 0.85,
          growth: 0.8 + Math.random() * 0.6
        });
        p.alpha = 0;
      }

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Update & Render Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += r.growth;
      r.alpha -= 0.03;

      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        this.ripples.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, r.alpha);
      this.ctx.strokeStyle = r.color;
      this.ctx.lineWidth = 1.4;
      this.ctx.shadowColor = r.color;
      this.ctx.shadowBlur = 6;

      this.ctx.beginPath();
      this.ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.38, 0, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }

    if (this.particles.length === 0 && this.ripples.length === 0) {
      this.isRunning = false;
      this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      return;
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  }

  dispose() {
    this.isRunning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
