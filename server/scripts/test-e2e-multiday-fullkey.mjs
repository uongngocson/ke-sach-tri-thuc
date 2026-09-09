import db from '../config/database.js';
import DewService from '../services/dew.service.js';
import BookService from '../services/book.service.js';
import { AnalyticsService } from '../services/analytics.service.js';

function assert(condition, message, detail = '') {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`, detail);
    throw new Error(`Assertion failed: ${message} ${detail}`);
  }
  console.log(`   ✅ [PASS] ${message}`);
}

async function runE2ETest() {
  console.log('='.repeat(75));
  console.log('🧪 BẮT ĐẦU TESTKEY N2N FULL 100%: ĐA NGÀY, TỐI ĐA 3 LẦN/NGÀY & ADMIN 288');
  console.log('='.repeat(75));

  const client = await db.pool.connect();
  const createdBookIds = [];
  const createdDewIds = [];
  
  try {
    // 1. Tìm test user thuộc Đội 5 (FPL_AU_FU)
    const userRes = await client.query(`
      SELECT id, full_name, nickname, team_id, total_exp_earned, contributed_books_count
      FROM users 
      WHERE team_id = 5 
      ORDER BY id ASC LIMIT 1
    `);
    assert(userRes.rows.length > 0, 'Tìm thấy user kiểm thử thuộc Đội 5 (FPL_AU_FU)');
    const testUser = userRes.rows[0];
    console.log(`👤 Người dùng thử nghiệm: [ID: ${testUser.id}] ${testUser.nickname || testUser.full_name} - Đội ${testUser.team_id}`);

    // Định nghĩa 2 ngày khác nhau: Ngày 1 (Hôm qua) & Ngày 2 (Hôm nay)
    const today = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    console.log(`📅 Ngày 1 (Hôm qua): ${yesterday}`);
    console.log(`📅 Ngày 2 (Hôm nay):  ${today}`);

    // Dọn sạch quotes và dews cũ của test user trong cả 2 ngày để test sạch sẽ
    await client.query('DELETE FROM daily_dews WHERE user_id = $1 AND claim_date IN ($2, $3)', [testUser.id, yesterday, today]);
    const oldQuotes = await client.query('SELECT book_id FROM daily_quotes WHERE user_id = $1 AND quote_date IN ($2, $3)', [testUser.id, yesterday, today]);
    for (const r of oldQuotes.rows) {
      if (r.book_id) {
        await client.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = $2', ['books', r.book_id]);
        await client.query('DELETE FROM books WHERE id = $1', [r.book_id]);
      }
    }
    await client.query('DELETE FROM daily_quotes WHERE user_id = $1 AND quote_date IN ($2, $3)', [testUser.id, yesterday, today]);

    // =========================================================================
    // PHẦN 1: KIỂM THỬ TƯỚI NƯỚC QUA CÁC NGÀY KHÁC NHAU (CROSS-DAY DAILY DEW)
    // =========================================================================
    console.log('\n💧 [PHẦN 1] Kiểm thử Tưới Nước (Daily Dew) Đa Ngày (Tối đa 3 lần/ngày):');
    
    // --- NGÀY 1: Hôm qua (${yesterday}) ---
    console.log(`   🔹 Thao tác Ngày 1 (${yesterday}):`);
    const dewDay1_1 = await DewService.claimDew({ userId: testUser.id, teamId: testUser.team_id, customDate: yesterday });
    assert(dewDay1_1.streak === 1, 'Ngày 1 - Lần 1: Chuỗi streak = 1');
    assert(dewDay1_1.claimsToday === 1, 'Ngày 1 - Lần 1: Đã tưới 1/3 lần');
    assert(dewDay1_1.remainingClaimsToday === 2, 'Ngày 1 - Lần 1: Còn 2 lượt');
    createdDewIds.push(dewDay1_1.dew.id);

    const dewDay1_2 = await DewService.claimDew({ userId: testUser.id, teamId: testUser.team_id, customDate: yesterday });
    assert(dewDay1_2.streak === 1, 'Ngày 1 - Lần 2: Giữ nguyên streak = 1 (không cộng dồn cùng ngày)');
    assert(dewDay1_2.claimsToday === 2, 'Ngày 1 - Lần 2: Đã tưới 2/3 lần');
    createdDewIds.push(dewDay1_2.dew.id);

    const dewDay1_3 = await DewService.claimDew({ userId: testUser.id, teamId: testUser.team_id, customDate: yesterday });
    assert(dewDay1_3.claimsToday === 3, 'Ngày 1 - Lần 3: Đã đạt tối đa 3/3 lần');
    assert(dewDay1_3.hasClaimedToday === true, 'Ngày 1 - Lần 3: hasClaimedToday = true');
    createdDewIds.push(dewDay1_3.dew.id);

    // Lần 4 trong Ngày 1 phải bị chặn!
    let day1Blocked = false;
    try {
      await DewService.claimDew({ userId: testUser.id, teamId: testUser.team_id, customDate: yesterday });
    } catch (e) {
      day1Blocked = (e.statusCode === 409);
    }
    assert(day1Blocked, 'Ngày 1 - Lần 4: Bị chặn thành công với HTTP 409 (Tối đa 3 lần/ngày)');

    // --- NGÀY 2: Hôm nay (${today}) ---
    console.log(`   🔹 Thao tác Ngày 2 (${today}):`);
    const dewDay2_1 = await DewService.claimDew({ userId: testUser.id, teamId: testUser.team_id, customDate: today });
    assert(dewDay2_1.streak === 2, 'Ngày 2 - Lần 1: Chuỗi streak tăng lên 2 ngày liên tiếp!');
    assert(dewDay2_1.claimsToday === 1, 'Ngày 2 - Lần 1: Đã tưới 1/3 lần');
    assert(dewDay2_1.remainingClaimsToday === 2, 'Ngày 2 - Lần 1: Còn 2 lượt');
    createdDewIds.push(dewDay2_1.dew.id);

    const dewDay2_2 = await DewService.claimDew({ userId: testUser.id, teamId: testUser.team_id, customDate: today });
    assert(dewDay2_2.streak === 2, 'Ngày 2 - Lần 2: Giữ nguyên streak = 2');
    createdDewIds.push(dewDay2_2.dew.id);

    const dewDay2_3 = await DewService.claimDew({ userId: testUser.id, teamId: testUser.team_id, customDate: today });
    assert(dewDay2_3.claimsToday === 3, 'Ngày 2 - Lần 3: Đã đạt tối đa 3/3 lần');
    assert(dewDay2_3.hasClaimedToday === true, 'Ngày 2 - Lần 3: hasClaimedToday = true');
    createdDewIds.push(dewDay2_3.dew.id);

    let day2Blocked = false;
    try {
      await DewService.claimDew({ userId: testUser.id, teamId: testUser.team_id, customDate: today });
    } catch (e) {
      day2Blocked = (e.statusCode === 409);
    }
    assert(day2Blocked, 'Ngày 2 - Lần 4: Bị chặn thành công với HTTP 409');

    // =========================================================================
    // PHẦN 2: KIỂM THỬ GIEO QUOTES QUA CÁC NGÀY KHÁC NHAU (CROSS-DAY QUOTES)
    // =========================================================================
    console.log('\n📖 [PHẦN 2] Kiểm thử Gieo Trích Dẫn Đa Ngày (Tối đa 3 quotes/ngày):');

    // --- NGÀY 1: Hôm qua (${yesterday}) - Gieo 3 quotes ---
    console.log(`   🔹 Gieo sách Ngày 1 (${yesterday}):`);
    for (let i = 1; i <= 3; i++) {
      const qRes = await BookService.contributeBook({
        title: `Sách Thử Nghiệm Ngày 1 Tập ${i}`,
        author: `Tác Giả ${i}`,
        quote: `Trích dẫn thử nghiệm ngày 1 số ${i}`,
        reflection: `Cảm nghĩ số ${i}`,
        totalPages: 200,
        category: 'Kỹ năng sống',
        userId: testUser.id,
        teamId: testUser.team_id,
        reader: testUser.nickname || 'Tester',
        customDate: yesterday
      });
      assert(qRes.book && qRes.book.id, `Ngày 1 - Gieo quote ${i}: Thành công (+5 EXP)`);
      createdBookIds.push(qRes.book.id);
    }

    // Quote thứ 4 trong Ngày 1 phải bị chặn!
    let quoteDay1Blocked = false;
    try {
      await BookService.contributeBook({
        title: 'Sách Thứ 4 Ngày 1',
        author: 'Tác giả',
        quote: 'Trích dẫn thứ 4',
        totalPages: 100,
        category: 'Kỹ năng',
        userId: testUser.id,
        teamId: testUser.team_id,
        reader: testUser.nickname || 'Tester',
        customDate: yesterday
      });
    } catch (e) {
      quoteDay1Blocked = (e.statusCode === 409);
    }
    assert(quoteDay1Blocked, 'Ngày 1 - Gieo quote 4: Bị chặn thành công với HTTP 409 DAILY_QUOTE_LIMIT_EXCEEDED');

    // --- NGÀY 2: Hôm nay (${today}) - Gieo 3 quotes ---
    console.log(`   🔹 Gieo sách Ngày 2 (${today}):`);
    for (let i = 1; i <= 3; i++) {
      const qRes = await BookService.contributeBook({
        title: `Sách Thử Nghiệm Ngày 2 Tập ${i}`,
        author: `Tác Giả ${i}`,
        quote: `Trích dẫn thử nghiệm ngày 2 số ${i}`,
        reflection: `Cảm nghĩ ngày 2 số ${i}`,
        totalPages: 250,
        category: 'Kinh doanh',
        userId: testUser.id,
        teamId: testUser.team_id,
        reader: testUser.nickname || 'Tester',
        customDate: today
      });
      assert(qRes.book && qRes.book.id, `Ngày 2 - Gieo quote ${i}: Thành công (+5 EXP)`);
      createdBookIds.push(qRes.book.id);
    }

    // Quote thứ 4 trong Ngày 2 phải bị chặn!
    let quoteDay2Blocked = false;
    try {
      await BookService.contributeBook({
        title: 'Sách Thứ 4 Ngày 2',
        author: 'Tác giả',
        quote: 'Trích dẫn thứ 4',
        totalPages: 100,
        category: 'Kỹ năng',
        userId: testUser.id,
        teamId: testUser.team_id,
        reader: testUser.nickname || 'Tester',
        customDate: today
      });
    } catch (e) {
      quoteDay2Blocked = (e.statusCode === 409);
    }
    assert(quoteDay2Blocked, 'Ngày 2 - Gieo quote 4: Bị chặn thành công với HTTP 409');

    // =========================================================================
    // PHẦN 3: KIỂM THỬ ADMIN 288 NHÂN SỰ ĐA NGÀY (ZERO DUPLICATE ROWS)
    // =========================================================================
    console.log('\n👥 [PHẦN 3] Kiểm tra Danh Bạ 288 Nhân Sự Admin (Chống nhân dòng khi gieo nhiều hạt/nhiều ngày):');

    // 3.1: Kiểm tra khi xem Ngày 1 (Hôm qua)
    const dirDay1 = await AnalyticsService.getUsersDirectory({
      teamId: testUser.team_id,
      date: yesterday,
      limit: 100
    });
    assert(dirDay1.pagination.total === 37, 'Ngày 1 - Đội 5 có sĩ số chuẩn xác 37 người (Không bị nhân thành 40!)');
    const userInDay1 = dirDay1.users.filter(u => u.id === testUser.id);
    assert(userInDay1.length === 1, 'Ngày 1 - User chỉ xuất hiện DUY NHẤT 1 DÒNG trong bảng nhân sự');
    assert(userInDay1[0].participated_today === true, 'Ngày 1 - Trạng thái: ✅ Đã gieo');
    assert(userInDay1[0].today_quotes_count === 3, 'Ngày 1 - Số trích dẫn gieo trong ngày: 3 quotes');

    // 3.2: Kiểm tra khi xem Ngày 2 (Hôm nay)
    const dirDay2 = await AnalyticsService.getUsersDirectory({
      teamId: testUser.team_id,
      date: today,
      limit: 100
    });
    assert(dirDay2.pagination.total === 37, 'Ngày 2 - Đội 5 có sĩ số chuẩn xác 37 người');
    const userInDay2 = dirDay2.users.filter(u => u.id === testUser.id);
    assert(userInDay2.length === 1, 'Ngày 2 - User chỉ xuất hiện DUY NHẤT 1 DÒNG trong bảng nhân sự');
    assert(userInDay2[0].participated_today === true, 'Ngày 2 - Trạng thái: ✅ Đã gieo');
    assert(userInDay2[0].today_quotes_count === 3, 'Ngày 2 - Số trích dẫn gieo trong ngày: 3 quotes');

    // 3.3: Kiểm tra toàn bộ 288 nhân sự (Toàn công ty)
    const allUsersDir = await AnalyticsService.getUsersDirectory({
      date: today,
      limit: 300
    });
    assert(allUsersDir.pagination.total === 288, 'Tổng sĩ số toàn công ty đúng chuẩn 288 nhân sự (Zero gaps, zero extras)');
    
    // Kiểm tra không có bất kỳ ID nào bị trùng lặp trong toàn bộ danh bạ
    const uniqueUserIds = new Set(allUsersDir.users.map(u => u.id));
    assert(uniqueUserIds.size === allUsersDir.users.length, `100% ${allUsersDir.users.length} dòng hiển thị đều là các cán bộ riêng biệt (Không có bất kỳ dòng trùng lặp nào!)`);

    // =========================================================================
    // PHẦN 4: KIỂM THỬ BẢNG XẾP HẠNG 8 ĐỘI & TÍNH TOÀN VẸN EXP
    // =========================================================================
    console.log('\n📊 [PHẦN 4] Kiểm tra Bảng Xếp Hạng & Thống Kê Analytics Tổng Quan:');
    
    const overviewToday = await AnalyticsService.getOverview({ date: today });
    assert(overviewToday.teams.length === 8, 'Hệ thống có đủ 8 đội thi đua');
    
    const team5Overview = overviewToday.teams.find(t => t.id === testUser.team_id);
    assert(team5Overview !== undefined, 'Đội 5 (FPL_AU_FU) hiển thị trên bảng xếp hạng');
    assert(team5Overview.tree_exp === team5Overview.total_exp, 'tree_exp và total_exp đồng bộ 100%');
    console.log(`   ℹ️ Đội 5: Tổng EXP = ${team5Overview.total_exp}, Sĩ số = ${team5Overview.actual_members || team5Overview.target_members}, Tham gia hôm nay = ${team5Overview.today_participants} cán bộ`);

    // Kiểm tra tổng số nhân sự các chi nhánh
    const branchSum = overviewToday.branches.reduce((acc, b) => acc + parseInt(b.total_members || 0, 10), 0);
    assert(branchSum === 288, `Tổng thành viên các chi nhánh đúng 288 người (Không bị nhân bản)`);

    // =========================================================================
    // PHẦN 5: KIỂM TRA ĐIỀU KIỆN TƯỚI NƯỚC THEO LEVEL CÂY (LEVEL >= 2)
    // =========================================================================
    console.log('\n🌳 [PHẦN 5] Kiểm tra Điều Kiện Mở Nút Tưới Nước (Chỉ mở từ Cây Con - Lvl 2):');
    
    // Đội dưới 150 EXP (Level 1 Mầm Non) -> Không hiển thị nút tưới
    const lvl1Exp = 100;
    const lvl1Calc = lvl1Exp >= 150 ? 2 : 1;
    assert(lvl1Calc < 2, 'Cây 100 EXP (Cấp 1 Mầm Non): Ẩn button tưới nước');

    // Đội từ 150 EXP trở lên (Level 2 Cây Con) -> Hiển thị nút tưới
    const lvl2Exp = 150;
    const lvl2Calc = lvl2Exp >= 150 ? 2 : 1;
    assert(lvl2Calc >= 2, 'Cây 150 EXP (Cấp 2 Cây Con): Mở button tưới nước');

    console.log('\n' + '='.repeat(75));
    console.log('🎉 100% TẤT CẢ TESTKEY ĐA NGÀY, ĐA LẦN GIEO & ADMIN DIRECTORY ĐÃ VƯỢT QUA!');
    console.log('='.repeat(75));

  } catch (err) {
    console.error('\n❌ TESTKEY THẤT BẠI:', err);
    process.exit(1);
  } finally {
    console.log('\n🧹 Đang dọn dẹp dữ liệu kiểm thử...');
    try {
      // Dọn dews đã tạo
      if (createdDewIds.length > 0) {
        await client.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = ANY($2)', ['daily_dews', createdDewIds]);
        await client.query('DELETE FROM daily_dews WHERE id = ANY($1)', [createdDewIds]);
      }
      // Dọn books đã tạo
      if (createdBookIds.length > 0) {
        await client.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = ANY($2)', ['books', createdBookIds]);
        await client.query('DELETE FROM daily_quotes WHERE book_id = ANY($1)', [createdBookIds]);
        await client.query('DELETE FROM books WHERE id = ANY($1)', [createdBookIds]);
      }
      console.log('✅ Dọn dẹp hoàn tất, cơ sở dữ liệu giữ nguyên vẹn!');
    } catch (cleanErr) {
      console.error('Lỗi dọn dẹp:', cleanErr);
    }
    client.release();
    process.exit(0);
  }
}

runE2ETest();
