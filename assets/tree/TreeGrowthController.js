/**
 * assets/tree/TreeGrowthController.js
 * Master 3D Growth Coordinator
 * Logic:
 * - Level 0 (0-49 EXP): 3D Tree is hidden / dormant in ground.
 * - Level 1 (50-150 EXP): 3D Sprout ~150px is visible with lush green leaves!
 * - Level 2-5: Progressively grows into ancient oak.
 */
import { MockDataStore } from '../data/MockDataStore.js';

export class TreeGrowthController {
  constructor(treeManager) {
    this.treeManager = treeManager;
    this.currentLevel = 0;
    this.currentEXP = 0;

    // Presets for Sprouted Stages (Levels 1 to 5)
    this.STAGE_PRESETS = {
      1: {
        // Stage 1: Mầm Non Mới Nhú (~150px tall: 50 - 150 EXP)
        name: 'Mầm Non Mới Nhú',
        maturity: 0.52,
        trunk: { length: 8.8, radius: 0.9, flare: 1.3 },
        branch: { levels: 1, start: 0.65, sweepAngle: 1.1, minChildren: 3, maxChildren: 4, lengthMultiplier: 0.60 },
        leaves: { size: 3.2, minCount: 4, maxCount: 6, emissive: 0.05 },
        transform: { scale: 4.2, groundOffset: -6.0 }
      },
      2: {
        // Stage 2: Cây Mầm Đâm Chồi (Young Sapling: 150 - 400 EXP)
        name: 'Cây Mầm Đâm Chồi',
        maturity: 0.66,
        trunk: { length: 12.0, radius: 1.30, flare: 1.5 },
        branch: { levels: 2, start: 0.52, sweepAngle: 1.6, minChildren: 3, maxChildren: 5, lengthMultiplier: 0.65 },
        leaves: { size: 2.8, minCount: 4, maxCount: 6, emissive: 0.06 },
        transform: { scale: 4.4, groundOffset: -6.0 }
      },
      3: {
        // Stage 3: Cây Tơ Vươn Cành (Young Growing Tree: 400 - 1000 EXP)
        name: 'Cây Tơ Vươn Cành',
        maturity: 0.78,
        trunk: { length: 15.0, radius: 1.70, flare: 1.7 },
        branch: { levels: 3, start: 0.44, sweepAngle: 2.0, minChildren: 4, maxChildren: 6, lengthMultiplier: 0.70 },
        leaves: { size: 2.7, minCount: 5, maxCount: 7, emissive: 0.07 },
        transform: { scale: 4.5, groundOffset: -6.0 }
      },
      4: {
        // Stage 4: Cây Trưởng Thành Rợp Bóng (Mature Oak Tree: 1000 - 2500 EXP)
        name: 'Cây Trưởng Thành Rợp Bóng',
        maturity: 0.90,
        trunk: { length: 18.0, radius: 2.10, flare: 1.9 },
        branch: { levels: 4, start: 0.40, sweepAngle: 2.3, minChildren: 4, maxChildren: 6, lengthMultiplier: 0.72 },
        leaves: { size: 2.6, minCount: 5, maxCount: 8, emissive: 0.08 },
        transform: { scale: 4.6, groundOffset: -6.0 }
      },
      5: {
        // Stage 5: Đại Cổ Thụ Nghìn Năm (Ancient Sage Tree: 2500+ EXP)
        name: 'Đại Cổ Thụ Nghìn Năm',
        maturity: 1.0,
        trunk: { length: 20.5, radius: 2.35, flare: 2.1 },
        branch: { levels: 4, start: 0.38, sweepAngle: 2.5, minChildren: 4, maxChildren: 7, lengthMultiplier: 0.74 },
        leaves: { size: 2.6, minCount: 6, maxCount: 9, emissive: 0.10 },
        transform: { scale: 4.7, groundOffset: -6.0 }
      }
    };

    this.init();
  }

  async init() {
    MockDataStore.subscribe('growth:updated', (growth) => {
      this.applyGrowth(growth);
    });

    const initialGrowth = await MockDataStore.getCommunityGrowth();
    this.applyGrowth(initialGrowth, true);
  }

  applyGrowth(growth, isInitial = false) {
    if (!this.treeManager || !this.treeManager.treeParams) return;

    const { level, isSprouted, progressPercent, totalEXP } = growth;
    const hasLevelChanged = this.currentLevel !== level;
    this.currentLevel = level;
    this.currentEXP = totalEXP;

    // 1. If not yet sprouted (Level 0 / < 50 seeds), hide 3D tree completely
    if (!isSprouted) {
      if (this.treeManager.tree && this.treeManager.tree.group) {
        this.treeManager.tree.group.visible = false;
      }
      return;
    }

    // 2. Tree is sprouted! Make 3D group visible
    if (this.treeManager.tree && this.treeManager.tree.group) {
      this.treeManager.tree.group.visible = true;
    }

    const activeLevel = Math.max(1, Math.min(5, level));
    const targetStage = this.STAGE_PRESETS[activeLevel] || this.STAGE_PRESETS[1];
    const nextStage = this.STAGE_PRESETS[Math.min(5, activeLevel + 1)] || targetStage;
    const p = this.treeManager.treeParams;

    const factor = Math.min(1.0, Math.max(0, progressPercent / 100));
    const lerp = (a, b, t) => a + (b - a) * t;

    // Morph parameters
    p.maturity = lerp(targetStage.maturity, nextStage.maturity, factor);
    p.trunk.length = lerp(targetStage.trunk.length, nextStage.trunk.length, factor);
    p.trunk.radius = lerp(targetStage.trunk.radius, nextStage.trunk.radius, factor);
    p.trunk.flare = lerp(targetStage.trunk.flare, nextStage.trunk.flare, factor);

    p.branch.levels = targetStage.branch.levels;
    p.branch.start = lerp(targetStage.branch.start, nextStage.branch.start, factor);
    p.branch.sweepAngle = lerp(targetStage.branch.sweepAngle, nextStage.branch.sweepAngle, factor);
    p.branch.lengthMultiplier = lerp(targetStage.branch.lengthMultiplier, nextStage.branch.lengthMultiplier, factor);

    p.leaves.size = lerp(targetStage.leaves.size, nextStage.leaves.size, factor);
    p.leaves.emissive = lerp(targetStage.leaves.emissive, nextStage.leaves.emissive, factor);

    p.transform.scale = lerp(targetStage.transform.scale, nextStage.transform.scale, factor);

    // Rebuild mesh with updated biological parameters
    this.treeManager.regenerateTree();
    this.treeManager.tree.group.visible = true;

    // Level-up celebration
    if (!isInitial && hasLevelChanged && level >= 1) {
      this.triggerLevelUpEffects(growth);
    }
  }

  triggerLevelUpEffects(growth) {
    const notification = document.createElement('div');
    notification.className = 'tree-level-up-toast';
    notification.innerHTML = `
      <div class="level-up-inner">
        <div class="level-up-icon">${growth.levelIcon}</div>
        <div class="level-up-text">
          <div class="level-up-title">${growth.level === 1 ? 'CÂY ĐÃ CHÍNH THỨC NẢY MẦM!' : 'CÂY TRI THỨC VƯƠN MÌNH!'}</div>
          <div class="level-up-subtitle">Đạt ${growth.levelName} (${growth.totalEXP} EXP)</div>
        </div>
      </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 600);
    }, 3800);
  }
}
