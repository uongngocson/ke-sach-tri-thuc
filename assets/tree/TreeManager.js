/**
 * assets/tree/TreeManager.js
 * Master 3D Procedural Tree Coordinator for Cây Sách Tri Thức
 * Seamlessly integrates the Tree.js generator into Three.js with full GUI Option Panel
 */
import { Tree, LeafStyle, LeafType } from './tree.js';
import GUI from './lil-gui.module.min.js';

export class TreeManager {
  constructor(THREE, scene, camera) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;

    // Default aesthetic tree parameters (Majestic Oak of Knowledge)
    this.treeParams = {
      seed: 42890,
      maturity: 1.0,
      animateGrowth: false,
      autoRotate: false,
      windSway: true,

      // Transform & Placement on Ground Horizon
      transform: {
        posY: -45,      // Sitting directly on top of the ground arc
        posZ: -260,
        scale: 5.5
      },

      trunk: {
        color: 0x5c3a21,
        flatShading: false,
        textured: true,
        length: 16.5,
        radius: 1.6,
        flare: 1.15
      },

      branch: {
        levels: 4,
        start: 0.52,
        stop: 0.95,
        sweepAngle: 2.1,
        minChildren: 3,
        maxChildren: 5,
        lengthVariance: 0.22,
        lengthMultiplier: 0.72,
        radiusMultiplier: 0.88,
        taper: 0.72,
        gnarliness: 0.16,
        gnarliness1_R: 0.04,
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
        size: 2.2,
        sizeVariance: 0.2,
        color: 0x4f8a10,
        emissive: 0.08,
        opacity: 1.0,
        alphaTest: 0.45
      },

      sun: {
        direction: new THREE.Vector3(0, 1, 0),
        strength: 0.02
      }
    };

    // Tree Scene Anchor & Transforms
    this.treeAnchor = new THREE.Group();
    this.treeAnchor.name = 'TreeAnchor';
    this.updateAnchorTransform();
    this.scene.add(this.treeAnchor);

    // Dedicated Lighting for 3D Tree
    this.#setupLighting();

    // Instantiate Tree
    this.tree = new Tree(THREE, this.treeParams);
    this.treeAnchor.add(this.tree.group);

