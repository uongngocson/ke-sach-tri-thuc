/**
 * components/Atmosphere.js
 * Atmospheric Sky Dome Mesh & Material Controller
 */
import { AtmosphereVertexShader, AtmosphereFragmentShader } from '../shaders/atmosphereShaders.js';

export class Atmosphere {
  constructor(THREE) {
    this.THREE = THREE;
    
    // Large hemisphere dome
    const geometry = new THREE.SphereGeometry(1000, 32, 24);
    
    this.material = new THREE.ShaderMaterial({
      vertexShader: AtmosphereVertexShader,
      fragmentShader: AtmosphereFragmentShader,
      uniforms: {
        uSunPosition: { value: new THREE.Vector3(0, 500, -300) },
        uMoonPosition: { value: new THREE.Vector3(0, -500, -300) },
        uDaylightFactor: { value: 1.0 },
        uSunsetFactor: { value: 0.0 },
        uTwilightFactor: { value: 0.0 },
        uTime: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
      },
      side: THREE.BackSide,
      depthWrite: false
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

  onResize(width, height) {
    this.material.uniforms.uResolution.value.set(width, height);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
