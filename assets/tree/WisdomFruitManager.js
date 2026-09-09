/**
 * assets/tree/WisdomFruitManager.js
 * Master 3D Botanical Fruit Coordinator
 * 100% Dynamically Anchored to REAL Procedural 3D Branch & Leaf Joints for EVERY Growth Stage
 */
import { MockDataStore } from '../data/MockDataStore.js?v=20260907_v3';

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
    this.serverHarvestedStatus = {};

    // Synchronize harvest status from backend database (anti-spam, cross-browser consistency)
    this.syncServerHarvestStatus();
    if (typeof window !== 'undefined') {
      window.addEventListener('user:logged_in', () => this.syncServerHarvestStatus());
      window.addEventListener('user:logged_out', () => this.syncServerHarvestStatus());
      window.addEventListener('user:session_changed', () => this.syncServerHarvestStatus());
    }

    // 1. Organic Anatomical Geometries
    this.fruitGeometry = this.createOrganicFruitGeometry();
    this.leafGeometry = this.createMiniLeafGeometry();
    this.stemGeometry = this.createCurvedStemGeometry();

    // 2. Photorealistic Organic Materials with 5 distinct vibrant, self-luminous fruit colors
    this.materials = [
      new THREE.MeshPhysicalMaterial({
        color: 0xff2222, // 🍎 Trái Ruby Đỏ Rực (Bright Ruby Red Apple)
        emissive: 0xaa0000,
        emissiveIntensity: 0.45,
        roughness: 0.22,
        metalness: 0.05,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
        reflectivity: 0.7
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0xff7b00, // 🍊 Trái Hổ Phách Cam (Vibrant Amber Orange)
        emissive: 0xaa4000,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.05,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
        reflectivity: 0.7
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0xffd000, // ✨ Trái Hoàng Kim Vàng Sáng (Golden Wisdom Pear)
        emissive: 0xaa8000,
        emissiveIntensity: 0.45,
        roughness: 0.22,
        metalness: 0.05,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
        reflectivity: 0.7
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0xff1493, // 🌸 Trái Tinh Hoa Hồng Tím (Deep Rose Dragonfruit)
        emissive: 0x990558,
        emissiveIntensity: 0.45,
        roughness: 0.22,
        metalness: 0.05,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
        reflectivity: 0.7
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0x00e676, // 🍏 Trái Ngọc Bích Phát Sáng (Glowing Emerald Jade)
        emissive: 0x008038,
        emissiveIntensity: 0.40,
        roughness: 0.25,
        metalness: 0.05,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
        reflectivity: 0.7
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
    // Botanical stem arching from top of fruit (y=0.40) up and back to branch origin (y=1.75, z=-1.10)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.40, 0),
      new THREE.Vector3(0.04, 0.85, -0.25),
      new THREE.Vector3(0.06, 1.35, -0.65),
      new THREE.Vector3(0.02, 1.75, -1.10)
    ]);
    return new THREE.TubeGeometry(curve, 14, 0.045, 6, false);
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

  async syncServerHarvestStatus() {
    try {
      const userSession = (window.UserIdentityModal && window.UserIdentityModal.getStoredSession()) 
        || JSON.parse(localStorage.getItem('caosach_user_session') || 'null');
      const userId = (userSession && userSession.id && userSession.id !== 'guest') ? userSession.id : null;
      if (!userId) {
        this.serverHarvestedStatus = {};
        for (const f of this.fruits) {
          f.userData.isHarvested = false;
          f.visible = true;
        }
        return;
      }
      const store = window.MockDataStore || window.ApiDataStore;
      if (store && typeof store.getFruitHarvestStatus === 'function') {
        const res = await store.getFruitHarvestStatus(userId);
        if (res && res.harvestedByTeam) {
          this.serverHarvestedStatus = res.harvestedByTeam;
          for (const f of this.fruits) {
            const tId = f.userData.teamId;
            const idx = f.userData.index;
            const isHarvested = !!(this.serverHarvestedStatus[tId] && this.serverHarvestedStatus[tId].includes(idx));
            f.userData.isHarvested = isHarvested;
            f.visible = !isHarvested;
          }
        }
      }
    } catch (err) {
      console.warn('Could not sync fruit harvest status from server:', err);
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
    const isLevel5 = (level >= 5) || (totalEXP >= 1200);
    if (!isLevel5) {
      return; // Tree with Level < 5 bears 0 fruits!
    }

    const currentTree = this.treeManager?.teamTrees && this.treeManager.teamTrees[idx];
    if (!currentTree || !currentTree.leafClusterOrigins || currentTree.leafClusterOrigins.length === 0) {
      return;
    }

    const availableNodes = currentTree.leafClusterOrigins;
    if (!availableNodes || availableNodes.length === 0) return;

    // Filter reasonable nodes in active canopy height (avoid bare base trunk or extreme tips)
    let allCandidates = availableNodes.filter(n => n.origin.y >= 7.5 && n.origin.y <= 21.0);
    if (allCandidates.length < 5) allCandidates = [...availableNodes];

    // Find bounding box in X and Y to understand this tree model's unique shape
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of allCandidates) {
      if (n.origin.x < minX) minX = n.origin.x;
      if (n.origin.x > maxX) maxX = n.origin.x;
      if (n.origin.y < minY) minY = n.origin.y;
      if (n.origin.y > maxY) maxY = n.origin.y;
    }
    const width = Math.max(4.0, maxX - minX);
    const height = Math.max(5.0, maxY - minY);

    // 5 Normalized Canopy Target Profiles (0.0 to 1.0 in tree's width & height):
    // 0: Lower-Left Branch (normX: 0.12, normY: 0.32) - Cành dưới bên trái
    // 1: Upper-Left Branch (normX: 0.26, normY: 0.72) - Cành trên bên trái
    // 2: Crown Center-Front (normX: 0.50, normY: 0.82) - Cành đỉnh diện tiền
    // 3: Upper-Right Branch (normX: 0.74, normY: 0.72) - Cành trên bên phải
    // 4: Lower-Right Branch (normX: 0.88, normY: 0.32) - Cành dưới bên phải
    const targetProfiles = [
      { targetNormX: 0.12, targetNormY: 0.32, desc: 'Cành dưới trái' },
      { targetNormX: 0.26, targetNormY: 0.72, desc: 'Cành trên trái' },
      { targetNormX: 0.50, targetNormY: 0.82, desc: 'Cành đỉnh diện tiền' },
      { targetNormX: 0.74, targetNormY: 0.72, desc: 'Cành trên phải' },
      { targetNormX: 0.88, targetNormY: 0.32, desc: 'Cành dưới phải' }
    ];

    const selectedNodes = [];
    const minDistance = Math.min(3.4, width * 0.38);

    for (let i = 0; i < 5; i++) {
      const profile = targetProfiles[i];
      let bestNode = null;
      let bestScore = -Infinity;

      // Pass 1: Strict distance check against already selected fruits
      for (const node of allCandidates) {
        let isSeparated = true;
        for (const sel of selectedNodes) {
          if (node.origin.distanceTo(sel.origin) < minDistance) {
            isSeparated = false;
            break;
          }
        }
        if (!isSeparated) continue;

        const normX = (node.origin.x - minX) / width;
        const normY = (node.origin.y - minY) / height;
        const dist2D = Math.sqrt(
          Math.pow(normX - profile.targetNormX, 2) * 1.8 +
          Math.pow(normY - profile.targetNormY, 2)
        );

        // Frontness bonus: prioritize nodes facing the camera (+Z)
        const frontBonus = node.origin.z >= 0.2 ? 1.8 : (node.origin.z * 1.5);
        const score = frontBonus - (dist2D * 3.5);

        if (score > bestScore) {
          bestScore = score;
          bestNode = node;
        }
      }

      // Pass 2: Relaxed separation fallback (at least 2.0 units)
      if (!bestNode) {
        bestScore = -Infinity;
        for (const node of allCandidates) {
          let isSeparated = true;
          for (const sel of selectedNodes) {
            if (node.origin.distanceTo(sel.origin) < 2.0) {
              isSeparated = false;
              break;
            }
          }
          if (!isSeparated) continue;

          const normX = (node.origin.x - minX) / width;
          const normY = (node.origin.y - minY) / height;
          const dist2D = Math.sqrt(
            Math.pow(normX - profile.targetNormX, 2) +
            Math.pow(normY - profile.targetNormY, 2)
          );
          const score = (node.origin.z * 1.2) - (dist2D * 2.5);
          if (score > bestScore) {
            bestScore = score;
            bestNode = node;
          }
        }
      }

      selectedNodes.push(bestNode || allCandidates[(i * 9) % allCandidates.length]);
    }

    const THREE = this.THREE;

    for (let i = 0; i < 5; i++) {
      const node = selectedNodes[i];
      if (!node) continue;

      const fruitAssembly = new THREE.Group();

      // Position fruit comfortably hanging below and in front of the foliage:
      // y -= 1.75: Lowers the fruit clear beneath the leaves quad, so leaves don't clip it
      // z = Math.max(1.2, node.origin.z + 1.1): Pushes it forward in front of trunk and all foliage
      fruitAssembly.position.x = node.origin.x;
      fruitAssembly.position.y = node.origin.y - 1.75;
      fruitAssembly.position.z = Math.max(1.2, node.origin.z + 1.1);

      // 1. Organic Fruit Mesh with rich ripe colors (each of the 5 fruits gets a unique vibrant color)
      const mat = this.materials[i % this.materials.length];
      const fruitMesh = new THREE.Mesh(this.fruitGeometry, mat);
      fruitMesh.castShadow = true;
      fruitMesh.receiveShadow = true;

      // 2. Curved Stem connecting fruit up to the branch joint
      const stemMesh = new THREE.Mesh(this.stemGeometry, this.stemMaterial);
      stemMesh.castShadow = true;

      // 3. Mini Leaflet
      const leafMesh = new THREE.Mesh(this.leafGeometry, this.leafMaterial);
      leafMesh.position.set(0.06, 1.05, 0.05);
      leafMesh.rotation.set(0.4, (i * 1.5), -0.6);

      fruitAssembly.add(fruitMesh);
      fruitAssembly.add(stemMesh);
      fruitAssembly.add(leafMesh);

      // Generous invisible hit collider for ultra-smooth clicking and tapping (especially on mobile)
      const hitColliderGeo = new THREE.SphereGeometry(1.8, 10, 10);
      const hitColliderMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const hitColliderMesh = new THREE.Mesh(hitColliderGeo, hitColliderMat);
      hitColliderMesh.name = `FruitHitCollider_${teamId}_${i}`;
      fruitAssembly.add(hitColliderMesh);

      // Natural organic size variations - prominent scale (1.95) so clearly visible from panorama
      const naturalVariance = 0.96 + (i % 3) * 0.06;
      const fruitScale = 1.95 * naturalVariance;
      fruitAssembly.scale.setScalar(fruitScale);
      fruitAssembly.rotation.y = (i * 1.25);

      const isHarvested = !!(this.serverHarvestedStatus && this.serverHarvestedStatus[teamId] && this.serverHarvestedStatus[teamId].includes(i));

      fruitAssembly.userData = {
        id: `fruit-team${teamId}-${i}`,
        teamId: teamId,
        index: i,
        baseScale: fruitScale,
        swaySpeed: 0.9 + (i % 3) * 0.2,
        swayPhase: (i * 1.7) + teamId * 0.5,
        mesh: fruitMesh,
        collider: hitColliderMesh,
        mat: mat,
        isHarvested: isHarvested,
        respawnTimer: 0
      };
      fruitAssembly.visible = !isHarvested;

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
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.touchMoved = false;
    this.lastTouchActionTime = 0;

    const onPointerMove = (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.checkHover();
    };

    const isInsideAnyOverlay = (target) => {
      return !!(target && target.closest && (
        target.closest('#book-quote-card') || 
        target.closest('#contribute-book-card') || 
        target.closest('#rules-card') || 
        target.closest('#welcome-slogan-card') || 
        target.closest('#user-identity-card') ||
        target.closest('#team-arena-card') ||
        target.closest('header') || 
        target.closest('aside') ||
        target.closest('button') ||
        target.closest('.modal-overlay') ||
        target.closest('.ground-seed-item') ||
        target.closest('.root-garden-plaque')
      ));
    };

    const onClick = (e) => {
      // Ignore click if it was already handled by touch within 600ms (prevent double trigger on touch devices)
      if (Date.now() - this.lastTouchActionTime < 600) {
        return;
      }
      if (isInsideAnyOverlay(e.target)) {
        return;
      }
      this.checkClick(e, e.clientX, e.clientY);
    };

    const onTouchStart = (e) => {
      if (e.touches && e.touches.length > 0) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();
        this.touchMoved = false;
      }
    };

    const onTouchMove = (e) => {
      if (e.touches && e.touches.length > 0) {
        const dx = Math.abs(e.touches[0].clientX - this.touchStartX);
        const dy = Math.abs(e.touches[0].clientY - this.touchStartY);
        if (dx > 12 || dy > 12) {
          this.touchMoved = true;
        }
      }
    };

    const onTouchEnd = async (e) => {
      if (this.touchMoved || (Date.now() - this.touchStartTime > 500)) {
        return; // User was panning/scrolling, not a clean tap
      }
      const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
      if (!touch) return;

      if (isInsideAnyOverlay(e.target)) {
        return;
      }

      this.lastTouchActionTime = Date.now();
      const clientX = touch.clientX;
      const clientY = touch.clientY;

      const handled = await this.checkClick(e, clientX, clientY);
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('click', onClick);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
  }

  checkHover() {
    if (!this.camera || this.fruits.length === 0) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const hitTargets = [];
    this.fruits.forEach(f => {
      if (!f.userData.isHarvested && f.visible) {
        if (f.userData.collider) hitTargets.push(f.userData.collider);
        if (f.userData.mesh) hitTargets.push(f.userData.mesh);
      }
    });

    const intersects = this.raycaster.intersectObjects(hitTargets, false);
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const hitFruit = this.fruits.find(f => 
        f.userData.collider === hitMesh || 
        f.userData.mesh === hitMesh ||
        f.children.includes(hitMesh)
      );

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

  async checkClick(e, clientX, clientY) {
    if (!this.camera) return false;

    // 1. Calculate normalized device coordinates
    if (clientX === undefined || clientY === undefined) {
      clientX = (this.mouse.x + 1) * 0.5 * window.innerWidth;
      clientY = (-this.mouse.y + 1) * 0.5 * window.innerHeight;
    } else {
      this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    }
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Filter unharvested, visible fruits
    const activeFruits = this.fruits.filter(f => !f.userData.isHarvested && f.visible);
    let targetFruit = null;

    if (activeFruits.length > 0) {
      // 1. 3D Raycasting with generous collider and meshes
      const hitTargets = [];
      activeFruits.forEach(f => {
        if (f.userData.collider) hitTargets.push(f.userData.collider);
        if (f.userData.mesh) hitTargets.push(f.userData.mesh);
        f.children.forEach(c => {
          if (c.isMesh && !hitTargets.includes(c)) hitTargets.push(c);
        });
      });

      if (hitTargets.length > 0) {
        const intersects = this.raycaster.intersectObjects(hitTargets, false);
        if (intersects.length > 0) {
          const hitObj = intersects[0].object;
          targetFruit = activeFruits.find(f => 
            f.userData.collider === hitObj || 
            f.userData.mesh === hitObj || 
            f.children.includes(hitObj)
          );
        }
      }

      // 2. Screen-space proximity fallback (crucial for mobile touch & imprecision)
      let closestScreenFruit = null;
      let minScreenDist = Infinity;
      const clickVec = new this.THREE.Vector2(clientX, clientY);

      for (const f of activeFruits) {
        const worldPos = new this.THREE.Vector3();
        f.getWorldPosition(worldPos);

        const screenPos = worldPos.clone().project(this.camera);
        if (screenPos.z < 1.0) { // in front of camera
          const sx = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
          const d = clickVec.distanceTo(new this.THREE.Vector2(sx, sy));
          if (d < minScreenDist) {
            minScreenDist = d;
            closestScreenFruit = f;
          }
        }
      }

      // Generous hit radius: 70px on screen
      const FRUIT_TAP_RADIUS_PX = 70;
      if (!targetFruit && closestScreenFruit && minScreenDist <= FRUIT_TAP_RADIUS_PX) {
        targetFruit = closestScreenFruit;
      }

      // If a fruit was clicked/tapped -> HARVEST IT!
      if (targetFruit) {
        if (e) {
          if (e.stopPropagation) e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        }
        await this.harvestFruit(targetFruit, e);
        return true;
      }

      // CRITICAL GUARD: If click was within 120px of ANY visible fruit,
      // SUPPRESS falling back to the tree click!
      // This completely stops the "Gieo mầm vào cây tri thức" modal from popping up
      // when the user was interacting with or near fruits!
      if (minScreenDist <= 120) {
        return false;
      }
    }

    // Check if clicked on 3D Tree Mesh or 3D Botanical Root Rings
    if (this.treeManager) {
      const treeTargets = [];
      if (this.treeManager.teamTrees) {
        this.treeManager.teamTrees.forEach(t => {
          if (t && t.group && t.group.visible) treeTargets.push(t.group);
        });
      }
      if (this.treeManager.teamRings) {
        this.treeManager.teamRings.forEach(r => {
          if (r && r.visible) treeTargets.push(r);
        });
      }
      if (treeTargets.length > 0) {
        const treeIntersects = this.raycaster.intersectObjects(treeTargets, true);
        if (treeIntersects.length > 0) {
          if (typeof window.handleGroundAction === 'function') {
            window.handleGroundAction(e);
            return true;
          }
        }
      }
    }

    // Check if clicked on 3D Ground Terrain Mesh
    if (window.skyCanvasInstance && window.skyCanvasInstance.ground && window.skyCanvasInstance.ground.mesh) {
      const groundIntersects = this.raycaster.intersectObject(window.skyCanvasInstance.ground.mesh, false);
      if (groundIntersects.length > 0) {
        if (typeof window.handleGroundAction === 'function') {
          window.handleGroundAction(e);
          return true;
        }
      }
    }

    return false;
  }

  async harvestFruit(fruit, e) {
    let userSession = null;
    try {
      if (window.UserIdentityModal && typeof window.UserIdentityModal.getStoredSession === 'function') {
        userSession = window.UserIdentityModal.getStoredSession();
      }
      if (!userSession) {
        userSession = JSON.parse(localStorage.getItem('caosach_user_session') || 'null');
      }
    } catch {}

    const isGuest = !userSession || !userSession.id || userSession.id === 'guest';
    if (isGuest) {
      if (window.showToast) {
        window.showToast('🔒 Vui lòng đăng nhập tài khoản FOXREAD để hái Trái Tri Thức!', 'warning');
      }
      if (window.openUserIdentityModal) {
        window.openUserIdentityModal();
      }
      return;
    }

    const teamId = fruit.userData.teamId || (this.treeManager?.activeTeamId || 1);
    const fruitIndex = typeof fruit.userData.index === 'number' ? fruit.userData.index : 0;
    const allTeams = (window.getAllTeams && window.getAllTeams()) || [];
    const teamObj = allTeams.find(t => t.id === teamId) || {};
    const TEAM_NAMES = { 1: 'SCU_BO', 2: 'Hà Đông Tây Bắc', 3: 'Trung Đông Tây Nam', 4: 'Thập đại Miền Nam', 5: 'FPL_AU_FU', 6: 'FTIBU_BOM', 7: 'FTI BA_TU_BOP', 8: 'IMU_PSU' };
    const teamName = teamObj.display_name || teamObj.name || teamObj.short_name || TEAM_NAMES[teamId] || `Đội ${teamId}`;

    const store = window.MockDataStore || window.ApiDataStore;
    if (!store || typeof store.harvestFruit !== 'function') {
      console.warn('DataStore.harvestFruit not available');
      return;
    }

    const res = await store.harvestFruit({
      teamId,
      fruitIndex,
      userId: userSession.id
    });

    if (res && res.success) {
      fruit.userData.isHarvested = true;
      fruit.visible = false;

      if (!this.serverHarvestedStatus[teamId]) this.serverHarvestedStatus[teamId] = [];
      if (!this.serverHarvestedStatus[teamId].includes(fruitIndex)) {
        this.serverHarvestedStatus[teamId].push(fruitIndex);
      }

      if (window.showToast) {
        window.showToast(`🍎 Bạn đã hái 1 Trái Tri Thức của ${teamName} (+5 EXP cho ${teamName})!`);
      }

      let selectedQuote = res.quote;
      if (!selectedQuote) {
        try {
          const quotes = await store.getMasterQuotes(true);
          const teamQuotes = (quotes || []).filter(q => Number(q.team_id) === Number(teamId));
          if (teamQuotes.length > 0) {
            selectedQuote = teamQuotes[Math.floor(Math.random() * teamQuotes.length)];
          }
        } catch (err) {
          console.warn('Failed to load team quotes:', err);
        }
      }

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
    } else {
      if (res && res.error === 'ALREADY_HARVESTED') {
        fruit.userData.isHarvested = true;
        fruit.visible = false;
        if (!this.serverHarvestedStatus[teamId]) this.serverHarvestedStatus[teamId] = [];
        if (!this.serverHarvestedStatus[teamId].includes(fruitIndex)) {
          this.serverHarvestedStatus[teamId].push(fruitIndex);
        }
        if (window.showToast) {
          window.showToast('⚠️ Bạn đã hái Trái Tri Thức này hôm nay rồi!', 'warning');
        }
      } else if (res && res.error === 'LOGIN_REQUIRED') {
        if (window.showToast) {
          window.showToast('🔒 Vui lòng đăng nhập tài khoản FOXREAD để hái Trái Tri Thức!', 'warning');
        }
        if (window.openUserIdentityModal) {
          window.openUserIdentityModal();
        }
      } else {
        if (window.showToast) {
          window.showToast(res?.message || 'Không thể hái Trái Tri Thức lúc này!', 'error');
        }
      }
    }
  }

  update(elapsedTime, delta, daylightFactor = 1.0) {
    // Periodic synchronization check: ensure any qualified Level 5 team with 0 fruits syncs when tree mesh finishes loading
    this._lastCheck = this._lastCheck || 0;
    if (elapsedTime - this._lastCheck > 1.5) {
      this._lastCheck = elapsedTime;
      for (let tId = 1; tId <= 8; tId++) {
        const tState = this.treeManager?.teamStates && this.treeManager.teamStates[tId - 1];
        const isQualified = (tState?.level >= 5) || (tState?.totalEXP >= 1200);
        const group = this.teamFruitGroups?.get(tId);
        if (isQualified && (!group || group.children.length === 0)) {
          this.syncTeamFruits(tId);
        }
      }
    }

    for (let i = 0; i < this.fruits.length; i++) {
      const f = this.fruits[i];
      const data = f.userData;

      // Persistently harvested fruits remain hidden (no client timer respawn)
      if (data.isHarvested || !f.visible) {
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
