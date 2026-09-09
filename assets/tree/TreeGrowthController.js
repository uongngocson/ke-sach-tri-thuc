/**
 * assets/tree/TreeGrowthController.js
 * Master 3D Growth Coordinator for 8-Team Panorama Garden
 * Logic:
 * - Level 0 (0-49 seeds): 3D Tree is hidden / dormant in ground (seeds clustered on ground).
 * - Level 1 (50-150 EXP): 3D Sprout Mầm Non ~120px tall is visible with lush green leaves!
 * - Level 2-5: Progressively grows into compact, majestic oak trees scaled to 0.8.
 * - Manages all 8 teams concurrently across the grand landscape.
 */
import { MockDataStore } from '../data/MockDataStore.js?v=20260907_v3';

export class TreeGrowthController {
  constructor(treeManager) {
    this.treeManager = treeManager;
    this.teamStates = new Map(); // teamId -> { level, isSprouted, totalEXP, treeSeeds }
    this.isInitialized = false;
    this.activeToastTimeout = null;

    // Presets for Sprouted Stages (Levels 1 to 5) - Compact Botanical Proportions for 8-Team Panorama
    this.STAGE_PRESETS = {
      1: {
        // Stage 1: Mầm Non (50 - 150 EXP)
        name: 'Mầm Non',
        maturity: 0.52,
        trunk: { length: 8.0, radius: 0.65, flare: 1.18 },
        branch: { levels: 1, start: 0.65, sweepAngle: 0.9, minChildren: 3, maxChildren: 4, lengthMultiplier: 0.48 },
        leaves: { size: 2.0, minCount: 3, maxCount: 4, emissive: 0.05 },
        transform: { scale: 2.2, groundOffset: -4.0 }
      },
      2: {
        // Stage 2: Cây Con (150 - 300 EXP)
        name: 'Cây Con',
        maturity: 0.66,
        trunk: { length: 10.5, radius: 0.85, flare: 1.25 },
        branch: { levels: 2, start: 0.55, sweepAngle: 1.15, minChildren: 3, maxChildren: 4, lengthMultiplier: 0.50 },
        leaves: { size: 2.0, minCount: 4, maxCount: 5, emissive: 0.06 },
        transform: { scale: 2.5, groundOffset: -4.0 }
      },
      3: {
        // Stage 3: Trưởng Thành (300 - 600 EXP)
        name: 'Trưởng Thành',
        maturity: 0.78,
        trunk: { length: 13.0, radius: 1.05, flare: 1.35 },
        branch: { levels: 3, start: 0.48, sweepAngle: 1.38, minChildren: 3, maxChildren: 5, lengthMultiplier: 0.52 },
        leaves: { size: 2.0, minCount: 4, maxCount: 5, emissive: 0.07 },
        transform: { scale: 2.7, groundOffset: -4.0 }
      },
      4: {
        // Stage 4: Cổ Thụ (600 - 1200 EXP)
        name: 'Cổ Thụ',
        maturity: 0.90,
        trunk: { length: 15.2, radius: 1.25, flare: 1.45 },
        branch: { levels: 3, start: 0.45, sweepAngle: 1.55, minChildren: 4, maxChildren: 5, lengthMultiplier: 0.54 },
        leaves: { size: 2.0, minCount: 4, maxCount: 6, emissive: 0.08 },
        transform: { scale: 2.9, groundOffset: -4.0 }
      },
      5: {
        // Stage 5: Đại Cổ Thụ (1200+ EXP)
        name: 'Đại Cổ Thụ',
        maturity: 1.0,
        trunk: { length: 17.5, radius: 1.45, flare: 1.55 },
        branch: { levels: 4, start: 0.42, sweepAngle: 1.68, minChildren: 4, maxChildren: 6, lengthMultiplier: 0.55 },
        leaves: { size: 2.0, minCount: 4, maxCount: 6, emissive: 0.09 },
        transform: { scale: 3.1, groundOffset: -4.0 }
      }
    };

    this.init();
  }

  getStore() {
    return (typeof window !== 'undefined' && (window.MockDataStore || window.ApiDataStore)) || MockDataStore;
  }

  async init() {
    const store = this.getStore();
    if (store && typeof store.subscribe === 'function') {
      store.subscribe('growth:updated', (growth) => {
        this.handleGrowthUpdated(growth);
      });

      store.subscribe('teams:updated', (teams) => {
        if (teams && Array.isArray(teams)) {
          this.syncAllTeams(teams);
        }
      });
    }

    // Initial load: sync all 8 teams into the panorama without triggering any level-up toasts
    try {
      if (store && typeof store.getTeams === 'function') {
        const teams = await store.getTeams(true);
        if (teams && teams.length) {
          this.syncAllTeams(teams);
        }
      }
    } catch (e) {
      console.warn('TreeGrowthController: Failed initial teams load:', e);
    } finally {
      // Mark initialized only after the initial team states are firmly recorded
      this.isInitialized = true;
    }
  }

