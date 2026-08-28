/**
 * components/Clouds.js
 * Multi-layer Procedural Volumetric Cloud Dome
 */
import { CloudVertexShader, CloudFragmentShader } from '../shaders/cloudShaders.js';

export class Clouds {
  constructor(THREE) {
    this.THREE = THREE;

    // Cloud hemisphere dome
    const geometry = new THREE.SphereGeometry(920, 32, 24);

    this.material = new THREE.ShaderMaterial({
      vertexShader: CloudVertexShader,
      fragmentShader: CloudFragmentShader,
      uniforms: {
        uSunPosition: { value: new THREE.Vector3(0, 500, -300) },
        uMoonPosition: { value: new THREE.Vector3(0, -500, -300) },
        uDaylightFactor: { value: 1.0 },
        uSunsetFactor: { value: 0.0 },
        uTwilightFactor: { value: 0.0 },
        uTime: { value: 0.0 },
        uCloudCover: { value: 0.45 },
        uCloudDensity: { value: 1.0 }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  update(celestialState, elapsedTime) {
    const { sun, moon, factors } = celestialState;

    this.material.uniforms.uSunPosition.value.set(sun.x, sun.y, sun.z);
    this.material.uniforms.uMoonPosition.value.set(moon.x, moon.y, moon.z);
    this.material.uniforms.uDaylightFactor.value = factors.daylight;
    this.material.uniforms.uSunsetFactor.value = factors.sunset;
    this.material.uniforms.uTwilightFactor.value = factors.twilight;
    this.material.uniforms.uTime.value = elapsedTime;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
