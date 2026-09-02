import { calculateLevelFromExp, LEVEL_THRESHOLDS } from '../../config/constants.js';

describe('Unit Test: Level & EXP Calculation Math', () => {
  test('Level 0: Dormant Seed (0 to 49 EXP)', () => {
    const res0 = calculateLevelFromExp(0);
    expect(res0.level).toBe(0);
    expect(res0.progressPercent).toBe(0);

    const res25 = calculateLevelFromExp(25);
    expect(res25.level).toBe(0);
    expect(res25.progressPercent).toBe(50); // 25 / 50 = 50%
  });

  test('Level 1: Sprout (50 to 149 EXP)', () => {
    const res50 = calculateLevelFromExp(50);
    expect(res50.level).toBe(1);
    expect(res50.progressPercent).toBe(0);

    const res100 = calculateLevelFromExp(100);
    expect(res100.level).toBe(1);
    expect(res100.progressPercent).toBe(50); // (100 - 50) / 100 = 50%
  });

  test('Level 4: Mature Oak with 36 fruits (700 to 1199 EXP)', () => {
    const res700 = calculateLevelFromExp(700);
    expect(res700.level).toBe(4);
    expect(res700.name).toBe('Đại Thụ Đơm Hoa Kết Trái');
  });

  test('Level 5: Ancient Sacred Tree (>= 1200 EXP)', () => {
    const res1500 = calculateLevelFromExp(1500);
    expect(res1500.level).toBe(5);
    expect(res1500.name).toBe('Cây Cổ Thụ Ngàn Năm');
    expect(res1500.progressPercent).toBe(100);
  });
});