  getStagePreset(level) {
    const lvl = Math.max(1, Math.min(5, level || 1));
    return this.STAGE_PRESETS[lvl] || this.STAGE_PRESETS[1];
  }

  syncAllTeams(teams) {
    if (!this.treeManager || !teams || !teams.length) return;
    teams.forEach(team => {
      const teamId = team.id;
      const prev = this.teamStates.get(teamId);
      const isSprouted = team.is_sprouted || team.level >= 1 || (team.tree_seeds >= 10) || ((team.total_exp || 0) >= 50);
      const newLevel = isSprouted ? Math.max(1, Math.min(5, team.level || 1)) : 0;

      this.syncSingleTeam(team);

      // Trigger level-up celebration ONLY if initialized, team previously known, and level strictly increased!
      if (this.isInitialized && prev && newLevel > prev.level && newLevel >= 1) {
        this.triggerTeamLevelUp(team, prev.level, newLevel);
      }

      this.teamStates.set(teamId, {
        level: newLevel,
        isSprouted,
        totalEXP: team.total_exp || 0,
        treeSeeds: team.tree_seeds || 0,
        name: team.display_name || team.name || `Đội ${teamId}`
      });
    });

    if (!this.isInitialized) {
      this.isInitialized = true;
    }
  }

  syncSingleTeam(team) {
    if (!this.treeManager || !team || !team.id) return;
    const isSprouted = team.is_sprouted || team.level >= 1 || (team.tree_seeds >= 10) || ((team.total_exp || 0) >= 50);
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

    // 1. UI Navigation / Inspection Sync - Never trigger level up notifications
    if (growth._isTeamSync) {
      if (growth.teamId && typeof this.treeManager.setActiveTeam === 'function') {
        this.treeManager.setActiveTeam(growth.teamId);
      }
      return;
    }

    // 2. Targeted Team Growth Update
    if (growth.teamId) {
      const teamId = growth.teamId;
      const prev = this.teamStates.get(teamId);
      const isSprouted = growth.isSprouted || growth.level >= 1 || (growth.totalSeeds >= 10) || ((growth.totalEXP || 0) >= 50);
      const newLevel = isSprouted ? Math.max(1, Math.min(5, growth.level || 1)) : 0;
      const stagePreset = isSprouted ? this.getStagePreset(newLevel) : null;

      if (typeof this.treeManager.updateTeamTreeState === 'function') {
        this.treeManager.updateTeamTreeState(teamId, {
          level: newLevel,
          isSprouted,
          totalEXP: growth.totalEXP || 0,
          stagePreset
        });
      }

      // Check strictly if this specific team leveled up
      if (this.isInitialized && prev && newLevel > prev.level && newLevel >= 1) {
        this.triggerTeamLevelUp(growth, prev.level, newLevel);
      }

      this.teamStates.set(teamId, {
        level: newLevel,
        isSprouted,
        totalEXP: growth.totalEXP || 0
      });
      return;
    }

    // 3. Global Community Growth (from quote likes, visits, harvests, etc.)
    // Sync all 8 teams consistently without triggering bogus community level toasts
    const store = this.getStore();
    if (store && typeof store.getTeams === 'function') {
      store.getTeams(true).then(teams => {
        if (teams && teams.length) this.syncAllTeams(teams);
      }).catch(() => {});
    }
  }

  triggerTeamLevelUp(teamData, oldLevel, newLevel) {
    // Deduplicate: Cleanly remove any existing level-up toast
    const existing = document.querySelectorAll('.tree-level-up-toast');
    existing.forEach(el => el.remove());
    if (this.activeToastTimeout) {
      clearTimeout(this.activeToastTimeout);
      this.activeToastTimeout = null;
    }

    const teamId = teamData.id || teamData.teamId || 1;
    const teamName = teamData.display_name || teamData.name || `Đội ${teamId}`;
    const preset = this.getStagePreset(newLevel);
    const stageName = preset ? preset.name : (teamData.levelName || 'Cây Tri Thức');
    const exp = (teamData.total_exp || teamData.totalEXP || 0).toLocaleString();
    const icon = newLevel >= 5 ? '👑' : (newLevel >= 4 ? '🌲' : (newLevel >= 3 ? '🌳' : (newLevel >= 2 ? '🌿' : '🌱')));

    const notification = document.createElement('div');
    notification.className = 'tree-level-up-toast';
    notification.innerHTML = `
      <div class="level-up-inner">
        <div class="level-up-icon">${icon}</div>
        <div class="level-up-text">
          <div class="level-up-title">${newLevel === 1 ? `🌱 CÂY ${teamName.toUpperCase()} ĐÃ CHÍNH THỨC NẢY MẦM!` : `🌳 CÂY ${teamName.toUpperCase()} ĐÃ LÊN CẤP ${newLevel}!`}</div>
          <div class="level-up-subtitle">Đạt ${stageName} (${exp} EXP)</div>
        </div>
      </div>
    `;
    document.body.appendChild(notification);

    this.activeToastTimeout = setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 600);
    }, 4000);
  }
}