    // Setup GUI option panel
    this.#setupGUI();
  }

  updateAnchorTransform() {
    const t = this.treeParams.transform;
    this.treeAnchor.position.set(0, t.posY, t.posZ);
    this.treeAnchor.scale.set(t.scale, t.scale, t.scale);
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
      title: '🌳 TÙY CHỈNH CÂY 3D',
      width: 310,
      autoPlace: false
    });

    this.gui = gui;

    // Presets definitions
    const presets = {
      'Cây Sồi Tinh Hoa (Mặc định)': () => {
        Object.assign(this.treeParams.trunk, { color: 0x5c3a21, length: 16.5, radius: 1.6, flare: 1.15 });
        Object.assign(this.treeParams.branch, { levels: 4, start: 0.52, sweepAngle: 2.1, minChildren: 3, maxChildren: 5, gnarliness: 0.16 });
        Object.assign(this.treeParams.leaves, { style: LeafStyle.Double, type: LeafType.Oak, size: 2.2, color: 0x4f8a10, emissive: 0.08 });
        this.treeParams.seed = 42890;
        this.tree.generate();
        gui.controllersRecursive().forEach(c => c.updateDisplay());
      },
      'Cổ Thụ Ngàn Năm': () => {
        Object.assign(this.treeParams.trunk, { color: 0x3d2716, length: 14, radius: 2.4, flare: 2.2 });
        Object.assign(this.treeParams.branch, { levels: 4, start: 0.35, sweepAngle: 2.6, minChildren: 4, maxChildren: 6, gnarliness: 0.28 });
        Object.assign(this.treeParams.leaves, { style: LeafStyle.Double, type: LeafType.Oak, size: 2.6, color: 0x386b12, emissive: 0.06 });
        this.treeParams.seed = 9999;
        this.tree.generate();
        gui.controllersRecursive().forEach(c => c.updateDisplay());
      },
      'Hoa Anh Đào (Cherry)': () => {
        Object.assign(this.treeParams.trunk, { color: 0x4a3b32, length: 15, radius: 1.3, flare: 0.9 });
        Object.assign(this.treeParams.branch, { levels: 4, start: 0.45, sweepAngle: 2.3, minChildren: 3, maxChildren: 5, gnarliness: 0.18 });
        Object.assign(this.treeParams.leaves, { style: LeafStyle.Double, type: LeafType.Flowers, size: 2.4, color: 0xffb7c5, emissive: 0.15 });
        this.treeParams.seed = 77123;
        this.tree.generate();
        gui.controllersRecursive().forEach(c => c.updateDisplay());
      },
      'Phong Đỏ Mùa Thu': () => {
        Object.assign(this.treeParams.trunk, { color: 0x482d1c, length: 17, radius: 1.4, flare: 1.1 });
        Object.assign(this.treeParams.branch, { levels: 4, start: 0.5, sweepAngle: 2.0, minChildren: 3, maxChildren: 5, gnarliness: 0.14 });
        Object.assign(this.treeParams.leaves, { style: LeafStyle.Double, type: LeafType.Aspen, size: 2.3, color: 0xd9381e, emissive: 0.12 });
        this.treeParams.seed = 54321;
        this.tree.generate();
        gui.controllersRecursive().forEach(c => c.updateDisplay());
      }
    };

    const presetFolder = gui.addFolder('✨ Mẫu Cây Có Sẵn');
    presetFolder.add({ p: 'Cây Sồi Tinh Hoa (Mặc định)' }, 'p', Object.keys(presets)).name('Chọn Mẫu').onChange((val) => {
      if (presets[val]) presets[val]();
    });

    // Placement & Position on ground
    const posFolder = gui.addFolder('📍 Vị Trí & Tỉ Lệ Mặt Đất');
    posFolder.add(this.treeParams.transform, 'posY', -100, 20, 1).name('Cao Độ Gốc (Y)').onChange(() => this.updateAnchorTransform());
    posFolder.add(this.treeParams.transform, 'scale', 2.0, 10.0, 0.1).name('Kích Cỡ Cây').onChange(() => this.updateAnchorTransform());
    posFolder.add(this.treeParams.transform, 'posZ', -400, -150, 5).name('Độ Sâu (Z)').onChange(() => this.updateAnchorTransform());

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
    leavesFolder.add(this.treeParams.leaves, 'type', { 'Sồi (Oak)': 2, 'Dương (Aspen)': 1, 'Tần Bì (Ash)': 0, 'Hoa (Flowers)': 3 }).name('Loại Lá');
    leavesFolder.add(this.treeParams.leaves, 'size', 0.5, 5.0, 0.1).name('Kích Cỡ Lá');
    leavesFolder.addColor(this.treeParams.leaves, 'color').name('Màu Lá');
    leavesFolder.add(this.treeParams.leaves, 'minCount', 1, 20, 1).name('Mật Độ Nhỏ');
    leavesFolder.add(this.treeParams.leaves, 'maxCount', 1, 25, 1).name('Mật Độ Lớn');
    leavesFolder.add(this.treeParams.leaves, 'emissive', 0, 0.5, 0.01).name('Phát Sáng');
    leavesFolder.add(this.treeParams.leaves, 'opacity', 0.2, 1.0, 0.05).name('Độ Trong Suốt');

    // Quick Actions
    gui.add({
      random: () => {
        this.treeParams.seed = Math.floor(Math.random() * 65535);
        this.tree.generate();
        gui.controllersRecursive().forEach(c => c.updateDisplay());
      }
    }, 'random').name('🎲 Đổi Dáng Cây Ngẫu Nhiên');

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

    // 2. Wind Sway Physics & Auto-Rotation
    if (this.treeParams.windSway) {
      const swayZ = Math.sin(elapsedTime * 0.75) * 0.018 + Math.cos(elapsedTime * 1.3) * 0.008;
      const swayX = Math.sin(elapsedTime * 0.55 + 1.2) * 0.012;
      this.treeAnchor.rotation.z = swayZ;
      this.treeAnchor.rotation.x = swayX;
    } else {
      this.treeAnchor.rotation.z = 0;
      this.treeAnchor.rotation.x = 0;
    }

    if (this.treeParams.autoRotate) {
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
      this.tree.generate();
      if (this.gui) {
        this.gui.controllersRecursive().forEach(c => c.updateDisplay());
      }
    }
  }

  dispose() {
    if (this.tree) this.tree.dispose();
    if (this.treeAnchor) this.scene.remove(this.treeAnchor);
  }
}
