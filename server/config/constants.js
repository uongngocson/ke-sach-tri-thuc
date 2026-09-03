export const EXP_CONFIG = {
  BOOK_CONTRIBUTION: 15,
  QUOTE_LIKE: 2,
  DAILY_DEW: 1,
  FRUIT_HARVEST: 5,
  ADMIN_BONUS_DEFAULT: 500,
  MODERATION_PENALTY: -15
};

export const LEVEL_THRESHOLDS = [
  { level: 0, name: 'Hạt Mầm Tri Thức', minExp: 0, maxExp: 49, desc: 'Hạt mầm tri thức đang ủ trong đất' },
  { level: 1, name: 'Mầm Xanh Hé Nụ', minExp: 50, maxExp: 149, desc: 'Mầm non nhú lên đón sương sớm' },
  { level: 2, name: 'Cây Non Vươn Cành', minExp: 150, maxExp: 349, desc: 'Thân non bắt đầu vươn tán' },
  { level: 3, name: 'Cây Tri Thức Sum Sê', minExp: 350, maxExp: 699, desc: 'Tán lá rộng phủ bóng tri thức' },
  { level: 4, name: 'Đại Thụ Đơm Hoa Kết Trái', minExp: 700, maxExp: 1199, desc: '36 quả ngọt tri thức trĩu cành' },
  { level: 5, name: 'Cây Cổ Thụ Ngàn Năm', minExp: 1200, maxExp: 999999999, desc: '52 quả tinh hoa rực sáng di sản' }
];

export function calculateLevelFromExp(totalExp) {
  const exp = Math.max(0, parseInt(totalExp, 10) || 0);
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (exp >= LEVEL_THRESHOLDS[i].minExp) {
      const current = LEVEL_THRESHOLDS[i];
      const next = LEVEL_THRESHOLDS[i + 1] || null;
      let progressPercent = 100;
      if (next) {
        const range = next.minExp - current.minExp;
        const currentProgress = exp - current.minExp;
        progressPercent = Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100)));
      }
      return {
        level: current.level,
        name: current.name,
        levelName: current.name,
        desc: current.desc,
        levelDescription: current.desc,
        levelDesc: current.desc,
        currentExp: exp,
        nextLevelExp: next ? next.minExp : current.minExp,
        nextThreshold: next ? next.minExp : current.minExp,
        currentFloor: current.minExp,
        progressPercent
      };
    }
  }
  return {
    level: 0,
    name: LEVEL_THRESHOLDS[0].name,
    desc: LEVEL_THRESHOLDS[0].desc,
    currentExp: 0,
    nextLevelExp: 50,
    progressPercent: 0
  };
}
