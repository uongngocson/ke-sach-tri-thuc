import RNG from './rng.js';

export const LeafStyle = {
  Single: 0,
  Double: 1
};

export const LeafType = {
  Ash: 0,
  Aspen: 1,
  Oak: 2,
  Flowers: 3
};

export class Tree {
  constructor(THREE, params) {
    this.THREE = THREE;
    this.params = params;
    this.group = new THREE.Group();
    this.group.name = 'Tree3D_Procedural';

    this.loader = new THREE.TextureLoader();
    this.barkTexture = this.loader.load('./assets/tree/textures/bark/bark.png');
    this.barkTexture.colorSpace = THREE.SRGBColorSpace;
    this.barkTexture.wrapS = THREE.RepeatWrapping;
    this.barkTexture.wrapT = THREE.RepeatWrapping;
    this.barkTexture.generateMipmaps = true;
    this.barkTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.barkTexture.magFilter = THREE.LinearFilter;
    this.barkTexture.anisotropy = 4;

    this.leafTextures = [null, null, null, null];
    // Preload primary Oak texture (index 2)
    const oakTex = this.loader.load('./assets/tree/textures/leaves/oak.png');
    oakTex.colorSpace = THREE.SRGBColorSpace;
    oakTex.generateMipmaps = true;
    oakTex.minFilter = THREE.LinearMipmapLinearFilter;
    oakTex.magFilter = THREE.LinearFilter;
    oakTex.anisotropy = 4;
    this.leafTextures[LeafType.Oak] = oakTex;

    this.branchesMesh = new THREE.Mesh();
    this.leavesMesh = new THREE.Mesh();
    this.group.add(this.branchesMesh);
    this.group.add(this.leavesMesh);

    this.generate();
  }

  /**
   * Generate a new tree geometry & materials
   */
  generate() {
    const THREE = this.THREE;

    this.branches = {
      verts: [],
      normals: [],
      indices: [],
      uvs: []
    };

    this.leaves = {
      verts: [],
      normals: [],
      indices: [],
      uvs: []
    };

    const rng = new RNG(this.params.seed);

    // Create the trunk of the tree
    this.trunk = this.#generateBranch(
      rng,
      new THREE.Vector3(),
      new THREE.Euler(),
      this.params.trunk.length,
      this.params.trunk.radius
    );

