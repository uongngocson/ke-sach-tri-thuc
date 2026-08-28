/**
 * components/SkyCanvas.js
 * Three.js WebGL Scene, Camera, Render Loop, and Celestial Component Coordinator
 */
import { Atmosphere } from './Atmosphere.js';
import { Sun } from './Sun.js';
import { Moon } from './Moon.js';
import { Clouds } from './Clouds.js';
import { Stars } from './Stars.js';
import { AtmosphericPost } from './AtmosphericPost.js';
import { calculateCelestialState } from '../lib/astronomy.js';
import { detectQualitySettings } from '../lib/quality.js';

export class SkyCanvas {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.THREE = window.THREE;

    if (!this.THREE) {
      console.error('Three.js library is not loaded.');
      return;
    }

    this.quality = detectQualitySettings();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.canvas = null;

    // Components
    this.atmosphere = null;
    this.sun = null;
    this.moon = null;
    this.clouds = null;
    this.stars = null;
    this.atmosphericPost = null;

    // Animation state
    this.clock = new this.THREE.Clock();
    this.isRendering = true;
    this.lastCelestialState = null;
    this.rafId = null;

    this.init();
  }

  init() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Scene & Perspective Camera
    this.scene = new this.THREE.Scene();
    this.camera = new this.THREE.PerspectiveCamera(60, width / height, 1, 3000);
    this.camera.position.set(0, 0, 0);

    // 2. WebGL Renderer
    this.renderer = new this.THREE.WebGLRenderer({
      alpha: true,
      antialias: this.quality.tier === 'HIGH',
      powerPreference: 'high-performance',
      stencil: false
    });

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.quality.dpr);
    this.canvas = this.renderer.domElement;
    this.canvas.id = 'realistic-sky-canvas';
    this.canvas.style.cssText = 'position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0;';
    
    this.container.appendChild(this.canvas);

    // 3. Initialize Celestial System Layers
    this.atmosphere = new Atmosphere(this.THREE);
    this.scene.add(this.atmosphere.mesh);

    this.stars = new Stars(this.THREE, this.quality);
    this.scene.add(this.stars.points);

    this.sun = new Sun(this.THREE);
    this.scene.add(this.sun.mesh);

    this.moon = new Moon(this.THREE);
    this.scene.add(this.moon.mesh);

    this.clouds = new Clouds(this.THREE);
    this.scene.add(this.clouds.mesh);

    this.atmosphericPost = new AtmosphericPost();

    // 4. Listeners
    window.addEventListener('resize', this.onResize.bind(this), { passive: true });
    document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
  }

  onResize() {
    if (!this.renderer || !this.camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.atmosphere.onResize(width, height);
  }

  onVisibilityChange() {
    this.isRendering = !document.hidden;
    if (this.isRendering && !this.rafId) {
      this.clock.getDelta(); // reset clock delta
    }
  }

  render(decimalHour) {
    if (!this.isRendering || !this.renderer || !this.scene) return;

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Calculate Sun, Moon, Atmosphere state for current hour
    const celestialState = calculateCelestialState(decimalHour);
    this.lastCelestialState = celestialState;

    // 2. Update individual celestial components
    this.atmosphere.update(celestialState, elapsedTime);
    this.stars.update(celestialState, elapsedTime);
    this.sun.update(celestialState, elapsedTime, this.camera);
    this.moon.update(celestialState, elapsedTime, this.camera);
    this.clouds.update(celestialState, elapsedTime);

    // 3. Subtle ambient light broadcast to DOM
    this.atmosphericPost.update(celestialState);

    // 4. Render WebGL Frame
    this.renderer.render(this.scene, this.camera);

    return celestialState;
  }

  dispose() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    if (this.atmosphere) this.atmosphere.dispose();
    if (this.sun) this.sun.dispose();
    if (this.moon) this.moon.dispose();
    if (this.clouds) this.clouds.dispose();
    if (this.stars) this.stars.dispose();

    if (this.renderer) {
      this.renderer.dispose();
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
    }
  }
}
