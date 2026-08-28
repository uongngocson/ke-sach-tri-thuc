/**
 * components/Moon.js
 * Photorealistic Moon Celestial Object with High-Res Texture, Dynamic Phase Terminator,
 * Earthshine, and Cold Atmospheric Glow
 */
import { MoonVertexShader, MoonFragmentShader } from '../shaders/moonShaders.js';

export class Moon {
  constructor(THREE) {
    this.THREE = THREE;

    // Sized for majestic presence in night sky
    const radius = 38;
    const geometry = new THREE.SphereGeometry(radius, 48, 48);

    // Texture Loader
    const textureLoader = new THREE.TextureLoader();
    const moonTexture = textureLoader.load('./assets/sky/moon.png');
    moonTexture.generateMipmaps = true;
    moonTexture.minFilter = THREE.LinearMipmapLinearFilter;

    this.material = new THREE.ShaderMaterial({
      vertexShader: MoonVertexShader,
      fragmentShader: MoonFragmentShader,
      uniforms: {
        uMoonTexture: { value: moonTexture },
        uPhase: { value: 0.5 }, // 0.5 = Full Moon
        uIntensity: { value: 1.0 },
        uDaylightFactor: { value: 0.0 },
        uTime: { value: 0.0 }
      },
      transparent: true,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.set(0, 180, -500);
    this.mesh.renderOrder = 2;
  }

  update(celestialState, elapsedTime, camera) {
    const { moon, factors } = celestialState;

    if (moon.visible && factors.daylight < 0.95) {
      this.mesh.visible = true;
      this.mesh.position.set(moon.x, moon.y, moon.z);
      
      // Face towards camera, with slight realistic orientation
      this.mesh.lookAt(camera.position);
      this.mesh.rotateY(Math.PI); // Align texture front-facing
      this.mesh.rotateZ(-0.08);   // Realistic lunar axial tilt

      this.material.uniforms.uPhase.value = moon.phase.value;
      this.material.uniforms.uIntensity.value = moon.intensity;
      this.material.uniforms.uDaylightFactor.value = factors.daylight;
      this.material.uniforms.uTime.value = elapsedTime;
    } else {
      this.mesh.visible = false;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
