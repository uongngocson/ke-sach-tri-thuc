/**
 * components/Moon.js
 * Photorealistic Moon Celestial Object with Direct High-Res Photographic Texture
 * and Atmospheric Halo Billboard (Proportionately sized for elegance)
 */
import { MoonVertexShader, MoonFragmentShader } from '../shaders/moonShaders.js';

export class Moon {
  constructor(THREE) {
    this.THREE = THREE;

    // Elegant, realistic proportion size
    const size = 115;
    const geometry = new THREE.PlaneGeometry(size, size);

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
      
      // Billboard facing camera directly
      this.mesh.lookAt(camera.position);

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
