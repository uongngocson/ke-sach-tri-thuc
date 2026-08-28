/**
 * lib/astronomy.js
 * High-precision celestial mechanics for Sun, Moon, Moon Phases, and Day/Night Cycle.
 * Calibrated for Camera FOV 60 at z = -500 frustum projection.
 */

export const SKY_STAGES = {
  DAWN: 'DAWN',             // 05:00 - 05:45
  SUNRISE: 'SUNRISE',       // 05:45 - 06:45
  MORNING: 'MORNING',       // 06:45 - 10:30
  NOON: 'NOON',             // 10:30 - 14:30
  AFTERNOON: 'AFTERNOON',   // 14:30 - 17:15
  GOLDEN_HOUR: 'GOLDEN_HOUR', // 17:15 - 18:00
  SUNSET: 'SUNSET',         // 18:00 - 18:45
  DUSK: 'DUSK',             // 18:45 - 19:30
  BLUE_HOUR: 'BLUE_HOUR',   // 19:30 - 20:15
  NIGHT: 'NIGHT',           // 20:15 - 05:00
};

export const MOON_PHASES = [
  { name: 'New Moon', phase: 0.0, icon: '🌑' },
  { name: 'Waxing Crescent', phase: 0.125, icon: '🌒' },
  { name: 'First Quarter', phase: 0.25, icon: '🌓' },
  { name: 'Waxing Gibbous', phase: 0.375, icon: '🌔' },
  { name: 'Full Moon', phase: 0.5, icon: '🌕' },
  { name: 'Waning Gibbous', phase: 0.625, icon: '🌖' },
  { name: 'Last Quarter', phase: 0.75, icon: '🌗' },
  { name: 'Waning Crescent', phase: 0.875, icon: '🌘' }
];

export function getMoonPhase(date = new Date()) {
  const synodicMonth = 29.53058770576;
  const refNewMoon = new Date('2024-01-11T11:57:00Z').getTime();
  const diffDays = (date.getTime() - refNewMoon) / (1000 * 60 * 60 * 24);
  const phase = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth / synodicMonth;
  
  let closestPhase = MOON_PHASES[0];
  let minDiff = 1.0;
  for (const p of MOON_PHASES) {
    const d = Math.abs(phase - p.phase);
    if (d < minDiff) {
      minDiff = d;
      closestPhase = p;
    }
  }
  
  return {
    value: phase,
    name: closestPhase.name,
    icon: closestPhase.icon,
    illumination: 0.5 * (1 - Math.cos(phase * 2 * Math.PI))
  };
}

