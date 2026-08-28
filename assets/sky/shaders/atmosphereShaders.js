/**
 * shaders/atmosphereShaders.js
 * Physically-inspired Rayleigh and Mie Atmospheric Scattering Sky Shader
 */

export const AtmosphereVertexShader = `
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const AtmosphereFragmentShader = `
  uniform vec3 uSunPosition;
  uniform vec3 uMoonPosition;
  uniform float uDaylightFactor;
  uniform float uSunsetFactor;
  uniform float uTwilightFactor;
  uniform float uTime;
  uniform vec2 uResolution;

  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // Zenith sky colors
  const vec3 ZENITH_DAY = vec3(0.18, 0.44, 0.82);       // Crisp azure blue
  const vec3 ZENITH_SUNSET = vec3(0.14, 0.16, 0.42);    // Deep violet-blue
  const vec3 ZENITH_TWILIGHT = vec3(0.035, 0.06, 0.18); // Indigo blue hour
  const vec3 ZENITH_NIGHT = vec3(0.006, 0.010, 0.022);  // Authentic deep midnight black-blue

  // Horizon sky colors
  const vec3 HORIZON_DAY = vec3(0.70, 0.84, 0.96);      // Atmospheric haze blue
  const vec3 HORIZON_SUNSET = vec3(0.96, 0.45, 0.15);   // Vibrant warm crimson-orange
  const vec3 HORIZON_TWILIGHT = vec3(0.38, 0.20, 0.35); // Dusky purple-pink
  const vec3 HORIZON_NIGHT = vec3(0.012, 0.018, 0.038); // Deep dark horizon

  // Mie scattering sun glow colors
  const vec3 SUN_GLOW_DAY = vec3(1.0, 0.96, 0.86);
  const vec3 SUN_GLOW_SUNSET = vec3(1.0, 0.52, 0.12);

  // Lunar glow color
  const vec3 MOON_GLOW = vec3(0.35, 0.55, 0.85);

  float henyeyGreenstein(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * 3.14159265 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
  }

  void main() {
    vec3 viewDir = normalize(vWorldPosition);
    float height = clamp(viewDir.y + 0.12, 0.0, 1.0);

    float horizonBlend = pow(1.0 - height, 1.6);

    // 1. Base Sky Gradient
    vec3 zenithColor = ZENITH_NIGHT;
    zenithColor = mix(zenithColor, ZENITH_TWILIGHT, uTwilightFactor);
    zenithColor = mix(zenithColor, ZENITH_SUNSET, uSunsetFactor);
    zenithColor = mix(zenithColor, ZENITH_DAY, uDaylightFactor);

    vec3 horizonColor = HORIZON_NIGHT;
    horizonColor = mix(horizonColor, HORIZON_TWILIGHT, uTwilightFactor);
    horizonColor = mix(horizonColor, HORIZON_SUNSET, uSunsetFactor);
    horizonColor = mix(horizonColor, HORIZON_DAY, uDaylightFactor);

    vec3 skyColor = mix(zenithColor, horizonColor, horizonBlend);

    // 2. Solar Mie Scattering
    vec3 sunDir = normalize(uSunPosition);
    float sunCosTheta = dot(viewDir, sunDir);

    if (uSunPosition.y > -150.0 && uDaylightFactor + uSunsetFactor > 0.01) {
      float sunHeightNorm = clamp((uSunPosition.y + 120.0) / 320.0, 0.0, 1.0);
      vec3 sunGlowColor = mix(SUN_GLOW_SUNSET, SUN_GLOW_DAY, sunHeightNorm);
      
      float wideGlow = pow(max(0.0, sunCosTheta), 6.0) * (0.45 + uSunsetFactor * 0.55);
      float tightGlow = henyeyGreenstein(sunCosTheta, 0.86) * (0.9 + uSunsetFactor * 1.4);
      
      float sunFactor = (wideGlow + tightGlow * 0.18) * (uDaylightFactor * 0.85 + uSunsetFactor * 1.1);
      skyColor += sunGlowColor * sunFactor;

      if (uSunsetFactor > 0.01) {
        float sunAzimuthAlign = max(0.0, dot(vec3(viewDir.x, 0.0, viewDir.z), vec3(sunDir.x, 0.0, sunDir.z)));
        float sunsetWash = pow(sunAzimuthAlign, 2.5) * horizonBlend * uSunsetFactor * 0.75;
        skyColor += vec3(1.0, 0.32, 0.06) * sunsetWash;
      }
    }

    // 3. Lunar Mie Scattering
    vec3 moonDir = normalize(uMoonPosition);
    float moonCosTheta = dot(viewDir, moonDir);
    if (uMoonPosition.y > -120.0 && uDaylightFactor < 0.6) {
      float moonWideGlow = pow(max(0.0, moonCosTheta), 10.0) * 0.25;
      float moonTightGlow = henyeyGreenstein(moonCosTheta, 0.90) * 0.12;
      float nightWeight = (1.0 - uDaylightFactor);
      skyColor += MOON_GLOW * (moonWideGlow + moonTightGlow) * nightWeight * 0.75;
    }

    // ACES Tone-mapping
    vec3 x = skyColor;
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    vec3 mapped = clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);

    gl_FragColor = vec4(mapped, 1.0);
  }
`;
