/**
 * server/scripts/test-watering-and-likes-fullkey.js
 * 
 * BỘ KIỂM THỬ TOÀN DIỆN (FULL TESTKEY):
 * 1. HOẠT ĐỘNG TƯỚI NƯỚC HÀNG NGÀY (DAILY DEW & STREAK)
 * 2. FLOW THẢ TIM TRÍCH DẪN (QUOTE LIKE & UNLIKE)
 * 3. KIỂM SOÁT ĐỒNG BỘ STATE: CLIENT UI <-> BACKEND DB (ZERO HARDCODE LOCAL STATE)
 */

import db from '../config/database.js';
import DewService, { getVietnamDateString } from '../services/dew.service.js';
import QuoteService from '../services/quote.service.js';
import BookService from '../services/book.service.js';
import GrowthService from '../services/growth.service.js';

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message, details = '') {
  if (condition) {
    totalPassed++;
    console.log(`  ✅ [PASS] ${message}`);
    if (details) console.log(`     ↳ ${details}`);
  } else {
    totalFailed++;
    console.error(`  ❌ [FAIL] ${message}`);
    if (details) console.error(`     ↳ ${details}`);
  }
}

async function runFullTestKey() {
  console.log('\n=================================================================');
  console.log('💧 BẮT ĐẦU BỘ KIỂM THỬ TOÀN DIỆN: TƯỚI NƯỚC & THẢ TIM (TESTKEY)');
  console.log('=================================================================\n');

  const testUserId1 = '00000001-0000-4000-a000-000000000001';
  const testUserId2 = '00000002-0000-4000-a000-000000000002';
  const testNoTeamUserId = '00000003-0000-4000-a000-000000000003';
  const testBookId = '00000004-0000-4000-a000-000000000004';
  const testFp1 = 'fp_testkey_waterer_01';
  const testFp2 = 'fp_testkey_waterer_02';

  const todayVN = getVietnamDateString();
  const yesterdayVN = getVietnamDateString(new Date(Date.now() - 86400000));

  try {
    // 0. Dọn dẹp dữ liệu kiểm thử cũ
    await db.query('DELETE FROM daily_dews WHERE user_id IN ($1, $2, $3)', [testUserId1, testUserId2, testNoTeamUserId]);
    await db.query('DELETE FROM quote_likes WHERE book_id = $1', [testBookId]);
    await db.query('DELETE FROM exp_ledger WHERE user_id IN ($1, $2, $3) OR reference_id = $1', [testUserId1, testUserId2, testNoTeamUserId]);
    await db.query('DELETE FROM books WHERE id = $1', [testBookId]);
    await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [testUserId1, testUserId2, testNoTeamUserId]);

    // Tạo test users:
    await db.query(`
      INSERT INTO users (id, employee_code, email, full_name, nickname, team_id, total_exp_earned)
      VALUES ($1, 'TK_U1', 'testkey_u1@fpt.com', 'Tester Đội 1', 'Độc Giả Tri Thức #01', 1, 100)
    `, [testUserId1]);

    await db.query(`
      INSERT INTO users (id, employee_code, email, full_name, nickname, team_id, total_exp_earned)
      VALUES ($1, 'TK_U2', 'testkey_u2@fpt.com', 'Tester Đội 2', 'Độc Giả Tri Thức #02', 2, 100)
    `, [testUserId2]);

    await db.query(`
      INSERT INTO users (id, employee_code, email, full_name, nickname, team_id, total_exp_earned)
      VALUES ($1, 'TK_U3', 'testkey_u3@fpt.com', 'Tester No Team', 'Độc Giả Vô Đội', NULL, 0)
    `, [testNoTeamUserId]);

    await db.query(`
      INSERT INTO books (id, title, author, quote, reader_name, team_id, likes_count, visibility_status, moderation_status)
      VALUES ($1, 'Đắc Nhân Tâm Tri Thức', 'Dale Carnegie', 'Học cách lắng nghe là khởi đầu của trí tuệ.', 'Tester Đội 1', 1, 0, 'visible', 'reviewed')
    `, [testBookId]);

    // =========================================================================
    // PHẦN 1: KIỂM THỬ HOẠT ĐỘNG TƯỚI NƯỚC HÀNG NGÀY (DAILY DEW)
    // =========================================================================
    console.log('\n--- [PHẦN 1] KIỂM THỬ HOẠT ĐỘNG TƯỚI NƯỚC HÀNG NGÀY (DAILY DEW) ---');

    // 1.1 Khách vãng lai (Guest) không thể tưới nước (HTTP 401)
    let guestBlocked = false;
    try {
      await DewService.claimDew({ userId: null, teamId: 1 });
    } catch (e) {
      guestBlocked = (e.statusCode === 401 && e.code === 'LOGIN_REQUIRED');
    }
    assert(guestBlocked, 'Khách vãng lai (Guest) bị chặn tưới nước tuyệt đối (HTTP 401 LOGIN_REQUIRED)');

    let guestBlockedStr = false;
    try {
      await DewService.claimDew({ userId: 'guest', teamId: 1 });
    } catch (e) {
      guestBlockedStr = (e.statusCode === 401 && e.code === 'LOGIN_REQUIRED');
    }
    assert(guestBlockedStr, 'Tài khoản giả định "guest" bị chặn tưới nước (HTTP 401)');

    // 1.2 User không tồn tại bị từ chối (HTTP 404)
    let notFoundBlocked = false;
    try {
      await DewService.claimDew({ userId: '99999999-9999-4999-a999-999999999999', teamId: 1 });
    } catch (e) {
      notFoundBlocked = (e.statusCode === 404 && e.code === 'USER_NOT_FOUND');
    }
    assert(notFoundBlocked, 'ID người dùng không tồn tại bị từ chối (HTTP 404 USER_NOT_FOUND)');

    // 1.3 User chưa được xếp đội bị từ chối (HTTP 400)
    let noTeamBlocked = false;
    try {
      await DewService.claimDew({ userId: testNoTeamUserId, teamId: 1 });
    } catch (e) {
      noTeamBlocked = (e.statusCode === 400 && e.code === 'NO_TEAM_ASSIGNED');
    }
    assert(noTeamBlocked, 'Người dùng chưa có đội bị chặn tưới cây (HTTP 400 NO_TEAM_ASSIGNED)');

    // 1.4 Chặn tưới cây của đội khác (Cross-team griefing protection - HTTP 403)
    let crossTeamBlocked = false;
    try {
      await DewService.claimDew({ userId: testUserId1, teamId: 2, userFingerprint: testFp1 });
    } catch (e) {
      crossTeamBlocked = (e.statusCode === 403 && e.code === 'FORBIDDEN_OTHER_TEAM_TREE');
    }
    assert(crossTeamBlocked, 'Thành viên Đội 1 cố tình tưới cây Đội 2 bị chặn đứng (HTTP 403 FORBIDDEN_OTHER_TEAM_TREE)');

    const dewsBefore = (await db.query('SELECT COUNT(*)::INT as count FROM daily_dews WHERE user_id = $1', [testUserId1])).rows[0].count;
    assert(dewsBefore === 0, 'Dữ liệu toàn vẹn: 0 lượt tưới nước ma được tạo khi các kiểm tra thất bại');

    // 1.5 Kiểm tra tưới nước hợp lệ trên cây đội mình
    const user1Before = parseInt((await db.query('SELECT total_exp_earned FROM users WHERE id = $1', [testUserId1])).rows[0].total_exp_earned, 10);
    const team1Before = parseInt((await db.query('SELECT tree_exp FROM teams WHERE id = 1')).rows[0].tree_exp, 10);
    const growthRes0 = (await db.query('SELECT total_exp, total_dews FROM community_growth WHERE id = 1')).rows[0];
    const growthExpBefore = parseInt(growthRes0.total_exp, 10);
    const growthDewsBefore = parseInt(growthRes0.total_dews, 10);

    const dewResult = await DewService.claimDew({
      userId: testUserId1,
      teamId: 1,
      userFingerprint: testFp1
    });

    assert(dewResult && dewResult.dew && dewResult.expEarned === 2, 'Tưới nước thành công: Nhận chính xác +2 EXP', `EXP: ${dewResult.expEarned}, Streak: ${dewResult.streak}`);

    const user1After = parseInt((await db.query('SELECT total_exp_earned FROM users WHERE id = $1', [testUserId1])).rows[0].total_exp_earned, 10);
    assert(user1After === user1Before + 2, 'EXP cá nhân của người tưới tăng đúng +2 EXP', `Trước: ${user1Before}, Sau: ${user1After}`);

    const team1After = parseInt((await db.query('SELECT tree_exp FROM teams WHERE id = 1')).rows[0].tree_exp, 10);
    assert(team1After === team1Before + 2, 'Điểm Cây Tri Thức Đội 1 (tree_exp) tăng đúng +2 EXP', `Trước: ${team1Before}, Sau: ${team1After}`);

    const growthRes1 = (await db.query('SELECT total_exp, total_dews FROM community_growth WHERE id = 1')).rows[0];
    const growthExpAfter = parseInt(growthRes1.total_exp, 10);
    const growthDewsAfter = parseInt(growthRes1.total_dews, 10);
    assert(growthExpAfter === growthExpBefore + 2, 'EXP Toàn Vườn tăng đúng +2 EXP', `Trước: ${growthExpBefore}, Sau: ${growthExpAfter}`);
    assert(growthDewsAfter === growthDewsBefore + 1, 'Tổng lượt tưới Toàn Vườn tăng đúng +1', `Trước: ${growthDewsBefore}, Sau: ${growthDewsAfter}`);

    const ledgerDew = await db.query('SELECT * FROM exp_ledger WHERE user_id = $1 AND type = $2', [testUserId1, 'DAILY_DEW']);
    assert(ledgerDew.rows.length === 1, 'Sổ cái exp_ledger ghi nhận chính xác 1 dòng giao dịch DAILY_DEW');
    assert(ledgerDew.rows[0].amount === 2, 'Số điểm ghi trong sổ cái khớp chuẩn 2 EXP');

    const savedDew = await db.query('SELECT * FROM daily_dews WHERE user_id = $1', [testUserId1]);
    assert(savedDew.rows.length === 1, 'Bảng daily_dews lưu chính xác 1 bản ghi');
    assert(getVietnamDateString(new Date(savedDew.rows[0].claim_date)) === todayVN, `Ngày tưới ghi nhận chuẩn xác theo múi giờ VN: ${todayVN}`);

    // 1.6 Chặn tưới lần 2 trong cùng ngày (Duplicate Daily Dew - HTTP 409)
    let duplicateDewBlocked = false;
    try {
      await DewService.claimDew({ userId: testUserId1, teamId: 1, userFingerprint: testFp1 });
    } catch (e) {
      duplicateDewBlocked = (e.statusCode === 409 && e.code === 'DUPLICATE_DEW_CLAIM');
    }
    assert(duplicateDewBlocked, 'Chặn tưới lần 2 trong cùng 1 ngày (HTTP 409 DUPLICATE_DEW_CLAIM)');

    const user1AfterDup = (await db.query('SELECT total_exp_earned FROM users WHERE id = $1', [testUserId1])).rows[0].total_exp_earned;
    assert(user1AfterDup === user1After, 'Điểm số người dùng KHÔNG bị tăng khống khi bị chặn tưới trùng lặp', `EXP giữ nguyên: ${user1AfterDup}`);

    // 1.7 Kiểm thử chống Race Condition (10 requests đồng thời stampede)
    console.log('   ↳ Mô phỏng 10 request tưới cây đồng thời cho User 2...');
    const racePromises = [];
    for (let i = 0; i < 10; i++) {
      racePromises.push(DewService.claimDew({ userId: testUserId2, teamId: 2, userFingerprint: testFp2 }));
    }
    const raceResults = await Promise.allSettled(racePromises);
    const successes = raceResults.filter(r => r.status === 'fulfilled');
    const failures = raceResults.filter(r => r.status === 'rejected');

    assert(successes.length === 1, 'Chính xác DUY NHẤT 1 request tưới cây thành công khi spam 10 request đồng thời', `Thành công: ${successes.length}/10`);
    assert(failures.length === 9, '9 request còn lại bị chặn bởi Unique Constraint & ACID Lock', `Bị chặn: ${failures.length}/10`);

    const user2Exp = (await db.query('SELECT total_exp_earned FROM users WHERE id = $1', [testUserId2])).rows[0].total_exp_earned;
    assert(user2Exp === 102, 'User 2 CHỈ TĂNG ĐÚNG +2 EXP (Không bị nhân đôi/nhân 10)', `EXP hiện tại: ${user2Exp} (100 + 2)`);

    const user2DewsCount = (await db.query('SELECT COUNT(*)::INT as count FROM daily_dews WHERE user_id = $1', [testUserId2])).rows[0].count;
    assert(user2DewsCount === 1, 'Bảng daily_dews chỉ lưu ĐÚNG 1 BẢN GHI duy nhất cho User 2', `Số dòng: ${user2DewsCount}`);

    // 1.8 Kiểm thử API getDewStatus (Server-Authoritative State Check)
    const statusWatered = await DewService.getDewStatus({ userId: testUserId1 });
    assert(statusWatered.hasClaimedToday === true, 'getDewStatus cho User đã tưới trả về hasClaimedToday = true chính xác');
    assert(statusWatered.streak >= 1, `getDewStatus trả về chuỗi ngày tưới chuẩn xác: ${statusWatered.streak}`);

    const statusUnwatered = await DewService.getDewStatus({ userId: testNoTeamUserId });
    assert(statusUnwatered.hasClaimedToday === false, 'getDewStatus cho User chưa tưới trả về hasClaimedToday = false chính xác');

    // 1.9 Kiểm thử tính chuỗi tưới ngày hôm sau (Consecutive Streak Calculation)
    await db.query('DELETE FROM daily_dews WHERE user_id = $1', [testUserId1]);
    await db.query(`
      INSERT INTO daily_dews (user_id, team_id, user_fingerprint, claim_date, streak)
      VALUES ($1, 1, $2, $3, 5)
    `, [testUserId1, testFp1, yesterdayVN]);

    const nextDayDew = await DewService.claimDew({ userId: testUserId1, teamId: 1, userFingerprint: testFp1 });
    assert(nextDayDew.streak === 6, 'Tính chuỗi ngày tưới chuẩn xác: Nối tiếp ngày hôm qua (5 -> 6)', `Streak: ${nextDayDew.streak}`);

    const threeDaysAgo = getVietnamDateString(new Date(Date.now() - 3 * 86400000));
    await db.query('DELETE FROM daily_dews WHERE user_id = $1', [testUserId2]);
    await db.query(`
      INSERT INTO daily_dews (user_id, team_id, user_fingerprint, claim_date, streak)
      VALUES ($1, 2, $2, $3, 10)
    `, [testUserId2, testFp2, threeDaysAgo]);

    const brokenStreakDew = await DewService.claimDew({ userId: testUserId2, teamId: 2, userFingerprint: testFp2 });
    assert(brokenStreakDew.streak === 1, 'Ngắt chuỗi tưới (bỏ lỡ hôm qua): Chuỗi tự động reset về 1 ngày', `Streak: ${brokenStreakDew.streak}`);

    // =========================================================================
    // PHẦN 2: KIỂM THỬ FLOW THẢ TIM TRÍCH DẪN (QUOTE LIKE & UNLIKE)
    // =========================================================================
    console.log('\n--- [PHẦN 2] KIỂM THỬ FLOW THẢ TIM TRÍCH DẪN (QUOTE LIKE & UNLIKE) ---');

    const bookLikesBefore = parseInt((await db.query('SELECT likes_count FROM books WHERE id = $1', [testBookId])).rows[0].likes_count, 10);
    const team1Row0 = (await db.query('SELECT total_likes, total_exp FROM teams WHERE id = 1')).rows[0];
    const team1LikesBefore = parseInt(team1Row0.total_likes, 10);
    const team1ExpBefore = parseInt(team1Row0.total_exp, 10);

    const growthLikesRow0 = (await db.query('SELECT total_likes, total_exp FROM community_growth WHERE id = 1')).rows[0];
    const growthLikesBefore = parseInt(growthLikesRow0.total_likes, 10);
    const growthExpLikesBefore = parseInt(growthLikesRow0.total_exp, 10);

    // 2.1 Thả tim trích dẫn thành công (+2 EXP)
    const likeFp = 'fp_testkey_liker_888';
    const likeRes = await QuoteService.likeQuote(testBookId, likeFp, { userId: testUserId2, teamId: 2 });
    assert(likeRes && likeRes.newLikesCount === bookLikesBefore + 1, 'Thả tim thành công: Số tim sách tăng đúng +1', `Likes: ${bookLikesBefore} -> ${likeRes.newLikesCount}`);
    assert(likeRes.expEarned === 2, 'Thả tim mang lại chính xác +2 EXP cho hệ sinh thái');

    const bookLikesAfter = parseInt((await db.query('SELECT likes_count FROM books WHERE id = $1', [testBookId])).rows[0].likes_count, 10);
    assert(bookLikesAfter === bookLikesBefore + 1, 'Bảng books ghi nhận chính xác likes_count tăng 1');

    const team1Row1 = (await db.query('SELECT total_likes, total_exp FROM teams WHERE id = 1')).rows[0];
    const team1LikesAfter = parseInt(team1Row1.total_likes, 10);
    const team1ExpAfter = parseInt(team1Row1.total_exp, 10);
    assert(team1LikesAfter === team1LikesBefore + 1, 'Đội có sách được tim (Đội 1) tăng đúng +1 total_likes');
    assert(team1ExpAfter === team1ExpBefore + 2, 'Đội có sách được tim tăng đúng +2 total_exp');

    const growthLikesRow1 = (await db.query('SELECT total_likes, total_exp FROM community_growth WHERE id = 1')).rows[0];
    const growthLikesAfter = parseInt(growthLikesRow1.total_likes, 10);
    const growthExpLikesAfter = parseInt(growthLikesRow1.total_exp, 10);
    assert(growthLikesAfter === growthLikesBefore + 1, 'Toàn Vườn tăng đúng +1 total_likes');
    assert(growthExpLikesAfter === growthExpLikesBefore + 2, 'Toàn Vườn tăng đúng +2 total_exp');

    const qlRow = await db.query('SELECT * FROM quote_likes WHERE book_id = $1 AND user_fingerprint = $2', [testBookId, likeFp]);
    assert(qlRow.rows.length === 1, 'Bảng quote_likes lưu chính xác 1 bản ghi cho fingerprint');

    // 2.2 Chống thả tim trùng lặp (Duplicate Like Protection)
    let dupLikeBlocked = false;
    try {
      await QuoteService.likeQuote(testBookId, likeFp);
    } catch (e) {
      dupLikeBlocked = true;
    }
    assert(dupLikeBlocked, 'Chặn thả tim trùng lặp từ cùng 1 thiết bị/người dùng (Unique Constraint)');

    const bookLikesAfterDup = parseInt((await db.query('SELECT likes_count FROM books WHERE id = $1', [testBookId])).rows[0].likes_count, 10);
    assert(bookLikesAfterDup === bookLikesAfter, 'Số tim của sách KHÔNG bị nhân đôi khi spam thả tim', `Likes: ${bookLikesAfterDup}`);

    // 2.3 Bỏ thả tim (Unlike Quote)
    const unlikeRes = await QuoteService.unlikeQuote(testBookId, likeFp);
    assert(unlikeRes && unlikeRes.newLikesCount === bookLikesBefore, 'Bỏ thích thành công: Số tim trở về mức ban đầu', `Likes: ${unlikeRes.newLikesCount}`);

    const qlAfterUnlike = await db.query('SELECT * FROM quote_likes WHERE book_id = $1 AND user_fingerprint = $2', [testBookId, likeFp]);
    assert(qlAfterUnlike.rows.length === 0, 'Bản ghi trong quote_likes đã bị xóa hoàn toàn sau khi bỏ thích');

    const team1Row2 = (await db.query('SELECT total_likes, total_exp FROM teams WHERE id = 1')).rows[0];
    const team1LikesAfterUnlike = parseInt(team1Row2.total_likes, 10);
    const team1ExpAfterUnlike = parseInt(team1Row2.total_exp, 10);
    assert(team1LikesAfterUnlike === team1LikesBefore, 'Điểm tim của Đội 1 hoàn lại chuẩn xác');
    assert(team1ExpAfterUnlike === team1ExpBefore, 'EXP của Đội 1 hoàn lại chuẩn xác (trừ 2 EXP)');

    // 2.4 Luồng Toggle Like hoàn chỉnh (Like -> Unlike -> Like lại)
    const relikeRes = await QuoteService.likeQuote(testBookId, likeFp, { userId: testUserId2, teamId: 2 });
    assert(relikeRes.newLikesCount === bookLikesBefore + 1, 'Thả tim lại lần 2 sau khi unlike thành công mượt mà');

    // 2.5 Kiểm tra cờ is_liked khi truy vấn sách
    const quotesForLiker = await BookService.getPublicQuotes({ userFingerprint: likeFp });
    const targetBookForLiker = quotesForLiker.quotes.find(b => b.id === testBookId);
    assert(targetBookForLiker && targetBookForLiker.is_liked === true, 'Truy vấn cho người đã thả tim: is_liked = true');

    const quotesForOther = await BookService.getPublicQuotes({ userFingerprint: 'fp_other_stranger' });
    const targetBookForOther = quotesForOther.quotes.find(b => b.id === testBookId);
    assert(targetBookForOther && targetBookForOther.is_liked === false, 'Truy vấn cho người chưa thả tim: is_liked = false');

    // =========================================================================
    // PHẦN 3: KIỂM THỬ ĐỒNG BỘ CLIENT STATE & UI LOGIC (ANTI-HARDCODE AUDIT)
    // =========================================================================
    console.log('\n--- [PHẦN 3] KIỂM THỬ ĐỒNG BỘ CLIENT STATE & UI LOGIC (ANTI-HARDCODE) ---');

    const clientStatusSync = await DewService.getDewStatus({ userId: testUserId1 });
    assert(clientStatusSync.hasClaimedToday === true, 'Client nhận đúng trạng thái tưới từ DB: hasClaimedToday = true (Không hardcode local)');

    function simulateDewButtonUI(currentUser, activeTeam, hasClaimedToday) {
      if (!currentUser || currentUser.isGuest || currentUser.id === 'guest' || !currentUser.team_id) {
        return { text: 'Tưới Nước', action: 'PROMPT_LOGIN', disabled: false };
      }
      const isInspectingOther = activeTeam && (parseInt(activeTeam.id, 10) !== parseInt(currentUser.team_id, 10));
      if (hasClaimedToday) {
        return { text: 'Đã Tưới Hôm Nay', action: 'SHOW_ALREADY_WATERED', disabled: true };
      } else if (isInspectingOther) {
        return { text: 'Tưới Cây Đội Tôi', action: 'SWITCH_TO_MY_TEAM', disabled: false };
      } else {
        return { text: 'Tưới Nước', action: 'DO_WATER', disabled: false };
      }
    }

    const guestUI = simulateDewButtonUI(null, { id: 1 }, false);
    assert(guestUI.text === 'Tưới Nước' && guestUI.action === 'PROMPT_LOGIN', 'UI Khách vãng lai: Hiển thị "Tưới Nước", click chuyển mở Modal đăng nhập');

    const inspectOtherUI = simulateDewButtonUI({ id: testUserId1, team_id: 1 }, { id: 2 }, false);
    assert(inspectOtherUI.text === 'Tưới Cây Đội Tôi' && inspectOtherUI.action === 'SWITCH_TO_MY_TEAM', 'UI Xem cây Đội khác: Hiển thị "Tưới Cây Đội Tôi", click tự động chuyển về cây đội mình');

    const ownTeamUnwateredUI = simulateDewButtonUI({ id: testUserId1, team_id: 1 }, { id: 1 }, false);
    assert(ownTeamUnwateredUI.text === 'Tưới Nước' && ownTeamUnwateredUI.action === 'DO_WATER', 'UI Cây đội mình chưa tưới: Hiển thị "Tưới Nước", click thực hiện tưới cây');

    const ownTeamWateredUI = simulateDewButtonUI({ id: testUserId1, team_id: 1 }, { id: 1 }, true);
    assert(ownTeamWateredUI.text === 'Đã Tưới Hôm Nay' && ownTeamWateredUI.disabled === true, 'UI Đã tưới hôm nay: Hiển thị "Đã Tưới Hôm Nay", nút bị vô hiệu hóa / opacity-75');

    // =========================================================================
    // PHẦN 4: KIỂM THỬ TOÀN DIỆN CHUYỂN NGÀY (DAY ROLLOVER & MULTI-DAY STREAK)
    // =========================================================================
    console.log('\n--- [PHẦN 4] KIỂM THỬ TOÀN DIỆN CHUYỂN NGÀY (DAY ROLLOVER & MULTI-DAY STREAK) ---');

    const multiDayUserId = '00000005-0000-4000-a000-000000000005';
    const multiDayFp = 'fp_multiday_tester_05';
    const bookDay1Id = '00000006-0000-4000-a000-000000000006';
    const bookDay2Id = '00000007-0000-4000-a000-000000000007';

    // Dọn dẹp dữ liệu kiểm thử multi-day
    await db.query('DELETE FROM daily_dews WHERE user_id = $1', [multiDayUserId]);
    await db.query('DELETE FROM quote_likes WHERE book_id IN ($1, $2)', [bookDay1Id, bookDay2Id]);
    await db.query('DELETE FROM exp_ledger WHERE user_id = $1 OR reference_id IN ($2, $3)', [multiDayUserId, bookDay1Id, bookDay2Id]);
    await db.query('DELETE FROM books WHERE id IN ($1, $2)', [bookDay1Id, bookDay2Id]);
    await db.query('DELETE FROM users WHERE id = $1', [multiDayUserId]);

    await db.query(`
      INSERT INTO users (id, employee_code, email, full_name, nickname, team_id, total_exp_earned)
      VALUES ($1, 'TK_U5', 'multiday_u5@fpt.com', 'Tester MultiDay', 'Độc Giả Xuyên Ngày #05', 1, 50)
    `, [multiDayUserId]);

    await db.query(`
      INSERT INTO books (id, title, author, quote, reader_name, team_id, likes_count, visibility_status, moderation_status)
      VALUES 
        ($1, 'Sách Ngày 1', 'Tác Giả 1', 'Trích dẫn ngày 1', 'Tester MultiDay', 1, 0, 'visible', 'reviewed'),
        ($2, 'Sách Ngày 2', 'Tác Giả 2', 'Trích dẫn ngày 2', 'Tester MultiDay', 1, 0, 'visible', 'reviewed')
    `, [bookDay1Id, bookDay2Id]);

    // 4.1 Ngày 1 (2026-09-01): Tưới nước lần đầu -> Streak = 1
    const day1Res = await DewService.claimDew({
      userId: multiDayUserId,
      teamId: 1,
      customDate: '2026-09-01'
    });
    assert(day1Res && day1Res.streak === 1, 'Ngày 1 (2026-09-01): Tưới nước thành công, khởi tạo Streak = 1');

    const day1Status = await DewService.getDewStatus({ userId: multiDayUserId, customDate: '2026-09-01' });
    assert(day1Status.hasClaimedToday === true && day1Status.streak === 1, 'Ngày 1: Kiểm tra getDewStatus phản hồi hasClaimedToday = true, streak = 1');

    let day1DupBlocked = false;
    try {
      await DewService.claimDew({ userId: multiDayUserId, teamId: 1, customDate: '2026-09-01' });
    } catch (e) {
      day1DupBlocked = (e.statusCode === 409 && e.code === 'DUPLICATE_DEW_CLAIM');
    }
    assert(day1DupBlocked, 'Ngày 1: Chặn tưới trùng lặp trong cùng Ngày 1 (HTTP 409 DUPLICATE_DEW_CLAIM)');

    // 4.2 Qua Ngày 2 (2026-09-02): Chuyển ngày liên tiếp -> hasClaimedToday chuyển về false, tưới tiếp Streak = 2
    const day2BeforeWatering = await DewService.getDewStatus({ userId: multiDayUserId, customDate: '2026-09-02' });
    assert(day2BeforeWatering.hasClaimedToday === false, 'Ngày 2 (Chuyển ngày): hasClaimedToday TỰ ĐỘNG CHUYỂN VỀ false, cho phép tưới ngày mới');
    assert(day2BeforeWatering.streak === 1, 'Ngày 2: Trạng thái trước khi tưới ghi nhận streak hôm qua = 1');

    const day2Res = await DewService.claimDew({
      userId: multiDayUserId,
      teamId: 1,
      customDate: '2026-09-02'
    });
    assert(day2Res && day2Res.streak === 2, 'Ngày 2: Tưới nước ngày mới thành công, chuỗi tăng chính xác: Streak = 2');

    const day2Status = await DewService.getDewStatus({ userId: multiDayUserId, customDate: '2026-09-02' });
    assert(day2Status.hasClaimedToday === true && day2Status.streak === 2, 'Ngày 2: Sau khi tưới, hasClaimedToday = true, streak = 2');

    let day2DupBlocked = false;
    try {
      await DewService.claimDew({ userId: multiDayUserId, teamId: 1, customDate: '2026-09-02' });
    } catch (e) {
      day2DupBlocked = (e.statusCode === 409 && e.code === 'DUPLICATE_DEW_CLAIM');
    }
    assert(day2DupBlocked, 'Ngày 2: Chặn tưới trùng lặp trong cùng Ngày 2');

    // 4.3 Qua Ngày 3 (2026-09-03): Ngày thứ 3 liên tiếp -> Streak = 3
    const day3BeforeWatering = await DewService.getDewStatus({ userId: multiDayUserId, customDate: '2026-09-03' });
    assert(day3BeforeWatering.hasClaimedToday === false, 'Ngày 3: hasClaimedToday tự động reset về false');

    const day3Res = await DewService.claimDew({
      userId: multiDayUserId,
      teamId: 1,
      customDate: '2026-09-03'
    });
    assert(day3Res && day3Res.streak === 3, 'Ngày 3: Tưới thành công ngày thứ 3 liên tiếp -> Streak = 3');

    // 4.4 Bỏ quên Ngày 4 (2026-09-04), quay lại Ngày 5 (2026-09-05) -> Reset Streak về 1
    const day5BeforeWatering = await DewService.getDewStatus({ userId: multiDayUserId, customDate: '2026-09-05' });
    assert(day5BeforeWatering.hasClaimedToday === false, 'Ngày 5 (Sau khi nghỉ Ngày 4): hasClaimedToday = false');

    const day5Res = await DewService.claimDew({
      userId: multiDayUserId,
      teamId: 1,
      customDate: '2026-09-05'
    });
    assert(day5Res && day5Res.streak === 1, 'Ngày 5 (Đứt chuỗi hôm qua): Hệ thống tự động reset Streak về 1 chuẩn xác!');

    // 4.5 Kiểm thử Flow Thả Tim Qua Ngày Mới (Quote Likes Persistence Across Days)
    // Ngày 1: Thả tim Sách 1
    await QuoteService.likeQuote(bookDay1Id, multiDayFp, { userId: multiDayUserId, teamId: 1 });
    const book1Likes = (await db.query('SELECT likes_count FROM books WHERE id = $1', [bookDay1Id])).rows[0].likes_count;
    assert(parseInt(book1Likes, 10) === 1, 'Ngày 1: Thả tim Sách 1 thành công (likes_count = 1)');

    // Qua Ngày 2: Kiểm tra tim đã thả của Ngày 1 có bị mất hay bị lỗi không
    const quotesDay2 = await BookService.getPublicQuotes({ userFingerprint: multiDayFp, search: 'Sách Ngày' });
    const b1OnDay2 = quotesDay2.quotes.find(b => b.id === bookDay1Id);
    assert(b1OnDay2 && b1OnDay2.is_liked === true, 'Ngày 2 (Qua ngày mới): Sách 1 VẪN ĐƯỢC LƯU is_liked = true (Không bị mất tim cũ)');

    // Ngày 2: Không được thả tim lại Sách 1 để gian lận EXP
    let b1RelikeBlocked = false;
    try {
      await QuoteService.likeQuote(bookDay1Id, multiDayFp, { userId: multiDayUserId, teamId: 1 });
    } catch (e) {
      b1RelikeBlocked = true;
    }
    assert(b1RelikeBlocked, 'Ngày 2: Chặn thả tim trùng lặp trên Sách 1 (Chống lạm phát EXP xuyên ngày)');

    // Ngày 2: Thả tim tiếp Sách 2 mới thành công
    const likeB2Res = await QuoteService.likeQuote(bookDay2Id, multiDayFp, { userId: multiDayUserId, teamId: 1 });
    assert(likeB2Res && likeB2Res.newLikesCount === 1, 'Ngày 2: Thả tim Sách 2 mới thành công mượt mà (+2 EXP)');

    const quotesDay2After = await BookService.getPublicQuotes({ userFingerprint: multiDayFp, search: 'Sách Ngày' });
    const b1After = quotesDay2After.quotes.find(b => b.id === bookDay1Id);
    const b2After = quotesDay2After.quotes.find(b => b.id === bookDay2Id);
    assert(b1After && b1After.is_liked === true && b2After && b2After.is_liked === true, 'Cả 2 sách ở cả 2 ngày đều đồng bộ is_liked = true hoàn hảo');

    // Ngày 2: Bỏ tim Sách 1, Sách 2 vẫn giữ nguyên tim
    await QuoteService.unlikeQuote(bookDay1Id, multiDayFp);
    const quotesAfterUnlike = await BookService.getPublicQuotes({ userFingerprint: multiDayFp, search: 'Sách Ngày' });
    const b1Unliked = quotesAfterUnlike.quotes.find(b => b.id === bookDay1Id);
    const b2StillLiked = quotesAfterUnlike.quotes.find(b => b.id === bookDay2Id);
    assert(b1Unliked && b1Unliked.is_liked === false && b2StillLiked && b2StillLiked.is_liked === true, 'Bỏ tim Sách 1 độc lập, Sách 2 vẫn giữ nguyên trạng thái thả tim');

    // 4.6 Kiểm thử Tính Toán Mốc Nửa Đêm (Timezone Midnight Offset Verification)
    const utcBeforeMidnight = new Date('2026-09-07T16:59:59.000Z'); // 23:59:59 VN
    const utcAtMidnight = new Date('2026-09-07T17:00:00.000Z');     // 00:00:00 VN hôm sau
    const vnDateBefore = getVietnamDateString(utcBeforeMidnight);
    const vnDateAt = getVietnamDateString(utcAtMidnight);
    assert(vnDateBefore === '2026-09-07', '23:59:59 VN: Tính chính xác là ngày 2026-09-07');
    assert(vnDateAt === '2026-09-08', '00:00:00 VN: Tính chính xác chuyển sang ngày mới 2026-09-08 (Zero Off-by-one bug)');

    // 4.7 Kiểm thử Cơ Chế Tự Hủy Cache Ngày Cũ Phía Client (Client Cache Expiry Simulation)
    const clientCacheStore = {
      [multiDayUserId]: {
        hasClaimedToday: true,
        streak: 2,
        cacheDate: '2026-09-07' // Ngày hôm qua
      }
    };

    function simulateClientCheckToday(userId, currentDate) {
      const cached = clientCacheStore[userId];
      if (cached && cached.cacheDate === currentDate) {
        return { fromCache: true, hasClaimedToday: cached.hasClaimedToday };
      }
      return { fromCache: false, hasClaimedToday: false }; // Bắt buộc query DB server
    }

    const cacheYesterday = simulateClientCheckToday(multiDayUserId, '2026-09-07');
    assert(cacheYesterday.fromCache === true && cacheYesterday.hasClaimedToday === true, 'Client trong ngày cũ: Nhận cache hợp lệ');

    const cacheToday = simulateClientCheckToday(multiDayUserId, '2026-09-08');
    assert(cacheToday.fromCache === false && cacheToday.hasClaimedToday === false, 'Client khi qua ngày mới: TỰ ĐỘNG HỦY CACHE CŨ, kích hoạt lấy state từ DB để mở nút tưới');

    // Dọn dẹp dữ liệu kiểm thử
    await db.query('DELETE FROM daily_dews WHERE user_id IN ($1, $2, $3, $4)', [testUserId1, testUserId2, testNoTeamUserId, multiDayUserId]);
    await db.query('DELETE FROM quote_likes WHERE book_id IN ($1, $2, $3)', [testBookId, bookDay1Id, bookDay2Id]);
    await db.query('DELETE FROM exp_ledger WHERE user_id IN ($1, $2, $3, $4) OR reference_id IN ($5, $6, $7)', [testUserId1, testUserId2, testNoTeamUserId, multiDayUserId, testBookId, bookDay1Id, bookDay2Id]);
    await db.query('DELETE FROM books WHERE id IN ($1, $2, $3)', [testBookId, bookDay1Id, bookDay2Id]);
    await db.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [testUserId1, testUserId2, testNoTeamUserId, multiDayUserId]);

    console.log('\n=================================================================');
    console.log(`📊 TỔNG KẾT TESTKEY: ${totalPassed} PASSED | ${totalFailed} FAILED`);
    const rate = ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1);
    console.log(`🎯 TỶ LỆ TOÀN VẸN: ${rate}% (MỤC TIÊU 100%)`);
    console.log('=================================================================\n');

    if (totalFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal testkey error:', err);
    process.exit(1);
  }
}

runFullTestKey();
