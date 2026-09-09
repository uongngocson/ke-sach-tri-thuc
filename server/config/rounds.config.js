export const ROUNDS_CONFIG = [
  { round: 1,  date: '2026-09-05', endDate: '2026-09-07', stage: 'SEEDING', label: 'Lượt 1: Gieo Mầm Khởi Động' },
  { round: 2,  date: '2026-09-08', endDate: '2026-09-10', stage: 'SEEDING', label: 'Lượt 2: Tích Lũy Nảy Mầm' },
  { round: 3,  date: '2026-09-11', endDate: '2026-09-13', stage: 'GROWTH',  label: 'Lượt 3: Khởi Động Tính EXP' },
  { round: 4,  date: '2026-09-14', endDate: '2026-09-16', stage: 'GROWTH',  label: 'Lượt 4: Bứt Phá Cây Con' },
  { round: 5,  date: '2026-09-17', endDate: '2026-09-19', stage: 'GROWTH',  label: 'Lượt 5: Chinh Phục 400 EXP' },
  { round: 6,  date: '2026-09-20', endDate: '2026-09-22', stage: 'GROWTH',  label: 'Lượt 6: Vươn Tán Sum Sê' },
  { round: 7,  date: '2026-09-23', endDate: '2026-09-25', stage: 'GROWTH',  label: 'Lượt 7: Quang Hợp Bền Bỉ' },
  { round: 8,  date: '2026-09-26', endDate: '2026-09-28', stage: 'GROWTH',  label: 'Lượt 8: Chạm Mốc 1.000 EXP' },
  { round: 9,  date: '2026-09-29', endDate: '2026-10-01', stage: 'GROWTH',  label: 'Lượt 9: Nuôi Dưỡng Tán Rộng' },
  { round: 10, date: '2026-10-02', endDate: '2026-10-04', stage: 'GROWTH',  label: 'Lượt 10: Tăng Tốc Về Đích' },
  { round: 11, date: '2026-10-05', endDate: '2026-10-07', stage: 'GROWTH',  label: 'Lượt 11: Đơm Hoa Kết Trái' },
  { round: 12, date: '2026-10-08', endDate: '2026-10-10', stage: 'GROWTH',  label: 'Lượt 12: Bền Bỉ Tri Thức' },
  { round: 13, date: '2026-10-11', endDate: '2026-10-13', stage: 'GROWTH',  label: 'Lượt 13: Tiến Sát Cổ Thụ' },
  { round: 14, date: '2026-10-14', endDate: '2026-10-16', stage: 'GROWTH',  label: 'Lượt 14: Cán Mốc 2.500 EXP' },
  { round: 15, date: '2026-10-17', endDate: '2026-10-19', stage: 'FINALS',  label: 'Lượt 15: Chung Cuộc Đại Cổ Thụ' }
];

export const STANDARD_TEAM_SIZE = 40;
export const EXP_PER_CONTRIBUTION = 5;
export const SEEDS_FOR_SPROUT = 10;

/**
 * Get current round by date (default to today or simulated date)
 */
export function getCurrentRound(dateStr = null) {
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const nowStr = targetDate.toISOString().slice(0, 10);

  for (let i = ROUNDS_CONFIG.length - 1; i >= 0; i--) {
    const r = ROUNDS_CONFIG[i];
    if (nowStr >= r.date) {
      return r;
    }
  }
  return ROUNDS_CONFIG[0];
}

/**
 * Calculate EXP using 40-person normalized formula:
 * EXP = (participants / teamSize) * 40 * 5 = (participants / teamSize) * 200
 */
export function calculateNormalizedExp(participantsCount, teamSize) {
  if (!teamSize || teamSize <= 0) return 0;
  const participationRate = Math.min(1.0, Math.max(0, participantsCount / teamSize));
  const exp = participationRate * STANDARD_TEAM_SIZE * EXP_PER_CONTRIBUTION;
  return Math.round(exp * 100) / 100;
}
