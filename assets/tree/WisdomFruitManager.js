/**
 * assets/tree/WisdomFruitManager.js
 * Master 3D Botanical Fruit Coordinator
 * 100% Dynamically Anchored to REAL Procedural 3D Branch & Leaf Joints for EVERY Growth Stage
 */
import { MockDataStore } from '../data/MockDataStore.js';

export class WisdomFruitManager {
  constructor(THREE, scene, camera, treeAnchor, treeManager) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;
    this.treeAnchor = treeAnchor;
    this.treeManager = treeManager;

    // Independent fruit group for each of the 8 teams
    this.teamFruitGroups = new Map();
    for (let teamId = 1; teamId <= 8; teamId++) {
      const group = new THREE.Group();
      group.name = `WisdomFruitGroup_Team_${teamId}`;
      const anchor = this.treeManager?.teamAnchors ? this.treeManager.teamAnchors[teamId - 1] : null;
      if (anchor) {
        anchor.add(group);
      }
      this.teamFruitGroups.set(teamId, group);
    }

    this.fruitGroup = this.teamFruitGroups.get(1); // Alias for compatibility

    this.fruits = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.hoveredFruit = null;
    this.currentLevel = 0;

    // 1. Organic Anatomical Geometries
    this.fruitGeometry = this.createOrganicFruitGeometry();
    this.leafGeometry = this.createMiniLeafGeometry();
    this.stemGeometry = this.createCurvedStemGeometry();

    // 2. Photorealistic Organic Materials
    this.materials = [
      new THREE.MeshPhysicalMaterial({
        color: 0x991b1b, // Ripe Apple
        emissive: 0x3f0708,
        emissiveIntensity: 0.15,
        roughness: 0.32,
        metalness: 0.02,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        reflectivity: 0.5
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0xc2410c, // Persimmon
        emissive: 0x431407,
        emissiveIntensity: 0.15,
        roughness: 0.35,
        metalness: 0.02,
        clearcoat: 0.55,
        clearcoatRoughness: 0.28,
        reflectivity: 0.5
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0x65a30d, // Orchard Olive Green
        emissive: 0x1a2e05,
        emissiveIntensity: 0.12,
        roughness: 0.38,
        metalness: 0.02,
        clearcoat: 0.5,
        clearcoatRoughness: 0.3,
        reflectivity: 0.45
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0xd97706, // Amber Pear
        emissive: 0x451a03,
        emissiveIntensity: 0.15,
        roughness: 0.34,
        metalness: 0.02,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        reflectivity: 0.5
      })
    ];

    this.stemMaterial = new THREE.MeshStandardMaterial({
      color: 0x3e2716,
      roughness: 0.9,
      metalness: 0.0
    });

