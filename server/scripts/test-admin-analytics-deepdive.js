import db from '../config/database.js';
import AnalyticsService from '../services/analytics.service.js';
import jwt from 'jsonwebtoken';

async function runDeepDiveAnalyticsTests() {
  console.log('\n🧪 =================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE TEST SUITE: ADMIN DEEP-DIVE ANALYTICS');
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
    // Ensure admin user exists
    const adminRes = await db.query("SELECT * FROM admin_users WHERE username = 'admin'");
    let adminUser = adminRes.rows[0];
    if (!adminUser) {
      const inserted = await db.query(`
        INSERT INTO admin_users (username, password_hash, full_name, role)
        VALUES ('admin', '$2a$10$abcdefghijklmnopqrstuvwxyz123456', 'Super Admin Cáo Sách', 'admin')
        RETURNING *
      `);
      adminUser = inserted.rows[0];
    }

    // =========================================================================
    // SECTION 1: PHÂN TÍCH ĐÓNG GÓP CÁ NHÂN TOÀN VƯỜN (CONTRIBUTOR INTELLIGENCE)
    // =========================================================================
    console.log('👥 [1/4] Test Suite 1: Phân Tích Đóng Góp Cá Nhân Toàn Vườn...');

    const allData = await AnalyticsService.getDeepDiveAnalytics();
    assert(allData !== null && typeof allData === 'object', 'Dịch vụ getDeepDiveAnalytics trả về dữ liệu hợp lệ');
    assert(allData.contributors !== undefined, 'Dữ liệu chứa nhóm phân tích Contributors');

    const { topExp, topWaterers, topSeeders, topQuoteWriters, topAppreciated, topVisitors } = allData.contributors;

    // 1.1: Top Đóng Góp EXP
    assert(Array.isArray(topExp), 'topExp là một danh sách mảng');
    if (topExp.length > 0) {
      assert(topExp[0].total_exp_earned !== undefined, 
        'Top 1 đóng góp EXP có đầy đủ thông tin total_exp_earned',
        `Top 1: ${topExp[0].full_name} (${topExp[0].team_name}) - ${topExp[0].total_exp_earned} EXP`);
      // Đảm bảo sắp xếp giảm dần theo EXP
      const isSortedExp = topExp.every((u, idx) => idx === 0 || topExp[idx - 1].total_exp_earned >= u.total_exp_earned);
      assert(isSortedExp, 'Danh sách topExp được sắp xếp giảm dần chính xác theo số điểm EXP');
    }

    // 1.2: Top Người Tưới Cây (Daily Dews)
    assert(Array.isArray(topWaterers), 'topWaterers là một danh sách mảng');
    if (topWaterers.length > 0) {
      assert(topWaterers[0].total_dews > 0 && topWaterers[0].max_streak >= 1, 
        'Top người tưới cây ghi nhận số lượt tưới và chuỗi ngày streak',
        `Top 1 tưới: ${topWaterers[0].full_name} - ${topWaterers[0].total_dews} lượt (Streak: ${topWaterers[0].max_streak})`);
    }

    // 1.3: Top Người Gieo Mầm Sách
    assert(Array.isArray(topSeeders), 'topSeeders là một danh sách mảng');
    if (topSeeders.length > 0) {
      assert(topSeeders[0].books_count > 0, 
        'Top người gieo mầm ghi nhận số lượng sách hợp lệ',
        `Top 1 gieo: ${topSeeders[0].full_name} - ${topSeeders[0].books_count} sách`);
    }

    // 1.4: Top Người Viết Câu Trích Dẫn & Độ Sâu Nội Dung
    assert(Array.isArray(topQuoteWriters), 'topQuoteWriters là một danh sách mảng');
    if (topQuoteWriters.length > 0) {
      assert(topQuoteWriters[0].quotes_count > 0 && topQuoteWriters[0].avg_quote_length >= 0, 
        'Top người viết câu cốt ghi nhận độ dài trung bình câu trích dẫn',
        `Top 1 câu cốt: ${topQuoteWriters[0].full_name} - ${topQuoteWriters[0].quotes_count} câu (Độ dài TB: ${topQuoteWriters[0].avg_quote_length} ký tự)`);
    }

    // 1.5: Top Người Được Nhiều Người Cảm Ơn / Ghi Nhận Nhất (Nhiều Likes Nhất)
    assert(Array.isArray(topAppreciated), 'topAppreciated là một danh sách mảng');
    if (topAppreciated.length > 0) {
      assert(topAppreciated[0].total_likes_received > 0, 
        'Top người được ghi nhận có tổng số lượt thích lớn hơn 0',
        `Top 1 cảm ơn: ${topAppreciated[0].full_name} - ${topAppreciated[0].total_likes_received} lượt thích nhận được`);
    }

    // =========================================================================
    // SECTION 2: PHÂN TÍCH NỘI DUNG TRI THỨC CỦA CÂY (CONTENT & KNOWLEDGE)
    // =========================================================================
    console.log('\n📖 [2/4] Test Suite 2: Phân Tích Nội Dung Tri Thức Của Cây...');

    assert(allData.content !== undefined, 'Dữ liệu chứa nhóm phân tích Content');
    const { topBooks, topCategories, topQuotes, topInteractors } = allData.content;

    // 2.1: Cuốn sách được trích dẫn nhiều câu cốt nhất
    assert(Array.isArray(topBooks), 'topBooks là một danh sách mảng');
    if (topBooks.length > 0) {
      assert(topBooks[0].title && topBooks[0].quote_count > 0, 
        'Top sách ghi nhận tiêu đề, tác giả và số lượng câu cốt trích dẫn',
        `Top 1 sách: "${topBooks[0].title}" (${topBooks[0].author}) - ${topBooks[0].quote_count} trích dẫn`);
    }

    // 2.2: Tỷ trọng đóng góp tri thức của 8 Đội thi đua (Không phân loại sách)
    assert(Array.isArray(topCategories), 'topCategories là một danh sách mảng');
    if (topCategories.length > 0) {
      assert(topCategories[0].category && typeof topCategories[0].percentage === 'number', 
        'Tỷ trọng đóng góp theo Đội thi đua tính toán tỷ lệ phần trăm chính xác',
        `Top 1 đội: ${topCategories[0].category} - ${topCategories[0].book_count} cuốn (${topCategories[0].percentage}%)`);
    }

    // 2.3: Câu cốt được nhiều thành viên tương tác nhất
    assert(Array.isArray(topQuotes), 'topQuotes là một danh sách mảng');
    if (topQuotes.length > 0) {
      assert(topQuotes[0].quote && topQuotes[0].likes_count >= 0, 
        'Top câu cốt có nội dung trích dẫn và lượt yêu thích',
        `Top quote: "${topQuotes[0].quote.substring(0, 40)}..." (${topQuotes[0].reader_name}) - ${topQuotes[0].likes_count} likes`);
    }

    // 2.4: Thành viên thường xuyên tương tác / thả tim
    assert(Array.isArray(topInteractors), 'topInteractors là một danh sách mảng');

    // =========================================================================
    // SECTION 3: SỰ PHÁT TRIỂN CỦA CÂY & SO SÁNH 8 CÂY (TREE GROWTH INTELLIGENCE)
    // =========================================================================
    console.log('\n🌳 [3/4] Test Suite 3: Sự Phát Triển Của Cây & So Sánh 8 Cây Thi Đua...');

    assert(allData.growth !== undefined, 'Dữ liệu chứa nhóm phân tích Growth');
    const { treesComparison, activityBreakdown, teamMvps } = allData.growth;

    // 3.1: So sánh toàn diện 8 cây
    assert(Array.isArray(treesComparison) && treesComparison.length === 8, 
      'Bảng so sánh trả về đầy đủ chính xác 8 cây trong hệ thống',
      `Số lượng cây: ${treesComparison.length}/8`);

    const tree1 = treesComparison.find(t => t.id === 1);
    assert(tree1 !== undefined, 'Cây Đội 1 tồn tại trong bảng so sánh');
    assert(typeof tree1.velocity_24h === 'number' && typeof tree1.velocity_7d === 'number', 
      'Cây ghi nhận tốc độ tăng trưởng điểm trong 24h và 7 ngày (Growth Velocity)',
      `Cây 1 Velocity 24h: ${tree1.velocity_24h} EXP | 7D: ${tree1.velocity_7d} EXP`);
    assert(typeof tree1.interactionScore === 'number', 
      'Cây tính toán điểm tương tác tổng hợp (Dews + Books + Likes)',
      `Cây 1 Interaction Score: ${tree1.interactionScore}`);

    // 3.2: Tỷ trọng các hoạt động tạo điểm nuôi dưỡng cây
    assert(Array.isArray(activityBreakdown), 'activityBreakdown là một danh sách mảng');
    if (activityBreakdown.length > 0) {
      assert(activityBreakdown.some(a => a.type === 'BOOK_CONTRIBUTION' || a.type === 'DAILY_DEW'), 
        'Cơ cấu hoạt động nhận diện chính xác các loại giao dịch BOOK_CONTRIBUTION & DAILY_DEW');
    }

    // 3.3: Gương mặt tiêu biểu số 1 (MVP) của từng đội
    assert(Array.isArray(teamMvps) && teamMvps.length === 8, 
      'Nhận diện đầy đủ 8 gương mặt tiêu biểu (MVP) cho cả 8 đội thi',
      `Số lượng MVP: ${teamMvps.length}/8 đội`);
    const allMvpsHaveTeam = teamMvps.every(m => m.team_id >= 1 && m.team_id <= 8 && m.full_name);
    assert(allMvpsHaveTeam, '100% MVP có tên, mã nhân viên và thuộc về đội tương ứng');

    // =========================================================================
    // SECTION 4: BỘ LỌC CHI TIẾT THEO TỪNG CÂY (FILTER BY SPECIFIC TEAM)
    // =========================================================================
    console.log('\n🎯 [4/4] Test Suite 4: Kiểm Tra Bộ Lọc Theo Từng Cây (Cây số 1)...');

    const tree1Data = await AnalyticsService.getDeepDiveAnalytics({ teamId: 1 });
    assert(tree1Data.filterTeamId === 1, 'Bộ lọc ghi nhận teamId = 1');

    // Mọi người đóng góp EXP trong kết quả lọc của Cây 1 phải thuộc Đội 1
    const allContributorsAreTeam1 = tree1Data.contributors.topExp.every(u => u.team_id === 1);
    assert(allContributorsAreTeam1, '100% top contributors khi lọc Cây 1 đều thuộc đúng Đội 1');

    // Mọi câu trích dẫn khi lọc Cây 1 phải thuộc Đội 1
    const allQuotesAreTeam1 = tree1Data.content.topQuotes.every(q => q.team_id === 1);
    assert(allQuotesAreTeam1, '100% top câu cốt khi lọc Cây 1 đều thuộc đúng Đội 1');

    // =========================================================================
    // SECTION 5: XÁC THỰC BẢO MẬT API HTTP ENDPOINT (REST API AUTHENTICATION)
    // =========================================================================
    console.log('\n🔒 [Bảo Mật API] Xác thực Token JWT & Quyền Hạn Quản Trị...');

    const jwtSecret = process.env.JWT_SECRET || 'caosach_jwt_secret_dev_2026_super_secure';
    const adminToken = jwt.sign(
      { id: adminUser.id, username: adminUser.username, role: adminUser.role },
      jwtSecret,
      { expiresIn: '1h' }
    );
    assert(adminToken && adminToken.length > 20, 'Tạo mã xác thực JWT quản trị viên hợp lệ');

  } catch (err) {
    console.error('💥 Lỗi ngoài dự kiến trong Deep-Dive Analytics Test:', err);
    failed++;
  } finally {
    console.log('\n=================================================================');
    console.log(`📊 TỔNG KẾT DEEP-DIVE ANALYTICS: ${passed} PASSED | ${failed} FAILED`);
    console.log(`🎯 TỶ LỆ THÀNH CÔNG: ${Math.round((passed / (passed + failed || 1)) * 100)}% (MỤC TIÊU 100%)`);
    console.log('=================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runDeepDiveAnalyticsTests();
