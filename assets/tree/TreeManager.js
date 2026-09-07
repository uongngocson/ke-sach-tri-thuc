/**
 * assets/tree/TreeManager.js
 * Master 3D Procedural Tree Coordinator for Cáo Sách
 * Features 100% "Cây Cổ Thụ Lâu Năm" (Ancient Thousand-Year Tree)
 * Dynamically Locks Tree Root directly to the DOM Ground Horizon Border
 */
import { Tree, LeafStyle, LeafType } from './tree.js?v=20260907_v1';
import GUI from './lil-gui.module.min.js?v=20260907_v1';
import { TreeGrowthController } from './TreeGrowthController.js?v=20260907_v1';
import { WisdomFruitManager } from './WisdomFruitManager.js?v=20260907_v1';

const DEFAULT_TEAM_COLORS = [
  '#F36F21', // Đội 1: Cam FPT
  '#0054A6', // Đội 2: Xanh FPT
  '#70B928', // Đội 3: Xanh Lá FPT
  '#9333ea', // Đội 4: Tím Thủy Chung
  '#06b6d4', // Đội 5: Xanh Cyan
  '#ec4899', // Đội 6: Hồng Năng Động
  '#f59e0b', // Đội 7: Vàng Hổ Phách
  '#10b981'  // Đội 8: Ngọc Bích
];

export class TreeManager {
  constructor(THREE, scene, camera) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;

    // Cây Cổ Thụ Lâu Năm Parameters (Ancient Majestic Oak)
    this.treeParams = {
      seed: 12345,
      maturity: 1.0,
      animateGrowth: false,
      autoRotate: false,  // 360° auto-rotation disabled
      windSway: true,
      lockToGroundBorder: true, // 100% Mathematically Locked to Ground Border

      // Placement & Height
      transform: {
        groundOffset: -6.0,      // Fine adjustment into ground terrain
        posZ: -260,
        scale: 4.6
      },

      trunk: {
        color: 0x3d2716,
        flatShading: false,
        textured: true,
        length: 17.5,
        radius: 1.45,
        flare: 1.55
      },

      branch: {
        levels: 4,
        start: 0.38,
        stop: 0.95,
        sweepAngle: 2.5,
        minChildren: 4,
        maxChildren: 6,
        lengthVariance: 0.22,
        lengthMultiplier: 0.72,
        radiusMultiplier: 0.88,
        taper: 0.72,
        gnarliness: 0.16,
        gnarliness1_R: 0.02,
        twist: 0.0
      },

      geometry: {
        sections: 10,
        segments: 10,
        lengthVariance: 0.08,
        radiusVariance: 0.08,
        randomization: 0.08
      },

      leaves: {
        style: LeafStyle.Double,
        type: LeafType.Oak,
        minCount: 6,
        maxCount: 9,
        size: 2.5,
        sizeVariance: 0.2,
        color: 0x386b12,
        emissive: 0.06,
        opacity: 1.0,
        alphaTest: 0.45
      },

      sun: {
        direction: new THREE.Vector3(0, 1, 0),
        strength: 0.02
      }
    };

    // Shared Textures for all 8 trees (single GPU load in memory)
    this.textureLoader = new THREE.TextureLoader();
    const barkTex = this.textureLoader.load('./assets/tree/textures/bark/bark.png');
    barkTex.colorSpace = THREE.SRGBColorSpace;
    barkTex.wrapS = THREE.RepeatWrapping;
    barkTex.wrapT = THREE.RepeatWrapping;
    barkTex.generateMipmaps = true;
    barkTex.minFilter = THREE.LinearMipmapLinearFilter;
    barkTex.magFilter = THREE.LinearFilter;
    barkTex.anisotropy = 4;

    const oakTex = this.textureLoader.load('./assets/tree/textures/leaves/oak.png');
    oakTex.colorSpace = THREE.SRGBColorSpace;
    oakTex.generateMipmaps = true;
    oakTex.minFilter = THREE.LinearMipmapLinearFilter;
    oakTex.magFilter = THREE.LinearFilter;
    oakTex.anisotropy = 4;

