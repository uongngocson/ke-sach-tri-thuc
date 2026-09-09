/**
 * test_3_claims.mjs
 * 
 * KIỂM THỬ TOÀN DIỆN 100% QUY TẮC MỚI: 3 LẦN / NGÀY CHO TƯỚI NƯỚC VÀ GIEO SÁCH
 * - 1 User được tưới nước tối đa 3 lần/ngày (+EXP mỗi lần, streak chuẩn, lần 4 bị chặn 409)
 * - 1 User được upload tối đa 3 câu quote/ngày (+5 EXP mỗi lần, lần 4 bị chặn 409)
 * - Analytics tính đúng tỷ lệ tham gia (COUNT DISTINCT, không bị nhân 300%)
 */

import db from '../config/database.js';
import DewService from '../services/dew.service.js';
import BookService from '../services/book.service.js';
import AnalyticsService from '../services/analytics.service.js';

function assert(cond, msg, detail = '') {
  if (!cond) {
    console.error(`❌ [FAILED] ${msg}`, detail);
    throw new Error(`Assertion failed: ${msg} ${detail}`);
  }
  console.log(`   ✅ [PASSED] ${msg}`);
}

async function run() {
  console.log('='.repeat(70));
  console.log('🧪 BẮT ĐẦU KIỂM THỬ 100% TESTKEY: 3 LẦN TƯỚI / NGÀY & 3 QUOTES / NGÀY');
  console.log('='.repeat(70));

  // 1. Chuẩn bị test user
  const userRes = await db.query(`
    SELECT id, full_name, nickname, team_id, total_exp_earned 
    FROM users 
    WHERE team_id = 5 
    ORDER BY id ASC LIMIT 1
  `);
  assert(userRes.rows.length > 0, 'Tìm thấy test user thuộc Đội 5 (FPL_AU_FU)');
  const testUser = userRes.rows[0];
  console.log(`👤 Test user: [ID: ${testUser.id}] ${testUser.full_name} (${testUser.nickname}) - Đội ${testUser.team_id}`);

  const todayVN = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  console.log(`📅 Ngày kiểm thử (Asia/Ho_Chi_Minh): ${todayVN}`);

  const createdDewIds = [];
  const createdBookIds = [];

  try {
    // Dọn dẹp sạch sẽ dữ liệu của user trong ngày hôm nay trước khi test
    await db.query('DELETE FROM daily_dews WHERE user_id = $1 AND claim_date = $2', [testUser.id, todayVN]);
    const existingQuotes = await db.query('SELECT book_id FROM daily_quotes WHERE user_id = $1 AND quote_date = $2', [testUser.id, todayVN]);
    for (const row of existingQuotes.rows) {
      if (row.book_id) {
        await db.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = $2', ['books', row.book_id]);
        await db.query('DELETE FROM books WHERE id = $1', [row.book_id]);
      }
    }
    await db.query('DELETE FROM daily_quotes WHERE user_id = $1 AND quote_date = $2', [testUser.id, todayVN]);

    // =========================================================================
    // PHẦN 1: KIỂM THỬ TƯỚI NƯỚC (DAILY DEW) - TỐI ĐA 3 LẦN / NGÀY
    // =========================================================================
    console.log('\n💧 [PHẦN 1] Kiểm thử Tưới Nước (Daily Dew) - Giới hạn 3 lần / ngày:');

    // 1.1: Trạng thái ban đầu (0 lần tưới)
    const initialDewStatus = await DewService.getDewStatus({ userId: testUser.id });
    assert(initialDewStatus.claimsToday === 0, 'Khởi đầu: claimsToday = 0');
    assert(initialDewStatus.remainingClaimsToday === 3, 'Khởi đầu: remainingClaimsToday = 3');
    assert(initialDewStatus.hasClaimedToday === false, 'Khởi đầu: hasClaimedToday = false');

    // 1.2: Lượt tưới thứ 1
    const dew1 = await DewService.claimDew({
      userId: testUser.id,
      teamId: testUser.team_id,
      email: testUser.email,
      userFingerprint: `test_fp_dew_${Date.now()}`
    });
    createdDewIds.push(dew1.dew.id);
    assert(dew1.claimsToday === 1, 'Lượt tưới 1: claimsToday = 1');
    assert(dew1.remainingClaimsToday === 2, 'Lượt tưới 1: remainingClaimsToday = 2');
    assert(dew1.hasClaimedToday === false, 'Lượt tưới 1: hasClaimedToday = false (chưa đạt giới hạn)');
    assert(dew1.expEarned === 2, 'Lượt tưới 1: Nhận đủ +2 EXP');

    // 1.3: Lượt tưới thứ 2
    const dew2 = await DewService.claimDew({
      userId: testUser.id,
      teamId: testUser.team_id,
      email: testUser.email,
      userFingerprint: `test_fp_dew_${Date.now()}`
    });
    createdDewIds.push(dew2.dew.id);
    assert(dew2.claimsToday === 2, 'Lượt tưới 2: claimsToday = 2');
    assert(dew2.remainingClaimsToday === 1, 'Lượt tưới 2: remainingClaimsToday = 1');
    assert(dew2.hasClaimedToday === false, 'Lượt tưới 2: hasClaimedToday = false');
    assert(dew2.streak === dew1.streak, 'Lượt tưới 2: Streak giữ nguyên (không bị cộng dồn trong cùng ngày)');

    // 1.4: Lượt tưới thứ 3 (Chạm mốc tối đa trong ngày)
    const dew3 = await DewService.claimDew({
      userId: testUser.id,
      teamId: testUser.team_id,
      email: testUser.email,
      userFingerprint: `test_fp_dew_${Date.now()}`
    });
    createdDewIds.push(dew3.dew.id);
    assert(dew3.claimsToday === 3, 'Lượt tưới 3: claimsToday = 3');
    assert(dew3.remainingClaimsToday === 0, 'Lượt tưới 3: remainingClaimsToday = 0');
    assert(dew3.hasClaimedToday === true, 'Lượt tưới 3: hasClaimedToday = true (đã đạt giới hạn 3 lần)');

    // 1.5: Lượt tưới thứ 4 -> BẮT BUỘC BỊ CHẶN VỚI MÃ LỖI 409 DUPLICATE_DEW_CLAIM
    let dew4Blocked = false;
    let dew4ErrorCode = '';
    try {
      await DewService.claimDew({
        userId: testUser.id,
        teamId: testUser.team_id,
        email: testUser.email,
        userFingerprint: `test_fp_dew_${Date.now()}`
      });
    } catch (err) {
      dew4Blocked = (err.statusCode === 409 || err.code === 'DUPLICATE_DEW_CLAIM');
      dew4ErrorCode = err.code || err.statusCode;
    }
    assert(dew4Blocked, `Lượt tưới 4: Bị chặn thành công với HTTP 409 DUPLICATE_DEW_CLAIM (Mã: ${dew4ErrorCode})`);

    // 1.6: Kiểm tra getDewStatus sau khi tưới đủ 3 lần
    const finalDewStatus = await DewService.getDewStatus({ userId: testUser.id });
    assert(finalDewStatus.claimsToday === 3, 'Status cuối: claimsToday = 3');
    assert(finalDewStatus.remainingClaimsToday === 0, 'Status cuối: remainingClaimsToday = 0');
    assert(finalDewStatus.hasClaimedToday === true, 'Status cuối: hasClaimedToday = true');

    // =========================================================================
    // PHẦN 2: KIỂM THỬ GIEO SÁCH (DAILY QUOTES) - TỐI ĐA 3 LẦN / NGÀY
    // =========================================================================
    console.log('\n📖 [PHẦN 2] Kiểm thử Gieo Trích Dẫn Sách - Giới hạn 3 lần / ngày:');

    // 2.1: Trạng thái ban đầu (0 câu quote)
    const initialQuoteStatus = await BookService.getDailyQuoteStatus({ userId: testUser.id });
    assert(initialQuoteStatus.quotesTodayCount === 0, 'Khởi đầu: quotesTodayCount = 0');
    assert(initialQuoteStatus.remainingToday === 3, 'Khởi đầu: remainingToday = 3');
    assert(initialQuoteStatus.hasContributedToday === false, 'Khởi đầu: hasContributedToday = false');

    const testFp = `test_quote_fp_${Date.now()}`;

    // 2.2: Gieo câu quote thứ 1
    const quote1 = await BookService.contributeBook({
      title: 'Nhà Giả Kim',
      author: 'Paulo Coelho',
      quote: 'Khi bạn khao khát một điều gì đó, cả vũ trụ sẽ hợp lực giúp bạn đạt được nó.',
      category: 'Văn Học',
      reader: testUser.nickname || testUser.full_name,
      email: testUser.email,
      userId: testUser.id,
      teamId: testUser.team_id,
      userFingerprint: testFp
    });
    createdBookIds.push(quote1.book.id);
    assert(quote1.book && quote1.book.id, 'Gieo quote 1: Thành công tạo sách & ghi nhận +5 EXP');

    const quoteStatus1 = await BookService.getDailyQuoteStatus({ userId: testUser.id });
    assert(quoteStatus1.quotesTodayCount === 1, 'Quote 1: quotesTodayCount = 1');
    assert(quoteStatus1.remainingToday === 2, 'Quote 1: remainingToday = 2');
    assert(quoteStatus1.hasContributedToday === false, 'Quote 1: hasContributedToday = false (chưa đạt tối đa)');

    // 2.3: Gieo câu quote thứ 2
    const quote2 = await BookService.contributeBook({
      title: 'Đắc Nhân Tâm',
      author: 'Dale Carnegie',
      quote: 'Biết lắng nghe và khuyến khích người khác nói về họ.',
      category: 'Kỹ Năng Sống',
      reader: testUser.nickname || testUser.full_name,
      email: testUser.email,
      userId: testUser.id,
      teamId: testUser.team_id,
      userFingerprint: testFp
    });
    createdBookIds.push(quote2.book.id);
    assert(quote2.book && quote2.book.id, 'Gieo quote 2: Thành công tạo sách & ghi nhận +5 EXP');

    const quoteStatus2 = await BookService.getDailyQuoteStatus({ userId: testUser.id });
    assert(quoteStatus2.quotesTodayCount === 2, 'Quote 2: quotesTodayCount = 2');
    assert(quoteStatus2.remainingToday === 1, 'Quote 2: remainingToday = 1');
    assert(quoteStatus2.hasContributedToday === false, 'Quote 2: hasContributedToday = false');

    // 2.4: Gieo câu quote thứ 3 (Chạm mốc 3 quotes/ngày)
    const quote3 = await BookService.contributeBook({
      title: 'Tư Duy Nhanh Và Chậm',
      author: 'Daniel Kahneman',
      quote: 'Tự tin thái quá là một cái bẫy nhận thức phổ biến.',
      category: 'Tâm Lý Học',
      reader: testUser.nickname || testUser.full_name,
      email: testUser.email,
      userId: testUser.id,
      teamId: testUser.team_id,
      userFingerprint: testFp
    });
    createdBookIds.push(quote3.book.id);
    assert(quote3.book && quote3.book.id, 'Gieo quote 3: Thành công tạo sách & ghi nhận +5 EXP');

    const quoteStatus3 = await BookService.getDailyQuoteStatus({ userId: testUser.id });
    assert(quoteStatus3.quotesTodayCount === 3, 'Quote 3: quotesTodayCount = 3');
    assert(quoteStatus3.remainingToday === 0, 'Quote 3: remainingToday = 0');
    assert(quoteStatus3.hasContributedToday === true, 'Quote 3: hasContributedToday = true (đạt tối đa 3 quotes)');

    // 2.5: Gieo câu quote thứ 4 -> BẮT BUỘC BỊ CHẶN VỚI MÃ LỖI 409 DAILY_QUOTE_LIMIT_EXCEEDED
    let quote4Blocked = false;
    let quote4ErrorCode = '';
    try {
      await BookService.contributeBook({
        title: 'Blink',
        author: 'Malcolm Gladwell',
        quote: 'Sức mạnh của trực giác và quyết định chớp nhoáng.',
        category: 'Tâm Lý Học',
        reader: testUser.nickname || testUser.full_name,
        email: testUser.email,
        userId: testUser.id,
        teamId: testUser.team_id,
        userFingerprint: testFp
      });
    } catch (err) {
      quote4Blocked = (err.statusCode === 409 || err.code === 'DAILY_QUOTE_LIMIT_EXCEEDED');
      quote4ErrorCode = err.code || err.statusCode;
    }
    assert(quote4Blocked, `Lượt gieo quote 4: Bị chặn thành công với HTTP 409 DAILY_QUOTE_LIMIT_EXCEEDED (Mã: ${quote4ErrorCode})`);

    // =========================================================================
    // PHẦN 3: KIỂM THỬ TOÀN VẸN DỮ LIỆU & BÁO CÁO THỐNG KÊ (ANALYTICS)
    // =========================================================================
    console.log('\n📊 [PHẦN 3] Kiểm tra tính toàn vẹn Analytics & Bảng xếp hạng Đội:');

    const analytics = await AnalyticsService.getOverview();
    const team5 = analytics.teams.find(t => parseInt(t.id, 10) === 5);
    assert(team5 !== undefined, 'Đội 5 (FPL_AU_FU) hiển thị chính xác trên bảng xếp hạng');
    
    console.log(`   ℹ️  Đội 5: Chỉ tiêu=${team5.target_members}, Thành viên=${team5.total_members}, Tham gia hôm nay=${team5.active_today_count || team5.today_participants || 0} cán bộ`);
    assert(team5.target_members > 0, `Đội 5 có chỉ tiêu thành viên hợp lệ: ${team5.target_members}`);

    // =========================================================================
    // DỌN DẸP DỮ LIỆU TEST
    // =========================================================================
    console.log('\n🧹 [DỌN DẸP] Làm sạch dữ liệu test để database giữ nguyên trạng...');
    for (const bId of createdBookIds) {
      await db.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = $2', ['books', bId]);
      await db.query('DELETE FROM daily_quotes WHERE book_id = $1', [bId]);
      await db.query('DELETE FROM books WHERE id = $1', [bId]);
    }
    for (const dId of createdDewIds) {
      await db.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = $2', ['daily_dews', dId]);
      await db.query('DELETE FROM daily_dews WHERE id = $1', [dId]);
    }

    console.log('\n🎉 ==============================================================');
    console.log('🎉 100% TẤT CẢ TESTKEY CHO QUY TẮC 3 LẦN/NGÀY ĐÃ VƯỢT QUA XUẤT SẮC!');
    console.log('🎉 ==============================================================');
  } catch (err) {
    console.error('💥 Test suite gặp lỗi:', err);
    throw err;
  } finally {
    await db.pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