export function calculateCelestialState(decimalHour) {
  const hour = ((decimalHour % 24) + 24) % 24;
  
  // Solar cycle calculations (6:00 sunrise, 12:00 noon, 18:00 sunset)
  // Solar angle traverses -PI/2 (0h) to 0 (6h) to PI/2 (12h) to PI (18h)
  const solarAngleRad = ((hour - 6.0) / 12.0) * Math.PI;
  
  // Calibrated for z = -500 projection plane:
  // Horizon is at y = -120. Peak noon sun is at y = +200, x = 0.
  const sunX = -Math.cos(solarAngleRad) * 380;
  const sunY = -120 + Math.sin(solarAngleRad) * 320;
  const sunZ = -500;
  
  const sunElevationDeg = ((sunY + 120) / 320) * 75;

  // Lunar cycle (opposite of sun)
  const lunarAngleRad = solarAngleRad + Math.PI;
  const moonX = -Math.cos(lunarAngleRad) * 380;
  const moonY = -120 + Math.sin(lunarAngleRad) * 310;
  const moonZ = -500;
  const moonElevationDeg = ((moonY + 120) / 310) * 70;

  let stage = SKY_STAGES.NIGHT;
  let sunIntensity = 0.0;
  let daylightFactor = 0.0;
  let sunsetFactor = 0.0;
  let twilightFactor = 0.0;
  let starVisibility = 0.0;

  if (hour >= 5.0 && hour < 5.75) {
    stage = SKY_STAGES.DAWN;
    twilightFactor = (hour - 5.0) / 0.75;
    daylightFactor = twilightFactor * 0.2;
    starVisibility = 1.0 - twilightFactor;
    sunIntensity = 0.05 + twilightFactor * 0.15;
  } else if (hour >= 5.75 && hour < 6.75) {
    stage = SKY_STAGES.SUNRISE;
    const t = (hour - 5.75) / 1.0;
    sunsetFactor = 1.0 - Math.abs(t - 0.5) * 2.0;
    twilightFactor = 1.0 - t;
    daylightFactor = 0.2 + t * 0.6;
    starVisibility = (1.0 - t) * 0.2;
    sunIntensity = 0.2 + t * 0.6;
  } else if (hour >= 6.75 && hour < 10.5) {
    stage = SKY_STAGES.MORNING;
    daylightFactor = 0.8 + ((hour - 6.75) / 3.75) * 0.2;
    sunIntensity = 0.8 + ((hour - 6.75) / 3.75) * 0.2;
    starVisibility = 0.0;
  } else if (hour >= 10.5 && hour < 14.5) {
    stage = SKY_STAGES.NOON;
    daylightFactor = 1.0;
    sunIntensity = 1.0;
    starVisibility = 0.0;
  } else if (hour >= 14.5 && hour < 17.25) {
    stage = SKY_STAGES.AFTERNOON;
    const t = (hour - 14.5) / 2.75;
    daylightFactor = 1.0 - t * 0.15;
    sunIntensity = 1.0 - t * 0.1;
    starVisibility = 0.0;
  } else if (hour >= 17.25 && hour < 18.0) {
    stage = SKY_STAGES.GOLDEN_HOUR;
    const t = (hour - 17.25) / 0.75;
    sunsetFactor = 0.5 + t * 0.5;
    daylightFactor = 0.85 - t * 0.35;
    sunIntensity = 0.9 - t * 0.3;
    starVisibility = 0.0;
  } else if (hour >= 18.0 && hour < 18.75) {
    stage = SKY_STAGES.SUNSET;
    const t = (hour - 18.0) / 0.75;
    sunsetFactor = 1.0 - t * 0.5;
    twilightFactor = t;
    daylightFactor = 0.5 - t * 0.4;
    sunIntensity = 0.6 - t * 0.5;
    starVisibility = t * 0.25;
  } else if (hour >= 18.75 && hour < 19.5) {
    stage = SKY_STAGES.DUSK;
    const t = (hour - 18.75) / 0.75;
    twilightFactor = 1.0 - t * 0.5;
    daylightFactor = 0.1 * (1.0 - t);
    sunIntensity = 0.1 * (1.0 - t);
    starVisibility = 0.25 + t * 0.45;
  } else if (hour >= 19.5 && hour < 20.25) {
    stage = SKY_STAGES.BLUE_HOUR;
    const t = (hour - 19.5) / 0.75;
    twilightFactor = 0.5 * (1.0 - t);
    daylightFactor = 0.0;
    sunIntensity = 0.0;
    starVisibility = 0.7 + t * 0.3;
  } else {
    stage = SKY_STAGES.NIGHT;
    daylightFactor = 0.0;
    sunIntensity = 0.0;
    starVisibility = 1.0;
  }

  // Moon intensity is highest at night
  const moonIntensity = Math.max(0.0, Math.min(1.0, (moonY + 120) / 250)) * (1.0 - daylightFactor * 0.85);

  return {
    hour,
    stage,
    sun: {
      x: sunX,
      y: sunY,
      z: sunZ,
      elevationDeg: sunElevationDeg,
      intensity: Math.max(0.0, sunIntensity),
      visible: sunY > -140
    },
    moon: {
      x: moonX,
      y: moonY,
      z: moonZ,
      elevationDeg: moonElevationDeg,
      intensity: moonIntensity,
      visible: moonY > -130,
      phase: getMoonPhase()
    },
    factors: {
      daylight: daylightFactor,
      sunset: sunsetFactor,
      twilight: twilightFactor,
      stars: starVisibility,
      ambientBrightness: Math.max(0.05, daylightFactor * 0.95 + sunsetFactor * 0.2 + moonIntensity * 0.1)
    }
  };
}
