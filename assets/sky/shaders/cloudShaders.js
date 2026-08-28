/**
 * shaders/cloudShaders.js
 * Multi-layered Procedural FBM Volumetric Cloud Deck with Silver Lining and Edge Lighting
 */

export const CloudVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const CloudFragmentShader = `
  uniform vec3 uSunPosition;
  uniform vec3 uMoonPosition;
  uniform float uDaylightFactor;
  uniform float uSunsetFactor;
  uniform float uTwilightFactor;
  uniform float uTime;
  uniform float uCloudCover; // e.g. 0.45
  uniform float uCloudDensity;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  // 2D Hash & Noise
  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.55), sin(0.55), -sin(0.55), cos(0.55));
    for (int i = 0; i < 4; ++i) {
      v += a * noise(p);
      p = rot * p * 2.1 + vec2(2.5, 1.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Cloud dome mapping from world position
    vec3 dir = normalize(vWorldPosition);
    if (dir.y < 0.02) discard; // Don't render below horizon

    // Perspective planar cloud projection
    vec2 cloudCoord = (dir.xz / (dir.y + 0.12)) * 0.45;
    
    // Slow majestic wind displacement (different velocities for layered depth)
    vec2 wind1 = vec2(uTime * 0.004, uTime * 0.0015);
    vec2 wind2 = vec2(uTime * 0.0065, uTime * 0.0025);

    // Multi-octave domain warped cloud density
    float warp = fbm(cloudCoord * 1.8 + wind1);
    float density1 = fbm(cloudCoord * 1.5 + wind1 + warp * 0.4);
    float density2 = fbm(cloudCoord * 3.2 + wind2);
    
    float rawDensity = density1 * 0.75 + density2 * 0.25;
    
    // Cloud coverage threshold
    float coverage = 0.48;
    float cloudAlpha = smoothstep(coverage, coverage + 0.28, rawDensity);

    // Fade out smoothly towards the horizon to avoid clipping
    float horizonFade = smoothstep(0.02, 0.25, dir.y);
    cloudAlpha *= horizonFade * 0.85;

    if (cloudAlpha < 0.008) discard;

    // 1. Cloud Lighting Calculation
    // Sun alignment (Forward scattering / Silver Lining when looking towards the sun through cloud edges)
    vec3 sunDir = normalize(uSunPosition);
    float sunDot = max(0.0, dot(dir, sunDir));
    float silverLining = pow(sunDot, 6.0) * (1.0 - cloudAlpha * 0.75) * (uDaylightFactor * 0.9 + uSunsetFactor * 1.2);

    // Moon alignment
    vec3 moonDir = normalize(uMoonPosition);
    float moonDot = max(0.0, dot(dir, moonDir));
    float moonSilver = pow(moonDot, 8.0) * (1.0 - cloudAlpha * 0.8) * (1.0 - uDaylightFactor) * 0.7;

    // 2. Cloud Shading Colors based on Time of Day
    // Day colors: bright white top, soft slate underside
    vec3 cloudTopDay = vec3(0.98, 0.99, 1.0);
    vec3 cloudUnderDay = vec3(0.72, 0.78, 0.86);

    // Sunset colors: brilliant gold/orange edges, deep violet-rose underside
    vec3 cloudTopSunset = vec3(1.0, 0.68, 0.28);
    vec3 cloudUnderSunset = vec3(0.48, 0.25, 0.38);

    // Twilight colors: muted rose-purple
    vec3 cloudTopTwilight = vec3(0.45, 0.35, 0.52);
    vec3 cloudUnderTwilight = vec3(0.18, 0.14, 0.25);

    // Night colors: cold silver moonlight top, obsidian underside
    vec3 cloudTopNight = vec3(0.22, 0.28, 0.38);
    vec3 cloudUnderNight = vec3(0.03, 0.04, 0.08);

    // Interpolate Top and Underside colors across time
    vec3 topColor = cloudTopNight;
    topColor = mix(topColor, cloudTopTwilight, uTwilightFactor);
    topColor = mix(topColor, cloudTopSunset, uSunsetFactor);
    topColor = mix(topColor, cloudTopDay, uDaylightFactor);

    vec3 underColor = cloudUnderNight;
    underColor = mix(underColor, cloudUnderTwilight, uTwilightFactor);
    underColor = mix(underColor, cloudUnderSunset, uSunsetFactor);
    underColor = mix(underColor, cloudUnderDay, uDaylightFactor);

    // Density shading (denser interior is shaded from below, edges catch light)
    float internalShading = smoothstep(0.0, 0.8, cloudAlpha);
    vec3 cloudBaseColor = mix(topColor, underColor, internalShading * 0.6);

    // Add Solar and Lunar Silver Lining to cloud edges
    vec3 silverColor = mix(vec3(1.0, 0.5, 0.15), vec3(1.0, 0.98, 0.9), uDaylightFactor);
    cloudBaseColor += silverColor * silverLining * 1.5;
    cloudBaseColor += vec3(0.65, 0.8, 1.0) * moonSilver * 1.2;

    gl_FragColor = vec4(cloudBaseColor, cloudAlpha);
  }
`;
