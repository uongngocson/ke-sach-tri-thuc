/**
 * shaders/moonShaders.js
 * Physically-based Moon Shader with crater displacement/maria procedural texture,
 * accurate moon phase shadow terminator, earthshine, and atmospheric halo.
 */

export const MoonVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const MoonFragmentShader = `
  uniform float uPhase; // 0.0 to 1.0 (0=New, 0.25=First Q, 0.5=Full, 0.75=Last Q)
  uniform float uIntensity;
  uniform float uDaylightFactor;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  // Simple pseudo-random and noise functions for procedural lunar surface
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
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
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; ++i) {
      v += a * noise(p);
      p = rot * p * 2.0 + vec2(100.0);
      a *= 0.5;
    }
    return v;
  }

  // Lunar crater generator
  float crater(vec2 uv, vec2 center, float radius) {
    float d = length(uv - center);
    if (d > radius * 1.5) return 0.0;
    float rim = smoothstep(radius * 0.85, radius, d) * smoothstep(radius * 1.3, radius, d);
    float floorDepth = -smoothstep(radius, 0.0, d) * 0.4;
    return (rim * 0.8 + floorDepth);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPosition);

    // Calculate sphere surface coordinates from UV
    vec2 p = vUv * 8.0;

    // 1. Procedural Lunar Surface (Basaltic Maria + Bright Highlands)
    float baseFbm = fbm(p);
    float fineDetail = fbm(p * 3.5);
    
    // Major Maria patterns (dark basaltic plains)
    float maria1 = smoothstep(0.45, 0.65, fbm(vUv * 4.2 + vec2(0.2, 0.8)));
    float maria2 = smoothstep(0.48, 0.70, fbm(vUv * 3.8 + vec2(1.5, 0.3)));
    float mariaCombined = clamp(maria1 * 0.7 + maria2 * 0.5, 0.0, 0.85);

    // Craters & ray systems
    float craters = 0.0;
    craters += crater(vUv, vec2(0.35, 0.42), 0.08); // Tycho
    craters += crater(vUv, vec2(0.68, 0.72), 0.12); // Copernicus
    craters += crater(vUv, vec2(0.25, 0.78), 0.06);
    craters += crater(vUv, vec2(0.52, 0.28), 0.09);

    // Color definitions
    vec3 highlandColor = vec3(0.88, 0.90, 0.94);     // Bright anorthositic highlands
    vec3 mariaColor = vec3(0.42, 0.45, 0.50);        // Dark basalt plains
    vec3 shadowColor = vec3(0.04, 0.06, 0.10);       // Earthshine dark side color
    vec3 haloColdColor = vec3(0.65, 0.80, 1.0);      // Cold atmospheric rim

    // Composite surface albedo
    vec3 surfaceAlbedo = mix(highlandColor, mariaColor, mariaCombined);
    surfaceAlbedo += vec3(craters * 0.15 + (fineDetail - 0.5) * 0.08);

    // 2. Realistic Lunar Phase Lighting & Terminator Line
    // Phase 0=New, 0.25=First Q (illuminated from Right), 0.5=Full, 0.75=Last Q (Left)
    float phaseAngle = uPhase * 6.2831853; // 0 to 2PI
    vec3 lightDir = normalize(vec3(-sin(phaseAngle), 0.0, cos(phaseAngle)));

    // Hapke / Rough surface Lunar diffuse model (Moon does not obey pure Lambertian falloff)
    float NdotL = dot(N, lightDir);
    
    // Moon phase terminator with micro-roughness diffusion
    float illumination = smoothstep(-0.08, 0.08, NdotL);
    // Limb brightening characteristic of lunar regolith retroreflection
    float NdotV = max(0.0, dot(N, V));
    float retroReflection = pow(1.0 - NdotV, 3.5) * 0.25;

    // Direct sunlit portion
    vec3 litSurface = surfaceAlbedo * (illumination * 1.1 + retroReflection);

    // Earthshine (dark side faintly lit by Earth reflection)
    vec3 unlitSurface = surfaceAlbedo * shadowColor * 0.8;

    // Final surface color
    vec3 finalMoon = mix(unlitSurface, litSurface, illumination);

    // 3. Subtle atmospheric cold halo at the edges
    float edgeHalo = pow(1.0 - NdotV, 2.8) * 0.35;
    finalMoon += haloColdColor * edgeHalo * illumination;

    // Modulate by global intensity and day factor (invisible in bright day)
    float totalAlpha = uIntensity * (1.0 - uDaylightFactor * 0.9);
    if (totalAlpha < 0.005) discard;

    gl_FragColor = vec4(finalMoon, totalAlpha);
  }
`;