    this.sharedTextures = {
      barkTexture: barkTex,
      leafTextures: [null, null, oakTex, null]
    };

    // Dedicated Lighting for 3D Tree
    this.#setupLighting();

    // 8-Team Panorama Garden Anchors & 3D Botanical Root Demarcation Rings
    this.teamAnchors = [];
    this.teamTrees = [];
    this.teamRings = [];
    this.teamStates = [];
    this.activeTeamId = 1;

    for (let i = 0; i < 8; i++) {
      const teamId = i + 1;
      const anchor = new THREE.Group();
      anchor.name = `TreeAnchor_Team_${teamId}`;
      this.scene.add(anchor);

      // 3D Botanical Root Ring encircling the tree root on the soil
      // Uses depthTest: true so the tree trunk geometry occludes the back half of the ring
      const ringGeo = new THREE.PlaneGeometry(24, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringTex = this.#createRingTexture(DEFAULT_TEAM_COLORS[i]);
      const ringMat = new THREE.MeshBasicMaterial({
        map: ringTex,
        transparent: true,
        opacity: 0.85,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(0, 0.12, 0); // Flat on soil around trunk
      ringMesh.renderOrder = 2; // Renders after opaque trunk for natural occlusion
      anchor.add(ringMesh);

      this.teamAnchors.push(anchor);
      this.teamTrees.push(null);
      this.teamRings.push(ringMesh);
      this.teamStates.push({
        teamId,
        level: 0,
        isSprouted: false,
        totalEXP: 0,
        treeSeeds: 0,
        colorCode: DEFAULT_TEAM_COLORS[i]
      });
    }

    // Expose on window for easy coordination with UI
    window.treeManager = this;

    // Primary/Focus Anchor (for interactive fruits & focus events)
    this.treeAnchor = this.teamAnchors[0];

    this.updateAnchorTransform();

    // Initialize Master 3D Growth Controller
    this.growthController = new TreeGrowthController(this);
    this.fruitManager = new WisdomFruitManager(THREE, scene, camera, this.teamAnchors[0], this);

    // Resize & scroll listener for continuous grounding
    window.addEventListener('resize', () => this.updateAnchorTransform(), { passive: true });
    window.addEventListener('scroll', () => this.updateAnchorTransform(), { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.updateAnchorTransform(), { passive: true });
      window.visualViewport.addEventListener('scroll', () => this.updateAnchorTransform(), { passive: true });
    }
    const groundCont = document.querySelector('.fpt-ground-container');
    if (groundCont) {
      groundCont.addEventListener('scroll', () => this.updateAnchorTransform(), { passive: true });
    }
  }

  /**
   * Procedural canvas texture generator for 3D botanical root demarcation rings
   */
  #createRingTexture(colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const cx = 256, cy = 256;

    // 1. Soft radial nutrient aura glow
    const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 240);
    grad.addColorStop(0, colorHex + '00');
    grad.addColorStop(0.55, colorHex + '33');
    grad.addColorStop(0.85, colorHex + '18');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // 2. High-clarity dashed botanical border
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 210, 0, Math.PI * 2);
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 14;
    ctx.setLineDash([32, 20]);
    ctx.stroke();

    // 3. Crisp inner boundary ring
    ctx.beginPath();
    ctx.arc(cx, cy, 195, 0, Math.PI * 2);
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 4;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();

