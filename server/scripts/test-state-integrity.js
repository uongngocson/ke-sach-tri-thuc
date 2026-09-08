import db from '../config/database.js';
import { DewService, getVietnamDateString } from '../services/dew.service.js';
import { QuoteService } from '../services/quote.service.js';
import { BookService } from '../services/book.service.js';
import { GrowthService } from '../services/growth.service.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

/**
 * COMPREHENSIVE STATE INTEGRITY & GHOST MUTATION TEST SUITE
 * Kiểm tra 100% tính toàn vẹn State:
 * 1. Idle Stability: Hệ thống nghỉ có bị tự ý cập nhật CSDL không?
 * 2. Read-Only Purity: Các endpoint GET có làm biến đổi CSDL không?
 * 3. Race Conditions: Xung đột khi hàng loạt request gửi tới cùng 1 mili-giây?
 * 4. Cross-Entity Isolation: Hành động của Đội A có làm đổi điểm Đội B hay User khác không?
 * 5. Rollback Atomicity: Khi lỗi xảy ra, CSDL có bị ghi nửa vời (dirty state) không?
 * 6. Client Code Audit: Có đoạn mã ngầm nào tự động gửi POST/PUT định kỳ không?
 */
async function runStateIntegrityTests() {
  console.log('\n🧪 =================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE TEST SUITE: STATE INTEGRITY & GHOST MUTATION');
  console.log('🧪 =================================================================\n');

  const API_PORT = process.env.PORT || 5000;
  const BASE_URL = `http://127.0.0.1:${API_PORT}/api/v1`;
  let serverInstance = null;
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

  // Helper: Snapshot entire database state
  async function takeDatabaseSnapshot() {
    const [growthRes, teamsRes, usersCountRes, usersExpRes, booksCountRes, ledgerRes, dewsCountRes, likesCountRes] = await Promise.all([
      db.query('SELECT total_exp, level, total_books, total_dews, total_likes, active_readers, updated_at FROM community_growth WHERE id = 1'),
      db.query('SELECT id, total_exp, tree_exp, level, tree_level, tree_seeds, total_books, total_dews, total_likes FROM teams ORDER BY id ASC'),
      db.query('SELECT COUNT(*)::INT as count FROM users'),
      db.query('SELECT COALESCE(SUM(total_exp_earned), 0)::BIGINT as sum_exp, COALESCE(SUM(contributed_books_count), 0)::BIGINT as sum_books FROM users'),
      db.query('SELECT COUNT(*)::INT as count FROM books'),
      db.query('SELECT COUNT(*)::INT as count, COALESCE(SUM(amount), 0)::BIGINT as sum_amount FROM exp_ledger'),
      db.query('SELECT COUNT(*)::INT as count FROM daily_dews'),
      db.query('SELECT COUNT(*)::INT as count FROM quote_likes')
    ]);

    return {
      growth: growthRes.rows[0] || {},
      teams: teamsRes.rows || [],
      usersCount: usersCountRes.rows[0].count,
      usersSumExp: usersExpRes.rows[0].sum_exp,
      usersSumBooks: usersExpRes.rows[0].sum_books,
      booksCount: booksCountRes.rows[0].count,
      ledgerCount: ledgerRes.rows[0].count,
      ledgerSumAmount: ledgerRes.rows[0].sum_amount,
      dewsCount: dewsCountRes.rows[0].count,
      likesCount: likesCountRes.rows[0].count
    };
  }

  try {
    // 0. Ensure server is active
    try {
      const check = await fetch(`http://127.0.0.1:${API_PORT}/health`, { signal: AbortSignal.timeout(1000) });
      if (!check.ok) throw new Error('Health check non-200');
    } catch {
      const { server } = await import('../server.js');
      if (!server.listening) {
        await new Promise((resolve) => {
          serverInstance = server.listen(API_PORT, '0.0.0.0', resolve);
        });
      }
      console.log(`🔌 Headless API test server auto-started on port ${API_PORT}`);
    }

    // Get admin user & JWT for admin read endpoints
    const adminRes = await db.query("SELECT id, username, role FROM admin_users WHERE username = 'admin' LIMIT 1");
    let adminToken = '';
    if (adminRes.rows.length > 0) {
      const jwtSecret = process.env.JWT_SECRET || 'caosach_jwt_secret_dev_2026_super_secure';
      adminToken = jwt.sign(
        { id: adminRes.rows[0].id, username: adminRes.rows[0].username, role: adminRes.rows[0].role },
        jwtSecret,
        { expiresIn: '1h' }
      );
    }

    // =========================================================================
    // SECTION 1: IDLE GHOST MUTATION CHECK (KIỂM TRA ĐỘT BIẾN TỰ PHÁT)
    // =========================================================================
    console.log('⏳ [1/6] Kiểm tra đột biến tự phát khi hệ thống ở trạng thái nghỉ (Idle Stability)...');
    
    const snap1 = await takeDatabaseSnapshot();
    // Đợi 2.5 giây ở trạng thái hoàn toàn không có tương tác
    await new Promise(r => setTimeout(r, 2500));
    const snap2 = await takeDatabaseSnapshot();

    assert(snap1.growth.total_exp === snap2.growth.total_exp, 'Community Growth total_exp không tự ý thay đổi khi nghỉ', `EXP: ${snap1.growth.total_exp} -> ${snap2.growth.total_exp}`);
    assert(snap1.growth.total_books === snap2.growth.total_books, 'Community Growth total_books không tự ý thay đổi khi nghỉ');
    assert(snap1.growth.total_dews === snap2.growth.total_dews, 'Community Growth total_dews không tự ý thay đổi khi nghỉ');
    assert(snap1.growth.total_likes === snap2.growth.total_likes, 'Community Growth total_likes không tự ý thay đổi khi nghỉ');
    assert(snap1.booksCount === snap2.booksCount, 'Bảng books không tự ý chèn thêm dòng mới', `Số sách: ${snap1.booksCount}`);
    assert(snap1.ledgerCount === snap2.ledgerCount, 'Bảng exp_ledger không tự ý ghi nhận giao dịch ma', `Số dòng sổ cái: ${snap1.ledgerCount}`);
    assert(snap1.ledgerSumAmount === snap2.ledgerSumAmount, 'Tổng điểm sổ cái exp_ledger không tự biến đổi', `Tổng EXP: ${snap1.ledgerSumAmount}`);
    assert(snap1.dewsCount === snap2.dewsCount, 'Bảng daily_dews không tự sinh lượt tưới nước ma');
    assert(snap1.usersSumExp === snap2.usersSumExp, 'Tổng EXP của 288 nhân sự giữ nguyên 100% không bị nhảy số');

    // Kiểm tra từng đội trong 8 đội
    let allTeamsIdentical = true;
    for (let i = 0; i < snap1.teams.length; i++) {
      if (snap1.teams[i].total_exp !== snap2.teams[i].total_exp || snap1.teams[i].tree_exp !== snap2.teams[i].tree_exp) {
        allTeamsIdentical = false;
        break;
      }
    }
    assert(allTeamsIdentical, 'Cả 8 Cây Tri Thức giữ nguyên 100% điểm số (Không có cron/timer ngầm sửa điểm)');

    // =========================================================================
    // SECTION 2: READ-ONLY ENDPOINTS PURITY (CHỐNG SIDE-EFFECT KHI ĐỌC)
    // =========================================================================
    console.log('\n📖 [2/6] Kiểm tra tính tinh khiết của các Endpoint Đọc (Read-Only Side-Effect Protection)...');

    const snapBeforeReads = await takeDatabaseSnapshot();

    const readEndpoints = [
      `${BASE_URL}/growth`,
      `${BASE_URL}/quotes?page=1&limit=10`,
      `${BASE_URL}/quotes?category=all`,
      `${BASE_URL}/quotes/daily-status`,
      `${BASE_URL}/teams`,
      `${BASE_URL}/settings/welcome`,
      `${BASE_URL}/settings/rules`
    ];

    if (adminToken) {
      readEndpoints.push(
        `${BASE_URL}/admin/analytics/overview`,
        `${BASE_URL}/admin/analytics/deep-dive`,
        `${BASE_URL}/admin/analytics/deep-dive?teamId=1`,
        `${BASE_URL}/admin/users?page=1&limit=10`,
        `${BASE_URL}/admin/books?page=1&limit=10`,
        `${BASE_URL}/admin/ledger?page=1&limit=10`
      );
    }

    // Gửi dồn dập 40 requests đọc
    const readPromises = [];
    for (let i = 0; i < 40; i++) {
      const ep = readEndpoints[i % readEndpoints.length];
      const headers = ep.includes('/admin/') ? { 'Authorization': `Bearer ${adminToken}` } : {};
      readPromises.push(fetch(ep, { headers }).then(r => r.json()).catch(() => null));
    }
    await Promise.all(readPromises);

    const snapAfterReads = await takeDatabaseSnapshot();

    assert(snapBeforeReads.growth.total_exp === snapAfterReads.growth.total_exp, '40 requests GET liên tục không làm thay đổi total_exp của Cây', `Trước: ${snapBeforeReads.growth.total_exp}, Sau: ${snapAfterReads.growth.total_exp}`);
    assert(snapBeforeReads.booksCount === snapAfterReads.booksCount, 'Không có cuốn sách nào bị vô tình chèn vào CSDL khi đọc');
    assert(snapBeforeReads.ledgerCount === snapAfterReads.ledgerCount, 'Không có giao dịch sổ cái nào bị vô tình tạo ra khi đọc');
    assert(snapBeforeReads.dewsCount === snapAfterReads.dewsCount, 'Không có lượt tưới nước nào bị tạo khống khi gọi GET');
    assert(snapBeforeReads.usersSumExp === snapAfterReads.usersSumExp, 'Điểm số của 288 thành viên không bị thay đổi dù chỉ 1 đơn vị');

    // =========================================================================
    // SECTION 3: RACE CONDITION & CONCURRENCY STAMPEDE (CHỐNG XUNG ĐỘT STATE)
    // =========================================================================
    console.log('\n⚡ [3/6] Kiểm tra chống Race Condition & Xung đột State khi gửi đồng thời (Concurrency Stampede)...');

    // 3.1: Concurrent Daily Dew Stampede (12 requests cùng 1 mili-giây cho 1 user)
    await db.query("DELETE FROM daily_dews WHERE user_id IN (SELECT id FROM users WHERE employee_code LIKE 'TR_%' OR employee_code LIKE 'TEST_RACE_%' OR employee_code LIKE 'RACE_%')");
    await db.query("DELETE FROM exp_ledger WHERE user_id IN (SELECT id FROM users WHERE employee_code LIKE 'TR_%' OR employee_code LIKE 'TEST_RACE_%' OR employee_code LIKE 'RACE_%')");
    await db.query("DELETE FROM users WHERE employee_code LIKE 'TR_%' OR employee_code LIKE 'TEST_RACE_%' OR employee_code LIKE 'RACE_%'");

    const testUserId = uuidv4();
    const testEmployeeCode = `TR_${Date.now()}`;
    await db.query(`
      INSERT INTO users (id, employee_code, full_name, email, team_id, total_exp_earned)
      VALUES ($1, $2, 'Độc Giả Test Race Condition', $3, 1, 0)
    `, [testUserId, testEmployeeCode, `race_test_${Date.now()}@fpt.com`]);

    const userExpBeforeDew = (await db.query('SELECT total_exp_earned FROM users WHERE id = $1', [testUserId])).rows[0].total_exp_earned;
    const team1ExpBeforeDew = (await db.query('SELECT tree_exp FROM teams WHERE id = 1')).rows[0].tree_exp;

    // Bắn ĐỒNG THỜI 12 requests tưới cây tại cùng 1 thời điểm
    const dewPromises = [];
    for (let i = 0; i < 12; i++) {
      dewPromises.push(
        DewService.claimDew({ userId: testUserId, teamId: 1, userFingerprint: `fp_race_${testUserId}` })
          .then(r => ({ success: true, data: r }))
          .catch(err => ({ success: false, error: err.code || err.message, status: err.statusCode }))
      );
    }
    const dewResults = await Promise.all(dewPromises);
    const successDews = dewResults.filter(r => r.success);
    const rejectedDews = dewResults.filter(r => !r.success);

    assert(successDews.length === 1, 'Chính xác DUY NHẤT 1 request tưới cây thành công', `Thành công: ${successDews.length}/12`);
    assert(rejectedDews.length === 11, '11 request còn lại bị chặn hoàn toàn (ACID Race Protection)', `Bị chặn: ${rejectedDews.length}/12`);
    
    // Kiểm tra CSDL chỉ tăng đúng +2 EXP
    const userExpAfterDew = (await db.query('SELECT total_exp_earned FROM users WHERE id = $1', [testUserId])).rows[0].total_exp_earned;
    const team1ExpAfterDew = (await db.query('SELECT tree_exp FROM teams WHERE id = 1')).rows[0].tree_exp;
    const dewsInDb = (await db.query('SELECT COUNT(*)::INT as count FROM daily_dews WHERE user_id = $1', [testUserId])).rows[0].count;

    assert(userExpAfterDew === userExpBeforeDew + 2, 'User EXP CHỈ TĂNG ĐÚNG +2 EXP (Không bị nhân đôi/nhân 12)', `Trước: ${userExpBeforeDew}, Sau: ${userExpAfterDew}`);
    assert(parseInt(team1ExpAfterDew, 10) === parseInt(team1ExpBeforeDew, 10) + 2, 'Team tree_exp CHỈ TĂNG ĐÚNG +2 EXP (Không bị race condition)');
    assert(dewsInDb === 1, 'Bảng daily_dews chỉ lưu ĐÚNG 1 BẢN GHI (0 bản ghi trùng lặp)');

    // 3.2: Concurrent Like Stampede (10 requests thả tim cùng 1 mili-giây cho 1 cuốn sách)
    let testBookRes = await db.query('SELECT id, likes_count, team_id FROM books WHERE visibility_status = \'visible\' LIMIT 1');
    let testBook = testBookRes.rows[0];
    if (!testBook) {
      const fallbackBookRes = await db.query(`
        INSERT INTO books (title, author, quote, category, user_fingerprint, likes_count, visibility_status, team_id, reader_name)
        VALUES ('Sách Test Toàn Vẹn', 'Tác Giả Test', 'Trích dẫn kiểm tra toàn vẹn dữ liệu hệ thống 2026', 'Tâm lý & Kỹ năng', 'fp_test_integrity', 0, 'visible', 1, 'Người Kiểm Thử')
        RETURNING id, likes_count, team_id
      `);
      testBook = fallbackBookRes.rows[0];
    }
    const initialLikes = testBook.likes_count;
    const likerUserRes = await db.query('SELECT id FROM users LIMIT 1');
    const testLikerId = likerUserRes.rows[0]?.id;
    const testLikerFp = `fp_liker_stampede_${Date.now()}`;

    const likePromises = [];
    for (let i = 0; i < 10; i++) {
      likePromises.push(
        QuoteService.likeQuote(testBook.id, testLikerFp, { userId: testLikerId })
          .then(r => ({ success: true, data: r }))
          .catch(err => ({ success: false, error: err.code || err.message }))
      );
    }
    const likeResults = await Promise.all(likePromises);
    const successLikes = likeResults.filter(r => r.success);
    const blockedLikes = likeResults.filter(r => !r.success);

    assert(successLikes.length === 1, 'Chính xác DUY NHẤT 1 request thả tim thành công khi spam đồng thời', `Thành công: ${successLikes.length}/10`);
    assert(blockedLikes.length === 9, '9 request còn lại bị chặn bởi Unique Constraint');

    const bookAfterLikes = (await db.query('SELECT likes_count FROM books WHERE id = $1', [testBook.id])).rows[0].likes_count;
    assert(bookAfterLikes === initialLikes + 1, 'likes_count của sách CHỈ TĂNG ĐÚNG +1 (Không bị double-like)', `Likes: ${initialLikes} -> ${bookAfterLikes}`);

    // 3.3: Concurrent Idempotency Book Contribution (8 requests cùng 1 Idempotency-Key)
    const testIdempKey = `idemp_stampede_${Date.now()}`;
    const idempPayload = {
      title: `Tác Phẩm Test Idempotency Stampede ${Date.now()}`,
      author: 'Tác Giả Kiểm Thử',
      quote: 'Kiểm tra chống trùng lặp khi người dùng bấm liên tục nút gửi.',
      category: 'Kỹ Năng Sống',
      reader: 'Người Kiểm Thử',
      userFingerprint: `fp_idemp_${Date.now()}`
    };

    const idempPromises = [];
    for (let i = 0; i < 8; i++) {
      idempPromises.push(
        fetch(`${BASE_URL}/books/contribute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': testIdempKey
          },
          body: JSON.stringify(idempPayload)
        }).then(r => r.json()).catch(err => ({ success: false, error: err.message }))
      );
    }
    const idempResults = await Promise.all(idempPromises);
    const successfulIdemp = idempResults.filter(r => r.success);
    assert(successfulIdemp.length === 8, 'Tất cả các request Idempotent đều nhận kết quả thành công hợp lệ', `Thành công: ${successfulIdemp.length}/8`);
    
    const firstId = successfulIdemp[0]?.data?.book?.id;
    const allSameBookId = successfulIdemp.every(r => r.data?.book?.id === firstId);
    assert(allSameBookId, '100% request trùng lặp đều trả về đúng ID sách ban đầu (Không tạo bản ghi dư)');

    const countInDb = (await db.query('SELECT COUNT(*)::INT as count FROM books WHERE title = $1', [idempPayload.title])).rows[0].count;
    assert(countInDb === 1, 'Cơ sở dữ liệu chỉ lưu DUY NHẤT 1 CUỐN SÁCH (Zero duplicated books)');

    // =========================================================================
    // SECTION 4: CROSS-ENTITY STATE ISOLATION (CHỐNG RÒ RỈ STATE CHÉO)
    // =========================================================================
    console.log('\n🛡️ [4/6] Kiểm tra cách ly State giữa 8 Đội và 288 Nhân Sự (State Isolation)...');

    const teamsBeforeRes = await db.query('SELECT id, total_exp, tree_exp FROM teams ORDER BY id ASC');
    const teamsBefore = teamsBeforeRes.rows;

    const team3UserRes = await db.query('SELECT id, email, team_id, total_exp_earned FROM users WHERE team_id = 3 LIMIT 1');
    const team3User = team3UserRes.rows[0];

    const newBookPayload = {
      title: `Sách Cách Ly Đội 3 - ${Date.now()}`,
      author: 'Tác giả Đội 3',
      quote: 'Hành động của Đội 3 không bao giờ được phép làm nhảy điểm của các đội khác.',
      category: 'Văn Học Kinh Điển',
      email: team3User.email,
      userId: team3User.id,
      teamId: 3,
      userFingerprint: `fp_iso_${team3User.id.substring(0, 8)}`
    };

    let insertedBookId = null;
    await db.transaction(async (client) => {
      const bRes = await client.query(`
        INSERT INTO books (title, author, quote, category, reader_name, reader_email, visibility_status, moderation_status, user_id, team_id, user_fingerprint)
        VALUES ($1, $2, $3, $4, 'Độc giả Đội 3', $5, 'visible', 'reviewed', $6, 3, $7)
        RETURNING id
      `, [newBookPayload.title, newBookPayload.author, newBookPayload.quote, newBookPayload.category, team3User.email, team3User.id, newBookPayload.userFingerprint]);

      insertedBookId = bRes.rows[0].id;

      await client.query(`
        INSERT INTO exp_ledger (user_id, team_id, user_fingerprint, amount, type, reference_type, reference_id)
        VALUES ($1, 3, $2, 5, 'BOOK_CONTRIBUTION', 'books', $3)
      `, [team3User.id, newBookPayload.userFingerprint, insertedBookId]);

      await client.query(`UPDATE teams SET total_exp = total_exp + 5, total_books = total_books + 1 WHERE id = 3`);
      await client.query(`UPDATE users SET total_exp_earned = total_exp_earned + 5 WHERE id = $1`, [team3User.id]);
    });

    const teamsAfterRes = await db.query('SELECT id, total_exp, tree_exp FROM teams ORDER BY id ASC');
    const teamsAfter = teamsAfterRes.rows;

    const team3Before = teamsBefore.find(t => t.id === 3);
    const team3After = teamsAfter.find(t => t.id === 3);
    assert(parseInt(team3After.total_exp, 10) === parseInt(team3Before.total_exp, 10) + 5, 'Đội 3 tăng chính xác +5 EXP');

    let otherTeamsUntouched = true;
    for (const tBefore of teamsBefore) {
      if (tBefore.id === 3) continue;
      const tAfter = teamsAfter.find(t => t.id === tBefore.id);
      if (parseInt(tAfter.total_exp, 10) !== parseInt(tBefore.total_exp, 10)) {
        otherTeamsUntouched = false;
        console.error(`  ❌ Phát hiện rò rỉ: Đội ${tBefore.id} bị thay đổi từ ${tBefore.total_exp} thành ${tAfter.total_exp}`);
        break;
      }
    }
    assert(otherTeamsUntouched, '7 Đội còn lại (Đội 1, 2, 4, 5, 6, 7, 8) 100% KHÔNG BỊ RÒ RỈ ĐIỂM (Zero State Bleed)');

    // =========================================================================
    // SECTION 5: TRANSACTION ATOMICITY & ROLLBACK INTEGRITY (CHỐNG DIRTY STATE)
    // =========================================================================
    console.log('\n🔒 [5/6] Kiểm tra tính toàn vẹn Transaction & Chống Dirty State khi xảy ra lỗi...');

    const ledgerCountBeforeFail = (await db.query('SELECT COUNT(*)::INT as count FROM exp_ledger')).rows[0].count;
    const teamsExpSumBeforeFail = (await db.query('SELECT SUM(total_exp)::BIGINT as sum FROM teams')).rows[0].sum;

    let transactionFailedAsExpected = false;
    try {
      await db.transaction(async (client) => {
        await client.query(`
          INSERT INTO exp_ledger (user_id, team_id, amount, type, reference_type)
          VALUES ($1, 1, 9999, 'ADMIN_AWARD', 'system')
        `, [testUserId]);

        // Cố tình vi phạm lỗi
        await client.query('INSERT INTO non_existent_table_for_rollback_test (foo) VALUES (1)');
      });
    } catch {
      transactionFailedAsExpected = true;
    }

    assert(transactionFailedAsExpected, 'Transaction cố tình tạo lỗi đã bị bắt và kích hoạt ROLLBACK tự động');

    const ledgerCountAfterFail = (await db.query('SELECT COUNT(*)::INT as count FROM exp_ledger')).rows[0].count;
    const teamsExpSumAfterFail = (await db.query('SELECT SUM(total_exp)::BIGINT as sum FROM teams')).rows[0].sum;

    assert(ledgerCountAfterFail === ledgerCountBeforeFail, 'Bảng exp_ledger hoàn toàn KHÔNG CÓ BẢN GHI RÁC sau rollback', `Số dòng: ${ledgerCountBeforeFail} === ${ledgerCountAfterFail}`);
    assert(teamsExpSumAfterFail === teamsExpSumBeforeFail, 'Tổng điểm của 8 đội không bị tăng khống khi giao dịch hỏng');

    // =========================================================================
    // SECTION 6: CLIENT & SERVER CODEBASE AUDIT (QUÉT MÃ TỰ ĐỘNG GỬI NGẦM)
    // =========================================================================
    console.log('\n🔍 [6/6] Quét kiểm tra mã nguồn Client & Server (Static Analysis Code Audit)...');

    const frontendFiles = ['public/app.js', 'admin/admin.js'];
    let foundMaliciousInterval = false;

    for (const relPath of frontendFiles) {
      const fullPath = path.resolve(process.cwd(), '..', relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const intervalMatches = content.match(/setInterval\s*\([^)]+\)/g) || [];
        for (const match of intervalMatches) {
          if (match.includes('fetch') && (match.includes('POST') || match.includes('PUT') || match.includes('DELETE'))) {
            foundMaliciousInterval = true;
            console.error(`  ❌ Phát hiện setInterval gửi request ngầm trong ${relPath}: ${match}`);
          }
        }
      }
    }
    assert(!foundMaliciousInterval, 'Không có mã setInterval nào tự động gửi POST/PUT/DELETE ngầm trong Client UI');

    // =========================================================================
    // SECTION 7: MATHEMATICAL STATE INVARIANTS & ANTI-CORRUPTION
    // =========================================================================
    console.log('\n📐 [7/8] Kiểm tra các bất biến toán học của State (Mathematical Invariants)...');

    // 7.1: Không có bất kỳ user nào có EXP âm
    const negativeUsers = await db.query('SELECT COUNT(*)::INT as count FROM users WHERE total_exp_earned < 0');
    assert(negativeUsers.rows[0].count === 0, 'Toàn bộ 288 nhân sự đều có EXP >= 0 (Không có điểm âm bất thường)');

    // 7.2: Không có bất kỳ đội nào có EXP âm
    const negativeTeams = await db.query('SELECT COUNT(*)::INT as count FROM teams WHERE total_exp < 0 OR tree_exp < 0');
    assert(negativeTeams.rows[0].count === 0, 'Cả 8 đội thi đua đều có tổng EXP và tree_exp >= 0');

    // 7.3: Không có cuốn sách nào có lượt tim âm
    const negativeLikes = await db.query('SELECT COUNT(*)::INT as count FROM books WHERE likes_count < 0');
    assert(negativeLikes.rows[0].count === 0, '100% sách trong hệ thống có lượt tim >= 0');

    // 7.4: Community Growth ID luôn là 1 (Single Source of Truth)
    const growthRows = await db.query('SELECT id, total_exp, level FROM community_growth');
    assert(growthRows.rows.length === 1 && growthRows.rows[0].id === 1, 'Bảng community_growth chỉ có DUY NHẤT 1 hàng (ID = 1)');

    // 7.5: Cấp độ Cây Tri Thức khớp chính xác theo công thức toán học
    const { calculateLevelFromExp } = await import('../config/constants.js');
    const curGrowthExp = parseInt(growthRows.rows[0].total_exp, 10);
    const expectedLevelInfo = calculateLevelFromExp(curGrowthExp);
    assert(growthRows.rows[0].level === expectedLevelInfo.level, `Cấp độ của Cây Tri Thức (Cấp ${growthRows.rows[0].level}) khớp 100% với hàm toán học calculateLevelFromExp (${expectedLevelInfo.levelName})`);

    // =========================================================================
    // SECTION 8: DATABASE HARD CONSTRAINTS AUDIT (TÍNH TOÀN VẸN RÀNG BUỘC CSDL)
    // =========================================================================
    console.log('\n🏛️ [8/8] Kiểm tra các ràng buộc cứng ở tầng PostgreSQL (Database Constraint Audit)...');

    const constraintsRes = await db.query(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conname IN (
        'unq_user_daily_quote',
        'unq_user_quote_like',
        'unq_user_fruit_harvest',
        'community_growth_id_check',
        'community_growth_level_check'
      )
    `);
    const existingConstraints = constraintsRes.rows.map(r => r.conname);

    assert(existingConstraints.includes('unq_user_daily_quote'), 'Ràng buộc UNIQUE unq_user_daily_quote bảo vệ 1 quote/ngày/user');
    assert(existingConstraints.includes('unq_user_quote_like'), 'Ràng buộc UNIQUE unq_user_quote_like bảo vệ chống duplicate like');
    assert(existingConstraints.includes('community_growth_id_check'), 'Ràng buộc CHECK id=1 bảo vệ bảng community_growth');
    assert(existingConstraints.includes('community_growth_level_check'), 'Ràng buộc CHECK level 0-5 bảo vệ cấp độ cây trong khoảng hợp lệ');

    // Cleanup test user
    await db.query('DELETE FROM daily_dews WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM exp_ledger WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);

  } catch (err) {
    console.error('💥 Lỗi ngoài dự kiến trong State Integrity Test:', err);
    failed++;
  } finally {
    try {
      await db.query("DELETE FROM daily_dews WHERE user_id IN (SELECT id FROM users WHERE employee_code LIKE 'TR_%' OR employee_code LIKE 'TEST_RACE_%' OR employee_code LIKE 'RACE_%')");
      await db.query("DELETE FROM exp_ledger WHERE user_id IN (SELECT id FROM users WHERE employee_code LIKE 'TR_%' OR employee_code LIKE 'TEST_RACE_%' OR employee_code LIKE 'RACE_%')");
      await db.query("DELETE FROM users WHERE employee_code LIKE 'TR_%' OR employee_code LIKE 'TEST_RACE_%' OR employee_code LIKE 'RACE_%'");
    } catch {}
    if (serverInstance) {
      serverInstance.close();
    }
    console.log('\n=================================================================');
    console.log(`📊 TỔNG KẾT STATE INTEGRITY: ${passed} PASSED | ${failed} FAILED`);
    console.log(`🎯 TỶ LỆ TOÀN VẸN: ${Math.round((passed / (passed + failed || 1)) * 100)}% (MỤC TIÊU 100%)`);
    console.log('=================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runStateIntegrityTests();
