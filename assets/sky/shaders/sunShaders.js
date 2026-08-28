/**
 * shaders/sunShaders.js
 * High-Dynamic-Range Solar Disk with Limb Darkening and Multi-layered Corona
 */

export const SunVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SunFragmentShader = `
  uniform float uIntensity;
  uniform float uSunsetFactor;
  uniform float uDaylightFactor;
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 pos = vUv - center;
    float dist = length(pos) * 2.0; // 0 at center, 1.0 at quad boundary

    if (dist > 1.0) discard;

    // Solar disk radius normalized
    float diskRadius = 0.32;
    
    // Core Solar Colors
    vec3 coreColorNoon = vec3(1.0, 0.98, 0.94);
    vec3 coreColorSunset = vec3(1.0, 0.62, 0.22);
    vec3 limbColorSunset = vec3(0.95, 0.28, 0.08);
    vec3 coronaColorNoon = vec3(1.0, 0.92, 0.75);
    vec3 coronaColorSunset = vec3(1.0, 0.45, 0.12);

    vec3 coreColor = mix(coreColorNoon, coreColorSunset, uSunsetFactor);
    vec3 limbColor = mix(vec3(1.0, 0.82, 0.55), limbColorSunset, uSunsetFactor);
    vec3 coronaColor = mix(coronaColorNoon, coronaColorSunset, uSunsetFactor);

    vec3 finalColor = vec3(0.0);
    float alpha = 0.0;

    if (dist < diskRadius) {
      // 1. Solar Disk Core with Photospheric Limb Darkening
      float rNorm = dist / diskRadius;
      float mu = sqrt(max(0.0, 1.0 - rNorm * rNorm));
      // Standard Eddington limb darkening approximation: I(mu)/I(1) = 0.4 + 0.6 * mu
      float limbDarkening = 0.45 + 0.55 * pow(mu, 0.8);
      
      // Core HDR intensity (super bright white center)
      float centerHotness = pow(1.0 - rNorm, 2.5) * 1.8;
      
      vec3 disk = mix(limbColor, coreColor, limbDarkening) + vec3(centerHotness);
      finalColor = disk;
      alpha = 1.0;
    } else {
      // 2. Coronal Glow & Atmospheric Optical Scattering Halo
      float coronaDist = (dist - diskRadius) / (1.0 - diskRadius);
      
      // Inner sharp corona
      float innerCorona = exp(-coronaDist * 6.5) * 0.95;
      
      // Outer diffuse atmospheric glow
      float outerCorona = exp(-coronaDist * 2.2) * 0.45;
      
      // Subtle dynamic ray pulsation
      float angle = atan(pos.y, pos.x);
      float rays = 1.0 + 0.04 * sin(angle * 8.0 + uTime * 0.4) + 0.02 * cos(angle * 14.0 - uTime * 0.6);
      
      float totalCorona = (innerCorona + outerCorona) * rays;
      finalColor = coronaColor * (1.2 + innerCorona * 1.5);
      alpha = clamp(totalCorona, 0.0, 1.0);
    }

    // Modulate by global solar intensity
    float totalAlpha = alpha * uIntensity;
    if (totalAlpha < 0.005) discard;

    gl_FragColor = vec4(finalColor, totalAlpha);
  }
`;
