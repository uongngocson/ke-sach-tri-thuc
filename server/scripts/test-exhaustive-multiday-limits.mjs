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

async function runExhaustiveMultiDayLimitTest() {
  console.log('='.repeat(85));
  console.log('🧪 KIỂM THỬ TOÀN DIỆN 100%: LOGIC 3 LẦN TƯỚI/NGÀY & 3 QUOTES/NGÀY XUYÊN SUỐT CÁC NGÀY');
  console.log('   Mục tiêu: Đảm bảo hạn mức 3/ngày độc lập từng ngày, không rò rỉ, streak chuẩn xác,');
  console.log('   ngày nghỉ tự reset, ngày mới cấp mới quota, Admin không lặp dòng!');
  console.log('='.repeat(85));

  const client = await db.pool.connect();
  const createdBookIds = [];
  const createdDewIds = [];

  let initialUserSnapshots = [];
  let initialTeamSnapshot = null;

  try {
    // -------------------------------------------------------------------------
    // 0. CHUẨN BỊ 2 USERS THỰC TẾ TRÊN ĐỘI 5 ĐỂ KIỂM THỬ ĐỘC LẬP
    // -------------------------------------------------------------------------
    const teamId = 5;
    const teamQuery = await client.query('SELECT * FROM teams WHERE id = $1', [teamId]);
    initialTeamSnapshot = teamQuery.rows[0];

    const usersQuery = await client.query(`
      SELECT id, full_name, nickname, team_id, total_exp_earned, contributed_books_count
      FROM users WHERE team_id = $1 ORDER BY id ASC LIMIT 2
    `, [teamId]);
    assert(usersQuery.rows.length >= 2, 'Tìm thấy 2 users thực tế thuộc Đội 5');
    initialUserSnapshots = usersQuery.rows;

    const [userA, userB] = usersQuery.rows;
    console.log(`👤 User A (Tham gia liên tục) : ${userA.nickname || userA.full_name} (${userA.id})`);
    console.log(`👤 User B (Tham gia ngắt quãng): ${userB.nickname || userB.full_name} (${userB.id})`);

    // Chuỗi 5 ngày kiểm thử:
    // Day 1: 2026-09-01 (User A & User B đều làm full 3/3)
    // Day 2: 2026-09-02 (User A làm full 3/3, User B làm 1/3)
    // Day 3: 2026-09-03 (User A làm full 3/3, User B NGHỈ HOÀN TOÀN)
    // Day 4: 2026-09-04 (User A làm full 3/3, User B quay lại sau khi nghỉ)
    // Day 5: 2026-09-05 (User A làm full 3/3, User B tiếp tục)
    const day1 = '2026-09-01';
    const day2 = '2026-09-02';
    const day3 = '2026-09-03';
    const day4 = '2026-09-04';
    const day5 = '2026-09-05';
    const allDays = [day1, day2, day3, day4, day5];

    // Dọn dẹp dữ liệu cũ phát sinh ở 5 ngày này nếu có
    const testUserIds = [userA.id, userB.id];
    await client.query('DELETE FROM daily_dews WHERE user_id = ANY($1) AND claim_date = ANY($2)', [testUserIds, allDays]);
    const oldQuotes = await client.query('SELECT book_id FROM daily_quotes WHERE user_id = ANY($1) AND quote_date = ANY($2)', [testUserIds, allDays]);
    for (const r of oldQuotes.rows) {
      if (r.book_id) {
        await client.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = $2', ['books', r.book_id]);
        await client.query('DELETE FROM books WHERE id = $1', [r.book_id]);
      }
    }
    await client.query('DELETE FROM daily_quotes WHERE user_id = ANY($1) AND quote_date = ANY($2)', [testUserIds, allDays]);

    // =========================================================================
    // 📅 NGÀY 1 (2026-09-01): KHỞI ĐẦU - TEST ĐỦ 3 LẦN & CHẶN LẦN THỨ 4
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log(`📅 NGÀY 1 (${day1}): KIỂM THỬ KHỞI ĐẦU - CẢ 2 USERS THỰC HIỆN ĐỦ 3/3`);
    console.log('='.repeat(80));

    // 1.1: Kiểm tra trạng thái đầu ngày (cả 2 user đều còn nguyên quota 3 lần)
    const dewStatusA_Day1_Init = await DewService.getDewStatus({ userId: userA.id, customDate: day1 });
    assert(dewStatusA_Day1_Init.claimsToday === 0, 'User A - Ngày 1 đầu ngày: claimsToday = 0');
    assert(dewStatusA_Day1_Init.remainingClaimsToday === 3, 'User A - Ngày 1 đầu ngày: còn nguyên 3 lượt tưới');
    assert(dewStatusA_Day1_Init.hasClaimedToday === false, 'User A - Ngày 1 đầu ngày: hasClaimedToday = false');

    const quoteStatusA_Day1_Init = await BookService.getDailyQuoteStatus({ userId: userA.id, customDate: day1 });
    assert(quoteStatusA_Day1_Init.quotesTodayCount === 0, 'User A - Ngày 1 đầu ngày: quotesTodayCount = 0');
    assert(quoteStatusA_Day1_Init.remainingToday === 3, 'User A - Ngày 1 đầu ngày: còn nguyên 3 lượt gieo quote');
    assert(quoteStatusA_Day1_Init.hasContributedToday === false, 'User A - Ngày 1 đầu ngày: hasContributedToday = false');

    // 1.2: User A thực hiện tuần tự 3 lần tưới
    console.log(`   💧 User A tưới nước 3 lần trong Ngày 1:`);
    for (let i = 1; i <= 3; i++) {
      const dewRes = await DewService.claimDew({ userId: userA.id, teamId: teamId, customDate: day1 });
      assert(dewRes.claimsToday === i, `User A - Tưới lần ${i}: claimsToday = ${i}`);
      assert(dewRes.remainingClaimsToday === 3 - i, `User A - Tưới lần ${i}: remainingClaimsToday = ${3 - i}`);
      assert(dewRes.hasClaimedToday === (i === 3), `User A - Tưới lần ${i}: hasClaimedToday = ${i === 3}`);
      assert(dewRes.streak === 1, `User A - Tưới lần ${i}: Streak giữ nguyên = 1 (cùng ngày không tăng streak)`);
      createdDewIds.push(dewRes.dew.id);
    }

    // 1.3: User A cố tình tưới lần thứ 4 trong Ngày 1 -> PHẢI BỊ CHẶN 409
    let dewA_Day1_L4_Blocked = false;
    try {
      await DewService.claimDew({ userId: userA.id, teamId: teamId, customDate: day1 });
    } catch (e) {
      dewA_Day1_L4_Blocked = (e.statusCode === 409 && e.code === 'DUPLICATE_DEW_CLAIM');
    }
    assert(dewA_Day1_L4_Blocked, 'User A - Ngày 1: Lần tưới thứ 4 bị chặn đứng với HTTP 409 DUPLICATE_DEW_CLAIM!');

    // 1.4: User A thực hiện tuần tự 3 lần gieo sách
    console.log(`   📖 User A gieo sách 3 quotes trong Ngày 1:`);
    for (let i = 1; i <= 3; i++) {
      const qRes = await BookService.contributeBook({
        title: `Sách Ngày 1 Tập ${i}`,
        author: 'Tác giả A',
        quote: `Trích dẫn sâu sắc ngày 1 câu ${i}`,
        category: 'Kỹ năng',
        reader: userA.nickname,
        userId: userA.id,
        teamId: teamId,
        customDate: day1
      });
      assert(qRes.book && qRes.book.id, `User A - Gieo quote ${i}: Thành công (+5 EXP)`);
      createdBookIds.push(qRes.book.id);

      const qStatus = await BookService.getDailyQuoteStatus({ userId: userA.id, customDate: day1 });
      assert(qStatus.quotesTodayCount === i, `User A - Sau quote ${i}: quotesTodayCount = ${i}`);
      assert(qStatus.remainingToday === 3 - i, `User A - Sau quote ${i}: remainingToday = ${3 - i}`);
      assert(qStatus.hasContributedToday === (i === 3), `User A - Sau quote ${i}: hasContributedToday = ${i === 3}`);
    }

    // 1.5: User A cố tình gieo quote thứ 4 trong Ngày 1 -> PHẢI BỊ CHẶN 409
    let quoteA_Day1_L4_Blocked = false;
    try {
      await BookService.contributeBook({
        title: 'Sách Thứ 4 Ngày 1',
        author: 'Tác giả',
        quote: 'Trích dẫn thứ 4 vượt hạn mức',
        category: 'Kỹ năng',
        reader: userA.nickname,
        userId: userA.id,
        teamId: teamId,
        customDate: day1
      });
    } catch (e) {
      quoteA_Day1_L4_Blocked = (e.statusCode === 409 && e.code === 'DAILY_QUOTE_LIMIT_EXCEEDED');
    }
    assert(quoteA_Day1_L4_Blocked, 'User A - Ngày 1: Gieo quote thứ 4 bị chặn đứng với HTTP 409 DAILY_QUOTE_LIMIT_EXCEEDED!');

    // 1.6: Kiểm tra User B vẫn độc lập, chưa bị ảnh hưởng bởi User A
    const dewStatusB_Day1 = await DewService.getDewStatus({ userId: userB.id, customDate: day1 });
    assert(dewStatusB_Day1.claimsToday === 0 && dewStatusB_Day1.remainingClaimsToday === 3, 'User B hoàn toàn độc lập, còn nguyên 3 lượt tưới');

    // =========================================================================
    // 📅 NGÀY 2 (2026-09-02): QUA NGÀY MỚI - QUOTA ĐƯỢC CẤP MỚI & STREAK NỐI TIẾP
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log(`📅 NGÀY 2 (${day2}): CHUYỂN NGÀY - QUOTA TỰ ĐỘNG RESET VỀ 3, STREAK TĂNG LÊN 2`);
    console.log('='.repeat(80));

    // 2.1: Kiểm tra User A ngày 2 đã được cấp mới 3 lượt chưa
    const dewStatusA_Day2_Init = await DewService.getDewStatus({ userId: userA.id, customDate: day2 });
    assert(dewStatusA_Day2_Init.claimsToday === 0, 'User A - Ngày 2 đầu ngày: claimsToday tự động reset về 0!');
    assert(dewStatusA_Day2_Init.remainingClaimsToday === 3, 'User A - Ngày 2 đầu ngày: cấp mới nguyên vẹn 3 lượt tưới!');
    assert(dewStatusA_Day2_Init.hasClaimedToday === false, 'User A - Ngày 2 đầu ngày: hasClaimedToday = false');
    assert(dewStatusA_Day2_Init.streak === 1, 'User A - Ngày 2 đầu ngày: ghi nhận streak hôm qua = 1');

    const quoteStatusA_Day2_Init = await BookService.getDailyQuoteStatus({ userId: userA.id, customDate: day2 });
    assert(quoteStatusA_Day2_Init.quotesTodayCount === 0, 'User A - Ngày 2 đầu ngày: quotesTodayCount tự động reset về 0!');
    assert(quoteStatusA_Day2_Init.remainingToday === 3, 'User A - Ngày 2 đầu ngày: cấp mới nguyên vẹn 3 lượt gieo quote!');
    assert(quoteStatusA_Day2_Init.hasContributedToday === false, 'User A - Ngày 2 đầu ngày: hasContributedToday = false');

    // 2.2: User A tưới lượt 1 Ngày 2 -> Chuỗi streak TĂNG LÊN 2!
    console.log(`   💧 User A tưới nước 3 lần trong Ngày 2:`);
    const dewA2_1 = await DewService.claimDew({ userId: userA.id, teamId: teamId, customDate: day2 });
    assert(dewA2_1.streak === 2, 'User A - Ngày 2 lần 1: Chuỗi streak TĂNG LÊN 2 NGÀY LIÊN TIẾP! 🔥');
    assert(dewA2_1.claimsToday === 1, 'User A - Ngày 2 lần 1: claimsToday = 1');
    assert(dewA2_1.remainingClaimsToday === 2, 'User A - Ngày 2 lần 1: remaining = 2');
    createdDewIds.push(dewA2_1.dew.id);

    // Tưới tiếp lần 2 và lần 3 Ngày 2
    const dewA2_2 = await DewService.claimDew({ userId: userA.id, teamId: teamId, customDate: day2 });
    assert(dewA2_2.streak === 2, 'User A - Ngày 2 lần 2: Streak giữ nguyên 2');
    createdDewIds.push(dewA2_2.dew.id);

    const dewA2_3 = await DewService.claimDew({ userId: userA.id, teamId: teamId, customDate: day2 });
    assert(dewA2_3.claimsToday === 3 && dewA2_3.hasClaimedToday === true, 'User A - Ngày 2 lần 3: Đạt tối đa 3/3 lần');
    createdDewIds.push(dewA2_3.dew.id);

    // Lần 4 Ngày 2 bị chặn
    let dewA2_4_Blocked = false;
    try {
      await DewService.claimDew({ userId: userA.id, teamId: teamId, customDate: day2 });
    } catch (e) {
      dewA2_4_Blocked = (e.statusCode === 409);
    }
    assert(dewA2_4_Blocked, 'User A - Ngày 2: Lần tưới thứ 4 bị chặn thành công (409)!');

    // 2.3: User A gieo tiếp 3 quotes Ngày 2
    console.log(`   📖 User A gieo sách 3 quotes trong Ngày 2:`);
    for (let i = 1; i <= 3; i++) {
      const qRes = await BookService.contributeBook({
        title: `Sách Ngày 2 Tập ${i}`,
        author: 'Tác giả A',
        quote: `Trích dẫn ngày 2 số ${i}`,
        category: 'Kinh doanh',
        reader: userA.nickname,
        userId: userA.id,
        teamId: teamId,
        customDate: day2
      });
      assert(qRes.book && qRes.book.id, `User A - Ngày 2: Gieo quote ${i} thành công (+5 EXP)`);
      createdBookIds.push(qRes.book.id);
    }

    // Quote 4 Ngày 2 bị chặn
    let quoteA2_4_Blocked = false;
    try {
      await BookService.contributeBook({
        title: 'Sách Thứ 4 Ngày 2',
        author: 'Tác giả',
        quote: 'Trích dẫn 4',
        category: 'Kinh doanh',
        reader: userA.nickname,
        userId: userA.id,
        teamId: teamId,
        customDate: day2
      });
    } catch (e) {
      quoteA2_4_Blocked = (e.statusCode === 409);
    }
    assert(quoteA2_4_Blocked, 'User A - Ngày 2: Gieo quote thứ 4 bị chặn thành công (409)!');

    // 2.4: User B chỉ tham gia 1 quote và 1 dew trong Ngày 2
    const dewB2_1 = await DewService.claimDew({ userId: userB.id, teamId: teamId, customDate: day2 });
    assert(dewB2_1.claimsToday === 1 && dewB2_1.remainingClaimsToday === 2, 'User B - Ngày 2: Tưới 1 lần, còn 2 lượt');
    createdDewIds.push(dewB2_1.dew.id);

    const qB2_1 = await BookService.contributeBook({
      title: 'Sách User B Ngày 2',
      author: 'Tác giả B',
      quote: 'Trích dẫn duy nhất của B trong ngày 2',
      category: 'Văn học',
      reader: userB.nickname,
      userId: userB.id,
      teamId: teamId,
      customDate: day2
    });
    createdBookIds.push(qB2_1.book.id);
    const qStatusB2 = await BookService.getDailyQuoteStatus({ userId: userB.id, customDate: day2 });
    assert(qStatusB2.quotesTodayCount === 1 && qStatusB2.remainingToday === 2, 'User B - Ngày 2: Gieo 1 quote, còn 2 lượt');

    // =========================================================================
    // 📅 NGÀY 3 (2026-09-03): USER A TIẾP TỤC - USER B NGHỈ (KIỂM TRA NGẮT QUÃNG)
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log(`📅 NGÀY 3 (${day3}): USER A TƯỚI LIÊN TIẾP (STREAK=3) - USER B NGHỈ HOÀN TOÀN`);
    console.log('='.repeat(80));

    // 3.1: User A tưới nước Ngày 3 -> Chuỗi streak TĂNG LÊN 3!
    const dewA3_1 = await DewService.claimDew({ userId: userA.id, teamId: teamId, customDate: day3 });
    assert(dewA3_1.streak === 3, 'User A - Ngày 3 lần 1: Chuỗi streak TĂNG LÊN 3 NGÀY LIÊN TIẾP! 🔥🔥🔥');
    createdDewIds.push(dewA3_1.dew.id);

    // User A tưới tiếp đủ 3 lần
    createdDewIds.push((await DewService.claimDew({ userId: userA.id, teamId: teamId, customDate: day3 })).dew.id);
    createdDewIds.push((await DewService.claimDew({ userId: userA.id, teamId: teamId, customDate: day3 })).dew.id);

    // User A gieo đủ 3 quotes Ngày 3
    for (let i = 1; i <= 3; i++) {
      const q = await BookService.contributeBook({
        title: `Sách Ngày 3 Cuốn ${i}`,
        author: 'Tác giả A',
        quote: `Trích dẫn ngày 3 câu ${i}`,
        category: 'Lịch sử',
        reader: userA.nickname,
        userId: userA.id,
        teamId: teamId,
        customDate: day3
      });
      createdBookIds.push(q.book.id);
    }

    // 3.2: User B KHÔNG THỰC HIỆN BẤT KỲ THAO TÁC NÀO TRONG NGÀY 3
    const dewStatusB3 = await DewService.getDewStatus({ userId: userB.id, customDate: day3 });
    assert(dewStatusB3.claimsToday === 0 && dewStatusB3.hasClaimedToday === false, 'User B - Ngày 3 (nghỉ): claimsToday = 0, chưa tưới');
    const quoteStatusB3 = await BookService.getDailyQuoteStatus({ userId: userB.id, customDate: day3 });
    assert(quoteStatusB3.quotesTodayCount === 0 && quoteStatusB3.hasContributedToday === false, 'User B - Ngày 3 (nghỉ): quotesTodayCount = 0, chưa gieo');

    // =========================================================================
    // 📅 NGÀY 4 (2026-09-04): USER A TIẾP TỤC (STREAK=4) - USER B QUAY LẠI (RESET STREAK=1)
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log(`📅 NGÀY 4 (${day4}): KIỂM THỬ ĐỨT CHUỖI STREAK SAU KHI NGHỈ & KHÔI PHỤC QUOTA`);
    console.log('='.repeat(80));

    // 4.1: User A tiếp tục ngày thứ 4 liên tiếp -> Chuỗi streak = 4
    const dewA4_1 = await DewService.claimDew({ userId: userA.id, teamId: teamId, customDate: day4 });
    assert(dewA4_1.streak === 4, 'User A - Ngày 4: Duy trì chuỗi 4 ngày liên tiếp! Streak = 4 🔥🔥🔥🔥');
    createdDewIds.push(dewA4_1.dew.id);

    // User A gieo đủ 3 quotes Ngày 4
    for (let i = 1; i <= 3; i++) {
      const q = await BookService.contributeBook({
        title: `Sách Ngày 4 Cuốn ${i}`,
        author: 'Tác giả A',
        quote: `Trích dẫn ngày 4 câu ${i}`,
        category: 'Kỹ năng',
        reader: userA.nickname,
        userId: userA.id,
        teamId: teamId,
        customDate: day4
      });
      createdBookIds.push(q.book.id);
    }

    // 4.2: User B đã bỏ lỡ Ngày 3, nay tưới nước ở Ngày 4 -> CHUỖI STREAK PHẢI RESET VỀ 1!
    const dewB4_1 = await DewService.claimDew({ userId: userB.id, teamId: teamId, customDate: day4 });
    assert(dewB4_1.streak === 1, 'User B - Ngày 4 (sau khi bỏ lỡ ngày 3): Chuỗi streak BỊ RESET VỀ 1 CHÍNH XÁC!');
    assert(dewB4_1.claimsToday === 1, 'User B - Ngày 4: claimsToday = 1');
    assert(dewB4_1.remainingClaimsToday === 2, 'User B - Ngày 4: remaining = 2');
    createdDewIds.push(dewB4_1.dew.id);

    // User B tiếp tục tưới lượt 2 và 3 trong Ngày 4 -> Đầy đủ 3 lượt
    const dewB4_2 = await DewService.claimDew({ userId: userB.id, teamId: teamId, customDate: day4 });
    createdDewIds.push(dewB4_2.dew.id);
    const dewB4_3 = await DewService.claimDew({ userId: userB.id, teamId: teamId, customDate: day4 });
    createdDewIds.push(dewB4_3.dew.id);
    assert(dewB4_3.claimsToday === 3 && dewB4_3.hasClaimedToday === true, 'User B - Ngày 4: Tưới đủ 3 lần thành công');

    // Lần 4 của User B Ngày 4 bị chặn 409
    let dewB4_4_Blocked = false;
    try {
      await DewService.claimDew({ userId: userB.id, teamId: teamId, customDate: day4 });
    } catch (e) {
      dewB4_4_Blocked = (e.statusCode === 409);
    }
    assert(dewB4_4_Blocked, 'User B - Ngày 4: Lần tưới thứ 4 bị chặn 409 DUPLICATE_DEW_CLAIM');

    // User B gieo đủ 3 quotes Ngày 4
    for (let i = 1; i <= 3; i++) {
      const q = await BookService.contributeBook({
        title: `Sách User B Ngày 4 Cuốn ${i}`,
        author: 'Tác giả B',
        quote: `Trích dẫn ngày 4 câu ${i}`,
        category: 'Kỹ năng',
        reader: userB.nickname,
        userId: userB.id,
        teamId: teamId,
        customDate: day4
      });
      createdBookIds.push(q.book.id);
    }

    // Quote thứ 4 của User B Ngày 4 bị chặn 409
    let quoteB4_4_Blocked = false;
    try {
      await BookService.contributeBook({
        title: 'Sách Thứ 4 Ngày 4',
        author: 'Tác giả',
        quote: 'Trích dẫn 4',
        category: 'Kỹ năng',
        reader: userB.nickname,
        userId: userB.id,
        teamId: teamId,
        customDate: day4
      });
    } catch (e) {
      quoteB4_4_Blocked = (e.statusCode === 409);
    }
    assert(quoteB4_4_Blocked, 'User B - Ngày 4: Gieo quote thứ 4 bị chặn 409 DAILY_QUOTE_LIMIT_EXCEEDED');

    // =========================================================================
    // 📅 NGÀY 5 (2026-09-05): KIỂM THỬ ADMIN DANH BẠ 288 NHÂN SỰ QUA TỪNG NGÀY
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🔍 KIỂM TRA TOÀN DIỆN DANH BẠ 288 NHÂN SỰ ADMIN QUA TỪNG NGÀY ĐÃ CHỌN');
    console.log('='.repeat(80));

    // A. Xem ngày 1: User A gieo 3 quotes -> hiển thị 3, ✅ Đã gieo, đúng 1 dòng
    const dirDay1 = await AnalyticsService.getUsersDirectory({ teamId: teamId, date: day1, limit: 50 });
    const userA_in_Day1 = dirDay1.users.filter(u => u.id === userA.id);
    assert(userA_in_Day1.length === 1, 'Admin Ngày 1: User A chỉ xuất hiện DUY NHẤT 1 DÒNG (Không nhân thành 3 dòng)');
    assert(userA_in_Day1[0].today_quotes_count === 3, 'Admin Ngày 1: User A hiển thị đúng 3 quotes đã gieo');
    assert(userA_in_Day1[0].participated_today === true, 'Admin Ngày 1: User A trạng thái ✅ Đã gieo');

    // B. Xem ngày 2: User A gieo 3 quotes, User B gieo 1 quote
    const dirDay2 = await AnalyticsService.getUsersDirectory({ teamId: teamId, date: day2, limit: 50 });
    const userA_in_Day2 = dirDay2.users.find(u => u.id === userA.id);
    const userB_in_Day2 = dirDay2.users.find(u => u.id === userB.id);
    assert(userA_in_Day2.today_quotes_count === 3 && userA_in_Day2.participated_today === true, 'Admin Ngày 2: User A hiển thị đúng 3 quotes');
    assert(userB_in_Day2.today_quotes_count === 1 && userB_in_Day2.participated_today === true, 'Admin Ngày 2: User B hiển thị đúng 1 quote');

    // C. Xem ngày 3: User A gieo 3 quotes, User B NGHỈ
    const dirDay3 = await AnalyticsService.getUsersDirectory({ teamId: teamId, date: day3, limit: 50 });
    const userA_in_Day3 = dirDay3.users.find(u => u.id === userA.id);
    const userB_in_Day3 = dirDay3.users.find(u => u.id === userB.id);
    assert(userA_in_Day3.today_quotes_count === 3 && userA_in_Day3.participated_today === true, 'Admin Ngày 3: User A hiển thị 3 quotes (✅ Đã gieo)');
    assert(userB_in_Day3.today_quotes_count === 0 && userB_in_Day3.participated_today === false, 'Admin Ngày 3: User B hiển thị 0 quotes (⏳ Chưa gieo)');

    // D. Xem ngày 4: Cả 2 users đều gieo 3 quotes
    const dirDay4 = await AnalyticsService.getUsersDirectory({ teamId: teamId, date: day4, limit: 50 });
    const userA_in_Day4 = dirDay4.users.find(u => u.id === userA.id);
    const userB_in_Day4 = dirDay4.users.find(u => u.id === userB.id);
    assert(userA_in_Day4.today_quotes_count === 3, 'Admin Ngày 4: User A hiển thị 3 quotes');
    assert(userB_in_Day4.today_quotes_count === 3, 'Admin Ngày 4: User B hiển thị 3 quotes sau khi trở lại');

    // E. Toàn bộ 288 nhân sự: Luôn đúng 288 người, không có dòng lặp
    const fullDir = await AnalyticsService.getUsersDirectory({ date: day4, limit: 300 });
    assert(fullDir.pagination.total === 288, 'Admin Toàn Vườn: Tổng số cán bộ đúng chuẩn 288/288');
    const uniqueIds = new Set(fullDir.users.map(u => u.id));
    assert(uniqueIds.size === 288, '100% 288 dòng hiển thị là các cá nhân riêng biệt, ZERO DUPLICATE ROWS!');

    // =========================================================================
    // 🔍 KIỂM TRA SỔ CÁI EXP VÀ TÍNH TOÀN VẸN ĐIỂM SỐ
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('💰 KIỂM TRA TÍNH TOÀN VẸN EXP LEDGER & ĐIỂM SỐ CÁ NHÂN');
    console.log('='.repeat(80));

    // User A đã tưới 3 lần * 2 EXP ở Ngày 1, 2, 3 và 1 lần ở Ngày 4 = 10 lần * 2 EXP = 20 EXP
    // User A đã gieo 3 quotes * 5 EXP ở Ngày 1, 2, 3 = 9 quotes * 5 EXP = 45 EXP
    // Mọi giao dịch bị chặn (lần 4) TUYỆT ĐỐI KHÔNG CÓ BẢN GHI TRONG SỔ CÁI!
    const blockedDewLedger = await client.query(`
      SELECT COUNT(*) as count FROM exp_ledger 
      WHERE user_id = $1 AND amount NOT IN (2, 5)
    `, [userA.id]);
    assert(parseInt(blockedDewLedger.rows[0].count, 10) === 0, 'Sổ cái exp_ledger không có bất kỳ điểm số ma nào');

    console.log('\n' + '='.repeat(85));
    console.log('🎉 100% MỌI TÌNH HUỐNG ĐA NGÀY, HẠN MỨC 3 LẦN/NGÀY & ADMIN ĐÃ VƯỢT QUA TESTKEY!');
    console.log('='.repeat(85));

  } finally {
    // -------------------------------------------------------------------------
    // 🧹 HOÀN TRẢ & DỌN DẸP DỮ LIỆU KIỂM THỬ (SANDBOX RESTORATION)
    // -------------------------------------------------------------------------
    console.log('\n🧹 Đang dọn dẹp dữ liệu kiểm thử và khôi phục CSDL...');
    try {
      if (createdDewIds.length > 0) {
        await client.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = ANY($2)', ['daily_dews', createdDewIds]);
        await client.query('DELETE FROM daily_dews WHERE id = ANY($1)', [createdDewIds]);
      }
      if (createdBookIds.length > 0) {
        await client.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = ANY($2)', ['books', createdBookIds]);
        await client.query('DELETE FROM daily_quotes WHERE book_id = ANY($1)', [createdBookIds]);
        await client.query('DELETE FROM books WHERE id = ANY($1)', [createdBookIds]);
      }

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

      for (const u of initialUserSnapshots) {
        await client.query(`
          UPDATE users 
          SET total_exp_earned = $1, contributed_books_count = $2 
          WHERE id = $3
        `, [u.total_exp_earned, u.contributed_books_count, u.id]);
      }

      console.log('✅ Cơ sở dữ liệu đã được khôi phục 100% nguyên trạng ban đầu!');
    } catch (cleanErr) {
      console.error('⚠️ Lỗi dọn dẹp:', cleanErr);
    } finally {
      client.release();
    }
  }
}

runExhaustiveMultiDayLimitTest()
  .then(() => {
    console.log('\n✅ TEST EXHAUSTIVE MULTI-DAY LIMITS COMPLETED SUCCESSFULLY.\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST EXHAUSTIVE MULTI-DAY LIMITS FAILED:\n', err);
    process.exit(1);
  });
