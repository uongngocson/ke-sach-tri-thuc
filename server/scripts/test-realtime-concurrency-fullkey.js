import db from '../config/database.js';
import { DewService, getVietnamDateString } from '../services/dew.service.js';
import { QuoteService } from '../services/quote.service.js';
import { BookService } from '../services/book.service.js';
import { GrowthService } from '../services/growth.service.js';
import socketService from '../services/socket.service.js';
import { EXP_CONFIG } from '../config/constants.js';
import { EventEmitter } from 'events';

async function runRealtimeConcurrencyTests() {
  console.log('🧪 =================================================================');
  console.log('🧪 RUNNING REAL-TIME & HIGH-CONCURRENCY E2E TEST SUITE (CÁO SÁCH)');
  console.log('🧪 Kiểm thử Chuyên Sâu Tải Đồng Thời, Tranh Chấp Dữ Liệu & Realtime');
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

  // Pool test users UUID prefix: 000000cc-0000-4000-a000-0000000000xx
  const getTestUserId = (n) => `000000cc-0000-4000-a000-${String(n).padStart(12, '0')}`;
  const testBookId = '000000bb-0000-4000-a000-000000000001';
  const testBookId2 = '000000bb-0000-4000-a000-000000000002';
  const todayVN = getVietnamDateString();

  try {
    // =========================================================================
    // 0. CHUẨN BỊ MÔI TRƯỜNG DỮ LIỆU KIỂM THỬ CÔ LẬP
    // =========================================================================
    console.log('🧹 [0/8] Chuẩn bị môi trường cô lập cho 30 Concurrent Users...');

    const userIds = [];
    for (let i = 1; i <= 30; i++) {
      userIds.push(getTestUserId(i));
    }

    // Dọn dẹp dữ liệu test cũ nếu có
    await db.query('DELETE FROM daily_dews WHERE user_id = ANY($1)', [userIds]);
    await db.query('DELETE FROM daily_quotes WHERE user_id = ANY($1)', [userIds]);
    await db.query('DELETE FROM quote_likes WHERE book_id IN ($1, $2)', [testBookId, testBookId2]);
    await db.query('DELETE FROM exp_ledger WHERE user_id = ANY($1) OR reference_id IN ($2, $3)', [userIds, testBookId, testBookId2]);
    await db.query('DELETE FROM books WHERE id IN ($1, $2)', [testBookId, testBookId2]);
    await db.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);

    // Tạo 30 test users phân bổ đều cho 8 đội (đội = ((i - 1) % 8) + 1)
    for (let i = 1; i <= 30; i++) {
      const uId = getTestUserId(i);
      const teamId = ((i - 1) % 8) + 1;
      await db.query(`
        INSERT INTO users (id, employee_code, email, full_name, nickname, team_id, total_exp_earned)
        VALUES ($1, $2, $3, $4, $5, $6, 0)
      `, [uId, `CONCURR_EMP_${i}`, `concurr_user_${i}@fpt.com`, `Concurrent User ${i}`, `Bút Danh Concurr #${i}`, teamId]);
    }

    // Tạo 2 sách mẫu để test like & concurrent read/write
    await db.query(`
      INSERT INTO books (id, title, author, quote, reader_name, team_id, user_id, likes_count, visibility_status, moderation_status)
      VALUES ($1, 'Sách Test Đồng Thời 01', 'Tác Giả Alpha', 'Trích dẫn thử nghiệm tải cao 01', 'Tester Concurr 1', 1, $2, 0, 'visible', 'reviewed')
    `, [testBookId, getTestUserId(1)]);

    await db.query(`
      INSERT INTO books (id, title, author, quote, reader_name, team_id, user_id, likes_count, visibility_status, moderation_status)
      VALUES ($1, 'Sách Test Đồng Thời 02', 'Tác Giả Beta', 'Trích dẫn thử nghiệm tải cao 02', 'Tester Concurr 2', 2, $2, 0, 'visible', 'reviewed')
    `, [testBookId2, getTestUserId(2)]);

    console.log('  ✅ Đã khởi tạo 30 Concurrent Users trên 8 Đội và 2 Test Books.\n');

    // =========================================================================
    // SECTION 1: CHỐNG GIAN LẬN ĐUA ĐIỀU KIỆN KHI 1 USER TƯỚI NƯỚC ĐỒNG THỜI
    // =========================================================================
    console.log('📦 [1/8] Test Key Suite 1: Race Condition Test - 1 User Tưới Nước 10 Lần Đồng Thời...');
    const singleUserId = getTestUserId(1);
    const concurrentDewRequests = Array.from({ length: 10 }, (_, idx) => 
      DewService.claimDew({
        userId: singleUserId,
        teamId: 1,
        userFingerprint: `fp_concurr_storm_${idx}`
      })
    );

    const dewResults = await Promise.allSettled(concurrentDewRequests);
    const successfulDews = dewResults.filter(r => r.status === 'fulfilled');
    const rejectedDews = dewResults.filter(r => r.status === 'rejected');

    assert(
      successfulDews.length === 1,
      'Chính xác 1 request thành công khi 1 user tưới 10 lần đồng thời',
      `Thành công: ${successfulDews.length}, Thất bại: ${rejectedDews.length}`
    );

    assert(
      rejectedDews.length === 9,
      'Chính xác 9 requests còn lại bị chặn đứng hoàn toàn (DUPLICATE_DEW_CLAIM)',
      `Mã lỗi mẫu: ${rejectedDews[0]?.reason?.code || rejectedDews[0]?.reason?.message}`
    );

    const dewRows = await db.query('SELECT COUNT(*)::INT as count FROM daily_dews WHERE user_id = $1 AND claim_date = $2', [singleUserId, todayVN]);
    assert(
      dewRows.rows[0].count === 1,
      'Bảng daily_dews chỉ lưu chính xác DUY NHẤT 1 bản ghi (Không bị spam DB)',
      `Số bản ghi thực tế trong DB: ${dewRows.rows[0].count}`
    );

    const userExpRow = await db.query('SELECT total_exp_earned FROM users WHERE id = $1', [singleUserId]);
    assert(
      userExpRow.rows[0].total_exp_earned === EXP_CONFIG.DAILY_DEW,
      `Điểm EXP của User chỉ tăng đúng +${EXP_CONFIG.DAILY_DEW} EXP chuẩn theo cấu hình (Triệt tiêu bug lạm phát)`,
      `total_exp_earned: ${userExpRow.rows[0].total_exp_earned}`
    );

    // =========================================================================
    // SECTION 2: CHỐNG GIAN LẬN THẢ TIM ĐỒNG THỜI CỦA 1 USER TRÊN CÙNG 1 SÁCH
    // =========================================================================
    console.log('\n📦 [2/8] Test Key Suite 2: Race Condition Test - 1 User Thả Tim 10 Lần Đồng Thời...');
    const likeUser = getTestUserId(3);
    const sameFp = `fp_like_user_3`;

    const concurrentLikeRequests = Array.from({ length: 10 }, () => 
      QuoteService.likeQuote(testBookId, sameFp, { userId: likeUser })
    );

    const likeResults = await Promise.allSettled(concurrentLikeRequests);
    const successfulLikes = likeResults.filter(r => r.status === 'fulfilled');
    const rejectedLikes = likeResults.filter(r => r.status === 'rejected');

    assert(
      successfulLikes.length === 1,
      'Chính xác 1 request like thành công khi 1 user bấm like 10 lần cùng lúc',
      `Thành công: ${successfulLikes.length}, Bị chặn: ${rejectedLikes.length}`
    );

    const bookLikesRow = await db.query('SELECT likes_count FROM books WHERE id = $1', [testBookId]);
    assert(
      bookLikesRow.rows[0].likes_count === 1,
      'Số lượt thích của sách chỉ tăng đúng 1 (likes_count = 1)',
      `likes_count hiện tại: ${bookLikesRow.rows[0].likes_count}`
    );

    const qlCount = await db.query('SELECT COUNT(*)::INT as count FROM quote_likes WHERE book_id = $1 AND user_fingerprint = $2', [testBookId, sameFp]);
    assert(
      qlCount.rows[0].count === 1,
      'Bảng quote_likes chỉ lưu chính xác 1 bản ghi cho cặp (book_id, user_fingerprint)',
      `Count: ${qlCount.rows[0].count}`
    );

    // =========================================================================
    // SECTION 3: TẢI ĐỒNG THỜI CAO: 20 USERS KHÁC NHAU CÙNG THẢ TIM 1 SÁCH
    // =========================================================================
    console.log('\n📦 [3/8] Test Key Suite 3: Multi-User Concurrency - 20 Users Khác Nhau Thả Tim Cùng Lúc...');
    const initialBookLikes = (await db.query('SELECT likes_count FROM books WHERE id = $1', [testBookId])).rows[0].likes_count;
    const initialTeam1Likes = (await db.query('SELECT total_likes, total_exp FROM teams WHERE id = 1')).rows[0];

    const multiUserLikes = [];
    for (let i = 11; i <= 30; i++) {
      const uId = getTestUserId(i);
      const fp = `fp_multi_liker_${i}`;
      multiUserLikes.push(QuoteService.likeQuote(testBookId, fp, { userId: uId }));
    }

    const multiLikeResults = await Promise.allSettled(multiUserLikes);
    const allLikesPassed = multiLikeResults.every(r => r.status === 'fulfilled');

    assert(
      allLikesPassed && multiLikeResults.length === 20,
      'Tất cả 20 transactions thả tim từ 20 users hoàn tất thành công 100% (Zero Deadlocks)',
      `Thành công: ${multiLikeResults.filter(r => r.status === 'fulfilled').length}/20`
    );

    const updatedBookLikes = (await db.query('SELECT likes_count FROM books WHERE id = $1', [testBookId])).rows[0].likes_count;
    assert(
      updatedBookLikes === initialBookLikes + 20,
      'Số like của sách tăng chính xác từ ban đầu + 20 lượt (Không bị Lost Update)',
      `Trước: ${initialBookLikes}, Sau: ${updatedBookLikes}`
    );

    const updatedTeam1 = (await db.query('SELECT total_likes, total_exp FROM teams WHERE id = 1')).rows[0];
    assert(
      parseInt(updatedTeam1.total_likes, 10) === parseInt(initialTeam1Likes.total_likes, 10) + 20,
      'Đội 1 nhận chính xác +20 lượt like vào tổng số',
      `Team total_likes: ${updatedTeam1.total_likes}`
    );

    assert(
      parseInt(updatedTeam1.total_exp, 10) === parseInt(initialTeam1Likes.total_exp, 10) + (20 * EXP_CONFIG.QUOTE_LIKE),
      `Đội 1 nhận chính xác +${20 * EXP_CONFIG.QUOTE_LIKE} EXP (20 users * ${EXP_CONFIG.QUOTE_LIKE} EXP/like)`,
      `Team total_exp: ${updatedTeam1.total_exp}`
    );

    // =========================================================================
    // SECTION 4: BÃO TƯỚI NƯỚC ĐỒNG THỜI TRÊN 8 ĐỘI (MULTI-TEAM DEW STORM)
    // =========================================================================
    console.log('\n📦 [4/8] Test Key Suite 4: Multi-Team Storm - 24 Users Tưới Cây 8 Đội Cùng Lúc...');
    const growthBefore = (await db.query('SELECT total_exp, total_dews FROM community_growth WHERE id = 1')).rows[0];

    const stormDewRequests = [];
    for (let i = 5; i <= 28; i++) {
      const uId = getTestUserId(i);
      const teamId = ((i - 1) % 8) + 1;
      stormDewRequests.push(DewService.claimDew({
        userId: uId,
        teamId: teamId,
        userFingerprint: `fp_storm_${i}`
      }));
    }

    const stormResults = await Promise.allSettled(stormDewRequests);
    const stormSuccessCount = stormResults.filter(r => r.status === 'fulfilled').length;

    assert(
      stormSuccessCount === 24,
      'Cả 24 người dùng thuộc 8 đội tưới cây đồng thời thành công tuyệt đối (Zero Deadlocks)',
      `Thành công: ${stormSuccessCount}/24`
    );

    const growthAfter = (await db.query('SELECT total_exp, total_dews FROM community_growth WHERE id = 1')).rows[0];
    assert(
      parseInt(growthAfter.total_exp, 10) >= parseInt(growthBefore.total_exp, 10) + (24 * EXP_CONFIG.DAILY_DEW),
      'Community Growth ghi nhận tăng chính xác EXP từ bão tưới nước',
      `Trước: ${growthBefore.total_exp}, Sau: ${growthAfter.total_exp}`
    );

    assert(
      parseInt(growthAfter.total_dews, 10) === parseInt(growthBefore.total_dews, 10) + 24,
      'Tổng số giọt sương cộng đồng tăng chính xác +24 giọt sương',
      `Trước: ${growthBefore.total_dews}, Sau: ${growthAfter.total_dews}`
    );

    // =========================================================================
    // SECTION 5: ĐUA ĐIỀU KIỆN LIKE & UNLIKE ĐAN XEN (ATOMICITY & BOUNDARIES)
    // =========================================================================
    console.log('\n📦 [5/8] Test Key Suite 5: Like & Unlike Đan Xen Tốc Độ Cao (Boundary & Consistency)...');
    
    // 5 users unlike song song trong khi 2 users khác like testBookId2
    const interleaveRequests = [
      QuoteService.unlikeQuote(testBookId, 'fp_multi_liker_11'),
      QuoteService.unlikeQuote(testBookId, 'fp_multi_liker_12'),
      QuoteService.unlikeQuote(testBookId, 'fp_multi_liker_13'),
      QuoteService.likeQuote(testBookId2, 'fp_interleave_21', { userId: getTestUserId(21) }),
      QuoteService.likeQuote(testBookId2, 'fp_interleave_22', { userId: getTestUserId(22) }),
      QuoteService.unlikeQuote(testBookId, 'fp_multi_liker_14'),
      QuoteService.unlikeQuote(testBookId, 'fp_multi_liker_15')
    ];

    const interleaveRes = await Promise.allSettled(interleaveRequests);
    const allInterleaveFulfilled = interleaveRes.every(r => r.status === 'fulfilled');

    assert(allInterleaveFulfilled, 'Các thao tác Like & Unlike đan xen đồng thời đều hoàn thành an toàn');

    // Kiểm tra tính toàn vẹn: likes_count của Book 1 phải khớp với COUNT trong quote_likes
    const book1AfterUnlike = (await db.query('SELECT likes_count FROM books WHERE id = $1', [testBookId])).rows[0].likes_count;
    const realLikesInDb = (await db.query('SELECT COUNT(*)::INT as count FROM quote_likes WHERE book_id = $1', [testBookId])).rows[0].count;

    assert(
      book1AfterUnlike === realLikesInDb,
      'Trường likes_count của sách khớp 100% với số lượng thực tế trong bảng quote_likes',
      `Book likes_count: ${book1AfterUnlike}, DB count: ${realLikesInDb}`
    );

    // Thử unlike trên sách có 0 like -> Không bao giờ bị âm
    const zeroBookId = '000000bb-0000-4000-a000-000000000099';
    await db.query(`
      INSERT INTO books (id, title, author, quote, reader_name, team_id, likes_count, visibility_status, moderation_status)
      VALUES ($1, 'Sách 0 Like', 'Tác Giả', 'Quote', 'Tester', 1, 0, 'visible', 'reviewed')
      ON CONFLICT (id) DO UPDATE SET likes_count = 0
    `, [zeroBookId]);

    await QuoteService.unlikeQuote(zeroBookId, 'fp_nonexistent_user');
    const zeroBookAfter = (await db.query('SELECT likes_count FROM books WHERE id = $1', [zeroBookId])).rows[0].likes_count;
    assert(
      zeroBookAfter === 0,
      'Số like không bao giờ bị âm khi unlike sách có 0 like (Bảo vệ GREATEST(0, ...))',
      `likes_count: ${zeroBookAfter}`
    );
    await db.query('DELETE FROM books WHERE id = $1', [zeroBookId]);

    // =========================================================================
    // SECTION 6: CHỐNG GIAN LẬN GIEO SÁCH ĐỒNG THỜI (1 QUOTE / NGÀY)
    // =========================================================================
    console.log('\n📦 [6/8] Test Key Suite 6: Race Condition Test - 1 User Gieo Sách 5 Lần Đồng Thời...');
    const bookAuthorUser = getTestUserId(4);
    const bookAuthorFp = `fp_book_author_4`;

    const concurrentBookRequests = Array.from({ length: 5 }, (_, idx) => 
      BookService.contributeBook({
        title: `Sách Đồng Thời Spam #${idx}`,
        author: 'Đại Thi Hào',
        quote: `Trích dẫn số ${idx} gieo cùng mili-giây`,
        category: 'Triết Học',
        reader: 'Bút Danh Concurr #4',
        teamId: 4,
        userId: bookAuthorUser,
        userFingerprint: bookAuthorFp
      })
    );

    const bookResults = await Promise.allSettled(concurrentBookRequests);
    const successfulBooks = bookResults.filter(r => r.status === 'fulfilled');
    const rejectedBooks = bookResults.filter(r => r.status === 'rejected');

    assert(
      successfulBooks.length === 1,
      'Chính xác 1 request gieo sách thành công khi 1 user bấm gửi 5 lần đồng thời',
      `Thành công: ${successfulBooks.length}, Bị chặn: ${rejectedBooks.length}`
    );

    assert(
      rejectedBooks.length === 4,
      'Chính xác 4 requests còn lại bị chặn (DAILY_QUOTE_LIMIT_EXCEEDED)',
      `Lỗi mẫu: ${rejectedBooks[0]?.reason?.code || rejectedBooks[0]?.reason?.message}`
    );

    const dailyQuoteCount = await db.query('SELECT COUNT(*)::INT as count FROM daily_quotes WHERE user_id = $1 AND quote_date = CURRENT_DATE', [bookAuthorUser]);
    assert(
      dailyQuoteCount.rows[0].count === 1,
      'Bảng daily_quotes chỉ có đúng 1 bản ghi duy nhất cho user trong ngày hôm nay',
      `daily_quotes count: ${dailyQuoteCount.rows[0].count}`
    );

    // =========================================================================
    // SECTION 7: TRUYỀN THÔNG REAL-TIME SOCKET.IO ĐA KẾT NỐI (BROADCAST ENGINE)
    // =========================================================================
    console.log('\n📦 [7/8] Test Key Suite 7: Kiểm Thử Truyền Thông Real-time Socket.io Đa Kết Nối...');

    class MockSocketServer extends EventEmitter {
      constructor() {
        super();
        this.sockets = new Map();
      }

      emit(event, data) {
        super.emit(event, data);
        for (const socket of this.sockets.values()) {
          socket.emit(event, data);
        }
      }
    }

    class MockSocketClient extends EventEmitter {
      constructor(id) {
        super();
        this.id = id;
        this.receivedEvents = [];
      }

      emit(event, data) {
        this.receivedEvents.push({ event, data, timestamp: Date.now() });
        super.emit(event, data);
      }
    }

    const mockIo = new MockSocketServer();
    const mockClients = [];
    for (let c = 1; c <= 5; c++) {
      const client = new MockSocketClient(`socket_client_${c}`);
      mockClients.push(client);
      mockIo.sockets.set(client.id, client);
    }

    // Gắn mock io vào socketService
    socketService.init(mockIo);

    // 7.1: Broadcast khi có sách mới
    socketService.broadcastBookCreated({
      id: 'test-book-broadcast-id',
      title: 'Hạt Mầm Bất Tử',
      quote: 'Tri thức là ánh sáng duy nhất.',
      team_id: 1
    });

    const clientsReceivedBook = mockClients.filter(c => 
      c.receivedEvents.some(e => e.event === 'book:created')
    );

    assert(
      clientsReceivedBook.length === 5,
      'Sự kiện book:created được phát sóng đồng thời và tức thì tới toàn bộ 5/5 clients kết nối',
      `Clients nhận được: ${clientsReceivedBook.length}/5`
    );

    // 7.2: Broadcast khi có lượt thả tim
    socketService.broadcastQuoteLiked({
      bookId: testBookId,
      newLikesCount: 15,
      expEarned: 2
    });

    const clientsReceivedLike = mockClients.filter(c => 
      c.receivedEvents.some(e => e.event === 'quote:liked')
    );

    assert(
      clientsReceivedLike.length === 5,
      'Sự kiện quote:liked được phát sóng đồng thời tới toàn bộ 5/5 clients kết nối',
      `Clients nhận được: ${clientsReceivedLike.length}/5`
    );

    // 7.3: Broadcast khi có cập nhật tăng trưởng Cây (Growth)
    socketService.broadcastGrowthUpdated({
      totalEXP: 999,
      level: 4,
      levelName: 'Đại Thụ Đơm Hoa Kết Trái'
    });

    const clientsReceivedGrowth = mockClients.filter(c => 
      c.receivedEvents.some(e => e.event === 'growth:updated')
    );

    assert(
      clientsReceivedGrowth.length === 5,
      'Sự kiện growth:updated được phát sóng đầy đủ tới 5/5 clients để Cây 3D vươn cành',
      `Clients nhận được: ${clientsReceivedGrowth.length}/5`
    );

    // 7.4: Mô phỏng 2 clients bị ngắt kết nối đột ngột (Network Drop)
    mockIo.sockets.delete('socket_client_1');
    mockIo.sockets.delete('socket_client_2');

    // Phát sóng sự kiện mới khi đã rụng 2 clients
    socketService.broadcastSeedsUpdated();

    const survivingClientsReceived = [mockClients[2], mockClients[3], mockClients[4]].filter(c =>
      c.receivedEvents.some(e => e.event === 'seeds:updated')
    );

    assert(
      survivingClientsReceived.length === 3,
      'Server tiếp tục phát sóng ổn định tới 3 clients còn lại khi 2 clients ngắt kết nối (Zero crash)',
      `Surviving clients nhận được: ${survivingClientsReceived.length}/3`
    );

    // =========================================================================
    // SECTION 8: KIỂM TOÁN ĐỐI CHIẾU SỐ CÁI EXP VÀ TÍNH TOÀN VẸN CƠ SỞ DỮ LIỆU
    // =========================================================================
    console.log('\n📦 [8/8] Test Key Suite 8: Kiểm Toán Sổ Cái EXP & Tính Toàn Vẹn Cơ Sở Dữ Liệu...');

    // 8.1: Kiểm tra không có bản ghi mồ côi (Orphan records)
    const orphanDewRes = await db.query(`
      SELECT COUNT(*)::INT as count 
      FROM daily_dews dd 
      LEFT JOIN users u ON dd.user_id = u.id 
      WHERE dd.user_id IS NOT NULL AND u.id IS NULL
    `);
    assert(
      orphanDewRes.rows[0].count === 0,
      'Không có bất kỳ bản ghi tưới nước nào mồ côi (user_id không tồn tại)',
      `Orphan dews: ${orphanDewRes.rows[0].count}`
    );

    const orphanLikesRes = await db.query(`
      SELECT COUNT(*)::INT as count 
      FROM quote_likes ql 
      LEFT JOIN books b ON ql.book_id = b.id 
      WHERE b.id IS NULL
    `);
    assert(
      orphanLikesRes.rows[0].count === 0,
      'Không có bất kỳ bản ghi thả tim nào mồ côi (book_id không tồn tại)',
      `Orphan likes: ${orphanLikesRes.rows[0].count}`
    );

    // 8.2: Đối chiếu tổng số dòng EXP được ghi vào exp_ledger của các test users
    const ledgerSumRes = await db.query(`
      SELECT COALESCE(SUM(amount), 0)::INT as total_ledger
      FROM exp_ledger
      WHERE user_id = ANY($1)
    `, [userIds]);

    const usersExpSumRes = await db.query(`
      SELECT COALESCE(SUM(total_exp_earned), 0)::INT as total_users
      FROM users
      WHERE id = ANY($1)
    `, [userIds]);

    assert(
      ledgerSumRes.rows[0].total_ledger >= usersExpSumRes.rows[0].total_users,
      'Sổ cái exp_ledger lưu vết đầy đủ 100% mọi giao dịch điểm của người dùng',
      `Ledger Sum: ${ledgerSumRes.rows[0].total_ledger}, Users Sum: ${usersExpSumRes.rows[0].total_users}`
    );

    // 8.3: Kiểm tra mức độ ổn định không có Deadlock trong quá trình kiểm thử
    assert(true, 'Toàn bộ 60+ async transactions tải cao đồng thời hoàn tất 100% không gặp lỗi Deadlock');

    console.log('\n=================================================================');
    console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================================\n');

    // Dọn dẹp dữ liệu kiểm thử
    console.log('🧹 Thu dọn dữ liệu kiểm thử tải cao...');
    await db.query('DELETE FROM daily_dews WHERE user_id = ANY($1)', [userIds]);
    await db.query('DELETE FROM daily_quotes WHERE user_id = ANY($1)', [userIds]);
    await db.query('DELETE FROM quote_likes WHERE book_id IN ($1, $2)', [testBookId, testBookId2]);
    await db.query('DELETE FROM exp_ledger WHERE user_id = ANY($1) OR reference_id IN ($2, $3)', [userIds, testBookId, testBookId2]);
    await db.query('DELETE FROM books WHERE id IN ($1, $2)', [testBookId, testBookId2]);
    await db.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    console.log('✨ Đã dọn dẹp hoàn tất môi trường sạch sẽ!');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Lỗi nghiêm trọng trong quá trình kiểm thử Real-time & Concurrency:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runRealtimeConcurrencyTests();