    const texture = new this.THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = this.THREE.LinearMipmapLinearFilter;
    return texture;
  }

  /**
   * Project 3D root ring to exact 2D screen viewport coordinates (centerX, centerY, rx, ry)
   * Guaranteed 0.0px mathematical alignment with Three.js camera and canvas
   */
  getTeamRingScreenMetrics(teamId) {
    const index = teamId - 1;
    if (index < 0 || index >= 8) return null;
    const anchor = this.teamAnchors[index];
    const ringMesh = this.teamRings[index];
    if (!anchor || !ringMesh || !this.camera) return null;

    anchor.updateMatrixWorld(true);
    ringMesh.updateMatrixWorld(true);

    const vpWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const vpHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    // 1. Center of the ring in 3D world space projected to screen
    const centerWorld = new this.THREE.Vector3(0, 0.12, 0);
    centerWorld.applyMatrix4(ringMesh.matrixWorld);
    centerWorld.project(this.camera);

    const screenCenterX = (centerWorld.x * 0.5 + 0.5) * vpWidth;
    const screenCenterY = (-(centerWorld.y * 0.5) + 0.5) * vpHeight;

    // 2. Active botanical ring radius in world space (Geometry is 24x24, active radius is ~9.8)
    const activeRadius = 9.8;

    // 3. Right edge projected to get screen horizontal radius rx
    const rightWorld = new this.THREE.Vector3(activeRadius, 0.12, 0);
    rightWorld.applyMatrix4(ringMesh.matrixWorld);
    rightWorld.project(this.camera);
    const screenRightX = (rightWorld.x * 0.5 + 0.5) * vpWidth;
    const rx = Math.abs(screenRightX - screenCenterX);

    // 4. Front edge projected to get screen vertical radius ry (perspective foreshortening)
    const frontWorld = new this.THREE.Vector3(0, 0.12, activeRadius);
    frontWorld.applyMatrix4(ringMesh.matrixWorld);
    frontWorld.project(this.camera);
    const screenFrontY = (-(frontWorld.y * 0.5) + 0.5) * vpHeight;
    const ry = Math.abs(screenFrontY - screenCenterY);

    return { screenCenterX, screenCenterY, rx, ry };
  }

  /**
   * Rebuild a specific team's 3D tree mesh
   */
  regenerateTeamTree(teamId, stageParams, colorCode = null) {
    const THREE = this.THREE;
    const index = teamId - 1;
    if (index < 0 || index >= 8) return;

    const anchor = this.teamAnchors[index];
    if (!anchor) return;

    if (this.teamTrees[index]) {
      anchor.remove(this.teamTrees[index].group);
      try { this.teamTrees[index].dispose(); } catch (e) {}
      this.teamTrees[index] = null;
    }

    // Clone treeParams and apply stageParams
    const p = JSON.parse(JSON.stringify(this.treeParams));
    // Geometry optimized for 8 simultaneous trees at 60 FPS
    p.geometry = {
      sections: 7,
      segments: 7,
      lengthVariance: 0.07,
      radiusVariance: 0.07,
      randomization: 0.07
    };

    if (stageParams) {
      p.maturity = stageParams.maturity || p.maturity;
      if (stageParams.trunk) Object.assign(p.trunk, stageParams.trunk);
      if (stageParams.branch) Object.assign(p.branch, stageParams.branch);
      if (stageParams.leaves) Object.assign(p.leaves, stageParams.leaves);
    }

    // Unique deterministic organic seed per team
    p.seed = 2026 + teamId * 1337;

    const newTree = new Tree(THREE, p, this.sharedTextures);
    anchor.add(newTree.group);
    this.teamTrees[index] = newTree;
    if (index === (this.activeTeamId - 1)) {
      this.tree = newTree;
      this.treeAnchor = anchor;
    }

    // Apply responsive scale and transform immediately
    this.updateAnchorTransform();

    // Automatically sync fruits for this team if it reaches Level 5
    if (this.fruitManager && typeof this.fruitManager.syncTeamFruits === 'function') {
      this.fruitManager.syncTeamFruits(teamId);
    }
  }

  setActiveTeam(teamId) {
    const idx = teamId - 1;
    if (idx >= 0 && idx < 8) {
      this.activeTeamId = teamId;
      this.treeAnchor = this.teamAnchors[idx];
      this.tree = this.teamTrees[idx];
      // Do NOT move fruit groups: Each team tree reaching Level 5 keeps its own fruit cluster permanently
    }
  }

  updateTeamTreeState(teamId, state) {
    const index = teamId - 1;
    if (index < 0 || index >= 8) return;

    const prevState = this.teamStates[index];
    const hasLevelChanged = !prevState || prevState.level !== state.level || prevState.isSprouted !== state.isSprouted;

    this.teamStates[index] = {
      ...prevState,
      ...state
    };

    const anchor = this.teamAnchors[index];
    if (!anchor) return;

    // Level 0 (not sprouted / < 50 seeds): Hide 3D tree mesh, keep plot demarcation ring visible
    if (!state.isSprouted || state.level === 0) {
      if (this.teamTrees[index]) {
        this.teamTrees[index].group.visible = false;
      }
      if (this.fruitManager && typeof this.fruitManager.syncTeamFruits === 'function') {
        this.fruitManager.syncTeamFruits(teamId);
      }
      return;
    }

    if (this.teamTrees[index]) {
      this.teamTrees[index].group.visible = true;
    }

    if (hasLevelChanged || !this.teamTrees[index]) {
      this.regenerateTeamTree(teamId, state.stagePreset, state.colorCode);
    } else if (this.fruitManager && typeof this.fruitManager.syncTeamFruits === 'function') {
      this.fruitManager.syncTeamFruits(teamId);
    }
  }

  /**
   * Legacy wrapper for single tree regeneration
   */
  regenerateTree() {
    this.regenerateTeamTree(this.activeTeamId, this.growthController?.getStagePreset(1));
  }

  updateAnchorTransform() {
    const THREE = this.THREE;
    if (!this.camera) return;

    const vpHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const vpWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const isMobile = vpWidth < 768;
    const isSmallMobile = vpWidth < 480;

    // Always keep camera aspect in 100% sync with current viewport dimensions
    const aspect = vpWidth / vpHeight;
    if (Math.abs(this.camera.aspect - aspect) > 0.001) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }

    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const tanHalfFov = Math.tan(vFovRad / 2.0);

    // Responsive canopy scale factor calibrated for elegant, tall, and non-colliding tree canopies
    const mobileScaleFactor = isSmallMobile ? 0.90 : (isMobile ? 0.95 : (vpWidth < 1024 ? 0.95 : 1.0));

    // Direct DOM query for 100% pixel-perfect lock with the team root plots
    const plotEls = document.querySelectorAll('.team-root-plot');
    const groundContainer = document.querySelector('.fpt-ground-container');
    const groundInner = document.querySelector('.fpt-ground-inner');
    const containerRect = groundInner ? groundInner.getBoundingClientRect() : (groundContainer ? groundContainer.getBoundingClientRect() : null);

    const baseDistance = 260;

    for (let i = 0; i < 8; i++) {
      const anchor = this.teamAnchors[i];
      if (!anchor) continue;

      let centerX, centerY;

      if (plotEls && plotEls[i]) {
        const plotEl = plotEls[i];
        const plotRect = plotEl.getBoundingClientRect();
        // Exact horizontal center of this team's garden plot
        centerX = plotRect.left + plotRect.width / 2.0;
        // The tree root base sits gracefully right inside the ground plot
        centerY = plotRect.top + (isMobile ? 38.0 : 44.0);
      } else if (containerRect && containerRect.width > 0) {
        const slotWidth = containerRect.width / 8.0;
        centerX = containerRect.left + (i + 0.5) * slotWidth;
        centerY = containerRect.top + (isMobile ? 38.0 : 44.0);
      } else {
        centerX = ((i + 0.5) / 8.0) * vpWidth;
        centerY = vpHeight * (isMobile ? 0.78 : 0.74);
      }

      // Exact NDC coordinate corresponding to the center of the root plot
      const ndcX = (centerX / vpWidth) * 2.0 - 1.0;
      const ndcY = 1.0 - (centerY / vpHeight) * 2.0;

      // Gentle amphitheater depth curve: center sits back, wings curve forward
      const clampedNdcX = Math.max(-1.0, Math.min(1.0, ndcX));
      const curveFactor = 1.0 - Math.pow(Math.abs(clampedNdcX), 1.8);
      const worldZ = -baseDistance - (curveFactor * 12.0);
      const dist = -worldZ;

      // Exact frustum dimensions at this anchor's specific distance
      const frustumHalfH = tanHalfFov * dist;
      const frustumHalfW = frustumHalfH * aspect;

      // World X is 100% mathematically aligned with the plot's screen X
      const worldX = ndcX * frustumHalfW;

      // Submerge trunk base slightly (1.8 units) so flared roots nest naturally into soil
      const worldY = (ndcY * frustumHalfH) - 1.8;

      anchor.position.set(worldX, worldY, worldZ);

      // Base scale with responsive scaling factor
      const currentState = this.teamStates[i];
      const stageScale = currentState?.stagePreset?.transform?.scale || (this.treeParams.transform.scale * 0.7);
      const responsiveScale = stageScale * mobileScaleFactor;
      anchor.scale.set(responsiveScale, responsiveScale, responsiveScale);
    }
  }

  #setupLighting() {
    const THREE = this.THREE;

    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    this.scene.add(this.ambientLight);

    // Directional Sun/Moon light for Tree shading
    this.treeDirLight = new THREE.DirectionalLight(0xfff3d6, 1.6);
    this.treeDirLight.position.set(50, 150, 100);
    this.scene.add(this.treeDirLight);

    // Fill Light from front-bottom
    this.fillLight = new THREE.DirectionalLight(0x70b928, 0.45);
    this.fillLight.position.set(0, -50, 100);
    this.scene.add(this.fillLight);
  }

  #setupGUI() {
    const THREE = this.THREE;

    // Create GUI Container floating on right side
    const gui = new GUI({
      title: '🌳 CÂY CỔ THỤ LÂU NĂM',
      width: 310,
      autoPlace: false
    });

    this.gui = gui;

    // Ground Locking & Scale
    const groundFolder = gui.addFolder('📍 Khóa Chặt Mặt Đất & Kích Cỡ');
    groundFolder.add(this.treeParams, 'lockToGroundBorder').name('Khóa Vào Viền Đất').onChange(() => this.updateAnchorTransform());
    groundFolder.add(this.treeParams.transform, 'groundOffset', -20, 20, 0.5).name('Tinh Chỉnh Cao Độ Gốc').onChange(() => this.updateAnchorTransform());
    groundFolder.add(this.treeParams.transform, 'scale', 2.0, 12.0, 0.1).name('Kích Cỡ Cây').onChange(() => this.updateAnchorTransform());
    groundFolder.add(this.treeParams.transform, 'posZ', -400, -150, 5).name('Độ Sâu (Z)').onChange(() => this.updateAnchorTransform());

    // Main Parameters
    gui.add(this.treeParams, 'seed', 0, 65536, 1).name('Seed (Ngẫu nhiên)');
    gui.add(this.treeParams, 'maturity', 0.1, 1.0, 0.01).name('Độ Trưởng Thành');
    gui.add(this.treeParams, 'animateGrowth').name('Hiệu Ứng Lớn Lên');
    gui.add(this.treeParams, 'windSway').name('Gió Đung Đưa');
    gui.add(this.treeParams, 'autoRotate').name('Tự Xoay 360°');

    // Trunk
    const trunkFolder = gui.addFolder('Thân Cây (Trunk)').close();
    trunkFolder.addColor(this.treeParams.trunk, 'color').name('Màu Thân');
    trunkFolder.add(this.treeParams.trunk, 'textured').name('Vân Vỏ Cây');
    trunkFolder.add(this.treeParams.trunk, 'flatShading').name('Flat Shading');
    trunkFolder.add(this.treeParams.trunk, 'length', 5, 35, 0.5).name('Chiều Cao');
    trunkFolder.add(this.treeParams.trunk, 'radius', 0.5, 4.0, 0.1).name('Bán Kính Gốc');
    trunkFolder.add(this.treeParams.trunk, 'flare', 0, 4.0, 0.1).name('Độ Xòe Gốc');

    // Branches
    const branchFolder = gui.addFolder('Cành Cây (Branches)').close();
    branchFolder.add(this.treeParams.branch, 'levels', 1, 5, 1).name('Cấp Nhánh');
    branchFolder.add(this.treeParams.branch, 'start', 0.1, 0.9, 0.05).name('Điểm Bắt Đầu');
    branchFolder.add(this.treeParams.branch, 'stop', 0.5, 1.0, 0.05).name('Điểm Kết Thúc');
    branchFolder.add(this.treeParams.branch, 'minChildren', 1, 8, 1).name('Cành Nhỏ Tối Thiểu');
    branchFolder.add(this.treeParams.branch, 'maxChildren', 1, 10, 1).name('Cành Nhỏ Tối Đa');
    branchFolder.add(this.treeParams.branch, 'sweepAngle', 0.5, Math.PI, 0.05).name('Góc Xòe Tán');
    branchFolder.add(this.treeParams.branch, 'lengthMultiplier', 0.4, 0.95, 0.02).name('Tỉ Lệ Dài');
    branchFolder.add(this.treeParams.branch, 'radiusMultiplier', 0.5, 0.98, 0.02).name('Tỉ Lệ Dày');
    branchFolder.add(this.treeParams.branch, 'taper', 0.3, 0.95, 0.02).name('Độ Vuốt Thon');
    branchFolder.add(this.treeParams.branch, 'gnarliness', 0, 0.4, 0.01).name('Độ Uốn Lượn');
    branchFolder.add(this.treeParams.branch, 'twist', -0.25, 0.25, 0.01).name('Độ Vặn Xoắn');

    // Geometry
    const geoFolder = gui.addFolder('Độ Chi Tiết (Geometry)').close();
    geoFolder.add(this.treeParams.geometry, 'sections', 4, 18, 1).name('Đoạn Thân (Sections)');
    geoFolder.add(this.treeParams.geometry, 'segments', 3, 20, 1).name('Mặt Tròn (Segments)');
    geoFolder.add(this.treeParams.geometry, 'randomization', 0, 0.3, 0.01).name('Độ Tự Nhiên');

    // Leaves
    const leavesFolder = gui.addFolder('Tán Lá (Leaves)').close();
    leavesFolder.add(this.treeParams.leaves, 'style', { 'Đơn (Single)': 0, 'Kép (Double)': 1 }).name('Kiểu Lá');
    leavesFolder.add(this.treeParams.leaves, 'size', 0.5, 5.0, 0.1).name('Kích Cỡ Lá');
    leavesFolder.addColor(this.treeParams.leaves, 'color').name('Màu Lá');
    leavesFolder.add(this.treeParams.leaves, 'minCount', 1, 20, 1).name('Mật Độ Nhỏ');
    leavesFolder.add(this.treeParams.leaves, 'maxCount', 1, 25, 1).name('Mật Độ Lớn');
    leavesFolder.add(this.treeParams.leaves, 'emissive', 0, 0.5, 0.01).name('Phát Sáng');
    leavesFolder.add(this.treeParams.leaves, 'opacity', 0.2, 1.0, 0.05).name('Độ Trong Suốt');

    // Reset to Default Cổ Thụ
    gui.add({
      reset: () => {
        Object.assign(this.treeParams.trunk, { color: 0x3d2716, length: 19.0, radius: 2.2, flare: 2.0 });
        Object.assign(this.treeParams.branch, { levels: 4, start: 0.38, sweepAngle: 2.5, minChildren: 4, maxChildren: 6, gnarliness: 0.24 });
        Object.assign(this.treeParams.leaves, { style: LeafStyle.Double, type: LeafType.Oak, size: 2.5, color: 0x386b12, emissive: 0.06 });
        this.treeParams.seed = 44402;
        this.treeParams.lockToGroundBorder = true;
        this.treeParams.transform.groundOffset = 2.0;
        this.treeParams.transform.scale = 6.2;
        this.updateAnchorTransform();
        this.tree.generate();
        gui.controllersRecursive().forEach(c => c.updateDisplay());
      }
    }, 'reset').name('↺ Đặt Lại Cổ Thụ Chuẩn');

    // Quick Random
    gui.add({
      random: () => {
        this.treeParams.seed = Math.floor(Math.random() * 65535);
        this.tree.generate();
        gui.controllersRecursive().forEach(c => c.updateDisplay());
      }
    }, 'random').name('🎲 Đổi Dáng Cổ Thụ Ngẫu Nhiên');

    gui.onChange(() => {
      this.tree.generate();
    });

    // Mount GUI container in DOM with floating toggle button
    this.#mountGUIDOM(gui);
  }

  #mountGUIDOM(gui) {
    const container = document.createElement('div');
    container.id = 'tree3d-gui-container';
    container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 18px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      pointer-events: auto;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'tree3d-gui-toggle-btn';
    toggleBtn.innerHTML = `
      <span style="font-size: 15px;">🌳</span>
      <span style="font-weight: 800; font-size: 12px; letter-spacing: 0.02em;">Tùy Chỉnh Cây 3D</span>
      <span id="tree3d-gui-arrow" style="font-size: 10px; font-weight: 900; transition: transform 0.2s;">▾</span>
    `;
    toggleBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 14px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.94);
      color: #0054A6;
      border: 1.5px solid #0054A6;
      box-shadow: 0 8px 24px rgba(0, 84, 166, 0.25);
      cursor: pointer;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      transition: all 0.2s ease;
      user-select: none;
    `;

    toggleBtn.addEventListener('mouseenter', () => {
      toggleBtn.style.transform = 'scale(1.04)';
      toggleBtn.style.background = '#0054A6';
      toggleBtn.style.color = '#ffffff';
    });

    toggleBtn.addEventListener('mouseleave', () => {
      toggleBtn.style.transform = 'scale(1)';
      if (!isExpanded) {
        toggleBtn.style.background = 'rgba(255, 255, 255, 0.94)';
        toggleBtn.style.color = '#0054A6';
      }
    });

    const guiWrapper = document.createElement('div');
    guiWrapper.id = 'tree3d-gui-wrapper';
    guiWrapper.style.cssText = `
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
      border-radius: 16px;
      overflow: hidden;
      display: none;
      max-height: 80vh;
      overflow-y: auto;
      border: 2px solid #0054A6;
    `;
    guiWrapper.appendChild(gui.domElement);

    let isExpanded = false;
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isExpanded = !isExpanded;
      guiWrapper.style.display = isExpanded ? 'block' : 'none';
      const arrow = document.getElementById('tree3d-gui-arrow');
      if (arrow) arrow.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
      if (isExpanded) {
        toggleBtn.style.background = '#0054A6';
        toggleBtn.style.color = '#ffffff';
      } else {
        toggleBtn.style.background = 'rgba(255, 255, 255, 0.94)';
        toggleBtn.style.color = '#0054A6';
      }
    });

    container.appendChild(toggleBtn);
    container.appendChild(guiWrapper);
    document.body.appendChild(container);
  }

  /**
   * Animation & Day/Night lighting updater
   */
  update(celestialState, elapsedTime, delta) {
    const { factors, sun, moon } = celestialState;

    // Dynamically maintain lock with ground border if resized or periodic check (avoids 60fps layout reflows)
    if (this.treeParams.lockToGroundBorder) {
      this._lastGroundCheck = this._lastGroundCheck || 0;
      if (elapsedTime - this._lastGroundCheck > 1.0) {
        this._lastGroundCheck = elapsedTime;
        this.updateAnchorTransform();
      }
    }

    // Dynamic scroll tracker for mobile ground container (instant 60fps sync during touch drag & inertia)
    const groundCont = document.querySelector('.fpt-ground-container');
    if (groundCont) {
      const currentScroll = groundCont.scrollLeft;
      if (this._lastScrollLeft !== currentScroll) {
        this._lastScrollLeft = currentScroll;
        this.updateAnchorTransform();
      }
    }

    // Active team botanical ring pulse & nutrient glow animation
    if (this.teamRings) {
      for (let i = 0; i < 8; i++) {
        const ring = this.teamRings[i];
        if (!ring) continue;
        const isActive = (i === (this.activeTeamId - 1));
        if (isActive) {
          const pulse = 1.0 + Math.sin(elapsedTime * 3.2) * 0.04;
          ring.scale.set(pulse, 1, pulse);
          ring.material.opacity = 0.90 + Math.sin(elapsedTime * 3.2) * 0.10;
        } else {
          ring.scale.set(1, 1, 1);
          ring.material.opacity = 0.68;
        }
      }
    }

    // 1. Dynamic Lighting synced with Day/Night Cycle
    const daylight = factors.daylight;
    const sunset = factors.sunset;

    // Ambient: bright warm during day, deep blue silver at night
    const dayAmbient = new this.THREE.Color(0xfff7ed);
    const nightAmbient = new this.THREE.Color(0x18243b);
    this.ambientLight.color.lerpColors(nightAmbient, dayAmbient, Math.max(0.15, daylight));
    this.ambientLight.intensity = 0.55 + daylight * 0.75;

    // Directional Light Position
    if (daylight > 0.05) {
      this.treeDirLight.position.set(sun.x * 0.3, Math.max(20, sun.y * 0.5), 100);
      const sunColor = new this.THREE.Color(0xfffaed).lerp(new this.THREE.Color(0xff8a3d), sunset);
      this.treeDirLight.color.copy(sunColor);
      this.treeDirLight.intensity = (0.6 + daylight * 1.0);
    } else {
      this.treeDirLight.position.set(moon.x * 0.3, Math.max(20, moon.y * 0.5), 100);
      this.treeDirLight.color.setHex(0xa5c2f0);
      this.treeDirLight.intensity = 0.45;
    }

    // 2. Interactive 3D Wisdom Fruits Update
    if (this.fruitManager) {
      this.fruitManager.update(elapsedTime, delta, factors.daylight);
    }

    // 2. Wind Sway Physics across all 8 Trees
    if (this.treeParams.windSway) {
      for (let i = 0; i < 8; i++) {
        const anchor = this.teamAnchors[i];
        if (anchor && anchor.visible) {
          const swayZ = Math.sin(elapsedTime * 0.75 + i * 0.45) * 0.015 + Math.cos(elapsedTime * 1.3 + i * 0.3) * 0.006;
          const swayX = Math.sin(elapsedTime * 0.55 + 1.2 + i * 0.4) * 0.010;
          anchor.rotation.z = swayZ;
          anchor.rotation.x = swayX;
        }
      }
    } else {
      for (let i = 0; i < 8; i++) {
        const anchor = this.teamAnchors[i];
        if (anchor) {
          anchor.rotation.z = 0;
          anchor.rotation.x = 0;
        }
      }
    }

    if (this.treeParams.autoRotate && this.treeAnchor) {
      this.treeAnchor.rotation.y += delta * 0.35;
    }

    // 3. Growth Animation
    if (this.treeParams.animateGrowth) {
      this.treeParams.maturity = Math.min(1.0, this.treeParams.maturity + 0.15 * delta);
      if (this.treeParams.maturity >= 1.0) {
        if (!this.resetTimer) {
          this.resetTimer = setTimeout(() => {
            this.treeParams.seed = Math.floor(Math.random() * 60000);
            this.treeParams.maturity = 0.1;
            this.resetTimer = null;
          }, 3500);
        }
      }
      if (this.teamTrees[0]) this.teamTrees[0].generate();
      if (this.gui) {
        this.gui.controllersRecursive().forEach(c => c.updateDisplay());
      }
    }
  }

  dispose() {
    if (this.fruitManager) this.fruitManager.dispose();
    if (this.teamTrees) {
      this.teamTrees.forEach(t => { if (t) try { t.dispose(); } catch (e) {} });
    }
    if (this.teamRings) {
      this.teamRings.forEach(r => {
        if (r) {
          try {
            if (r.geometry) r.geometry.dispose();
            if (r.material) {
              if (r.material.map) r.material.map.dispose();
              r.material.dispose();
            }
          } catch (e) {}
        }
      });
    }
    if (this.teamAnchors) {
      this.teamAnchors.forEach(a => { if (a) this.scene.remove(a); });
    }
  }
}
