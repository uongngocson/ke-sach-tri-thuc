/**
 * shaders/moonShaders.js
 * Photorealistic Moon Billboard Shader with Lunar Glow & Atmospheric Halo
 */

export const MoonVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const MoonFragmentShader = `
  uniform sampler2D uMoonTexture;
  uniform float uIntensity;
  uniform float uDaylightFactor;
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 pos = vUv - center;
    float dist = length(pos) * 2.0; // 0 at center, 1.0 at quad boundary

    // 1. Sample real high-res Moon photographic texture
    vec4 texColor = texture2D(uMoonTexture, vUv);
    
    // Moon disk radius in normalized quad space
    float diskRadius = 0.72;

    vec3 moonColor = vec3(0.0);
    float alpha = 0.0;

    // Atmospheric Cold Lunar Halo Colors
    vec3 haloInnerColor = vec3(0.85, 0.92, 1.0);
    vec3 haloOuterColor = vec3(0.35, 0.55, 0.90);

    if (dist <= diskRadius) {
      // Inside Moon disk
      if (texColor.a > 0.05) {
        // Bright silvery-white moon surface
        vec3 surface = texColor.rgb * 1.15 + vec3(0.04);
        
        // Subtle edge atmospheric radiance
        float edge = smoothstep(0.4, diskRadius, dist);
        surface += haloInnerColor * edge * 0.25;

        moonColor = surface;
        alpha = texColor.a;
      }
    } else {
      // Outer Atmospheric Moon Halo
      float haloDist = (dist - diskRadius) / (1.0 - diskRadius);
      float haloFalloff = exp(-haloDist * 3.2) * 0.45;
      
      // Subtle gentle shimmer
      float shimmer = 1.0 + 0.03 * sin(uTime * 0.8 + dist * 10.0);
      
      vec3 halo = mix(haloInnerColor, haloOuterColor, haloDist);
      moonColor = halo * 1.2;
      alpha = clamp(haloFalloff * shimmer, 0.0, 1.0);
    }

    // Modulate by global intensity and day/night visibility (fades out in day)
    float visibility = uIntensity * (1.0 - uDaylightFactor * 0.95);
    float totalAlpha = alpha * visibility;

    if (totalAlpha < 0.005) discard;

    gl_FragColor = vec4(moonColor, totalAlpha);
  }
`;
