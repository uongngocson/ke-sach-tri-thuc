/**
 * components/Moon.js
 * 3D Procedural Moon Sphere with Crater Formations and Phase Shading
 */
import { MoonVertexShader, MoonFragmentShader } from '../shaders/moonShaders.js';

export class Moon {
  constructor(THREE) {
    this.THREE = THREE;

    // 3D Sphere geometry for realistic lighting normals
    const radius = 34;
    const geometry = new THREE.SphereGeometry(radius, 48, 48);

    this.material = new THREE.ShaderMaterial({
      vertexShader: MoonVertexShader,
      fragmentShader: MoonFragmentShader,
      uniforms: {
        uPhase: { value: 0.5 },
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
      
      // Face towards camera, with realistic slight axial tilt
      this.mesh.lookAt(camera.position);
      this.mesh.rotateZ(0.15);

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
