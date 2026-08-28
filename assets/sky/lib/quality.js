/**
 * lib/quality.js
 * Hardware detection, DPR clamping, performance tiering, and motion preferences.
 */

export const QUALITY_TIERS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

export function detectQualitySettings() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Hardware concurrency & memory heuristics
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  
  let tier = QUALITY_TIERS.HIGH;
  let maxDPR = 1.5;
  let cloudOctaves = 4;
  let starCount = 900;
  let cloudParticles = true;
  
  if (isMobile || cores <= 4 || memory <= 4) {
    tier = QUALITY_TIERS.MEDIUM;
    maxDPR = 1.0;
    cloudOctaves = 3;
    starCount = 450;
  }
  
  if (isMobile && (cores <= 2 || memory <= 2)) {
    tier = QUALITY_TIERS.LOW;
    maxDPR = 1.0;
    cloudOctaves = 2;
    starCount = 250;
    cloudParticles = false;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, maxDPR);

  return {
    tier,
    isMobile,
    prefersReducedMotion,
    dpr,
    cloudOctaves,
    starCount,
    cloudParticles,
    sunSegments: tier === QUALITY_TIERS.HIGH ? 64 : 32,
    moonSegments: tier === QUALITY_TIERS.HIGH ? 64 : 32
  };
}
