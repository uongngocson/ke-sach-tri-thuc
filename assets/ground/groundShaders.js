/**
 * assets/ground/groundShaders.js
 * High-End Photorealistic Procedural Forest Soil & Terrain Shader for Cáo Sách
 */

export const groundVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const groundFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uDaylight;
  uniform float uSunset;
  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  uniform vec3 uSunColor;
  uniform vec3 uMoonColor;
  uniform vec3 uTreeBasePos;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  // --- High Quality Deterministic Procedural Noise ---
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float hash1(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Simplex Noise 2D
  float snoise(vec2 p) {
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;

    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;

    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3 n = h * h * h * h * vec3(dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));

    return dot(n, vec3(70.0));
  }

  // 5-Octave Fractal Brownian Motion for Realistic Organic Soil Topology
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.48), sin(0.48), -sin(0.48), cos(0.48));
    for (int i = 0; i < 5; i++) {
      v += a * snoise(p);
      p = rot * p * 2.12 + vec2(3.17, 7.81);
      a *= 0.48;
    }
    return v;
  }

  // Voronoi Cellular Noise for Dirt Clods, Humus Patches, and Small Stones
  float voronoi(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash2(n + g) * 0.5 + 0.5;
        vec2 r = g - f + o;
        float d = dot(r, r);
        minDist = min(minDist, d);
      }
    }
    return sqrt(minDist);
  }

  void main() {
    // 1. World Mapping Coordinates
    vec2 soilCoord = vWorldPosition.xz * 0.038;
    vec2 detailCoord = vWorldPosition.xz * 0.22;
    vec2 microCoord = vWorldPosition.xz * 0.85;

    // 2. Multi-Frequency Natural Geological Texture Layers
    float terrainFbm   = fbm(soilCoord);
    float humusPatches = fbm(soilCoord * 2.8 + vec2(5.2, 1.9));
    float dirtClods    = voronoi(detailCoord * 1.8);
    float microGrit    = snoise(microCoord * 3.5) * 0.5 + 0.5;
    float pebbleStones = smoothstep(0.68, 0.92, 1.0 - voronoi(detailCoord * 6.5));

    // 3. Photorealistic Natural Forest Loam & Humus Palette
    // Deep damp rich soil in root hollows
    vec3 deepHumusSoil    = vec3(0.08, 0.05, 0.03);
    // Rich warm ancient oak forest loam
    vec3 warmForestLoam   = vec3(0.18, 0.11, 0.07);
    // Reddish-brown mineral earth
    vec3 reddishClayEarth = vec3(0.25, 0.15, 0.09);
    // Dry sun-exposed topsoil silt
    vec3 drySiltTopsoil   = vec3(0.32, 0.23, 0.15);
    // Subtle organic moss & lichen accents near damp roots
    vec3 forestMossTint   = vec3(0.15, 0.18, 0.08);
    // Tiny mineral pebbles / weathered gravel
    vec3 gravelColor      = vec3(0.24, 0.22, 0.20);

    // Natural Soil Layering & Stratification
    float blend1 = smoothstep(-0.35, 0.45, terrainFbm);
    float blend2 = smoothstep(-0.25, 0.55, humusPatches);
    float clodMask = smoothstep(0.2, 0.8, dirtClods);

    vec3 soilBase = mix(deepHumusSoil, warmForestLoam, blend1);
    soilBase = mix(soilBase, reddishClayEarth, blend2 * 0.55);
    soilBase = mix(soilBase, drySiltTopsoil, clodMask * 0.35 + microGrit * 0.15);

    // Organic forest moss in depressions & under tree
    float mossMask = smoothstep(0.2, 0.7, fbm(soilCoord * 1.6 + vec2(8.4, 3.2)));
    soilBase = mix(soilBase, forestMossTint, mossMask * 0.35);

    // Micro pebbles and grit
    soilBase = mix(soilBase, gravelColor, pebbleStones * 0.28);

    // 4. Tree Root Contact Occlusion (Baking deep 3D shadow into root bed)
    vec2 distToTrunk = vWorldPosition.xz - uTreeBasePos.xz;
    float distFromTrunk = length(distToTrunk);

    // Dark contact shadow directly beneath trunk & main root flares
    float rootContactAO = smoothstep(1.5, 26.0, distFromTrunk);
    // Broad canopy umbrella occlusion
    float canopyAO = smoothstep(12.0, 95.0, distFromTrunk) * 0.42 + 0.58;
    float totalAO = mix(0.18, 1.0, rootContactAO) * canopyAO;

    // Extra dampness/darkness close to ancient roots
    float rootDampness = 1.0 - smoothstep(0.0, 35.0, distFromTrunk);
    soilBase = mix(soilBase, deepHumusSoil, rootDampness * 0.45);

    // 5. Procedural Normal Perturbation (Micro-Roughness & Soil Bump Mapping)
    vec3 normal = normalize(vNormal);
    vec2 dN = vec2(
      snoise(soilCoord * 4.0 + vec2(0.015, 0.0)) - snoise(soilCoord * 4.0),
      snoise(soilCoord * 4.0 + vec2(0.0, 0.015)) - snoise(soilCoord * 4.0)
    );
    normal.xz += dN * 0.32;
    normal = normalize(normal);

    // 6. Dynamic Photorealistic Celestial Lighting
    // Daylight Sun Illumination (Warm direct sunlight + ambient hemisphere fill)
    vec3 sunDir = normalize(uSunDirection);
    float sunDiff = max(dot(normal, sunDir), 0.0);
    vec3 sunLight = uSunColor * (sunDiff * 0.85 + 0.32) * uDaylight;

    // Sunset / Golden Hour Low-Angle Warm Earth Glow
    vec3 goldenSunset = vec3(0.95, 0.52, 0.22) * (uSunset * 0.75 * (sunDiff * 0.6 + 0.4));

    // Night / Moonlight Illumination (Cool, silvery, desaturated midnight earth)
    vec3 moonDir = normalize(uMoonDirection);
    float moonDiff = max(dot(normal, moonDir), 0.0);
    vec3 moonLight = uMoonColor * (moonDiff * 0.35 + 0.15) * (1.0 - uDaylight);

    // Desaturate and cool-shift soil at night for realistic human eye scotopic vision
    vec3 nightSoil = mix(vec3(dot(soilBase, vec3(0.299, 0.587, 0.114))), soilBase, 0.38);
    nightSoil = mix(nightSoil, vec3(0.035, 0.055, 0.095), 0.42);

    // 7. Slow Atmospheric Cloud Shadows Drift
    vec2 cloudShadowUv = vWorldPosition.xz * 0.007 + vec2(uTime * 0.004, uTime * 0.0015);
    float cloudShadow = smoothstep(-0.1, 0.5, snoise(cloudShadowUv)) * 0.18;
    float shadowFactor = (1.0 - cloudShadow);

    // 8. Final Composite
    vec3 dayColor = (soilBase * sunLight + goldenSunset) * totalAO * shadowFactor;
    vec3 nightColor = (nightSoil * moonLight + soilBase * 0.035) * totalAO;

    vec3 finalColor = mix(nightColor, dayColor, uDaylight);

    // Gentle horizon depth fade
    float depthFade = smoothstep(120.0, 280.0, length(vWorldPosition.xy));
    finalColor = mix(finalColor, finalColor * 0.7, depthFade * 0.4);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