    this.#createBranchesGeometry();
    this.#createLeavesGeometry();
  }

  /**
   * Generates the geometry for the branches
   */
  #createBranchesGeometry() {
    const THREE = this.THREE;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.branches.verts), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.branches.normals), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.branches.uvs), 2));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(this.branches.indices), 1));
    g.computeBoundingSphere();

    const mat = new THREE.MeshLambertMaterial({
      name: 'branches',
      flatShading: this.params.trunk.flatShading,
      color: this.params.trunk.color
    });

    if (this.params.trunk.textured) {
      mat.map = this.barkTexture;
    }

    if (this.branchesMesh.geometry) this.branchesMesh.geometry.dispose();
    this.branchesMesh.geometry = g;
    if (this.branchesMesh.material) this.branchesMesh.material.dispose();
    this.branchesMesh.material = mat;
    this.branchesMesh.castShadow = true;
    this.branchesMesh.receiveShadow = true;
  }

  /**
   * Generates the geometry for the leaves
   */
  #createLeavesGeometry() {
    const THREE = this.THREE;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.leaves.verts), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.leaves.uvs), 2));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(this.leaves.indices), 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();

    const mat = new THREE.MeshLambertMaterial({
      name: 'leaves',
      color: this.params.leaves.color,
      emissive: new THREE.Color(this.params.leaves.color).multiplyScalar(this.params.leaves.emissive || 0.05),
      opacity: this.params.leaves.opacity,
      alphaTest: this.params.leaves.alphaTest || 0.35,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide
    });

    let leafTex = this.leafTextures[this.params.leaves.type];
    if (!leafTex) {
      const paths = [
        './assets/tree/textures/leaves/ash.png',
        './assets/tree/textures/leaves/aspen.png',
        './assets/tree/textures/leaves/oak.png',
        './assets/tree/textures/leaves/flowers.png'
      ];
      const p = paths[this.params.leaves.type];
      if (p) {
        leafTex = this.loader.load(p);
        leafTex.colorSpace = THREE.SRGBColorSpace;
        leafTex.generateMipmaps = true;
        leafTex.minFilter = THREE.LinearMipmapLinearFilter;
        leafTex.magFilter = THREE.LinearFilter;
        leafTex.anisotropy = 4;
        this.leafTextures[this.params.leaves.type] = leafTex;
      }
    }
    if (leafTex) {
      mat.map = leafTex;
    }

    if (this.leavesMesh.geometry) this.leavesMesh.geometry.dispose();
    this.leavesMesh.geometry = g;
    if (this.leavesMesh.material) this.leavesMesh.material.dispose();
    this.leavesMesh.material = mat;
    this.leavesMesh.castShadow = true;
    this.leavesMesh.receiveShadow = true;
  }

  /**
   * Generates a branch
   */
  #generateBranch(rng, origin, orientation, length, radius, level = 1) {
    const THREE = this.THREE;
    const indexOffset = this.branches.verts.length / 3;

    let sectionOrigin = origin.clone();
    let sectionOrientation = orientation.clone();
    let sectionRadius = radius;

    const sections = [];

    for (let i = 0; i <= this.params.geometry.sections; i++) {
      let sectionRadius = radius * (1 - this.params.branch.taper * (i / this.params.geometry.sections));

      if (level === 1) {
        sectionRadius *= (1 + this.params.trunk.flare * Math.pow(1 - (i / this.params.geometry.sections), 4));
      }

      sectionRadius *= (1 + rng.random(this.params.geometry.radiusVariance, -this.params.geometry.radiusVariance));
      sectionRadius *= Math.min(1.0, (this.params.maturity));

      let first = {};

      for (let j = 0; j < this.params.geometry.segments; j++) {
        let angle = (2 * Math.PI * j) / this.params.geometry.segments;

        let vertex = new THREE.Vector3(
          sectionRadius * Math.cos(angle),
          0,
          sectionRadius * Math.sin(angle)
        );

        vertex.add(new THREE.Vector3(
          rng.random(this.params.geometry.randomization, -this.params.geometry.randomization),
          0,
          rng.random(this.params.geometry.randomization, -this.params.geometry.randomization)
        ));

        let normal = vertex.clone().normalize();
        vertex.applyEuler(sectionOrientation).add(sectionOrigin);
        normal.applyEuler(sectionOrientation);

        let uv = new THREE.Vector2(
          j / this.params.geometry.segments,
          (i / this.params.geometry.sections) * (length / 5)
        );

        this.branches.verts.push(...Object.values(vertex));
        this.branches.normals.push(...Object.values(normal));
        this.branches.uvs.push(...Object.values(uv));

        if (j === 0) {
          first = { vertex, normal, uv };
        }
      }

      this.branches.verts.push(...Object.values(first.vertex));
      this.branches.normals.push(...Object.values(first.normal));
      this.branches.uvs.push(1, first.uv.y);

      sections.push({
        origin: sectionOrigin.clone(),
        orientation: sectionOrientation.clone(),
        radius: sectionRadius
      });

      let sectionLength = (length / this.params.geometry.sections) *
        (1 + rng.random(this.params.geometry.lengthVariance, -this.params.geometry.lengthVariance));
      sectionLength *= Math.min(1.0, sectionLength * (this.params.maturity));

      if (level > 1 && i < this.params.geometry.sections - 1) {
        sectionLength = sectionLength * Math.max(0.4, this.params.maturity);
      }

      sectionOrigin.add(new THREE.Vector3(0, sectionLength, 0).applyEuler(sectionOrientation));

      const gnarliness = this.params.maturity * (this.params.branch.gnarliness + this.params.branch.gnarliness1_R / Math.max(0.001, sectionRadius));
      sectionOrientation.x += rng.random(gnarliness, -gnarliness);
      sectionOrientation.z += rng.random(gnarliness, -gnarliness);

      const qSection = new THREE.Quaternion().setFromEuler(sectionOrientation);
      const qTwist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.params.branch.twist || 0);
      const qForce = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.params.sun.direction);
      qSection.multiply(qTwist);
      qSection.rotateTowards(qForce, (this.params.sun.strength || 0) / Math.max(0.001, sectionRadius));
      sectionOrientation.setFromQuaternion(qSection);
    }

    this.#generateChildBranches(rng, level, sections, length);
    this.#generateBranchIndices(indexOffset);
  }

  /**
   * Generates leaves
   */
  #generateLeaf(rng, origin, orientation, rotate90 = false) {
    const THREE = this.THREE;
    const i = this.leaves.verts.length / 3;

    let leafSize = this.params.leaves.size *
      (1 + rng.random(this.params.leaves.sizeVariance, -this.params.leaves.sizeVariance));
    leafSize = leafSize * Math.max(0.35, this.params.maturity);

    const W = leafSize;
    const L = 1.5 * leafSize;

    const localRotation = new THREE.Euler(0, rotate90 ? Math.PI / 2 : 0, 0);

    const v = [
      new THREE.Vector3(-W / 2, L, 0),
      new THREE.Vector3(-W / 2, 0, 0),
      new THREE.Vector3(W / 2, 0, 0),
      new THREE.Vector3(W / 2, L, 0)
    ].map(v => v.applyEuler(localRotation).applyEuler(orientation).add(origin));

    this.leaves.verts.push(
      v[0].x, v[0].y, v[0].z,
      v[1].x, v[1].y, v[1].z,
      v[2].x, v[2].y, v[2].z,
      v[3].x, v[3].y, v[3].z
    );

    const n = new THREE.Vector3(0, 0, 1).applyEuler(orientation);
    this.leaves.normals.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z);
    this.leaves.uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
    this.leaves.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /**
   * Spawns child branches from parent sections
   */
  #generateChildBranches(rng, level, sections, parentLength) {
    const THREE = this.THREE;
    if (level > this.params.branch.levels) return;

    const minBranches = (level === this.params.branch.levels) ? this.params.leaves.minCount : this.params.branch.minChildren;
    const maxBranches = (level === this.params.branch.levels) ? this.params.leaves.maxCount : this.params.branch.maxChildren;
    const childBranchCount = Math.round(rng.random() * (maxBranches - minBranches)) + minBranches;

    const branchSepAngle = this.params.branch.sweepAngle / Math.max(1, childBranchCount - 1);

    for (let i = 0; i < childBranchCount; i++) {
      let sectionIndex = 0;
      if (i < childBranchCount - 1) {
        let startIndex = this.params.geometry.sections * this.params.branch.start;
        let endIndex = this.params.geometry.sections * this.params.branch.stop;
        sectionIndex = Math.floor(rng.random() * (endIndex - startIndex) + startIndex);
      } else {
        sectionIndex = sections.length - 1;
      }

      let section = sections[Math.min(sections.length - 1, Math.max(0, sectionIndex))];
      if (!section) continue;

      const offset = rng.random(2 * Math.PI);
      let childBranchRadius = section.radius;
      if (i < childBranchCount - 1) {
        const r1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.params.maturity * this.params.branch.sweepAngle / 2, 0, 0));
        const r2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, offset + i * branchSepAngle, 0));
        const r3 = new THREE.Quaternion().setFromEuler(section.orientation);

        section.orientation = new THREE.Euler().setFromQuaternion(r3.multiply(r2.multiply(r1)));
        childBranchRadius *= this.params.branch.radiusMultiplier;
      }

      let childBranchLength = parentLength * (this.params.branch.lengthMultiplier +
        rng.random(this.params.branch.lengthVariance, -this.params.branch.lengthVariance));

      if (level === this.params.branch.levels) {
        this.#generateLeaf(
          rng,
          section.origin,
          section.orientation.clone()
        );

        if (this.params.leaves.style === LeafStyle.Double) {
          this.#generateLeaf(
            rng,
            section.origin,
            section.orientation.clone(),
            true
          );
        }
      } else {
        this.#generateBranch(
          rng,
          section.origin,
          section.orientation.clone(),
          childBranchLength,
          childBranchRadius,
          level + 1
        );
      }
    }
  }

  /**
   * Generates branch quad indices
   */
  #generateBranchIndices(indexOffset) {
    let v1, v2, v3, v4;
    const N = this.params.geometry.segments + 1;
    for (let i = 0; i < this.params.geometry.sections; i++) {
      for (let j = 0; j < this.params.geometry.segments; j++) {
        v1 = indexOffset + (i * N) + j;
        v2 = indexOffset + (i * N) + (j + 1);
        v3 = v1 + N;
        v4 = v2 + N;
        this.branches.indices.push(v1, v3, v2, v2, v3, v4);
      }
    }
  }

  dispose() {
    if (this.branchesMesh.geometry) this.branchesMesh.geometry.dispose();
    if (this.branchesMesh.material) this.branchesMesh.material.dispose();
    if (this.leavesMesh.geometry) this.leavesMesh.geometry.dispose();
    if (this.leavesMesh.material) this.leavesMesh.material.dispose();
  }
}
