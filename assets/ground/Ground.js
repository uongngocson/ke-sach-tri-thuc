/**
 * assets/ground/Ground.js
 * 3D Procedural Terrain Coordinator for Cáo Sách
 * Seamlessly integrates the High-End Procedural Soil Shader into Three.js
 */
import { groundVertexShader, groundFragmentShader } from './groundShaders.js';

export class Ground {
  constructor(THREE, scene, camera) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;

    // Anchor group
    this.group = new THREE.Group();
    this.group.name = 'GroundTerrain';
    this.scene.add(this.group);

    this.#initMesh();
  }

  #initMesh() {
    const THREE = this.THREE;

    // Create a broad landscape hill geometry
    const width = 850;
    const depth = 650;
    const segX = 96;
    const segY = 72;

    const geometry = new THREE.PlaneGeometry(width, depth, segX, segY);
    geometry.rotateX(-Math.PI / 2);

    // Sculpt natural organic forest mound & gentle undulating terrain
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      
      // Natural gentle dome curve centered at the tree root (flattened for elegant horizon)
      const rX = x * 0.35;
      const rZ = (z + 20.0) * 0.5;
      const distSq = rX * rX + rZ * rZ;
      const slope = distSq * 0.0006;
      
      // Multi-frequency organic earth undulation (gentle and smooth)
      const bump1 = Math.sin(x * 0.028) * Math.cos(z * 0.032) * 1.2;
      const bump2 = Math.sin(x * 0.065 + 1.2) * Math.sin(z * 0.055) * 0.6;
      
      pos.setY(i, -slope + bump1 + bump2);
    }
    geometry.computeVertexNormals();

    // Shader Material with Dynamic Uniforms
    this.material = new THREE.ShaderMaterial({
      vertexShader: groundVertexShader,
      fragmentShader: groundFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uDaylight: { value: 1.0 },
        uSunset: { value: 0.0 },
        uSunDirection: { value: new THREE.Vector3(50, 150, 100).normalize() },
        uMoonDirection: { value: new THREE.Vector3(-50, 120, -100).normalize() },
        uSunColor: { value: new THREE.Color(0xfff5e6) },
        uMoonColor: { value: new THREE.Color(0x94b8e8) },
        uTreeBasePos: { value: new THREE.Vector3(0, -58, -260) }
      },
      depthWrite: true,
      depthTest: true
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    this.updatePosition();
  }

  /**
   * Sync terrain position with tree root height
   */
  updatePosition(treePosY = -58, treePosZ = -260) {
    // Bed the terrain mound right under the root base
    this.group.position.set(0, treePosY - 1.2, treePosZ + 130);
    if (this.material && this.material.uniforms.uTreeBasePos) {
      this.material.uniforms.uTreeBasePos.value.set(0, treePosY, treePosZ);
    }
  }

  /**
   * Animation & Day/Night Celestial Lighting Updater
   */
  update(celestialState, elapsedTime) {
    if (!this.material) return;

    const { factors, sun, moon } = celestialState;
    const uniforms = this.material.uniforms;

    uniforms.uTime.value = elapsedTime;
    uniforms.uDaylight.value = factors.daylight;
    uniforms.uSunset.value = factors.sunset;

    // Sun & Moon Directions
    if (sun) {
      uniforms.uSunDirection.value.set(sun.x, Math.max(10, sun.y), 100).normalize();
      const sunColor = new this.THREE.Color(0xfffaed).lerp(new this.THREE.Color(0xff8a3d), factors.sunset);
      uniforms.uSunColor.value.copy(sunColor);
    }

    if (moon) {
      uniforms.uMoonDirection.value.set(moon.x, Math.max(15, moon.y), 100).normalize();
      uniforms.uMoonColor.value.setHex(0x94b8e8);
    }
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.material.dispose();
      this.group.remove(this.mesh);
    }
    if (this.group) {
      this.scene.remove(this.group);
    }
  }
}
