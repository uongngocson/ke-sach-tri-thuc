/**
 * components/Stars.js
 * Realistic Night Sky Star Dome with Spectral Colors and Scintillation
 */
import { StarVertexShader, StarFragmentShader } from '../shaders/starShaders.js';

export class Stars {
  constructor(THREE, quality) {
    this.THREE = THREE;
    const count = quality.starCount || 800;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinkleSpeeds = new Float32Array(count);
    const twinklePhases = new Float32Array(count);

    // Spectral stellar color palette (O, B, A, F, G, K, M)
    const spectralColors = [
      new THREE.Color(0.85, 0.92, 1.0), // Blue-white
      new THREE.Color(0.95, 0.98, 1.0), // White
      new THREE.Color(1.0, 0.98, 0.90), // Pale yellow
      new THREE.Color(1.0, 0.88, 0.72), // Amber
      new THREE.Color(1.0, 0.75, 0.65), // Warm orange
      new THREE.Color(0.78, 0.88, 1.0)  // Cyan-white
    ];

    const radius = 960;

    for (let i = 0; i < count; i++) {
      // Distribute stars on upper hemisphere with realistic concentration
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.1 + Math.random() * 0.9); // Mostly above horizon

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Magnitude distribution (many dim stars, few bright ones)
      const r = Math.random();
      let size = 1.2;
      if (r > 0.96) size = 3.5;       // Brightest navigational stars
      else if (r > 0.82) size = 2.4;  // Major constellation stars
      else if (r > 0.50) size = 1.6;  // Medium stars
      else size = 0.9 + Math.random() * 0.5; // Faint background stars

      sizes[i] = size;

      // Pick spectral color
      const col = spectralColors[Math.floor(Math.random() * spectralColors.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      // Individual twinkle oscillation
      twinkleSpeeds[i] = 1.5 + Math.random() * 3.5;
      twinklePhases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
    geometry.setAttribute('aTwinklePhase', new THREE.BufferAttribute(twinklePhases, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: StarVertexShader,
      fragmentShader: StarFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uVisibility: { value: 0.0 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geometry, this.material);
  }

  update(celestialState, elapsedTime) {
    const { factors } = celestialState;
    this.material.uniforms.uTime.value = elapsedTime;
    this.material.uniforms.uVisibility.value = factors.stars;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
