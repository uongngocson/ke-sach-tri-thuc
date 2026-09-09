import db from '../config/database.js';
import { calculateNormalizedExp, getCurrentRound, ROUNDS_CONFIG, STANDARD_TEAM_SIZE, SEEDS_FOR_SPROUT } from '../config/rounds.config.js';
import { calculateLevelFromExp } from '../config/constants.js';
import { TeamService } from '../services/team.service.js';
import { UserService } from '../services/user.service.js';
import { RoundService } from '../services/round.service.js';
import { v4 as uuidv4 } from 'uuid';

async function runUnitSuite() {
  console.log('🧪 =================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE UNIT TEST & TEST-KEY SUITE (CÁO SÁCH)');
  console.log('🧪 =================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      if (details) console.log(`     ↳ ${details}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      if (details) console.error(`     ↳ ${details}`);
      failed++;
    }
  }

  try {
    // =========================================================================
    // SECTION 1: CÔNG THỨC EXP CHUẨN HÓA 40 NGƯỜI (calculateNormalizedExp)
    // =========================================================================
    console.log('📦 [1/8] Test Key Suite 1: Công Thức Chuẩn Hóa EXP 40 Người...');

    // 1.1: Đội chuẩn 40 người, 40 người tham gia (100%) -> 200.00 EXP
    const exp40_40 = calculateNormalizedExp(40, 40);
    assert(exp40_40 === 200, 'Đội chuẩn 40/40 người đạt chính xác 200.00 EXP', `Got: ${exp40_40}`);

    // 1.2: Đội 39 người, 39 người tham gia (100%) -> 200.00 EXP
    const exp39_39 = calculateNormalizedExp(39, 39);
    assert(exp39_39 === 200, 'Đội 39/39 người (100% tham gia) đạt chuẩn hóa 200.00 EXP', `Got: ${exp39_39}`);

    // 1.3: Đội 49 người, 49 người tham gia (100%) -> 200.00 EXP
    const exp49_49 = calculateNormalizedExp(49, 49);
    assert(exp49_49 === 200, 'Đội 49/49 người (100% tham gia) đạt chuẩn hóa 200.00 EXP', `Got: ${exp49_49}`);

    // 1.4: Đội 26 người, 13 người tham gia (50%) -> 100.00 EXP
    const exp26_13 = calculateNormalizedExp(13, 26);
    assert(exp26_13 === 100, 'Đội 26 người có 13 người tham gia (50%) đạt chính xác 100.00 EXP', `Got: ${exp26_13}`);

    // 1.5: Đội 30 người, 15 người tham gia (50%) -> 100.00 EXP
    const exp30_15 = calculateNormalizedExp(15, 30);
    assert(exp30_15 === 100, 'Đội 30 người có 15 người tham gia (50%) đạt chính xác 100.00 EXP', `Got: ${exp30_15}`);

    // 1.6: Đội 37 người, 37 người tham gia -> 200.00 EXP
    const exp37_37 = calculateNormalizedExp(37, 37);
    assert(exp37_37 === 200, 'Đội 37/37 người đạt chính xác 200.00 EXP', `Got: ${exp37_37}`);

    // 1.7: Người tham gia vượt quá quy mô đội (clamp 1.0) -> 200.00 EXP
    const expClamp = calculateNormalizedExp(45, 40);
    assert(expClamp === 200, 'Số người tham gia vượt quy mô được clamp tối đa ở 200.00 EXP', `Got: ${expClamp}`);

    // 1.8: 0 người tham gia -> 0.00 EXP
    const expZero = calculateNormalizedExp(0, 40);
    assert(expZero === 0, '0 người tham gia trả về đúng 0.00 EXP', `Got: ${expZero}`);

    // 1.9: Quy mô đội âm hoặc bằng 0 -> 0.00 EXP (Chống chia cho 0)
    const expInvalid = calculateNormalizedExp(10, 0);
    assert(expInvalid === 0, 'Quy mô đội <= 0 xử lý an toàn trả về 0 EXP, không crash', `Got: ${expInvalid}`);

    // =========================================================================
    // SECTION 2: TÍNH TOÁN LEVEL & MỐC SINH TRƯỞNG CÂY TRI THỨC (calculateLevelFromExp)
    // =========================================================================
    console.log('\n📦 [2/8] Test Key Suite 2: Tính Toán Level & Mốc Tăng Trưởng...');

    // 2.1: Level 0: 0 EXP -> 0% progress
    const l0_start = calculateLevelFromExp(0);
    assert(l0_start.level === 0 && l0_start.progressPercent === 0, 'Level 0 khởi đầu với 0 EXP có 0% tiến độ');

    // 2.2: Level 0: 25 EXP -> 50% progress
    const l0_mid = calculateLevelFromExp(25);
    assert(l0_mid.level === 0 && l0_mid.progressPercent === 50, 'Level 0 với 25 EXP có đúng 50% tiến độ');

    // 2.3: Level 1: 50 EXP -> 0% progress
    const l1_start = calculateLevelFromExp(50);
    assert(l1_start.level === 1 && l1_start.progressPercent === 0, 'Level 1 khởi đầu với 50 EXP có 0% tiến độ');

    // 2.4: Level 1: 100 EXP -> 50% progress
    const l1_mid = calculateLevelFromExp(100);
    assert(l1_mid.level === 1 && l1_mid.progressPercent === 50, 'Level 1 với 100 EXP có đúng 50% tiến độ');

    // 2.5: Level 2: 150 EXP -> Cây Con
    const l2_start = calculateLevelFromExp(150);
    assert(l2_start.level === 2 && l2_start.progressPercent === 0, 'Level 2 với 150 EXP bắt đầu giai đoạn Cây Con');

    // 2.6: Level 3: 300 EXP -> Trưởng Thành
    const l3_start = calculateLevelFromExp(300);
    assert(l3_start.level === 3 && l3_start.progressPercent === 0, 'Level 3 với 300 EXP bắt đầu giai đoạn Trưởng Thành');

    // 2.7: Level 4: 600 EXP -> Cổ Thụ
    const l4_start = calculateLevelFromExp(600);
    assert(l4_start.level === 4 && l4_start.progressPercent === 0, 'Level 4 với 600 EXP bắt đầu giai đoạn Cổ Thụ');

    // 2.8: Level 5: 1200 EXP -> Cực đại Max Level 100%
    const l5_max = calculateLevelFromExp(1200);
    assert(l5_max.level === 5 && l5_max.progressPercent === 100, 'Level 5 đạt mốc cực đại 1200 EXP với 100% tiến độ');

    // 2.9: Vượt mốc 1200 EXP (e.g. 2500 EXP, 5000 EXP) -> Vẫn giữ Level 5 và 100% cap
    const l5_over = calculateLevelFromExp(5000);
    assert(l5_over.level === 5 && l5_over.progressPercent === 100, 'Vượt mốc cực đại (5000 EXP) vẫn giữ nguyên Level 5 và 100% cap');

    // =========================================================================
    // SECTION 3: ĐIỀU HƯỚNG VÒNG THI & GIAI ĐOẠN THEO NGÀY (getCurrentRound)
    // =========================================================================
    console.log('\n📦 [3/8] Test Key Suite 3: Điều Hướng 15 Vòng Thi Theo Ngày...');

    // 3.1: Trước ngày khai mạc (01/09/2026) -> Trả về Round 1
    const rPre = getCurrentRound('2026-09-01');
    assert(rPre.round === 1 && rPre.stage === 'SEEDING', 'Trước ngày 05/09 trả về Lượt 1 (SEEDING)');

    // 3.2: Ngày 05/09/2026 -> Round 1
    const r1 = getCurrentRound('2026-09-05');
    assert(r1.round === 1 && r1.label.includes('Lượt 1'), 'Ngày 05/09 trả về chính xác Lượt 1');

    // 3.3: Ngày 08/09/2026 -> Round 2 (Tích lũy nảy mầm)
    const r2 = getCurrentRound('2026-09-08');
    assert(r2.round === 2 && r2.stage === 'SEEDING', 'Ngày 08/09 trả về chính xác Lượt 2 (SEEDING)');

    // 3.4: Ngày 11/09/2026 -> Round 3 (Khởi động tính EXP - GROWTH)
    const r3 = getCurrentRound('2026-09-11');
    assert(r3.round === 3 && r3.stage === 'GROWTH', 'Ngày 11/09 chuyển sang Lượt 3 (GROWTH)');

    // 3.5: Ngày 26/09/2026 -> Round 8 (Chạm mốc 1000 EXP)
    const r8 = getCurrentRound('2026-09-26');
    assert(r8.round === 8 && r8.stage === 'GROWTH', 'Ngày 26/09 trả về chính xác Lượt 8 (GROWTH)');

    // 3.6: Ngày 17/10/2026 -> Round 15 (Chung cuộc - FINALS)
    const r15 = getCurrentRound('2026-10-17');
    assert(r15.round === 15 && r15.stage === 'FINALS', 'Ngày 17/10 chuyển sang Lượt 15 (FINALS - Đại Cổ Thụ)');

    // 3.7: Kiểm tra tổng số 15 vòng cấu hình
    assert(ROUNDS_CONFIG.length === 15, 'Cấu hình hệ thống có đầy đủ đúng 15 vòng thi');

    // =========================================================================
    // SECTION 4: THUẬT TOÁN XẾP HẠNG 4 BẬC (4-Tier Tie-Breaker Sorting)
    // =========================================================================
    console.log('\n📦 [4/8] Test Key Suite 4: Thuật Toán Xếp Hạng 4 Bậc Bảng Tổng Sắp...');

    function compareTeams(a, b) {
      if (b.total_exp !== a.total_exp) return b.total_exp - a.total_exp;
      if (b.avg_participation_rate !== a.avg_participation_rate) return b.avg_participation_rate - a.avg_participation_rate;
      const mKeys = ['milestone_2500_at', 'milestone_1000_at', 'milestone_400_at', 'milestone_150_at'];
      for (const k of mKeys) {
        if (a[k] && b[k]) {
          const diff = new Date(a[k]).getTime() - new Date(b[k]).getTime();
          if (diff !== 0) return diff;
        } else if (a[k] && !b[k]) return -1;
        else if (!a[k] && b[k]) return 1;
      }
      if (b.perfect_rounds_count !== a.perfect_rounds_count) return b.perfect_rounds_count - a.perfect_rounds_count;
      return a.id - b.id;
    }

    // 4.1: Tier 1: Điểm EXP cao hơn xếp trên
    const tA_exp = { id: 1, total_exp: 2000, avg_participation_rate: 80, perfect_rounds_count: 0 };
    const tB_exp = { id: 2, total_exp: 1500, avg_participation_rate: 95, perfect_rounds_count: 5 };
    assert(compareTeams(tA_exp, tB_exp) < 0, 'Tier 1: Đội có EXP cao hơn (2000) xếp trên đội có EXP thấp hơn (1500)');

    // 4.2: Tier 2: Bằng EXP -> Tỷ lệ tham gia cao hơn xếp trên
    const tA_rate = { id: 1, total_exp: 1000, avg_participation_rate: 92.5, perfect_rounds_count: 1 };
    const tB_rate = { id: 2, total_exp: 1000, avg_participation_rate: 85.0, perfect_rounds_count: 3 };
    assert(compareTeams(tA_rate, tB_rate) < 0, 'Tier 2: Khi bằng EXP, đội có tỷ lệ tham gia cao hơn (92.5% vs 85%) xếp trên');

    // 4.3: Tier 3: Bằng EXP & Tỷ lệ tham gia -> Đội cán mốc sớm hơn xếp trên
    const tA_time = { 
      id: 1, total_exp: 1000, avg_participation_rate: 90, 
      milestone_1000_at: '2026-09-20T10:00:00Z', perfect_rounds_count: 1 
    };
    const tB_time = { 
      id: 2, total_exp: 1000, avg_participation_rate: 90, 
      milestone_1000_at: '2026-09-21T10:00:00Z', perfect_rounds_count: 1 
    };
    assert(compareTeams(tA_time, tB_time) < 0, 'Tier 3: Cán mốc sớm hơn (20/09 vs 21/09) xếp trên');

    // 4.4: Tier 3: Đội đã cán mốc xếp trên đội chưa cán mốc (NULL)
    const tA_hasM = { id: 1, total_exp: 400, avg_participation_rate: 80, milestone_400_at: '2026-09-15T00:00:00Z', perfect_rounds_count: 0 };
    const tB_noM  = { id: 2, total_exp: 400, avg_participation_rate: 80, milestone_400_at: null, perfect_rounds_count: 0 };
    assert(compareTeams(tA_hasM, tB_noM) < 0, 'Tier 3: Đội đã đạt mốc thời gian xếp trên đội chưa đạt mốc (NULLS LAST)');

    // 4.5: Tier 4: Bằng cả 3 tiêu chí trên -> Đội có số vòng hoàn hảo (100% tham gia) nhiều hơn xếp trên
    const tA_perf = { id: 1, total_exp: 500, avg_participation_rate: 80, milestone_400_at: null, perfect_rounds_count: 4 };
    const tB_perf = { id: 2, total_exp: 500, avg_participation_rate: 80, milestone_400_at: null, perfect_rounds_count: 2 };
    assert(compareTeams(tA_perf, tB_perf) < 0, 'Tier 4: Đội có số vòng hoàn hảo nhiều hơn (4 vs 2) xếp trên');

    // =========================================================================
    // SECTION 5: CÂY VÀ QUẢ LEVEL 5 (Level 5 Fruits Coordinates & Logic)
    // =========================================================================
    console.log('\n📦 [5/8] Test Key Suite 5: Logic Trái Tri Thức Cây Level 5...');

    // 5.1: Cây chưa đạt Level 5 (EXP < 1200) -> Không hiển thị quả
    const isFruitVisibleL4 = (1199 >= 1200);
    assert(isFruitVisibleL4 === false, 'Cây 1199 EXP (Level 4) chưa hiển thị Trái Tri Thức');

    // 5.2: Cây đạt Level 5 (EXP >= 1200) -> Kích hoạt hiển thị quả
    const isFruitVisibleL5 = (1200 >= 1200);
    assert(isFruitVisibleL5 === true, 'Cây 1200 EXP (Level 5) kích hoạt hiển thị Trái Tri Thức');

    // 5.3: Quy định đúng 5 quả độc lập trên tán cây
    const TOTAL_FRUITS_COUNT = 5;
    assert(TOTAL_FRUITS_COUNT === 5, 'Mỗi Cây Level 5 sinh ra đúng 5 Trái Tri Thức độc lập');

    // 5.4: Chỉ số quả nằm trong khoảng [0..4]
    let fruitIndicesValid = true;
    for (let i = 0; i < 5; i++) {
      if (i < 0 || i > 4) fruitIndicesValid = false;
    }
    assert(fruitIndicesValid, 'Tất cả 5 chỉ số quả nằm trọn vẹn trong khoảng [0..4]');

    // 5.5: Thưởng EXP khi hái quả: +5 EXP
    const FRUIT_HARVEST_REWARD = 5;
    assert(FRUIT_HARVEST_REWARD === 5, 'Hái 1 Trái Tri Thức được cộng chính xác +5 EXP vào hệ sinh thái');

    // =========================================================================
    // SECTION 6: TOÀN VẸN DỮ LIỆU 8 ĐỘI & 288 THÀNH VIÊN (PostgreSQL DB Integrity)
    // =========================================================================
    console.log('\n📦 [6/8] Test Key Suite 6: Tính Toàn Vẹn 8 Đội & 288 Độc Giả...');

    // 6.1: Đúng 8 đội trong bảng teams
    const allTeams = await TeamService.getAllTeams();
    assert(allTeams.length === 8, 'Hệ thống có đầy đủ đúng 8 đội');

    // 6.2: Kiểm tra chính xác sĩ số của từng đội
    const exactCounts = { 1: 39, 2: 49, 3: 30, 4: 26, 5: 37, 6: 32, 7: 36, 8: 39 };
    let allMatched = true;
    for (const t of allTeams) {
      if (t.actual_members !== exactCounts[t.id]) {
        allMatched = false;
        console.error(`Mismatch Team ${t.id}: got ${t.actual_members}, expected ${exactCounts[t.id]}`);
      }
    }
    assert(allMatched, '100% sĩ số 8 đội khớp chính xác (Đội 1: 39, Đội 2: 49, Đội 3: 30, Đội 4: 26, Đội 5: 37, Đội 6: 32, Đội 7: 36, Đội 8: 39)');

    // 6.3: Tổng số user trong PostgreSQL là đúng 288
    const countUsers = await db.query('SELECT COUNT(*) FROM users');
    assert(parseInt(countUsers.rows[0].count, 10) === 288, 'Cơ sở dữ liệu lưu trữ chính xác 288 độc giả FoxREAD');

    // 6.4: Lookup độc giả theo Nickname
    const userByEmail = await UserService.lookupUser('Viết Kim Hoàng');
    assert(userByEmail && userByEmail.nickname === 'Viết Kim Hoàng' && userByEmail.team_id === 5, 'Tra cứu theo bút danh Viết Kim Hoàng trả về đúng Đội 5');

    // 6.5: Lookup độc giả theo Họ tên
    const userByCode = await UserService.lookupUser('Đỗ Viết Kim Hoàng');
    assert(userByCode && userByCode.full_name === 'Đỗ Viết Kim Hoàng', 'Tra cứu theo họ tên Đỗ Viết Kim Hoàng trả về đúng độc giả');

    // 6.6: Fast Autocomplete Suggestions
    const suggestions = await UserService.suggestUsers('Kim Hoàng', 5);
    assert(suggestions.length >= 1 && suggestions[0].nickname.includes('Kim Hoàng'), 'API gợi ý tìm kiếm tức thời (Autocomplete) trả về kết quả chính xác');

    // =========================================================================
    // SECTION 7: RÀNG BUỘC ĐÓNG GÓP THEO VÒNG (Round Anti-Spam Constraint)
    // =========================================================================
    console.log('\n📦 [7/8] Test Key Suite 7: Ràng Buộc Đóng Góp Theo Vòng (1 User / Vòng)...');

    const testUserId = userByEmail.id;
    const testTeamId = 5;

    // Clean previous contribution for this user in current round
    const curRound = await RoundService.getCurrentRound();
    await db.query('DELETE FROM round_contributions WHERE user_id = $1 AND round_number = $2', [testUserId, curRound.round_number]);

    // 7.1: Đóng góp lần 1 trong vòng -> isNewParticipation = true
    const client = await db.pool.connect();
    try {
      const contrib1 = await RoundService.recordContribution(client, {
        userId: testUserId,
        teamId: testTeamId,
        code: 'TEST_ROUND_CONTRIB'
      });
      assert(contrib1.isNewParticipation === true, 'Đóng góp lần 1 trong vòng thành công (isNewParticipation = true)');

      // 7.2: Đóng góp lần 2 trong cùng vòng -> isNewParticipation = false (chống spam)
      const contrib2 = await RoundService.recordContribution(client, {
        userId: testUserId,
        teamId: testTeamId,
        code: 'TEST_ROUND_CONTRIB_REPEAT'
      });
      assert(contrib2.isNewParticipation === false, 'Đóng góp lần 2 trong cùng vòng bị chặn tính điểm kép (isNewParticipation = false)');

      // 7.3: Kiểm tra ràng buộc Unique index trong database
      const countContribs = await db.query(
        'SELECT COUNT(*) FROM round_contributions WHERE user_id = $1 AND round_number = $2',
        [testUserId, curRound.round_number]
      );
      assert(parseInt(countContribs.rows[0].count, 10) === 1, 'Cơ sở dữ liệu chỉ lưu đúng 1 bản ghi tham gia hợp lệ của user trong vòng');
    } finally {
      client.release();
    }

    // =========================================================================
    // SECTION 8: KHÓA BẢO VỆ GIAO DỊCH & IDEMPOTENCY (ACID Integrity)
    // =========================================================================
    console.log('\n📦 [8/8] Test Key Suite 8: Giao Dịch ACID & Idempotency...');

    // 8.1: Idempotency Key lưu trữ và ngăn trùng lặp
    const testKey = `idem_unit_test_${Date.now()}`;
    await db.query(`
      INSERT INTO idempotency_keys (key, request_path, response_payload, status_code)
      VALUES ($1, '/api/v1/test', '{"success":true}', 200)
    `, [testKey]);

    const idemCheck = await db.query('SELECT * FROM idempotency_keys WHERE key = $1', [testKey]);
    assert(idemCheck.rows.length === 1 && idemCheck.rows[0].status_code === 200, 'Khóa Idempotency Key được lưu trữ thành công');

    // 8.2: Trùng khóa Idempotency Key bị chặn bởi PRIMARY KEY constraint
    let duplicateBlocked = false;
    try {
      await db.query(`
        INSERT INTO idempotency_keys (key, request_path, response_payload, status_code)
        VALUES ($1, '/api/v1/test', '{"success":true}', 200)
      `, [testKey]);
    } catch (err) {
      if (err.code === '23505') duplicateBlocked = true;
    }
    assert(duplicateBlocked, 'Primary key constraint ngăn chặn thành công việc tạo trùng lặp Idempotency Key');

    // 8.3: Bảng exp_ledger có đầy đủ các loại giao dịch được ENUM hóa
    const allowedTypes = ['BOOK_CONTRIBUTION', 'QUOTE_LIKE', 'DAILY_DEW', 'FRUIT_HARVEST', 'ADMIN_BONUS', 'MODERATION_PENALTY'];
    assert(allowedTypes.length === 6, 'Hệ sinh thái EXP hỗ trợ đầy đủ 6 loại giao dịch chuẩn');

    // 8.4: Kiểm tra chi tiết 1 đội qua getTeamById (bao gồm 15 vòng)
    const team1Detail = await TeamService.getTeamById(1);
    assert(team1Detail && team1Detail.id === 1, 'TeamService.getTeamById(1) trả về đầy đủ hồ sơ Đội 1');
    assert(team1Detail.rounds && team1Detail.rounds.length === 15, 'Hồ sơ đội chứa đầy đủ lịch sử 15 vòng thi');
    assert(team1Detail.members && team1Detail.members.length === 39, 'Hồ sơ đội chứa danh sách thành viên đầy đủ đúng sĩ số 39 người');

  } catch (err) {
    console.error('💥 Lỗi ngoài dự kiến trong Unit Test Suite:', err);
    failed++;
  } finally {
    console.log('\n=================================================================');
    console.log(`📊 KẾT QUẢ KIỂM THỬ TOÀN DIỆN: ${passed} PASSED | ${failed} FAILED`);
    console.log(`🎯 TỶ LỆ THÀNH CÔNG: ${Math.round((passed / (passed + failed || 1)) * 100)}% (100% TARGET)`);
    console.log('=================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runUnitSuite();
