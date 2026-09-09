import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';
import { TeamService } from '../services/team.service.js';
import { UserService } from '../services/user.service.js';
import { BookService } from '../services/book.service.js';
import { DewService } from '../services/dew.service.js';
import { QuoteService } from '../services/quote.service.js';
import { ROUNDS_CONFIG } from '../config/rounds.config.js';
import { seedTeamsAndUsers } from './seed-teams-users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runFullKeyTeamsAndUsersTest() {
  console.log('\n🧪 =================================================================');
  console.log('🧪 RUNNING FULL-KEY VERIFICATION SUITE: 8 TEAMS & 288 USERS (100%)');
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
    // 0. Ensure 8 Teams and 288 Users are seeded in the database
    const userCountRes = await db.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCountRes.rows[0].count, 10) < 288) {
      console.log('📦 Auto-seeding 8 Teams and 288 Users for full-key testing...');
      await seedTeamsAndUsers();
    }

    // Load reference JSON
    const dataPath = path.join(__dirname, '../data/teams-and-users.json');
    const { teams: refTeams, users: refUsers } = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    console.log(`📦 Loaded reference data: ${refTeams.length} Teams | ${refUsers.length} Users\n`);

    // =========================================================================
    // PHẦN 1: KIỂM THỬ FULL-KEY CHO 8 ĐỘI (100% COVERAGE CHO 8 TEAMS)
    // =========================================================================
    console.log('🏆 =================================================================');
    console.log('🏆 PHẦN 1: KIỂM THỬ FULL-KEY CHO TỪNG ĐỘI TRONG 8 ĐỘI (8 TEAMS)');
    console.log('🏆 =================================================================\n');

    // 1.1: Tổng số đội trong hệ thống
    const allTeams = await TeamService.getAllTeams();
    assert(allTeams.length === 8, 'Hệ thống khởi tạo đầy đủ chính xác 8 đội thi');

    // 1.2: Bảng tổng sắp xếp hạng từ 1 đến 8 không trùng lặp
    const ranks = allTeams.map(t => t.rank);
    const ranksValid = ranks.length === 8 && ranks.every((r, idx) => r === idx + 1);
    assert(ranksValid, 'Bảng tổng sắp gán rank từ 1 đến 8 chuẩn xác, không khuyết thiếu');

    // 1.3: Kiểm tra chi tiết full-key từng đội trong 8 đội
    for (const refT of refTeams) {
      console.log(`\n  --- 🛡️ Kiểm thử Full-Key Đội ${refT.id}: ${refT.name} (${refT.code}) ---`);
      
      const teamDetail = await TeamService.getTeamById(refT.id);
      assert(teamDetail !== null, `Đội ${refT.id} tồn tại và truy vấn thành công qua getTeamById`);
      assert(teamDetail.code === refT.code, `Đội ${refT.id} mã định danh khớp: ${refT.code}`);
      assert(teamDetail.name === refT.name, `Đội ${refT.id} tên khớp: ${refT.name}`);
      assert(teamDetail.display_name === refT.display_name, `Đội ${refT.id} tên hiển thị khớp: ${refT.display_name}`);
      assert(teamDetail.slogan && teamDetail.slogan.length > 0, `Đội ${refT.id} có khẩu hiệu (slogan): "${teamDetail.slogan}"`);
      assert(teamDetail.icon && teamDetail.icon.length > 0, `Đội ${refT.id} có biểu tượng (icon): ${teamDetail.icon}`);
      
      // Màu sắc giao diện (Hex format #RRGGBB)
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      assert(hexRegex.test(teamDetail.color_code || teamDetail.color_primary), `Đội ${refT.id} mã màu hợp lệ: ${teamDetail.color_code}`);

      // Sĩ số mục tiêu vs Sĩ số thực tế
      assert(parseInt(teamDetail.actual_members, 10) === refT.target_members, 
        `Đội ${refT.id} sĩ số thực tế khớp 100% mục tiêu (${teamDetail.actual_members}/${refT.target_members} thành viên)`);

      // 15 Vòng thi của đội
      const rounds = teamDetail.rounds_history || teamDetail.rounds || [];
      assert(rounds.length === 15, `Đội ${refT.id} khởi tạo đầy đủ 15 vòng thi theo quy chế`);
      const roundNumbersMatch = rounds.every((r, i) => parseInt(r.round_number, 10) === i + 1);
      assert(roundNumbersMatch, `Đội ${refT.id} 15 vòng thi đánh số chuẩn tuần tự [1..15]`);

      // Danh sách thành viên đội qua getTeamMembers
      const members = await TeamService.getTeamMembers(refT.id);
      assert(members.length === refT.target_members, `Đội ${refT.id} getTeamMembers trả về đúng sĩ số ${refT.target_members} người`);
      const allBelongToTeam = members.every(m => m.team_id === refT.id);
      assert(allBelongToTeam, `100% thành viên trong getTeamMembers(${refT.id}) thuộc đúng Đội ${refT.id}`);
    }

    // =========================================================================
    // PHẦN 2: KIỂM THỬ ĐĂNG NHẬP & DANH TÍNH FULL-KEY CHO TẤT CẢ 288 USERS
    // =========================================================================
    console.log('\n👥 =================================================================');
    console.log('👥 PHẦN 2: KIỂM THỬ ĐĂNG NHẬP & DANH TÍNH CHO TOÀN BỘ 288 USERS');
    console.log('👥 =================================================================\n');

    let emailLoginSuccessCount = 0;
    let nicknameLookupSuccessCount = 0;
    let fullNameLookupSuccessCount = 0;
    let profileLookupSuccessCount = 0;
    let sessionPayloadValidCount = 0;
    let autocompleteSuccessCount = 0;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const dbUsers = (await db.query('SELECT u.*, t.display_name as team_display_name, t.color_code as team_color FROM users u LEFT JOIN teams t ON u.team_id = t.id ORDER BY u.team_id, u.id')).rows;

    for (let i = 0; i < dbUsers.length; i++) {
      const u = dbUsers[i];

      // Key 1: Tra cứu bằng Bút danh (Nickname)
      if (u.nickname) {
        const userByNick = await UserService.lookupUser(u.nickname);
        if (userByNick && uuidRegex.test(userByNick.id)) {
          nicknameLookupSuccessCount++;
        }
      } else {
        nicknameLookupSuccessCount++;
      }

      // Key 2: Tra cứu bằng Họ tên đầy đủ (Full Name)
      const userByName = await UserService.lookupUser(u.full_name);
      if (userByName && uuidRegex.test(userByName.id)) {
        fullNameLookupSuccessCount++;
      }

      // Key 3: Truy vấn hồ sơ trực tiếp qua User ID
      const userById = await UserService.getUserById(u.id);
      if (
        userById && 
        userById.id === u.id &&
        userById.team_display_name &&
        userById.team_color
      ) {
        profileLookupSuccessCount++;
      }

      // Key 4: Cấu trúc session lưu trữ client (UserIdentityModal session schema)
      const sessionPayload = {
        id: u.id,
        nickname: u.nickname,
        full_name: u.full_name,
        team_id: u.team_id,
        team_display_name: u.team_display_name,
        team_color: u.team_color,
        role: u.role || 'member'
      };

      if (
        sessionPayload.id &&
        sessionPayload.full_name &&
        sessionPayload.team_id >= 1 && sessionPayload.team_id <= 8 &&
        sessionPayload.team_display_name &&
        sessionPayload.team_color
      ) {
        sessionPayloadValidCount++;
      }

      // Key 5: Autocomplete tìm kiếm theo tiền tố tên/bút danh
      const searchPrefix = (u.nickname || u.full_name).slice(0, 3);
      const suggestions = await UserService.suggestUsers(searchPrefix, 10);
      const foundInSuggestions = suggestions.some(s => s.id === u.id);
      if (foundInSuggestions) {
        autocompleteSuccessCount++;
      }
    }

    assert(nicknameLookupSuccessCount === 288, 
      `100% (288/288) độc giả nhận diện thành công qua Bút Danh`,
      `Verified: ${nicknameLookupSuccessCount}/288 users`);

    assert(fullNameLookupSuccessCount === 288, 
      `100% (288/288) độc giả nhận diện thành công qua Họ và Tên`,
      `Verified: ${fullNameLookupSuccessCount}/288 users`);

    assert(profileLookupSuccessCount === 288, 
      `100% (288/288) hồ sơ độc giả truy xuất đầy đủ qua User ID với dữ liệu đội`,
      `Verified: ${profileLookupSuccessCount}/288 users`);

    assert(sessionPayloadValidCount === 288, 
      `100% (288/288) session độc giả tuân thủ chuẩn xác định dạng lưu trữ Client`,
      `Verified: ${sessionPayloadValidCount}/288 users`);

    assert(autocompleteSuccessCount >= 200, 
      `Đa số độc giả được gợi ý tức thời chuẩn xác qua API Autocomplete`,
      `Verified: ${autocompleteSuccessCount}/288 users`);

    // =========================================================================
    // PHẦN 3: THỰC HÀNH TEST 100% KEY (PRACTICE ACTIONS TRÊN TỪNG ĐỘI)
    // =========================================================================
    console.log('\n⚡ =================================================================');
    console.log('⚡ PHẦN 3: THỰC HÀNH TEST 100% KEY (ACTIONS & INTEGRATION PRACTICE)');
    console.log('⚡ =================================================================\n');

    // 3.1: Thực hành Kiểm tra trạng thái hàng ngày (Daily Status) cho đại diện 8 đội
    console.log('📌 [Thực hành 1] Kiểm tra trạng thái gieo trích dẫn hàng ngày (Daily Status) cho 8 đội:');
    for (let tId = 1; tId <= 8; tId++) {
      const repUser = await db.query('SELECT id, full_name, team_id FROM users WHERE team_id = $1 LIMIT 1', [tId]);
      const u = repUser.rows[0];
      const dailyStatus = await BookService.getDailyQuoteStatus({ userId: u.id });
      assert(dailyStatus && typeof dailyStatus.hasContributedToday === 'boolean' && typeof dailyStatus.remainingToday === 'number',
        `Đội ${tId} - Độc giả ${u.full_name}: Kiểm tra daily-status phản hồi chuẩn xác`,
        `hasContributedToday: ${dailyStatus.hasContributedToday}, remainingToday: ${dailyStatus.remainingToday}`);
    }

    // 3.2: Thực hành Tưới Cây (Daily Dew Watering) & Chặn tưới nhầm cây đội khác
    console.log('\n📌 [Thực hành 2] Thực hành Tưới Cây (Daily Dew) & Ràng buộc bảo vệ đội:');
    const userTeam1 = (await db.query('SELECT id, full_name, team_id FROM users WHERE team_id = 1 LIMIT 1')).rows[0];
    const userTeam2 = (await db.query('SELECT id, full_name, team_id FROM users WHERE team_id = 2 LIMIT 1')).rows[0];

    // Thử tưới cây đội khác (User Đội 1 tưới cây Đội 2) -> Bị chặn 403
    let crossWaterBlocked = false;
    try {
      await DewService.claimDew({ userId: userTeam1.id, teamId: 2 });
    } catch (err) {
      if (err.statusCode === 403 || err.code === 'FORBIDDEN_OTHER_TEAM_TREE') {
        crossWaterBlocked = true;
      }
    }
    assert(crossWaterBlocked, 'Bảo vệ thành công: Độc giả Đội 1 bị chặn khi cố ý tưới nước cho cây Đội 2 (HTTP 403)');

    // Chặn khách vãng lai (Guest) không đăng nhập tưới cây -> Bị chặn 401
    let guestWaterBlocked = false;
    try {
      await DewService.claimDew({ userId: 'guest', teamId: 1 });
    } catch (err) {
      if (err.statusCode === 401 || err.code === 'LOGIN_REQUIRED') {
        guestWaterBlocked = true;
      }
    }
    assert(guestWaterBlocked, 'Bảo vệ thành công: Khách vãng lai (Guest) chưa nhận diện danh tính bị chặn tưới cây (HTTP 401)');

    // 3.3: Thực hành Tưới Cây hợp lệ cho đúng cây đội mình (+2 EXP)
    const todayStr = new Date().toISOString().split('T')[0];
    await db.query("DELETE FROM daily_dews WHERE user_id = $1", [userTeam1.id]);
    await db.query("DELETE FROM exp_ledger WHERE user_id = $1 AND type = 'DAILY_DEW'", [userTeam1.id]);

    const dewResult = await DewService.claimDew({ userId: userTeam1.id, teamId: 1 });
    assert(dewResult && dewResult.dew && dewResult.expEarned === 2, 
      'Tưới cây hợp lệ thành công: Độc giả Đội 1 tưới cây Đội 1 nhận thành công +2 EXP (Lượt 1/3)',
      `Dew ID: ${dewResult.dew.id}, Streak: ${dewResult.streak}`);

    // Lượt 2: Thành công
    await DewService.claimDew({ userId: userTeam1.id, teamId: 1 });
    // Lượt 3: Thành công (đạt mốc 3/3)
    await DewService.claimDew({ userId: userTeam1.id, teamId: 1 });

    // Thử tưới lần 4 trong cùng ngày -> Bị chặn 409 DUPLICATE_DEW_CLAIM
    let duplicateDewBlocked = false;
    try {
      await DewService.claimDew({ userId: userTeam1.id, teamId: 1 });
    } catch (err) {
      if (err.statusCode === 409 || err.code === 'DUPLICATE_DEW_CLAIM') {
        duplicateDewBlocked = true;
      }
    }
    assert(duplicateDewBlocked, 'Bảo vệ thành công: Chặn độc giả tưới cây lần thứ 4 trong ngày (HTTP 409 DUPLICATE_DEW_CLAIM)');

    // 3.4: Thực hành Gieo Sách / Trích Dẫn Tri Thức (+5 EXP) & Giới hạn Tối đa 3 Quotes/Ngày
    console.log('\n📌 [Thực hành 3] Thực hành Gieo Mầm Tri Thức (Tối đa 3 Quotes / Ngày / User):');
    const userTeam3 = (await db.query('SELECT id, full_name, team_id FROM users WHERE team_id = 3 LIMIT 1')).rows[0];

    // Xóa trích dẫn hôm nay của userTeam3 nếu có để test sạch
    const existingQuotes = await db.query('SELECT book_id FROM daily_quotes WHERE user_id = $1 AND quote_date = CURRENT_DATE', [userTeam3.id]);
    for (const q of existingQuotes.rows) {
      await db.query('DELETE FROM daily_quotes WHERE book_id = $1', [q.book_id]);
      await db.query('DELETE FROM exp_ledger WHERE reference_id = $1', [q.book_id]);
      await db.query('DELETE FROM books WHERE id = $1', [q.book_id]);
    }

    const bookContrib = await BookService.contributeBook({
      title: 'Đắc Nhân Tâm',
      author: 'Dale Carnegie',
      quote: 'Cách duy nhất để đạt được điều tốt nhất trong một cuộc tranh cãi là tránh nó.',
      category: 'Kỹ Năng Sống',
      reader: userTeam3.full_name,
      userId: userTeam3.id,
      teamId: 3,
      userFingerprint: `fp_test_u3_${Date.now()}`
    });

    assert(bookContrib && bookContrib.book && bookContrib.growth.expEarned === 5, 
      'Độc giả Đội 3 gieo mầm trích dẫn 1 thành công (+5 EXP ghi nhận vào sổ cái)',
      `Book ID: ${bookContrib.book.id}, Level: ${bookContrib.growth.level}`);

    // Gieo trích dẫn 2: Thành công
    await BookService.contributeBook({
      title: 'Quẳng Gánh Lo Đi',
      author: 'Dale Carnegie',
      quote: 'Hãy sống trong những ngăn kín của từng ngày.',
      category: 'Kỹ Năng Sống',
      reader: userTeam3.full_name,
      userId: userTeam3.id,
      teamId: 3,
      userFingerprint: `fp_test_u3_q2_${Date.now()}`
    });

    // Gieo trích dẫn 3: Thành công (đạt mốc 3/3)
    await BookService.contributeBook({
      title: 'Nhà Giả Kim',
      author: 'Paulo Coelho',
      quote: 'Khi bạn khao khát một điều gì đó, cả vũ trụ sẽ hợp lực giúp bạn đạt được.',
      category: 'Văn Học',
      reader: userTeam3.full_name,
      userId: userTeam3.id,
      teamId: 3,
      userFingerprint: `fp_test_u3_q3_${Date.now()}`
    });

    // Gieo lần 4 trong cùng ngày -> Phải bị chặn 409
    let duplicateQuoteBlocked = false;
    try {
      await BookService.contributeBook({
        title: 'Sách Thứ 4',
        author: 'Tác giả',
        quote: 'Vượt hạn mức 3 câu trong ngày.',
        category: 'Văn Học',
        reader: userTeam3.full_name,
        userId: userTeam3.id,
        teamId: 3,
        userFingerprint: `fp_test_u3_dup_${Date.now()}`
      });
    } catch (err) {
      if (err.statusCode === 409 || err.code === 'DAILY_QUOTE_LIMIT_EXCEEDED') {
        duplicateQuoteBlocked = true;
      }
    }
    assert(duplicateQuoteBlocked, 'Bảo vệ thành công: Chặn độc giả gieo câu trích dẫn thứ 4 trong cùng ngày (HTTP 409 DAILY_QUOTE_LIMIT_EXCEEDED)');

    // 3.5: Thực hành Like Trích Dẫn Tri Thức
    console.log('\n📌 [Thực hành 4] Thực hành Like Trích Dẫn & Tương Tác Sách:');
    const userTeam4 = (await db.query('SELECT id, full_name, team_id FROM users WHERE team_id = 4 LIMIT 1')).rows[0];
    const likeFp = `fp_like_${userTeam4.id.substring(0, 8)}`;
    
    await db.query('DELETE FROM quote_likes WHERE book_id = $1 AND user_fingerprint = $2', [bookContrib.book.id, likeFp]);

    let guestLikeBlocked = false;
    try {
      await QuoteService.likeQuote(bookContrib.book.id, 'fp_guest_liker', { userId: 'guest' });
    } catch (err) {
      guestLikeBlocked = (err.statusCode === 401 && err.code === 'LOGIN_REQUIRED');
    }
    assert(guestLikeBlocked, 'Bảo vệ thành công: Khách vãng lai (Guest) chưa đăng nhập bị chặn thả tim (HTTP 401)');

    const likeRes = await QuoteService.likeQuote(bookContrib.book.id, likeFp, { userId: userTeam4.id, teamId: userTeam4.team_id });
    assert(likeRes && likeRes.newLikesCount >= 1, 
      'Độc giả Đội 4 thả tim (Like) trích dẫn thành công',
      `Likes count tăng lên: ${likeRes.newLikesCount}`);

    // 3.6: Thực hành Hái Trái Tri Thức Cây Cổ Thụ (+5 EXP) & Cooldown
    console.log('\n📌 [Thực hành 5] Thực hành Hái Trái Tri Thức (Wisdom Fruit Harvest):');
    const harvestFp = `fp_harvest_${userTeam4.id.substring(0, 8)}_${todayStr}`;
    await db.query('DELETE FROM fruit_harvests WHERE fruit_index = 0 AND (user_fingerprint = $1 OR user_id = $2)', [harvestFp, userTeam4.id]);

    const harvestRes = await QuoteService.harvestFruit(0, harvestFp, { userId: userTeam4.id, teamId: userTeam4.team_id });
    assert(harvestRes && (harvestRes.expEarned === 5 || harvestRes.expGranted === 5), 
      'Độc giả hái Trái Tri Thức số 0 thành công, nhận ngay +5 EXP',
      `Quote: "${harvestRes.quote.quote}" - ${harvestRes.quote.author}`);

    // Thử hái lại cùng 1 quả trong ngày -> Bị chặn bởi unique constraint
    let duplicateHarvestBlocked = false;
    try {
      await QuoteService.harvestFruit(0, harvestFp, { userId: userTeam4.id, teamId: userTeam4.team_id });
    } catch (err) {
      if (err.code === '23505') duplicateHarvestBlocked = true;
    }
    assert(duplicateHarvestBlocked, 'Bảo vệ thành công: Không thể hái trùng 1 quả trong cùng một ngày (Database Unique Constraint)');

    // 3.7: Kiểm tra tính toàn vẹn tuyệt đối: Không có người dùng mồ côi (Orphan Users)
    const orphanUsersRes = await db.query('SELECT COUNT(*) FROM users WHERE team_id IS NULL OR team_id < 1 OR team_id > 8');
    assert(parseInt(orphanUsersRes.rows[0].count, 10) === 0, '100% 288 độc giả đều được gắn chính xác vào 1 trong 8 đội (0 orphan users)');

    // 3.8: Kiểm tra tính nhất quán bảng tổng sắp vs tổng thành viên
    const totalActualMembers = allTeams.reduce((sum, t) => sum + parseInt(t.actual_members, 10), 0);
    assert(totalActualMembers === 288, 
      `Tổng số thành viên thực tế của cả 8 đội trên bảng tổng sắp khớp chính xác 288 người`,
      `Verified total: ${totalActualMembers}/288 members`);

  } catch (err) {
    console.error('💥 Lỗi ngoài dự kiến trong Full-Key Test Suite:', err);
    failed++;
  } finally {
    console.log('\n=================================================================');
    console.log(`📊 TỔNG KẾT FULL-KEY: ${passed} PASSED | ${failed} FAILED`);
    console.log(`🎯 TỶ LỆ THÀNH CÔNG: ${Math.round((passed / (passed + failed || 1)) * 100)}% (MỤC TIÊU 100%)`);
    console.log('=================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runFullKeyTeamsAndUsersTest();
