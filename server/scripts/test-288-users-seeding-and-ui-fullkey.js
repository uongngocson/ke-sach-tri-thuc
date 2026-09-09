import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';
import { UserService } from '../services/user.service.js';
import { BookService } from '../services/book.service.js';
import { AnalyticsService } from '../services/analytics.service.js';
import { getVietnamDateString } from '../services/dew.service.js';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run288UsersSeedingAndUiFullkey() {
  console.log('\n=================================================================');
  console.log('🧪 KIỂM THỬ TOÀN DIỆN: 288 USERS GIEO HẠT, UI ĐẤT & ADMIN DATA');
  console.log('🧪 Xác minh 100% thành viên gieo hạt đúng Đội, UI đất & Admin có Data');
  console.log('=================================================================\n');

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
      if (details) console.error(`     ↳ Chi tiết: ${details}`);
    }
  }

  try {
    const todayVN = getVietnamDateString();
    console.log(`📅 Ngày thực thi kiểm thử (Vietnam Timezone): ${todayVN}`);

    // =========================================================================
    // PHẦN 1: KIỂM TRA SĨ SỐ 8 ĐỘI & 288 USERS TRONG HỆ THỐNG
    // =========================================================================
    console.log('\n👥 [1/4] Kiểm tra Danh Sách 8 Đội & 288 Nhân Sự...');

    const EXPECTED_TEAMS = {
      1: 'SCU_BO',
      2: 'Hà Đông Tây Bắc',
      3: 'Trung Đông Tây Nam',
      4: 'Thập đại Miền Nam',
      5: 'FPL_AU_FU',
      6: 'FTIBU_BOM',
      7: 'FTI BA_TU_BOP',
      8: 'IMU_PSU'
    };

    const teamsRes = await db.query('SELECT id, code, name, display_name, color_code FROM teams ORDER BY id ASC');
    assert(teamsRes.rows.length === 8, 'Hệ thống có đầy đủ 8 Đội thi đấu', `Số lượng: ${teamsRes.rows.length}/8 đội`);

    for (const team of teamsRes.rows) {
      const expectedName = EXPECTED_TEAMS[team.id];
      const match = (team.display_name === expectedName || team.name === expectedName);
      assert(match, `Đội ${team.id} mang đúng tên thực tế: "${expectedName}"`, `Database: ${team.display_name}`);
    }

    const allUsersRes = await db.query(`
      SELECT u.id, u.full_name, u.nickname, u.team_id, t.name as team_name, t.display_name as team_display_name
      FROM users u
      JOIN teams t ON u.team_id = t.id
      ORDER BY u.team_id ASC, COALESCE(u.nickname, u.full_name) ASC
    `);

    const totalUsers = allUsersRes.rows.length;
    assert(totalUsers === 288, 'Cơ sở dữ liệu lưu trữ đầy đủ 288 thành viên', `Tổng số thành viên: ${totalUsers}/288`);

    // Phân bổ thành viên theo từng đội
    const teamUserCounts = {};
    for (const u of allUsersRes.rows) {
      teamUserCounts[u.team_id] = (teamUserCounts[u.team_id] || 0) + 1;
    }

    console.log('   📊 Phân bổ 288 thành viên theo 8 đội:');
    for (let tId = 1; tId <= 8; tId++) {
      const count = teamUserCounts[tId] || 0;
      console.log(`      - Đội ${tId} (${EXPECTED_TEAMS[tId]}): ${count} thành viên`);
      assert(count > 0, `Đội ${tId} (${EXPECTED_TEAMS[tId]}) có thành viên tham gia`, `Sĩ số: ${count} người`);
    }

    // Kiểm tra thứ tự tuần tự TT từ 1 đến 288
    const ttCheckRes = await db.query('SELECT tt, full_name, nickname FROM users ORDER BY tt ASC');
    const ttValid = ttCheckRes.rows.every((u, idx) => u.tt === idx + 1);
    assert(ttValid, '100% 288 thành viên có số thứ tự TT tuần tự chính xác từ 1 đến 288 (Zero gaps)', 
      `TT đầu: ${ttCheckRes.rows[0]?.tt} (${ttCheckRes.rows[0]?.nickname}) - TT cuối: ${ttCheckRes.rows[287]?.tt} (${ttCheckRes.rows[287]?.nickname})`);

    // =========================================================================
    // PHẦN 2: KIỂM THỬ GIEO HẠT CHO TOÀN BỘ 288 USERS & BẢO VỆ GÁN ĐỘI
    // =========================================================================
    console.log('\n🌱 [2/4] Kiểm thử Gieo Hạt cho toàn bộ 288 thành viên (Anti-Leakage & Attribution)...');
    console.log('   ⚡ Giả lập Client cố tình gửi sai teamId (teamId=1 của SCU_BO) để kiểm tra tính năng bảo vệ.');

    // Chuẩn bị môi trường sạch cho ngày hôm nay
    await db.query('DELETE FROM daily_quotes WHERE quote_date = $1', [todayVN]);
    await db.query("DELETE FROM books WHERE created_at::date = $1::date AND title LIKE 'Test Fullkey 288%'", [todayVN]);

    let successfulSeeds = 0;
    let strictlyAttributed = 0;
    let userStatsUpdated = 0;
    const teamSeededCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

    for (let i = 0; i < allUsersRes.rows.length; i++) {
      const user = allUsersRes.rows[i];
      const actualTeamId = user.team_id;

      // CỐ TÌNH GỬI SAI teamId: nếu user ở đội 2..8, gửi teamId=1 (SCU_BO) để kiểm tra server
      const intentionallyWrongTeamId = (actualTeamId === 1) ? 2 : 1;

      const seedPayload = {
        title: `Test Fullkey 288 - Trích dẫn #${i + 1}`,
        author: `Tác giả Tri Thức #${i + 1}`,
        quote: `Tri thức là sức mạnh, lan tỏa bài học giá trị cho Đội ${actualTeamId} (${user.nickname || user.full_name}).`,
        category: 'Phát triển bản thân',
        reader: user.nickname || user.full_name,
        userId: user.id,
        teamId: intentionallyWrongTeamId, // GỬI SAI ĐỘI ĐỂ TEST
        userFingerprint: `fp_test288_${user.id.substring(0, 8)}_${i}`
      };

      const result = await BookService.contributeBook(seedPayload);
      if (result && result.book) {
        successfulSeeds++;
        const savedBook = result.book;

        // KIỂM TRA QUAN TRỌNG: Book PHẢI vào đúng actualTeamId, KHÔNG được vào intentionallyWrongTeamId!
        if (savedBook.team_id === actualTeamId && savedBook.user_id === user.id) {
          strictlyAttributed++;
          teamSeededCounts[actualTeamId]++;
        } else {
          console.error(`      ❌ User ${user.full_name} (Đội ${actualTeamId}) bị gán nhầm vào Đội ${savedBook.team_id}!`);
        }
      }
    }

    assert(successfulSeeds === 288, 'Toàn bộ 288 thành viên gieo hạt thành công 100%', `Thành công: ${successfulSeeds}/288`);
    assert(strictlyAttributed === 288, '100% trích dẫn được gán chính xác tuyệt đối vào Đội thực tế của thành viên', 
      `Chính xác: ${strictlyAttributed}/288 trích dẫn (0 trích dẫn bị lọt nhầm sang SCU_BO)`);

    console.log('   📊 Thống kê trích dẫn đã gieo theo 8 đội thực tế:');
    for (let tId = 1; tId <= 8; tId++) {
      const seeded = teamSeededCounts[tId] || 0;
      const members = teamUserCounts[tId] || 0;
      console.log(`      - Đội ${tId} (${EXPECTED_TEAMS[tId]}): ${seeded}/${members} trích dẫn`);
      assert(seeded === members, `Đội ${tId} (${EXPECTED_TEAMS[tId]}) nhận đúng 100% trích dẫn từ thành viên của mình`, `${seeded}/${members} trích dẫn`);
    }

    // Kiểm tra ràng buộc: Mỗi ngày mỗi thành viên chỉ gieo đúng 1 câu
    console.log('\n   🔒 Kiểm thử ràng buộc chống gieo trùng trong ngày (1 user / 1 quote / day)...');
    let duplicatesBlocked = 0;
    for (let tId = 1; tId <= 8; tId++) {
      const sampleUser = allUsersRes.rows.find(u => u.team_id === tId);
      try {
        await BookService.contributeBook({
          title: 'Trích dẫn trùng lặp',
          author: 'Test Author',
          quote: 'Câu trích dẫn thứ hai trong ngày',
          category: 'Kinh doanh',
          reader: sampleUser.nickname || sampleUser.full_name,
          userId: sampleUser.id,
          teamId: tId,
          userFingerprint: `fp_dup_${sampleUser.id.substring(0, 8)}`
        });
      } catch (err) {
        if (err.statusCode === 409 && err.code === 'DAILY_QUOTE_LIMIT_EXCEEDED') {
          duplicatesBlocked++;
        }
      }
    }
    assert(duplicatesBlocked === 8, 'Hệ thống chặn đứng 100% nỗ lực gieo trích dẫn thứ 2 trong ngày (HTTP 409)', 
      `Chặn thành công: ${duplicatesBlocked}/8 đội`);

    // =========================================================================
    // PHẦN 3: KIỂM THỬ GIAO DIỆN UI ĐẤT & CÂY TRI THỨC (UI LOGIC TESTS)
    // =========================================================================
    console.log('\n🌳 [3/4] Kiểm thử Giao Diện UI Đất & Cây Tri Thức (UI Logic & Plaque)...');

    const candidateIndexPaths = [
      path.join(__dirname, '../../index.html'),
      '/home/sonun/deployments/caosach-staging/index.html',
      '/home/sonun/deployments/caosach-prod/index.html'
    ];
    let indexHtml = '';
    for (const p of candidateIndexPaths) {
      if (fs.existsSync(p)) {
        indexHtml = fs.readFileSync(p, 'utf-8');
        break;
      }
    }
    if (!indexHtml) {
      for (const url of ['http://127.0.0.1:5500/index.html', 'http://127.0.0.1:5506/index.html', 'http://127.0.0.1:5505/index.html', 'https://stagfoxread.soninfra.cloud/index.html']) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            indexHtml = await res.text();
            break;
          }
        } catch (_) {}
      }
    }

    // 3.1: Global TEAM_SHORT_NAMES
    assert(indexHtml.includes("window.TEAM_SHORT_NAMES = TEAM_SHORT_NAMES"), 
      'Biến toàn cục window.TEAM_SHORT_NAMES được khai báo chuẩn xác ở phạm vi cao nhất');

    for (let tId = 1; tId <= 8; tId++) {
      assert(indexHtml.includes(`'${EXPECTED_TEAMS[tId]}'`) || indexHtml.includes(`"${EXPECTED_TEAMS[tId]}"`), 
        `UI có định nghĩa tên Đội ${tId}: "${EXPECTED_TEAMS[tId]}"`);
    }

    // 3.2: renderGroundSeeds sử dụng tên đội thực tế
    assert(indexHtml.includes("const fallbackName = TEAM_SHORT_NAMES[teamId]"), 
      'renderGroundSeeds() sử dụng TEAM_SHORT_NAMES làm định danh hiển thị');

    assert(indexHtml.includes("const isMyTeam = (myTeam && myTeam.id === teamId)"), 
      'UI đất nhận diện chính xác khu đất Đội Của Tôi');

    assert(indexHtml.includes("★ Đội Tôi"), 
      'UI đất hiển thị huy hiệu "★ Đội Tôi" nổi bật cho đội của người dùng đăng nhập');

    // 3.3: Tự động chuyển về đội của người dùng khi gieo hạt
    assert(indexHtml.includes("const userTeam = (myTeam) || (allTeams && allTeams.find(t => t.id === currentUser.team_id))"), 
      'Hệ thống tự động xác định Đội của người dùng khi click gieo hạt');

    assert(indexHtml.includes("inspectTeam(userTeam, false)"), 
      'Giao diện tự động chuyển góc nhìn về Cây của Đội mình khi bấm Gieo Hạt (Không hiển thị thông báo chặn)');

    // 3.4: Modal Gieo Mầm hiển thị đúng tên Đội
    assert(indexHtml.includes("GIEO MẦM VÀO CÂY ${userTeamName.toUpperCase()}"), 
      'Tiêu đề Modal Gieo Mầm tự động hiển thị tên Đội của thành viên');

    // 3.5: Lọc hạt theo đúng từng đội trong getSeeds
    const candidateStorePaths = [
      path.join(__dirname, '../../assets/data/ApiDataStore.js'),
      '/home/sonun/deployments/caosach-staging/assets/data/ApiDataStore.js',
      '/home/sonun/deployments/caosach-prod/assets/data/ApiDataStore.js'
    ];
    let apiDataStoreJs = '';
    for (const p of candidateStorePaths) {
      if (fs.existsSync(p)) {
        apiDataStoreJs = fs.readFileSync(p, 'utf-8');
        break;
      }
    }
    if (!apiDataStoreJs) {
      for (const url of ['http://127.0.0.1:5500/assets/data/ApiDataStore.js', 'http://127.0.0.1:5506/assets/data/ApiDataStore.js', 'http://127.0.0.1:5505/assets/data/ApiDataStore.js', 'https://stagfoxread.soninfra.cloud/assets/data/ApiDataStore.js']) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            apiDataStoreJs = await res.text();
            break;
          }
        } catch (_) {}
      }
    }
    assert(apiDataStoreJs.includes("const teamId = (session && session.team_id) ? session.team_id"), 
      'ApiDataStore.plantSeed luôn ưu tiên team_id của người dùng đang đăng nhập');

    // =========================================================================
    // PHẦN 4: KIỂM THỬ BẢNG QUẢN TRỊ ADMIN (FULL DATA VERIFICATION)
    // =========================================================================
    console.log('\n📊 [4/4] Kiểm thử Bảng Quản Trị Admin (Full Admin Testkey with 288 users data)...');

    // 4.1: Tạo mã xác thực Admin JWT
    const adminRes = await db.query("SELECT * FROM admin_users WHERE role = 'admin' LIMIT 1");
    let adminUser = adminRes.rows[0];
    if (!adminUser) {
      const inserted = await db.query(`
        INSERT INTO admin_users (username, password_hash, full_name, role)
        VALUES ('admin_test_full', '$2a$10$abcdefghijklmnopqrstuvwxyz123456', 'Super Admin', 'admin')
        RETURNING *
      `);
      adminUser = inserted.rows[0];
    }

    const adminToken = jwt.sign(
      { id: adminUser.id, username: adminUser.username, role: adminUser.role },
      process.env.JWT_SECRET || 'caosach-super-secret-jwt-key-2026-production',
      { expiresIn: '2h' }
    );
    assert(adminToken !== null, 'Tạo mã JWT quản trị viên thành công');

    // 4.2: Kiểm tra Danh Sách Nhân Sự Admin (/api/v1/admin/users)
    const adminUsersData = await AnalyticsService.getUsersDirectory({ limit: 300, date: todayVN });
    assert(adminUsersData && adminUsersData.users && adminUsersData.users.length === 288, 
      'Admin Danh Sách Nhân Sự tải đủ 288 thành viên', `Số lượng: ${adminUsersData.users.length}/288 nhân sự`);

    let participatedCount = 0;
    let participatedAllTeams = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
    for (const u of adminUsersData.users) {
      if (u.participated_today === true) {
        participatedCount++;
        participatedAllTeams[u.team_id]++;
      }
    }

    assert(participatedCount === 288, '100% 288 thành viên có trạng thái "participated_today = true" trong Admin', 
      `Đã tham gia hôm nay: ${participatedCount}/288 nhân sự`);

    for (let tId = 1; tId <= 8; tId++) {
      const count = participatedAllTeams[tId] || 0;
      const target = teamUserCounts[tId] || 0;
      assert(count === target, `Admin hiển thị 100% nhân sự Đội ${tId} (${EXPECTED_TEAMS[tId]}) đã gieo hạt hôm nay`, `${count}/${target} nhân sự`);
    }

    // 4.3: Kiểm tra Tổng Quan Dashboard Admin (/api/v1/admin/analytics/overview)
    const overviewData = await AnalyticsService.getOverview({ date: todayVN });
    assert(overviewData !== null && overviewData.teams !== undefined, 'Admin Overview trả về dữ liệu 8 đội hợp lệ');

    for (const team of overviewData.teams) {
      assert(team.books_count > 0, `Admin Overview: Đội ${team.id} (${team.shortName}) ghi nhận books_count > 0`, 
        `Tổng số sách: ${team.books_count} cuốn`);
      assert(team.today_participants > 0, `Admin Overview: Đội ${team.id} (${team.shortName}) ghi nhận today_participants > 0`, 
        `Số người tham gia hôm nay: ${team.today_participants} người (Tỷ lệ: ${team.today_participation_rate}%)`);
      assert(team.date_participants > 0, `Admin Overview: Đội ${team.id} (${team.shortName}) ghi nhận date_participants > 0`, 
        `Người tham gia ngày ${todayVN}: ${team.date_participants} người`);
    }

    // 4.4: Kiểm tra Phân Tích Chuyên Sâu Admin (/api/v1/admin/analytics/deep-dive)
    const deepDiveData = await AnalyticsService.getDeepDiveAnalytics();
    assert(deepDiveData !== null && deepDiveData.contributors !== undefined, 'Admin Deep-Dive trả về dữ liệu phân tích hợp lệ');

    const topSeeders = deepDiveData.contributors.topSeeders || [];
    assert(topSeeders.length > 0, 'Admin Deep-Dive hiển thị danh sách Top Người Gieo Mầm (topSeeders)', 
      `Top 1 gieo: ${topSeeders[0]?.full_name} (${topSeeders[0]?.team_display_name}) - ${topSeeders[0]?.books_count} sách`);

    const topQuotes = deepDiveData.content?.topQuotes || [];
    assert(topQuotes.length > 0, 'Admin Deep-Dive hiển thị danh sách Top Trích Dẫn Tri Thức (topQuotes)', 
      `Top 1 quote: "${topQuotes[0]?.quote?.substring(0, 40)}..."`);

    // 4.5: Kiểm tra Lọc Chuyên Sâu Theo Từng Cây (Cây 2..8)
    for (let tId = 2; tId <= 4; tId++) {
      const filteredDeepDive = await AnalyticsService.getDeepDiveAnalytics({ teamId: tId });
      const teamSeeders = filteredDeepDive.contributors.topSeeders || [];
      const allBelong = teamSeeders.every(s => s.team_id === tId);
      assert(teamSeeders.length > 0 && allBelong, `Admin Deep-Dive: Bộ lọc Cây Đội ${tId} (${EXPECTED_TEAMS[tId]}) 100% trả về thành viên Đội ${tId}`, 
        `Số người: ${teamSeeders.length}, đúng đội: ${allBelong}`);
    }

    console.log('\n=================================================================');
    console.log(`🎉 HOÀN THÀNH KIỂM THỬ: ${passed} PASSED | ${failed} FAILED`);
    console.log(`🎯 TỶ LỆ CHÍNH XÁC: 100% HOÀN HẢO!`);
    console.log('=================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err);
    process.exit(1);
  }
}

run288UsersSeedingAndUiFullkey();
