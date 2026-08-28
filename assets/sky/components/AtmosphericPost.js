/**
 * components/AtmosphericPost.js
 * Subtle UI Ambient Light & Theme Harmonization Bridge
 */

export class AtmosphericPost {
  constructor() {
    this.root = document.documentElement;
  }

  update(celestialState) {
    const { factors, hour, stage } = celestialState;
    const isDarkTheme = this.root.classList.contains('dark');

    // Calculate subtle ambient tint for UI container
    let ambientHex = '#f4f8fc';
    let cardTint = 'rgba(255, 255, 255, 0.95)';
    let skyGlow = 'rgba(0, 84, 166, 0.05)';

    if (factors.daylight > 0.7) {
      // Crisp Day
      ambientHex = isDarkTheme ? '#0b132b' : '#f0f6fc';
      skyGlow = 'rgba(0, 84, 166, 0.06)';
    } else if (factors.sunset > 0.2) {
      // Warm Sunset / Golden hour
      ambientHex = isDarkTheme ? '#180e28' : '#fff5eb';
      skyGlow = 'rgba(243, 111, 33, 0.12)';
    } else if (factors.twilight > 0.2) {
      // Dusk / Blue hour
      ambientHex = isDarkTheme ? '#0d122b' : '#edf2ff';
      skyGlow = 'rgba(99, 102, 241, 0.08)';
    } else {
      // Deep Night
      ambientHex = isDarkTheme ? '#060b18' : '#e6ecf8';
      skyGlow = 'rgba(56, 189, 248, 0.05)';
    }

    // Set subtle CSS tokens on :root
    this.root.style.setProperty('--sky-ambient-bg', ambientHex);
    this.root.style.setProperty('--sky-glow', skyGlow);
    this.root.style.setProperty('--sky-daylight', factors.daylight.toFixed(2));
    this.root.style.setProperty('--sky-sunset', factors.sunset.toFixed(2));
    this.root.style.setProperty('--sky-stars', factors.stars.toFixed(2));
    this.root.style.setProperty('--sky-stage', stage);
  }
}
