/**
 * shaders/starShaders.js
 * High-precision Star Field shader with spectral stellar colors and organic scintillation
 */

export const StarVertexShader = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aTwinkleSpeed;
  attribute float aTwinklePhase;

  uniform float uTime;
  uniform float uVisibility; // 0.0 to 1.0

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;

    // Organic scintillation (twinkle) using smooth multi-frequency harmonic
    float t = uTime * aTwinkleSpeed + aTwinklePhase;
    float twinkle = 0.75 + 0.25 * sin(t) * cos(t * 0.7 + 1.2);
    
    vAlpha = twinkle * uVisibility;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (350.0 / -mvPosition.z) * (0.8 + 0.2 * twinkle);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const StarFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.005) discard;

    // Circular Gaussian point spread function
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord) * 2.0; // 0 to 1

    if (dist > 1.0) discard;

    // Soft Gaussian core + gentle stellar diffraction flare
    float core = exp(-dist * dist * 4.0);
    float halo = exp(-dist * 2.0) * 0.35;
    float intensity = (core + halo) * vAlpha;

    gl_FragColor = vec4(vColor, intensity);
  }
`;
