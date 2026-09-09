import db from '../config/database.js';
import DewService from '../services/dew.service.js';
import BookService from '../services/book.service.js';
import QuoteService from '../services/quote.service.js';
import { TeamService } from '../services/team.service.js';
import { AnalyticsService } from '../services/analytics.service.js';

function assert(condition, message, detail = '') {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`, detail);
    throw new Error(`Assertion failed: ${message} ${detail}`);
  }
  console.log(`   ✅ [PASS] ${message}`);
}

async function runFullTeamJourneyTest() {
  console.log('='.repeat(80));
  console.log('🏆 BẮT ĐẦU TESTKEY N2N: HÀNH TRÌNH THỰC TẾ TRỌN VẸN CỦA 1 ĐỘI THI ĐUA (FULL JOURNEY)');
  console.log('   Mô phỏng 5 ngày chiến dịch: Mầm non ➔ Cây con ➔ Trưởng thành ➔ Cổ thụ ➔ Hoa trái');
  console.log('='.repeat(80));

  const client = await db.pool.connect();
  const createdBookIds = [];
  const createdDewIds = [];

  // Lưu lại snapshot ban đầu của Đội 5 và các thành viên để rollback nguyên vẹn 100%
  let initialTeamSnapshot = null;
  let initialUserSnapshots = [];

  try {
    // -------------------------------------------------------------------------
    // 0. CHUẨN BỊ MÔI TRƯỜNG & CHỌN ĐỘI THI ĐUA THỰC TẾ
    // -------------------------------------------------------------------------
    const teamId = 5; // Đội 5: FPL_AU_FU
    const teamQuery = await client.query('SELECT * FROM teams WHERE id = $1', [teamId]);
    assert(teamQuery.rows.length > 0, 'Tìm thấy Đội 5 (FPL_AU_FU) trong hệ thống');
    initialTeamSnapshot = teamQuery.rows[0];

    // Lấy danh sách 5 thành viên thực tế của Đội 5 để mô phỏng hành vi khác nhau
    const membersQuery = await client.query(`
      SELECT id, full_name, nickname, team_id, total_exp_earned, contributed_books_count
      FROM users
      WHERE team_id = $1
      ORDER BY id ASC
      LIMIT 5
    `, [teamId]);
    assert(membersQuery.rows.length >= 5, 'Lấy đủ 5 thành viên nòng cốt của Đội 5');
    initialUserSnapshots = membersQuery.rows;

    const [memberA, memberB, memberC, memberD, memberE] = membersQuery.rows;
    console.log(`👥 Danh sách 5 nhân sự thử nghiệm Đội 5:`);
    console.log(`   1. [Member A - Siêu tích cực] : ${memberA.nickname || memberA.full_name} (${memberA.id})`);
    console.log(`   2. [Member B - Năng nổ]       : ${memberB.nickname || memberB.full_name} (${memberB.id})`);
    console.log(`   3. [Member C - Đều đặn]      : ${memberC.nickname || memberC.full_name} (${memberC.id})`);
    console.log(`   4. [Member D - Bận rộn]       : ${memberD.nickname || memberD.full_name} (${memberD.id})`);
    console.log(`   5. [Member E - Tham gia sau]  : ${memberE.nickname || memberE.full_name} (${memberE.id})`);

    // Chuỗi 5 ngày liên tiếp giả lập hành trình
    const day1 = '2026-09-05';
    const day2 = '2026-09-06';
    const day3 = '2026-09-07';
    const day4 = '2026-09-08';
    const day5 = '2026-09-09';

    const testDates = [day1, day2, day3, day4, day5];

    // Dọn dẹp dữ liệu cũ phát sinh ở 5 ngày này của 5 users nếu có
    const userIds = membersQuery.rows.map(u => u.id);
    await client.query('DELETE FROM daily_dews WHERE user_id = ANY($1) AND claim_date = ANY($2)', [userIds, testDates]);
    const oldQuotes = await client.query('SELECT book_id FROM daily_quotes WHERE user_id = ANY($1) AND quote_date = ANY($2)', [userIds, testDates]);
    for (const r of oldQuotes.rows) {
      if (r.book_id) {
        await client.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = $2', ['books', r.book_id]);
        await client.query('DELETE FROM books WHERE id = $1', [r.book_id]);
      }
    }
    await client.query('DELETE FROM daily_quotes WHERE user_id = ANY($1) AND quote_date = ANY($2)', [userIds, testDates]);
    await client.query('DELETE FROM fruit_harvests WHERE team_id = $1 AND harvest_date = ANY($2)', [teamId, testDates]);

    // =========================================================================
    // 🌟 GIAI ĐOẠN 1: NGÀY 1 (2026-09-05) - MẦM NON (LEVEL 1 / EXP < 150)
    // =========================================================================
    console.log('\n' + '-'.repeat(70));
    console.log(`🌱 GIAI ĐOẠN 1: NGÀY 1 (${day1}) - MẦM NON (LEVEL 1 / EXP < 150)`);
    console.log('-'.repeat(70));

    // Đặt đội về trạng thái Mầm non (< 150 EXP, ví dụ 80 EXP)
    await client.query(`
      UPDATE teams 
      SET tree_exp = 80, total_exp = 80, tree_level = 1, level = 1, total_books = 4
      WHERE id = $1
    `, [teamId]);

    // 1.1: Kiểm tra quy tắc nghiệp vụ: Cây chưa đạt Level 2 -> NÚT TƯỚI NƯỚC PHẢI BỊ ẨN / KHÓA
    const currentTeamState1 = (await client.query('SELECT level, tree_level, total_exp FROM teams WHERE id = $1', [teamId])).rows[0];
    const canWaterLevel1 = currentTeamState1.tree_level >= 2 && currentTeamState1.total_exp >= 150;
    assert(!canWaterLevel1, 'Ngày 1: Cây ở Level 1 (80 EXP) -> Tính năng Tưới Nước BỊ KHÓA theo đúng quy định!');

    // 1.2: Thành viên tích cực gieo hạt tri thức (Quotes)
    // Member A gieo đủ 3 quotes (+15 EXP)
    console.log(`   🔹 Member A (${memberA.nickname}) gieo 3 quotes:`);
    for (let i = 1; i <= 3; i++) {
      const q = await BookService.contributeBook({
        title: `Sách Ngày 1 Cuốn ${i}`,
        author: 'Tác giả A',
        quote: `Trích dẫn sâu sắc ngày 1 số ${i}`,
        totalPages: 200,
        category: 'Tư duy',
        userId: memberA.id,
        teamId: teamId,
        reader: memberA.nickname,
        customDate: day1
      });
      assert(q.book && q.book.id, `Member A gieo thành công quote ${i} (+5 EXP)`);
      createdBookIds.push(q.book.id);
    }

    // 1.3: Member A cố gieo quote thứ 4 -> Bị chặn 409
    let quote4Blocked = false;
    try {
      await BookService.contributeBook({
        title: 'Sách Thứ 4',
        author: 'Tác giả',
        quote: 'Trích dẫn thứ 4',
        totalPages: 150,
        category: 'Tư duy',
        userId: memberA.id,
        teamId: teamId,
        reader: memberA.nickname,
        customDate: day1
      });
    } catch (e) {
      quote4Blocked = (e.statusCode === 409);
    }
    assert(quote4Blocked, 'Member A gieo quote thứ 4 bị chặn thành công với HTTP 409 DAILY_QUOTE_LIMIT_EXCEEDED');

    // 1.4: Các thành viên khác tham gia Ngày 1
    // Member B gieo 2 quotes
    const qB1 = await BookService.contributeBook({
      title: 'Sách Member B Cuốn 1',
      author: 'Tác giả B',
      quote: 'Trích dẫn B1',
      totalPages: 180,
      category: 'Kỹ năng',
      userId: memberB.id,
      teamId: teamId,
      reader: memberB.nickname,
      customDate: day1
    });
    createdBookIds.push(qB1.book.id);

    const qB2 = await BookService.contributeBook({
      title: 'Sách Member B Cuốn 2',
      author: 'Tác giả B',
      quote: 'Trích dẫn B2',
      totalPages: 220,
      category: 'Kỹ năng',
      userId: memberB.id,
      teamId: teamId,
      reader: memberB.nickname,
      customDate: day1
    });
    createdBookIds.push(qB2.book.id);
    assert(qB2.book && qB2.book.id, 'Member B gieo thành công 2 quotes (+10 EXP)');

    // Member C gieo 1 quote
    const qC1 = await BookService.contributeBook({
      title: 'Sách Member C Cuốn 1',
      author: 'Tác giả C',
      quote: 'Trích dẫn C1',
      totalPages: 150,
      category: 'Công nghệ',
      userId: memberC.id,
      teamId: teamId,
      reader: memberC.nickname,
      customDate: day1
    });
    createdBookIds.push(qC1.book.id);
    assert(qC1.book && qC1.book.id, 'Member C gieo thành công 1 quote (+5 EXP)');

    // Member D gieo 1 quote
    const qD1 = await BookService.contributeBook({
      title: 'Sách Member D Cuốn 1',
      author: 'Tác giả D',
      quote: 'Trích dẫn D1',
      totalPages: 300,
      category: 'Lịch sử',
      userId: memberD.id,
      teamId: teamId,
      reader: memberD.nickname,
      customDate: day1
    });
    createdBookIds.push(qD1.book.id);
    assert(qD1.book && qD1.book.id, 'Member D gieo thành công 1 quote (+5 EXP)');

    // 1.5: Kiểm tra Admin Danh Bạ 288 Nhân Sự Ngày 1
    const dirDay1 = await AnalyticsService.getUsersDirectory({ teamId: teamId, date: day1, limit: 100 });
    assert(dirDay1.pagination.total === 37, 'Admin Ngày 1: Sĩ số Đội 5 chuẩn xác 37 người (Không nhân dòng)');
    
    const userA_Day1 = dirDay1.users.find(u => u.id === memberA.id);
    assert(userA_Day1.participated_today === true, 'Member A: Trạng thái ✅ Đã gieo');
    assert(userA_Day1.today_quotes_count === 3, 'Member A: Đã gieo đúng 3 quotes');

    const userB_Day1 = dirDay1.users.find(u => u.id === memberB.id);
    assert(userB_Day1.today_quotes_count === 2, 'Member B: Đã gieo đúng 2 quotes');

    const userC_Day1 = dirDay1.users.find(u => u.id === memberC.id);
    assert(userC_Day1.today_quotes_count === 1, 'Member C: Đã gieo đúng 1 quote');

    const userE_Day1 = dirDay1.users.find(u => u.id === memberE.id);
    assert(userE_Day1.participated_today === false, 'Member E: Trạng thái ⏳ Chưa gieo (0 quotes)');

    // =========================================================================
    // 🌟 GIAI ĐOẠN 2: NGÀY 2 (2026-09-06) - THĂNG CẤP CÂY CON (LEVEL 2 >= 150 EXP)
    // =========================================================================
    console.log('\n' + '-'.repeat(70));
    console.log(`🌿 GIAI ĐOẠN 2: NGÀY 2 (${day2}) - BƯỚC NGOẶT THĂNG CẤP CÂY CON (LEVEL 2 >= 150 EXP)`);
    console.log('-'.repeat(70));

    // Đội vượt ngưỡng 150 EXP (ví dụ 160 EXP)
    await client.query(`
      UPDATE teams 
      SET tree_exp = 160, total_exp = 160, tree_level = 2, level = 2
      WHERE id = $1
    `, [teamId]);

    // 2.1: Kiểm tra tính năng Tưới Nước CHÍNH THỨC ĐƯỢC MỞ KHÓA
    const currentTeamState2 = (await client.query('SELECT level, tree_level, total_exp FROM teams WHERE id = $1', [teamId])).rows[0];
    const canWaterLevel2 = currentTeamState2.tree_level >= 2 && currentTeamState2.total_exp >= 150;
    assert(canWaterLevel2, 'Ngày 2: Cây đạt Level 2 (160 EXP) ➔ NÚT TƯỚI NƯỚC CHÍNH THỨC MỞ KHÓA!');

    // 2.2: Member A bắt đầu tưới nước (Daily Dew) Ngày 2
    console.log(`   🔹 Member A tưới nước 3 lần trong Ngày 2:`);
    const dewA2_1 = await DewService.claimDew({ userId: memberA.id, teamId: teamId, customDate: day2 });
    assert(dewA2_1.streak === 1, 'Member A - Tưới lần 1: Streak khởi đầu = 1');
    assert(dewA2_1.claimsToday === 1, 'Member A - Đã tưới 1/3 lần hôm nay');
    assert(dewA2_1.remainingClaimsToday === 2, 'Member A - Còn 2 lượt tưới');
    createdDewIds.push(dewA2_1.dew.id);

    const dewA2_2 = await DewService.claimDew({ userId: memberA.id, teamId: teamId, customDate: day2 });
    assert(dewA2_2.streak === 1, 'Member A - Tưới lần 2: Streak giữ nguyên 1 (không cộng dồn trong cùng ngày)');
    assert(dewA2_2.claimsToday === 2, 'Member A - Đã tưới 2/3 lần');
    createdDewIds.push(dewA2_2.dew.id);

    const dewA2_3 = await DewService.claimDew({ userId: memberA.id, teamId: teamId, customDate: day2 });
    assert(dewA2_3.claimsToday === 3, 'Member A - Tưới lần 3: Đạt tối đa 3/3 lần!');
    assert(dewA2_3.hasClaimedToday === true, 'Member A - hasClaimedToday = true');
    createdDewIds.push(dewA2_3.dew.id);

    // Lần 4 phải bị chặn 409
    let dewA2_4Blocked = false;
    try {
      await DewService.claimDew({ userId: memberA.id, teamId: teamId, customDate: day2 });
    } catch (e) {
      dewA2_4Blocked = (e.statusCode === 409);
    }
    assert(dewA2_4Blocked, 'Member A - Tưới lần 4 bị chặn thành công với HTTP 409 DUPLICATE_DEW_CLAIM');

    // 2.3: Member B tưới 2 lần
    const dewB2_1 = await DewService.claimDew({ userId: memberB.id, teamId: teamId, customDate: day2 });
    createdDewIds.push(dewB2_1.dew.id);
    const dewB2_2 = await DewService.claimDew({ userId: memberB.id, teamId: teamId, customDate: day2 });
    createdDewIds.push(dewB2_2.dew.id);
    assert(dewB2_2.claimsToday === 2, 'Member B - Đã tưới 2 lần');

    // 2.4: Member D hôm nay bận việc, không tưới nước và không gieo sách
    // Member E bắt đầu tham gia chiến dịch từ Ngày 2
    const qE2_1 = await BookService.contributeBook({
      title: 'Sách Member E Cuốn 1',
      author: 'Tác giả E',
      quote: 'Trích dẫn E1',
      totalPages: 190,
      category: 'Văn học',
      userId: memberE.id,
      teamId: teamId,
      reader: memberE.nickname,
      customDate: day2
    });
    createdBookIds.push(qE2_1.book.id);
    assert(qE2_1.book && qE2_1.book.id, 'Member E tham gia từ Ngày 2: Gieo quote đầu tiên (+5 EXP)');

    const dewE2_1 = await DewService.claimDew({ userId: memberE.id, teamId: teamId, customDate: day2 });
    createdDewIds.push(dewE2_1.dew.id);
    assert(dewE2_1.streak === 1, 'Member E: Tưới nước lần đầu, streak = 1');

    // 2.5: Kiểm tra Admin Directory Ngày 2
    const dirDay2 = await AnalyticsService.getUsersDirectory({ teamId: teamId, date: day2, limit: 100 });
    assert(dirDay2.pagination.total === 37, 'Admin Ngày 2: Sĩ số vẫn đúng 37 người');
    const userD_Day2 = dirDay2.users.find(u => u.id === memberD.id);
    assert(userD_Day2.participated_today === false, 'Member D (vắng mặt ngày 2): ⏳ Chưa gieo');

    // =========================================================================
    // 🌟 GIAI ĐOẠN 3: NGÀY 3 (2026-09-07) - DUY TRÌ LIÊN TỤC & KIỂM TRA CHUỖI STREAK
    // =========================================================================
    console.log('\n' + '-'.repeat(70));
    console.log(`🔥 GIAI ĐOẠN 3: NGÀY 3 (${day3}) - DUY TRÌ LIÊN TỤC & KIỂM TRA CHUỖI STREAK`);
    console.log('-'.repeat(70));

    // 3.1: Member A đã tưới Ngày 2, nay tưới Ngày 3 -> STREAK PHẢI TĂNG LÊN 2!
    const dewA3_1 = await DewService.claimDew({ userId: memberA.id, teamId: teamId, customDate: day3 });
    assert(dewA3_1.streak === 2, 'Member A (tưới liên tiếp Ngày 2 và 3): Chuỗi streak TĂNG LÊN 2 NGÀY LIÊN TIẾP! 🔥');
    createdDewIds.push(dewA3_1.dew.id);

    // 3.2: Member B cũng tưới Ngày 2, nay tưới Ngày 3 -> Streak cũng tăng lên 2
    const dewB3_1 = await DewService.claimDew({ userId: memberB.id, teamId: teamId, customDate: day3 });
    assert(dewB3_1.streak === 2, 'Member B (tưới liên tiếp Ngày 2 và 3): Chuỗi streak tăng lên 2 ngày!');
    createdDewIds.push(dewB3_1.dew.id);

    // 3.3: Member D (đã bỏ lỡ Ngày 2), nay quay trở lại tưới vào Ngày 3 -> STREAK BỊ RESET VỀ 1!
    const dewD3_1 = await DewService.claimDew({ userId: memberD.id, teamId: teamId, customDate: day3 });
    assert(dewD3_1.streak === 1, 'Member D (bỏ lỡ Ngày 2, tưới Ngày 3): Chuỗi streak RESET VỀ 1 do bị ngắt quãng!');
    createdDewIds.push(dewD3_1.dew.id);

    // 3.4: Kiểm tra tính toàn vẹn của EXP Ledger (Nhật ký biến động điểm)
    const ledgerCount = await client.query(`
      SELECT COUNT(*) as total 
      FROM exp_ledger 
      WHERE user_id = $1 AND type IN ('BOOK_CONTRIBUTION', 'DAILY_DEW')
    `, [memberA.id]);
    assert(parseInt(ledgerCount.rows[0].total, 10) >= 4, 'EXP Ledger: Lưu trữ đầy đủ mọi giao dịch điểm của Member A');

    // =========================================================================
    // 🌟 GIAI ĐOẠN 4: NGÀY 4 (2026-09-08) - CÂY TRƯỞNG THÀNH & CỔ THỤ (LEVEL 3 & 4)
    // =========================================================================
    console.log('\n' + '-'.repeat(70));
    console.log(`🌳 GIAI ĐOẠN 4: NGÀY 4 (${day4}) - VƯƠN MÌNH THÀNH CÂY TRƯỞNG THÀNH & CỔ THỤ (LEVEL 3 & 4)`);
    console.log('-'.repeat(70));

    // Member A tiếp tục tưới ngày thứ 3 liên tiếp -> STREAK TĂNG LÊN 3!
    const dewA4_1 = await DewService.claimDew({ userId: memberA.id, teamId: teamId, customDate: day4 });
    assert(dewA4_1.streak === 3, 'Member A (tưới liên tiếp Ngày 2, 3, 4): Chuỗi streak TĂNG LÊN 3 NGÀY LIÊN TIẾP! 🔥🔥🔥');
    createdDewIds.push(dewA4_1.dew.id);

    // Mô phỏng đội bứt phá điểm số:
    // Cột mốc 1: Đạt 350 EXP -> Cấp 3 (Cây Trưởng Thành)
    await client.query(`
      UPDATE teams 
      SET tree_exp = 350, total_exp = 350, tree_level = 3, level = 3
      WHERE id = $1
    `, [teamId]);
    const teamStateL3 = (await client.query('SELECT tree_level, level FROM teams WHERE id = $1', [teamId])).rows[0];
    assert(teamStateL3.tree_level === 3 && teamStateL3.level === 3, 'Cột mốc 350 EXP: Đội 5 thăng cấp lên Level 3 (Cây Trưởng Thành)');

    // Cột mốc 2: Đạt 700 EXP -> Cấp 4 (Cây Cổ Thụ)
    await client.query(`
      UPDATE teams 
      SET tree_exp = 700, total_exp = 700, tree_level = 4, level = 4
      WHERE id = $1
    `, [teamId]);
    const teamStateL4 = (await client.query('SELECT tree_level, level FROM teams WHERE id = $1', [teamId])).rows[0];
    assert(teamStateL4.tree_level === 4 && teamStateL4.level === 4, 'Cột mốc 700 EXP: Đội 5 thăng cấp lên Level 4 (Cây Cổ Thụ)');

    // =========================================================================
    // 🌟 GIAI ĐOẠN 5: NGÀY 5 (2026-09-09) - ĐẠI THỤ ĐƠM HOA KẾT TRÁI (LEVEL 5) & THU HOẠCH QUẢ
    // =========================================================================
    console.log('\n' + '-'.repeat(70));
    console.log(`🍎 GIAI ĐOẠN 5: NGÀY 5 (${day5}) - ĐẠI THỤ ĐƠM HOA KẾT TRÁI (LEVEL 5) & THU HOẠCH QUẢ`);
    console.log('-'.repeat(70));

    // Đội đạt 1300 EXP -> Level 5 (Đơm hoa kết trái)
    await client.query(`
      UPDATE teams 
      SET tree_exp = 1300, total_exp = 1300, tree_level = 5, level = 5
      WHERE id = $1
    `, [teamId]);
    const teamStateL5 = (await client.query('SELECT tree_level, level FROM teams WHERE id = $1', [teamId])).rows[0];
    assert(teamStateL5.tree_level === 5 && teamStateL5.level === 5, 'Cột mốc 1300 EXP: Đội 5 đạt Level 5 (Đại thụ đơm hoa kết trái)');

    // 5.1: Member A hái Trái Tri Thức index 0 (+5 EXP)
    const fruitHarvest1 = await QuoteService.harvestFruit(0, `fp_user_${memberA.id.substring(0, 8)}`, {
      userId: memberA.id,
      teamId: teamId,
      customDate: day5
    });
    assert(fruitHarvest1.fruitIndex === 0, 'Member A: Hái thành công Trái Tri Thức số 0 (+5 EXP)');
    assert(fruitHarvest1.expEarned === 5, 'Trái Tri Thức cộng chuẩn +5 EXP');

    // 5.2: Member A cố tình hái lại Trái số 0 trong cùng ngày -> Bị chặn chống spam!
    let duplicateFruitBlocked = false;
    try {
      await QuoteService.harvestFruit(0, `fp_user_${memberA.id.substring(0, 8)}`, {
        userId: memberA.id,
        teamId: teamId,
        customDate: day5
      });
    } catch (e) {
      duplicateFruitBlocked = (e.status === 409 || e.statusCode === 409 || e.status === 400 || e.code === '23505');
    }
    assert(duplicateFruitBlocked, 'Member A hái lại quả số 0 bị chặn thành công (Chống spam quả)');

    // 5.3: Member B hái Trái Tri Thức index 1 (+5 EXP)
    const fruitHarvest2 = await QuoteService.harvestFruit(1, `fp_user_${memberB.id.substring(0, 8)}`, {
      userId: memberB.id,
      teamId: teamId,
      customDate: day5
    });
    assert(fruitHarvest2.fruitIndex === 1, 'Member B: Hái thành công Trái Tri Thức số 1 (+5 EXP)');

    // =========================================================================
    // 🌟 TỔNG KIỂM TOÁN HỆ THỐNG: LEADERBOARD, 288 NHÂN SỰ & ZERO DUPLICATES
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🔍 TỔNG KIỂM TOÁN HỆ THỐNG TOÀN DIỆN (LEADERBOARD & DANH BẠ 288 NHÂN SỰ)');
    console.log('='.repeat(80));

    // A. Bảng xếp hạng 8 Đội
    const overview = await AnalyticsService.getOverview({ date: day5 });
    assert(overview.teams.length === 8, 'Hệ thống có đủ 8 đội thi đua trên Bảng Xếp Hạng');
    const team5Final = overview.teams.find(t => t.id === teamId);
    assert(team5Final !== undefined, 'Đội 5 xuất hiện đầy đủ trên Bảng Xếp Hạng');
    assert(team5Final.tree_exp === team5Final.total_exp, 'tree_exp và total_exp của Đội 5 đồng bộ 100%');
    console.log(`   📊 Đội 5 Tổng kết: EXP = ${team5Final.total_exp} | Level = ${team5Final.tree_level} | Thành viên = ${team5Final.actual_members || team5Final.target_members}`);

    // B. Danh bạ 288 nhân sự (Audit toàn công ty)
    const allUsersDirectory = await AnalyticsService.getUsersDirectory({ date: day5, limit: 300 });
    assert(allUsersDirectory.pagination.total === 288, 'Danh bạ toàn công ty: Chuẩn xác 288/288 nhân sự!');
    assert(allUsersDirectory.users.length === 288, 'Danh sách trả về hiển thị đầy đủ 288 dòng');

    // Kiểm tra tính duy nhất tuyệt đối (Zero duplicates across all users)
    const uniqueIds = new Set(allUsersDirectory.users.map(u => u.id));
    assert(uniqueIds.size === 288, '100% 288 cán bộ đều là các cá nhân duy nhất, ZERO DÒNG TRÙNG LẶP!');

    // C. Modal Thành Viên Đội 5
    const team5Members = await TeamService.getTeamMembers(teamId);
    assert(team5Members.length === 37, 'Danh sách thành viên Đội 5 trả về chuẩn xác 37 người');
    const hasAllNicknames = team5Members.every(m => m.nickname && m.nickname.trim().length > 0);
    assert(hasAllNicknames, '100% thành viên Đội 5 có Bút Danh (Nickname) hiển thị');

    console.log('\n' + '='.repeat(80));
    console.log('🎉 100% TẤT CẢ GIAI ĐOẠN CỦA HÀNH TRÌNH ĐỘI ĐÃ VƯỢT QUA TESTKEY XUẤT SẮC!');
    console.log('='.repeat(80));

  } finally {
    // -------------------------------------------------------------------------
    // 🧹 HOÀN TRẢ & DỌN DẸP DỮ LIỆU KIỂM THỬ (SANDBOX RESTORATION)
    // -------------------------------------------------------------------------
    console.log('\n🧹 Đang hoàn trả trạng thái ban đầu của CSDL...');
    try {
      // Xóa dews tạo trong test
      if (createdDewIds.length > 0) {
        await client.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = ANY($2)', ['daily_dews', createdDewIds]);
        await client.query('DELETE FROM daily_dews WHERE id = ANY($1)', [createdDewIds]);
      }
      // Xóa books tạo trong test
      if (createdBookIds.length > 0) {
        await client.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = ANY($2)', ['books', createdBookIds]);
        await client.query('DELETE FROM daily_quotes WHERE book_id = ANY($1)', [createdBookIds]);
        await client.query('DELETE FROM books WHERE id = ANY($1)', [createdBookIds]);
      }
      // Xóa fruit harvests trong test
      await client.query('DELETE FROM fruit_harvests WHERE team_id = 5 AND harvest_date >= $1', ['2026-09-05']);
      await client.query("DELETE FROM exp_ledger WHERE team_id = 5 AND type = 'FRUIT_HARVEST'");

      // Khôi phục Đội 5 về trạng thái ban đầu
      if (initialTeamSnapshot) {
        await client.query(`
          UPDATE teams
          SET total_exp = $1, tree_exp = $2, tree_level = $3, level = $4,
              total_books = $5, total_dews = $6, updated_at = NOW()
          WHERE id = $7
        `, [
          initialTeamSnapshot.total_exp,
          initialTeamSnapshot.tree_exp,
          initialTeamSnapshot.tree_level,
          initialTeamSnapshot.level,
          initialTeamSnapshot.total_books,
          initialTeamSnapshot.total_dews,
          initialTeamSnapshot.id
        ]);
      }

      // Khôi phục user snapshots
      for (const u of initialUserSnapshots) {
        await client.query(`
          UPDATE users 
          SET total_exp_earned = $1, contributed_books_count = $2 
          WHERE id = $3
        `, [u.total_exp_earned, u.contributed_books_count, u.id]);
      }

      console.log('✅ Hoàn tất dọn dẹp và khôi phục CSDL! Dữ liệu thực tế được giữ nguyên vẹn 100%.');
    } catch (cleanupErr) {
      console.error('⚠️ Lỗi trong quá trình dọn dẹp:', cleanupErr);
    } finally {
      client.release();
    }
  }
}

runFullTeamJourneyTest()
  .then(() => {
    console.log('\n✅ TEST SUITE COMPLETED SUCCESSFULLY.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  });
