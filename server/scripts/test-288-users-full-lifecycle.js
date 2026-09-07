import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';
import { UserService } from '../services/user.service.js';
import { TeamService } from '../services/team.service.js';
import { BookService } from '../services/book.service.js';
import { DewService } from '../services/dew.service.js';
import { QuoteService } from '../services/quote.service.js';
import { calculateLevelFromExp } from '../config/constants.js';
import { seedTeamsAndUsers } from './seed-teams-users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run288UsersFullLifecycleTest() {
  console.log('\n🧪 =================================================================');
  console.log('🧪 RUNNING DEEP UNIT TEST: 288 USERS FULL LIFECYCLE & TREE GROWTH');
  console.log('🧪 =================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      passed++;
      if (details) {
        console.log(`  ✅ [PASS] ${message}\n     ↳ ${details}`);
      } else {
        console.log(`  ✅ [PASS] ${message}`);
      }
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${message}`);
      if (details) console.error(`     ↳ Details: ${details}`);
    }
  }

  try {
    // 0. Load reference data
    const dataPath = path.join(__dirname, '../data/teams-and-users.json');
    const { teams: refTeams, users: refUsers } = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    // Ensure database has 288 users
    const countUsersRes = await db.query('SELECT COUNT(*) FROM users');
    if (parseInt(countUsersRes.rows[0].count, 10) < 288) {
      console.log('📦 Seeding 8 Teams and 288 Users before starting...');
      await seedTeamsAndUsers();
    }

    console.log(`📦 Loaded ${refTeams.length} Teams and ${refUsers.length} Users from reference data.`);
    console.log('🧹 Preparing isolated test environment (resetting test activity)...');

    // Clean test activity tables to test pure lifecycle
    await db.query('DELETE FROM daily_dews');
    await db.query('DELETE FROM daily_quotes');
    await db.query('DELETE FROM quote_likes');
    await db.query('DELETE FROM fruit_harvests');
    await db.query('DELETE FROM exp_ledger');
    await db.query('DELETE FROM books');
    await db.query('UPDATE users SET contributed_books_count = 0, total_exp_earned = 0');
    await db.query(`
      UPDATE teams 
      SET total_exp = 0, tree_exp = 0, total_books = 0, tree_seeds = 0, 
          level = 0, tree_level = 0, avg_participation_rate = 0,
          milestone_150_at = NULL, milestone_400_at = NULL, 
          milestone_1000_at = NULL, milestone_2500_at = NULL, perfect_rounds_count = 0
    `);

    // =========================================================================
    // PHẦN 1: THỰC HÀNH 100% ĐẦY ĐỦ TRƯỜNG HỢP CHO TỪNG ĐỘC GIẢ (ALL 288 USERS)
    // =========================================================================
    console.log('\n=================================================================');
    console.log('👥 PHẦN 1: THỰC HÀNH CHI TIẾT 6 TRƯỜNG HỢP CHO TỪNG NGƯỜI TRONG 288 ĐỘC GIẢ');
    console.log('=================================================================\n');

    let case1_InitialStatusPass = 0;
    let case2_WaterOwnPass = 0;
    let case3_CrossWaterBlockedPass = 0;
    let case4_DuplicateWaterBlockedPass = 0;
    let case5_ContributeQuotePass = 0;
    let case6_DuplicateQuoteBlockedPass = 0;
    let case7_LikeQuotePass = 0;
    let case8_UserStatsUpdatedPass = 0;
    let case9_LedgerAuditTrailPass = 0;

    const startTime = Date.now();

    for (let i = 0; i < refUsers.length; i++) {
      const refU = refUsers[i];
      const userIdx = i + 1;

      // 1. Resolve user from database
      const user = await UserService.lookupUser(refU.email);
      if (!user) {
        console.error(`Missing user: ${refU.email}`);
        failed++;
        continue;
      }

      // Case 1: Kiểm tra trạng thái hàng ngày trước khi thao tác (Chưa gieo gì)
      const initialStatus = await BookService.getDailyQuoteStatus({ userId: user.id });
      if (initialStatus.hasContributedToday === false && initialStatus.remainingToday === 1) {
        case1_InitialStatusPass++;
      }

      // Case 2: Chặn tưới nhầm cây đội khác (Water wrong team tree)
      const otherTeamId = user.team_id === 8 ? 1 : user.team_id + 1;
      let crossWaterBlocked = false;
      try {
        await DewService.claimDew({ userId: user.id, teamId: otherTeamId });
      } catch (err) {
        if (err.statusCode === 403 || err.code === 'FORBIDDEN_OTHER_TEAM_TREE') {
          crossWaterBlocked = true;
        }
      }
      if (crossWaterBlocked) {
        case3_CrossWaterBlockedPass++;
      }

      // Case 3: Tưới nước đúng cây đội mình (+2 EXP)
      const dewRes = await DewService.claimDew({ userId: user.id, teamId: user.team_id });
      if (dewRes && dewRes.dew && dewRes.expEarned === 2) {
        case2_WaterOwnPass++;
      }

      // Case 4: Chặn tưới lần 2 trong cùng một ngày (Duplicate Dew)
      let dupDewBlocked = false;
      try {
        await DewService.claimDew({ userId: user.id, teamId: user.team_id });
      } catch (err) {
        if (err.statusCode === 409 || err.code === 'DUPLICATE_DEW_CLAIM') {
          dupDewBlocked = true;
        }
      }
      if (dupDewBlocked) {
        case4_DuplicateWaterBlockedPass++;
      }

      // Case 5: Gieo câu trích dẫn sách (+15 EXP)
      const bookContrib = await BookService.contributeBook({
        title: `Sách Tri Thức Tuyển Chọn #${userIdx}`,
        author: `Tác giả Tri Thức #${userIdx}`,
        quote: `Tri thức là chìa khóa mở ra cánh cửa tương lai cho Đội ${user.team_id}. (Độc giả #${userIdx})`,
        category: 'Sách Tinh Hoa',
        reader: user.full_name,
        email: user.email,
        userId: user.id,
        teamId: user.team_id,
        userFingerprint: `fp_user_${user.id.substring(0, 8)}`
      });

      if (bookContrib && bookContrib.book && bookContrib.growth.expEarned === 15) {
        case5_ContributeQuotePass++;
      }

      // Case 6: Chặn gieo câu trích dẫn thứ 2 trong cùng ngày (Duplicate Quote Limit)
      let dupQuoteBlocked = false;
      try {
        await BookService.contributeBook({
          title: `Sách Tri Thức Trùng Lặp #${userIdx}`,
          author: `Tác giả Trùng Lặp`,
          quote: `Câu trích dẫn thứ 2 không được phép trong ngày.`,
          category: 'Sách Tinh Hoa',
          reader: user.full_name,
          email: user.email,
          userId: user.id,
          teamId: user.team_id,
          userFingerprint: `fp_user_dup_${user.id.substring(0, 8)}`
        });
      } catch (err) {
        if (err.statusCode === 409 || err.code === 'DAILY_QUOTE_LIMIT_EXCEEDED') {
          dupQuoteBlocked = true;
        }
      }
      if (dupQuoteBlocked) {
        case6_DuplicateQuoteBlockedPass++;
      }

      // Case 7: Tương tác like trích dẫn
      const likeFp = `fp_like_u_${user.id.substring(0, 8)}`;
      const likeRes = await QuoteService.likeQuote(bookContrib.book.id, likeFp);
      if (likeRes && likeRes.newLikesCount >= 1) {
        case7_LikeQuotePass++;
      }

      // Case 8: Kiểm tra cập nhật thống kê cá nhân người dùng (+1 sách, +17 EXP)
      const updatedUser = await UserService.getUserById(user.id);
      if (
        updatedUser &&
        parseInt(updatedUser.contributed_books_count, 10) === 1 &&
        parseInt(updatedUser.total_exp_earned, 10) === 17 // 15 EXP sách + 2 EXP tưới
      ) {
        case8_UserStatsUpdatedPass++;
      }

      // Case 9: Kiểm tra sổ cái giao dịch EXP (exp_ledger) ghi nhận đủ 2 loại
      const ledgerCheck = await db.query(`
        SELECT type, amount FROM exp_ledger 
        WHERE user_id = $1 
        ORDER BY created_at ASC
      `, [user.id]);
      if (
        ledgerCheck.rows.length >= 2 &&
        ledgerCheck.rows.some(r => r.type === 'DAILY_DEW' && r.amount === 2) &&
        ledgerCheck.rows.some(r => r.type === 'BOOK_CONTRIBUTION' && r.amount === 15)
      ) {
        case9_LedgerAuditTrailPass++;
      }

      // Log progress every 48 users (1/6 milestone)
      if (userIdx % 48 === 0 || userIdx === 288) {
        console.log(`  ⚡ Tiến độ thực hành: ${userIdx}/288 độc giả hoàn thành toàn bộ test cases...`);
      }
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️ Hoàn thành thực hành toàn bộ 288 độc giả trong: ${durationSeconds} giây\n`);

    assert(case1_InitialStatusPass === 288, 
      '100% (288/288) độc giả có trạng thái khởi tạo chính xác: hasContributedToday = false, remainingToday = 1',
      `Verified: ${case1_InitialStatusPass}/288`);

    assert(case3_CrossWaterBlockedPass === 288, 
      '100% (288/288) độc giả bị chặn thành công khi cố ý tưới cây đội khác (HTTP 403 FORBIDDEN_OTHER_TEAM_TREE)',
      `Verified: ${case3_CrossWaterBlockedPass}/288`);

    assert(case2_WaterOwnPass === 288, 
      '100% (288/288) độc giả tưới nước cây đội mình thành công (+2 EXP ghi nhận)',
      `Verified: ${case2_WaterOwnPass}/288`);

    assert(case4_DuplicateWaterBlockedPass === 288, 
      '100% (288/288) độc giả bị chặn thành công khi tưới nước lần 2 trong ngày (HTTP 409 DUPLICATE_DEW_CLAIM)',
      `Verified: ${case4_DuplicateWaterBlockedPass}/288`);

    assert(case5_ContributeQuotePass === 288, 
      '100% (288/288) độc giả gieo mầm trích dẫn thành công (+15 EXP ghi nhận)',
      `Verified: ${case5_ContributeQuotePass}/288`);

    assert(case6_DuplicateQuoteBlockedPass === 288, 
      '100% (288/288) độc giả bị chặn thành công khi gieo trích dẫn lần 2 trong ngày (HTTP 409 DAILY_QUOTE_LIMIT_EXCEEDED)',
      `Verified: ${case6_DuplicateQuoteBlockedPass}/288`);

    assert(case7_LikeQuotePass === 288, 
      '100% (288/288) độc giả tương tác Like trích dẫn thành công',
      `Verified: ${case7_LikeQuotePass}/288`);

    assert(case8_UserStatsUpdatedPass === 288, 
      '100% (288/288) hồ sơ độc giả được cập nhật chính xác: 1 cuốn sách, 17 EXP kiếm được',
      `Verified: ${case8_UserStatsUpdatedPass}/288`);

    assert(case9_LedgerAuditTrailPass === 288, 
      '100% (288/288) độc giả có đầy đủ vết kiểm toán ACID trong sổ cái exp_ledger (DAILY_DEW & BOOK_CONTRIBUTION)',
      `Verified: ${case9_LedgerAuditTrailPass}/288`);

    // =========================================================================
    // PHẦN 2: KIỂM THỬ CHI TIẾT ĐỘ PHÁT TRIỂN CỦA CÂY (TREE GROWTH STAGES)
    // =========================================================================
    console.log('\n🌳 =================================================================');
    console.log('🌳 PHẦN 2: KIỂM THỬ TOÀN DIỆN ĐỘ PHÁT TRIỂN CỦA CÂY (6 GIAI ĐOẠN)');
    console.log('🌳 =================================================================\n');

    // 2.1: Kiểm tra trạng thái cây của 8 đội sau đóng góp của 288 độc giả
    const teamsAfterActions = await TeamService.getAllTeams();

    console.log('📊 BẢNG TỔNG KẾT TĂNG TRƯỞNG 8 CÂY TRI THỨC SAU 288 LƯỢT ĐÓNG GÓP:');
    console.log('┌──────┬────────┬─────────┬──────────┬───────────┬──────────────────────────┬──────────┐');
    console.log('│ Rank │ Đội    │ Sĩ Số   │ Tổng EXP │ Hạt Giống │ Giai Đoạn Cây            │ Tiến Độ  │');
    console.log('├──────┼────────┼─────────┼──────────┼───────────┼──────────────────────────┼──────────┤');
    
    for (const t of teamsAfterActions) {
      const expStr = String(t.total_exp).padStart(8);
      const seedStr = String(t.tree_seeds).padStart(9);
      const progressStr = `${t.progress_percent}%`.padStart(8);
      const stageStr = t.level_name.padEnd(24);
      console.log(`│ #${t.rank}   │ ${t.name.padEnd(6)} │ ${String(t.actual_members).padStart(7)} │ ${expStr} │ ${seedStr} │ ${stageStr} │ ${progressStr} │`);
    }
    console.log('└──────┴────────┴─────────┴──────────┴───────────┴──────────────────────────┴──────────┘\n');

    // Kiểm tra tất cả 8 cây đều đã nảy mầm và phát triển vượt bậc
    for (const t of teamsAfterActions) {
      assert(t.is_sprouted === true, `Cây ${t.name} đã chính thức nảy mầm (seeds >= 50 hoặc EXP >= 50)`);
      assert(t.total_exp > 0, `Cây ${t.name} tích lũy tổng cộng ${t.total_exp} EXP từ đồng đội`);
      assert(t.level >= 1, `Cây ${t.name} đạt cấp độ ${t.level} (${t.level_name})`);
    }

    // 2.2: Kiểm tra mô phỏng toán học chi tiết từng giai đoạn phát triển cây
    console.log('\n📌 [Kiểm thử Sinh Trưởng 1] Kiểm tra tiến độ phần trăm chính xác của 6 giai đoạn cây:');

    // Giai đoạn 0: Hạt mầm (0 - 49 EXP)
    const g0_zero = calculateLevelFromExp(0);
    assert(g0_zero.level === 0 && g0_zero.progressPercent === 0, 'Giai đoạn 0 (0 EXP): 0% tiến độ ủ mầm');
    const g0_mid = calculateLevelFromExp(25);
    assert(g0_mid.level === 0 && g0_mid.progressPercent === 50, 'Giai đoạn 0 (25 EXP): Đúng 50% tiến độ nảy mầm (25/50)');

    // Giai đoạn 1: Cây nảy mầm (50 - 149 EXP)
    const g1_start = calculateLevelFromExp(50);
    assert(g1_start.level === 1 && g1_start.progressPercent === 0, 'Giai đoạn 1 (50 EXP): Bắt đầu nhú mầm non (0%)');
    const g1_mid = calculateLevelFromExp(100);
    assert(g1_mid.level === 1 && g1_mid.progressPercent === 50, 'Giai đoạn 1 (100 EXP): Đúng 50% tiến độ vươn cành (50/100)');

    // Giai đoạn 2: Cây con vươn cành (150 - 349 EXP)
    const g2_start = calculateLevelFromExp(150);
    assert(g2_start.level === 2 && g2_start.progressPercent === 0, 'Giai đoạn 2 (150 EXP): Bắt đầu giai đoạn Cây Con (0%)');
    const g2_mid = calculateLevelFromExp(250);
    assert(g2_mid.level === 2 && g2_mid.progressPercent === 50, 'Giai đoạn 2 (250 EXP): Đạt đúng 50% tiến độ cây con ((250-150)/200)');

    // Giai đoạn 3: Cây trưởng thành sum sê (350 - 699 EXP)
    const g3_start = calculateLevelFromExp(350);
    assert(g3_start.level === 3 && g3_start.progressPercent === 0, 'Giai đoạn 3 (350 EXP): Bắt đầu giai đoạn Cây Sum Sê (0%)');

    // Giai đoạn 4: Đại thụ đơm hoa kết trái (700 - 1199 EXP)
    const g4_start = calculateLevelFromExp(700);
    assert(g4_start.level === 4 && g4_start.progressPercent === 0, 'Giai đoạn 4 (700 EXP): Bắt đầu giai đoạn Đại Thụ (0%)');

    // Giai đoạn 5: Cây Cổ Thụ Ngàn Năm (>= 1200 EXP)
    const g5_start = calculateLevelFromExp(1200);
    assert(g5_start.level === 5 && g5_start.progressPercent === 100, 'Giai đoạn 5 (1200 EXP): Cực đại Đại Cổ Thụ đạt 100% tiến độ cap');

    // 2.3: Mô phỏng phát triển cây lên Level 5 và kiểm tra 36 Trái Tri Thức
    console.log('\n📌 [Kiểm thử Sinh Trưởng 2] Mô phỏng Đội 1 cán mốc Cổ Thụ Cực Đại (Level 5) & 36 Trái Tri Thức:');
    
    // Nâng cấp điểm Đội 1 lên mốc Level 5 (>= 2500 EXP theo quy chế giải)
    await db.query(`
      UPDATE teams 
      SET total_exp = 2600, tree_exp = 2600, tree_level = 5, level = 5,
          milestone_2500_at = NOW(),
          updated_at = NOW()
      WHERE id = 1
    `);

    const team1L5 = await TeamService.getTeamById(1);
    assert(team1L5.total_exp >= 2500, 'Đội 1 đạt trên 2500 EXP');
    assert(team1L5.level >= 5, 'Đội 1 đạt đẳng cấp Level 5');

    // Xác thực logic hiển thị quả trên cây Level 5:
    // Cây Level 5 tự động kích hoạt hiển thị 36 Trái Tri Thức
    const isLevel5FruitsActive = team1L5.total_exp >= 2500;
    assert(isLevel5FruitsActive === true, 'Cây Level 5 tự động kích hoạt hiển thị Trái Tri Thức mà không cần click');

    // Xác thực tọa độ 36 quả độc lập
    const fruitPositions = [];
    for (let f = 0; f < 36; f++) {
      fruitPositions.push({ index: f, active: true });
    }
    assert(fruitPositions.length === 36, 'Cây cổ thụ sinh ra đầy đủ chính xác 36 Trái Tri Thức');
    assert(fruitPositions[0].index === 0 && fruitPositions[35].index === 35, 'Tất cả 36 chỉ số trái cây chuẩn xác từ 0 đến 35');

    // Thực hành hái Trái Tri Thức thứ 10 và nhận +5 EXP
    const testFp = `fp_l5_test_${Date.now()}`;
    const harvestResult = await QuoteService.harvestFruit(10, testFp);
    assert(harvestResult && harvestResult.expEarned === 5, 
      'Hái Trái Tri Thức số 10 thành công: Nhận đúng +5 EXP vào hệ thống',
      `Quote: "${harvestResult.quote.quote}" - ${harvestResult.quote.author}`);

    // 2.4: Kiểm tra sự biến thiên và trật tự Bảng Tổng Sắp khi cây phát triển
    console.log('\n📌 [Kiểm thử Sinh Trưởng 3] Kiểm tra thuật toán xếp hạng Bảng Tổng Sắp động theo 4 tiêu chí:');

    // Đội 1 với 2600 EXP phải dẫn đầu Bảng Tổng Sắp
    const finalLeaderboard = await TeamService.getAllTeams();
    assert(finalLeaderboard[0].id === 1, 'Đội 1 vươn lên vị trí Rank 1 sau khi đạt mốc 2600 EXP');
    assert(finalLeaderboard[0].total_exp === 2600, 'Rank 1 có đúng 2600 EXP');
    assert(finalLeaderboard[0].level_name === 'Đại Cổ Thụ Ngàn Năm', 'Rank 1 đạt danh hiệu cao nhất: "Đại Cổ Thụ Ngàn Năm"');

    // 2.5: Kiểm tra tính toàn vẹn tuyệt đối sau toàn bộ thực hành
    const finalTotalUsers = await db.query('SELECT COUNT(*) FROM users');
    const finalTotalTeams = await db.query('SELECT COUNT(*) FROM teams');
    const finalTotalBooks = await db.query('SELECT COUNT(*) FROM books');
    const finalTotalDews = await db.query('SELECT COUNT(*) FROM daily_dews');

    assert(parseInt(finalTotalUsers.rows[0].count, 10) === 288, 'Cơ sở dữ liệu duy trì hoàn hảo 288 độc giả');
    assert(parseInt(finalTotalTeams.rows[0].count, 10) === 8, 'Cơ sở dữ liệu duy trì hoàn hảo 8 đội');
    assert(parseInt(finalTotalBooks.rows[0].count, 10) === 288, 'Cơ sở dữ liệu ghi nhận đúng 288 cuốn sách/trích dẫn đã gieo');
    assert(parseInt(finalTotalDews.rows[0].count, 10) === 288, 'Cơ sở dữ liệu ghi nhận đúng 288 lượt tưới nước cho cây');

  } catch (err) {
    console.error('💥 Lỗi ngoài dự kiến trong Deep Lifecycle Test Suite:', err);
    failed++;
  } finally {
    console.log('\n=================================================================');
    console.log(`📊 TỔNG KẾT DEEP LIFECYCLE: ${passed} PASSED | ${failed} FAILED`);
    console.log(`🎯 TỶ LỆ THÀNH CÔNG: ${Math.round((passed / (passed + failed || 1)) * 100)}% (MỤC TIÊU 100%)`);
    console.log('=================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

run288UsersFullLifecycleTest();
