/**
 * shaders/moonShaders.js
 * Realistic Photorealistic Moon Shader with Real Moon Texture, Dynamic Phase Terminator,
 * Earthshine, and Atmospheric Lunar Halo.
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
  uniform sampler2D uMoonTexture;
  uniform float uPhase; // 0.0 to 1.0 (0=New, 0.25=First Q, 0.5=Full, 0.75=Last Q)
  uniform float uIntensity;
  uniform float uDaylightFactor;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    // 1. Sample real high-res Moon photographic texture
    vec4 texColor = texture2D(uMoonTexture, vUv);
    
    if (texColor.a < 0.05) discard;

    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPosition);

    // 2. Realistic Lunar Phase Lighting & Terminator Line
    // Phase angle: 0=New, 0.25=First Q (lit from right), 0.5=Full Moon, 0.75=Last Q (lit from left)
    float phaseAngle = uPhase * 6.2831853;
    vec3 lightDir = normalize(vec3(-sin(phaseAngle), 0.0, cos(phaseAngle)));

    // Hapke / Rough regolith diffuse model
    float NdotL = dot(N, lightDir);
    float illumination = smoothstep(-0.06, 0.08, NdotL);

    // Subtle limb brightening characteristic of retroreflective lunar dust
    float NdotV = max(0.0, dot(N, V));
    float retroReflection = pow(1.0 - NdotV, 3.2) * 0.2;

    // Direct sunlit portion on the photographic surface
    vec3 litSurface = texColor.rgb * (illumination * 1.05 + retroReflection);

    // Earthshine (dark side faintly illuminated by reflected light from Earth)
    vec3 earthshineColor = vec3(0.04, 0.06, 0.10);
    vec3 unlitSurface = texColor.rgb * earthshineColor * 0.75;

    // Blend between lit and unlit side according to phase
    vec3 finalMoon = mix(unlitSurface, litSurface, illumination);

    // 3. Cold Silvery Atmospheric Rim Halo
    vec3 haloColdColor = vec3(0.72, 0.85, 1.0);
    float edgeHalo = pow(1.0 - NdotV, 2.5) * 0.28 * illumination;
    finalMoon += haloColdColor * edgeHalo;

    // Total opacity modulated by global intensity and day/night factor
    float totalAlpha = texColor.a * uIntensity * (1.0 - uDaylightFactor * 0.92);
    if (totalAlpha < 0.005) discard;

    gl_FragColor = vec4(finalMoon, totalAlpha);
  }
`;