    this.leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    this.initInteraction();
    this.bindDataStoreEvents();
  }

  createOrganicFruitGeometry() {
    const THREE = this.THREE;
    const points = [];
    points.push(new THREE.Vector2(0.01, -0.65));
    points.push(new THREE.Vector2(0.25, -0.58));
    points.push(new THREE.Vector2(0.48, -0.42));
    points.push(new THREE.Vector2(0.62, -0.15));
    points.push(new THREE.Vector2(0.60, 0.15));
    points.push(new THREE.Vector2(0.45, 0.38));
    points.push(new THREE.Vector2(0.22, 0.48));
    points.push(new THREE.Vector2(0.06, 0.42));
    points.push(new THREE.Vector2(0.02, 0.40));

    const geo = new THREE.LatheGeometry(points, 24);
    geo.computeVertexNormals();
    return geo;
  }

  createCurvedStemGeometry() {
    const THREE = this.THREE;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.40, 0),
      new THREE.Vector3(0.05, 0.60, 0.02),
      new THREE.Vector3(0.08, 0.85, 0.08),
      new THREE.Vector3(0.04, 1.05, 0.12)
    ]);
    return new THREE.TubeGeometry(curve, 12, 0.035, 6, false);
  }

  createMiniLeafGeometry() {
    const THREE = this.THREE;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.18, 0.18, 0.22, 0.42);
    shape.quadraticCurveTo(0.06, 0.35, 0, 0.55);
    shape.quadraticCurveTo(-0.06, 0.35, -0.22, 0.42);
    shape.quadraticCurveTo(-0.18, 0.18, 0, 0);

    const geo = new THREE.ShapeGeometry(shape);
    geo.scale(0.55, 0.55, 0.55);
    return geo;
  }

  bindDataStoreEvents() {
    MockDataStore.subscribe('growth:updated', (growth) => {
      if (growth && growth.teamId) {
        this.syncTeamFruits(growth.teamId);
      } else {
        this.syncAllTeamFruits();
      }
    });

    MockDataStore.getCommunityGrowth().then(() => {
      this.syncAllTeamFruits();
    });
  }

  updateLevel(level) {
    this.currentLevel = level;
    this.syncAllTeamFruits();
  }

  setParentAnchor(anchor) {
    // Keep all team fruit groups firmly attached to their corresponding team anchors
    this.ensureTeamFruitGroupsAttached();
  }

  ensureTeamFruitGroupsAttached() {
    if (!this.treeManager?.teamAnchors) return;
    for (let teamId = 1; teamId <= 8; teamId++) {
      const anchor = this.treeManager.teamAnchors[teamId - 1];
      let group = this.teamFruitGroups.get(teamId);
      if (!group) {
        group = new this.THREE.Group();
        group.name = `WisdomFruitGroup_Team_${teamId}`;
        this.teamFruitGroups.set(teamId, group);
      }
      if (anchor && group.parent !== anchor) {
        anchor.add(group);
      }
    }
  }

  /**
   * Synchronize fruit cluster for a specific team tree
   * Condition: Team tree MUST reach Level 5 (Ancient Tree)
   */
  syncTeamFruits(teamId) {
    if (!teamId || teamId < 1 || teamId > 8) return;
    const idx = teamId - 1;

    this.ensureTeamFruitGroupsAttached();
    const group = this.teamFruitGroups.get(teamId);
    if (!group) return;

    // Clear existing fruits for this team
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
    }
    this.fruits = this.fruits.filter(f => f.userData.teamId !== teamId);

    // Check Level 5 qualification:
    const teamState = this.treeManager?.teamStates && this.treeManager.teamStates[idx];
    const level = (teamState && typeof teamState.level === 'number') ? teamState.level : 0;
    const totalEXP = (teamState && typeof teamState.totalEXP === 'number') ? teamState.totalEXP : 0;

    // Requirement: "nếu cây nào của team nào đạt LV5 thì đều hiển thị quả như ảnh trên hiện tại"
    const isLevel5 = (level >= 5) || (totalEXP >= 2500);
    if (!isLevel5) {
      return; // Tree with Level < 5 bears 0 fruits!
    }

    const currentTree = this.treeManager?.teamTrees && this.treeManager.teamTrees[idx];
    if (!currentTree || !currentTree.leafClusterOrigins || currentTree.leafClusterOrigins.length === 0) {
      return;
    }

    const availableNodes = currentTree.leafClusterOrigins;
    // 36 abundant ripe fruits lavishly bearing on Ancient Sage Tree canopy
    const targetCount = 36;
    const step = Math.max(1, Math.floor(availableNodes.length / targetCount));
    const THREE = this.THREE;

    for (let i = 0; i < targetCount; i++) {
      const nodeIndex = (i * step + (i % 3)) % availableNodes.length;
      const node = availableNodes[nodeIndex];
      if (!node) continue;

      const fruitAssembly = new THREE.Group();

      // Position fruit stem exactly at the real branch section origin, hanging naturally below foliage
      fruitAssembly.position.copy(node.origin);
      fruitAssembly.position.y -= (0.55 + (i % 4) * 0.08);
      fruitAssembly.position.x += ((i % 5) - 2) * 0.12;
      fruitAssembly.position.z += (((i * 3) % 5) - 2) * 0.12;

      // 1. Organic Fruit Mesh with rich ripe colors
      const mat = this.materials[(i + teamId) % this.materials.length];
      const fruitMesh = new THREE.Mesh(this.fruitGeometry, mat);
      fruitMesh.castShadow = true;
      fruitMesh.receiveShadow = true;

      // 2. Curved Stem
      const stemMesh = new THREE.Mesh(this.stemGeometry, this.stemMaterial);
      stemMesh.castShadow = true;

      // 3. Mini Leaflet
      const leafMesh = new THREE.Mesh(this.leafGeometry, this.leafMaterial);
      leafMesh.position.set(0.06, 0.75, 0.05);
      leafMesh.rotation.set(0.4, (i * 1.5), -0.6);

      fruitAssembly.add(fruitMesh);
      fruitAssembly.add(stemMesh);
      fruitAssembly.add(leafMesh);

      // Natural organic size variations
      const naturalVariance = 0.85 + (i % 5) * 0.1;
      const fruitScale = 1.15 * naturalVariance;
      fruitAssembly.scale.setScalar(fruitScale);
      fruitAssembly.rotation.y = (i * 1.15);

      fruitAssembly.userData = {
        id: `fruit-team${teamId}-${i}`,
        teamId: teamId,
        baseScale: fruitScale,
        swaySpeed: 0.9 + (i % 3) * 0.2,
        swayPhase: (i * 1.7) + teamId * 0.5,
        mesh: fruitMesh,
        mat: mat,
        isHarvested: false,
        respawnTimer: 0
      };

      this.fruits.push(fruitAssembly);
      group.add(fruitAssembly);
    }
  }

  /**
   * Synchronize fruits across all 8 team trees
   */
  syncAllTeamFruits() {
    for (let tId = 1; tId <= 8; tId++) {
      this.syncTeamFruits(tId);
    }
  }

  syncWithTreeGeometry() {
    this.syncAllTeamFruits();
  }

  initInteraction() {
    const onPointerMove = (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.checkHover();
    };

    const onClick = (e) => {
      if (e.target.closest && (e.target.closest('#book-quote-card') || e.target.closest('#contribute-book-card') || e.target.closest('#rules-card') || e.target.closest('#welcome-slogan-card') || e.target.closest('header') || e.target.closest('aside'))) {
        return;
      }
      this.checkClick(e);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('click', onClick);
  }

  checkHover() {
    if (!this.camera || this.fruits.length === 0) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const hitTargets = [];
    this.fruits.forEach(f => {
      if (!f.userData.isHarvested) {
        hitTargets.push(f.userData.mesh);
      }
    });

    const intersects = this.raycaster.intersectObjects(hitTargets, false);
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const hitFruit = this.fruits.find(f => f.userData.mesh === hitMesh);

      if (hitFruit && this.hoveredFruit !== hitFruit) {
        this.hoveredFruit = hitFruit;
        document.body.style.cursor = 'pointer';
      }
    } else {
      if (this.hoveredFruit) {
        this.hoveredFruit = null;
        document.body.style.cursor = '';
      }
    }
  }

  async checkClick(e) {
    if (!this.camera || this.fruits.length === 0) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const hitTargets = [];
    this.fruits.forEach(f => {
      if (!f.userData.isHarvested) {
        hitTargets.push(f.userData.mesh);
      }
    });

    const intersects = this.raycaster.intersectObjects(hitTargets, false);
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const hitFruit = this.fruits.find(f => f.userData.mesh === hitMesh);

      if (hitFruit && !hitFruit.userData.isHarvested) {
        this.harvestFruit(hitFruit, e);
      }
    }
  }

  async harvestFruit(fruit, e) {
    fruit.userData.isHarvested = true;
    fruit.visible = false;

    const teamId = fruit.userData.teamId || (this.treeManager?.activeTeamId || 1);
    const allTeams = (window.getAllTeams && window.getAllTeams()) || [];
    const teamObj = allTeams.find(t => t.id === teamId) || { short_name: `Đội ${teamId}`, display_name: `Đội ${teamId}`, color_code: '#0054A6' };
    const teamName = teamObj.short_name || `Đội ${teamId}`;

    if (window.showToast) {
      window.showToast(`🍎 Bạn đã hái 1 Trái Tri Thức của ${teamName} (+5 EXP)!`);
    }

    await MockDataStore.addEXP(5);

    // Requirement: "click vào quả thì hiển thị modal 1 câu quote của cây đó"
    let selectedQuote = null;
    try {
      const quotes = await MockDataStore.getMasterQuotes(true);
      const teamQuotes = (quotes || []).filter(q => Number(q.team_id) === Number(teamId));
      if (teamQuotes.length > 0) {
        selectedQuote = teamQuotes[Math.floor(Math.random() * teamQuotes.length)];
      }
    } catch (err) {
      console.warn('Failed to load team quotes:', err);
    }

    // Fallback inspiring wisdom quote attributed directly to this team
    if (!selectedQuote) {
      selectedQuote = {
        id: `fruit_quote_${teamId}_${Date.now()}`,
        book: 'Đại Cổ Thụ Tri Thức',
        author: teamObj.display_name || teamName,
        quote: `Trái ngọt tri thức đơm hoa kết trái từ nỗ lực gieo mầm đọc sách của ${teamObj.display_name || teamName}!`,
        reader: teamName,
        team_id: teamId,
        team_name: teamObj.display_name || teamName,
        team_short_name: teamName,
        team_color: teamObj.color_code || '#0054A6',
        category: 'Trí Tuệ',
        likes: 25
      };
    }

    if (window.openBookQuoteModal) {
      window.openBookQuoteModal(selectedQuote);
    } else if (window.openQuoteModal) {
      window.openQuoteModal(selectedQuote);
    }

    fruit.userData.respawnTimer = 30;
  }

  update(elapsedTime, delta, daylightFactor = 1.0) {
    // Periodic synchronization check: ensure any qualified Level 5 team with 0 fruits syncs when tree mesh finishes loading
    this._lastCheck = this._lastCheck || 0;
    if (elapsedTime - this._lastCheck > 1.5) {
      this._lastCheck = elapsedTime;
      for (let tId = 1; tId <= 8; tId++) {
        const tState = this.treeManager?.teamStates && this.treeManager.teamStates[tId - 1];
        const isQualified = (tState?.level >= 5) || (tState?.totalEXP >= 2500);
        const group = this.teamFruitGroups?.get(tId);
        if (isQualified && (!group || group.children.length === 0)) {
          this.syncTeamFruits(tId);
        }
      }
    }

    for (let i = 0; i < this.fruits.length; i++) {
      const f = this.fruits[i];
      const data = f.userData;

      if (data.isHarvested) {
        data.respawnTimer -= delta;
        if (data.respawnTimer <= 0) {
          data.isHarvested = false;
          f.visible = true;
          f.scale.setScalar(0.05);
        }
        continue;
      }

      if (f.scale.x < data.baseScale) {
        f.scale.addScalar(delta * 0.8);
      }

      // Natural Pendulum Sway Physics
      const swayX = Math.sin(elapsedTime * data.swaySpeed + data.swayPhase) * 0.08;
      const swayZ = Math.cos(elapsedTime * (data.swaySpeed * 0.75) + data.swayPhase) * 0.06;
      f.rotation.x = swayX;
      f.rotation.z = swayZ;

      // Subtle Hover Response
      const isHovered = (this.hoveredFruit === f);
      const targetScale = isHovered ? (data.baseScale * 1.15) : data.baseScale;
      f.scale.lerp(new this.THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      data.mat.clearcoatRoughness = isHovered ? 0.15 : 0.25;
    }
  }

  dispose() {
    this.teamFruitGroups.forEach((group) => {
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
    });
    this.fruits = [];
    if (this.fruitGeometry) this.fruitGeometry.dispose();
    if (this.stemGeometry) this.stemGeometry.dispose();
    if (this.leafGeometry) this.leafGeometry.dispose();
  }
}
