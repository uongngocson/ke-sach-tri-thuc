/**
 * assets/tree/TreeGrowthController.js
 * Master 3D Growth Coordinator for 8-Team Panorama Garden
 * Logic:
 * - Level 0 (0-49 seeds): 3D Tree is hidden / dormant in ground (seeds clustered on ground).
 * - Level 1 (50-150 EXP): 3D Sprout Mầm Non ~120px tall is visible with lush green leaves!
 * - Level 2-5: Progressively grows into compact, majestic oak trees scaled to 0.8.
 * - Manages all 8 teams concurrently across the grand landscape.
 */
import { MockDataStore } from '../data/MockDataStore.js';

export class TreeGrowthController {
  constructor(treeManager) {
    this.treeManager = treeManager;
    this.currentLevel = 0;
    this.currentEXP = 0;

    // Presets for Sprouted Stages (Levels 1 to 5) - Compact Botanical Proportions for 8-Team Panorama
    this.STAGE_PRESETS = {
      1: {
        // Stage 1: Mầm Non Mới Nhú (50 - 150 EXP)
        name: 'Mầm Non Mới Nhú',
        maturity: 0.52,
        trunk: { length: 8.0, radius: 0.65, flare: 1.18 },
        branch: { levels: 1, start: 0.65, sweepAngle: 0.9, minChildren: 3, maxChildren: 4, lengthMultiplier: 0.48 },
        leaves: { size: 2.0, minCount: 3, maxCount: 4, emissive: 0.05 },
        transform: { scale: 2.2, groundOffset: -4.0 }
      },
      2: {
        // Stage 2: Cây Mầm Đâm Chồi (Young Sapling: 150 - 400 EXP)
        name: 'Cây Mầm Đâm Chồi',
        maturity: 0.66,
        trunk: { length: 10.5, radius: 0.85, flare: 1.25 },
        branch: { levels: 2, start: 0.55, sweepAngle: 1.15, minChildren: 3, maxChildren: 4, lengthMultiplier: 0.50 },
        leaves: { size: 2.0, minCount: 4, maxCount: 5, emissive: 0.06 },
        transform: { scale: 2.5, groundOffset: -4.0 }
      },
      3: {
        // Stage 3: Cây Tơ Vươn Cành (Young Growing Tree: 400 - 1000 EXP)
        // Tall dignified trunk with elegant canopy
        name: 'Cây Tơ Vươn Cành',
        maturity: 0.78,
        trunk: { length: 13.0, radius: 1.05, flare: 1.35 },
        branch: { levels: 3, start: 0.48, sweepAngle: 1.38, minChildren: 3, maxChildren: 5, lengthMultiplier: 0.52 },
        leaves: { size: 2.0, minCount: 4, maxCount: 5, emissive: 0.07 },
        transform: { scale: 2.7, groundOffset: -4.0 }
      },
      4: {
        // Stage 4: Cây Trưởng Thành Rợp Bóng (Mature Oak Tree: 1000 - 2500 EXP)
        name: 'Cây Trưởng Thành Rợp Bóng',
        maturity: 0.90,
        trunk: { length: 15.2, radius: 1.25, flare: 1.45 },
        branch: { levels: 3, start: 0.45, sweepAngle: 1.55, minChildren: 4, maxChildren: 5, lengthMultiplier: 0.54 },
        leaves: { size: 2.0, minCount: 4, maxCount: 6, emissive: 0.08 },
        transform: { scale: 2.9, groundOffset: -4.0 }
      },
      5: {
        // Stage 5: Đại Cổ Thụ Nghìn Năm (Ancient Sage Tree: 2500+ EXP)
        name: 'Đại Cổ Thụ Nghìn Năm',
        maturity: 1.0,
        trunk: { length: 17.5, radius: 1.45, flare: 1.55 },
        branch: { levels: 4, start: 0.42, sweepAngle: 1.68, minChildren: 4, maxChildren: 6, lengthMultiplier: 0.55 },
        leaves: { size: 2.0, minCount: 4, maxCount: 6, emissive: 0.09 },
        transform: { scale: 3.1, groundOffset: -4.0 }
      }
    };

    this.init();
  }

