/**
 * components/Sun.js
 * Volumetric Solar Celestial Object with Limb Darkening and HDR Corona
 */
import { SunVertexShader, SunFragmentShader } from '../shaders/sunShaders.js';

export class Sun {
  constructor(THREE) {
    this.THREE = THREE;

    // Billboard quad for sun disk & optical corona (large, impactful, realistic)
    const size = 280;
    const geometry = new THREE.PlaneGeometry(size, size);

    this.material = new THREE.ShaderMaterial({
      vertexShader: SunVertexShader,
      fragmentShader: SunFragmentShader,
      uniforms: {
        uIntensity: { value: 1.0 },
        uSunsetFactor: { value: 0.0 },
        uDaylightFactor: { value: 1.0 },
        uTime: { value: 0.0 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.set(0, 180, -500);
    this.mesh.renderOrder = 2;
  }

  update(celestialState, elapsedTime, camera) {
    const { sun, factors } = celestialState;
    
    if (sun.visible && sun.intensity > 0.01) {
      this.mesh.visible = true;
      this.mesh.position.set(sun.x, sun.y, sun.z);
      // Billboard facing camera
      this.mesh.lookAt(camera.position);

      this.material.uniforms.uIntensity.value = sun.intensity;
      this.material.uniforms.uSunsetFactor.value = factors.sunset;
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