  async init() {
    MockDataStore.subscribe('growth:updated', (growth) => {
      this.handleGrowthUpdated(growth);
    });

    MockDataStore.subscribe('teams:updated', (teams) => {
      if (teams && Array.isArray(teams)) {
        this.syncAllTeams(teams);
      }
    });

    // Initial load: sync all 8 teams into the panorama
    try {
      const teams = await MockDataStore.getTeams(true);
      if (teams && teams.length) {
        this.syncAllTeams(teams);
      }
    } catch (e) {
      console.warn('TreeGrowthController: Failed initial teams load:', e);
    }

    const initialGrowth = await MockDataStore.getCommunityGrowth();
    if (initialGrowth) {
      this.applyGrowth(initialGrowth, true);
    }
  }

  getStagePreset(level) {
    const lvl = Math.max(1, Math.min(5, level || 1));
    return this.STAGE_PRESETS[lvl] || this.STAGE_PRESETS[1];
  }

  syncAllTeams(teams) {
    if (!this.treeManager || !teams || !teams.length) return;
    teams.forEach(team => {
      this.syncSingleTeam(team);
    });
  }

  syncSingleTeam(team) {
    if (!this.treeManager || !team || !team.id) return;
    const isSprouted = team.is_sprouted || team.level >= 1;
    const teamId = team.id;
    const level = isSprouted ? Math.max(1, Math.min(5, team.level || 1)) : 0;
    const stagePreset = isSprouted ? this.getStagePreset(level) : null;

    if (typeof this.treeManager.updateTeamTreeState === 'function') {
      this.treeManager.updateTeamTreeState(teamId, {
        level,
        isSprouted,
        totalEXP: team.total_exp || 0,
        treeSeeds: team.tree_seeds || 0,
        colorCode: team.color_code || team.color_primary,
        stagePreset
      });
    }
  }

  handleGrowthUpdated(growth) {
    if (!growth) return;

    // If update is targeted at a specific team
    if (growth.teamId) {
      const teamId = growth.teamId;
      const isSprouted = growth.isSprouted || growth.level >= 1;
      const level = isSprouted ? Math.max(1, Math.min(5, growth.level || 1)) : 0;
      const stagePreset = isSprouted ? this.getStagePreset(level) : null;

      if (typeof this.treeManager.updateTeamTreeState === 'function') {
        this.treeManager.updateTeamTreeState(teamId, {
          level,
          isSprouted,
          totalEXP: growth.totalEXP || 0,
          stagePreset
        });
      }
    } else {
      // Global growth: sync all teams
      MockDataStore.getTeams(true).then(teams => {
        if (teams && teams.length) this.syncAllTeams(teams);
      }).catch(() => {});
    }

    // Apply active growth to primary focus
    this.applyGrowth(growth);
  }

  applyGrowth(growth, isInitial = false) {
    if (!this.treeManager || !this.treeManager.treeParams) return;

    const { level, isSprouted, progressPercent, totalEXP } = growth;
    const hasLevelChanged = this.currentLevel !== level;
    this.currentLevel = level || 0;
    this.currentEXP = totalEXP || 0;

    if (growth.teamId) {
      if (typeof this.treeManager.setActiveTeam === 'function') {
        this.treeManager.setActiveTeam(growth.teamId);
      }
      this.syncSingleTeam({
        id: growth.teamId,
        level: growth.level,
        is_sprouted: isSprouted,
        total_exp: totalEXP
      });
    }

    // Level-up toast notification
    if (!isInitial && hasLevelChanged && level >= 1 && growth.levelName) {
      this.triggerLevelUpEffects(growth);
    }
  }

  triggerLevelUpEffects(growth) {
    const notification = document.createElement('div');
    notification.className = 'tree-level-up-toast';
    notification.innerHTML = `
      <div class="level-up-inner">
        <div class="level-up-icon">${growth.levelIcon || '🌱'}</div>
        <div class="level-up-text">
          <div class="level-up-title">${growth.level === 1 ? 'CÂY ĐÃ CHÍNH THỨC NẢY MẦM!' : 'CÂY TRI THỨC VƯƠN MÌNH!'}</div>
          <div class="level-up-subtitle">Đạt ${growth.levelName} (${(growth.totalEXP || 0).toLocaleString()} EXP)</div>
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
