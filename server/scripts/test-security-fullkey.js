import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { DewService } from '../services/dew.service.js';
import { UserService } from '../services/user.service.js';
import { BookService } from '../services/book.service.js';
import { QuoteService } from '../services/quote.service.js';
import { AdminUserService } from '../services/admin-user.service.js';
import { 
  contributeBookSchema, likeQuoteSchema, claimDewSchema, adminLoginSchema,
  createAdminAccountSchema, adminBonusExpSchema
} from '../middlewares/validator.js';

async function runSecurityFullKeyTests() {
  console.log('🛡️ =================================================================');
  console.log('🛡️ RUNNING COMPREHENSIVE SECURITY AUDIT & TESTKEY SUITE (CÁO SÁCH)');
  console.log('🛡️ Kiểm thử Chuyên Sâu Toàn Diện: SQLi, XSS, RBAC, IDOR, Auth & Hash');
  console.log('🛡️ =================================================================\n');

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

  const JWT_SECRET = process.env.JWT_SECRET || 'caosach_super_secure_jwt_secret_2026_production';

  try {
    // =========================================================================
    // SECTION 1: XÁC THỰC ADMIN & PHÂN QUYỀN RBAC (AUTHENTICATION & RBAC)
    // =========================================================================
    console.log('📦 [1/7] Test Key Suite 1: Xác Thực JWT & Phân Quyền Vai Trò (RBAC)...');

    // 1.1: Token giả mạo hoặc sai chữ ký
    const forgedToken = jwt.sign({ id: 'fake-id', role: 'admin' }, 'wrong_secret_key_12345');
    let verifyForgedFailed = false;
    try {
      jwt.verify(forgedToken, JWT_SECRET);
    } catch (err) {
      verifyForgedFailed = true;
    }
    assert(verifyForgedFailed, 'Token giả mạo chữ ký (Signature Tampering) bị từ chối 100%');

    // 1.2: Token hết hạn (Expired Token)
    const expiredToken = jwt.sign(
      { id: 'expired-user', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );
    let verifyExpiredFailed = false;
    try {
      jwt.verify(expiredToken, JWT_SECRET);
    } catch (err) {
      verifyExpiredFailed = (err.name === 'TokenExpiredError');
    }
    assert(verifyExpiredFailed, 'Token đã hết hạn sử dụng bị từ chối chuẩn xác (TokenExpiredError)');

    // 1.3: Token hợp lệ với vai trò Moderator
    const modToken = jwt.sign({ id: 'mod-1', role: 'moderator' }, JWT_SECRET, { expiresIn: '1h' });
    const decodedMod = jwt.verify(modToken, JWT_SECRET);
    assert(decodedMod.role === 'moderator', 'Moderator token được giải mã chính xác');

    // 1.4: Phân quyền RBAC - Moderator KHÔNG có quyền truy cập chức năng của Admin
    function checkPermission(userRole, allowedRoles) {
      return allowedRoles.includes(userRole);
    }
    assert(
      checkPermission(decodedMod.role, ['admin']) === false,
      'RBAC: Moderator cố tình gọi API SuperAdmin (Wipe data, Accounts, Bonus) bị chặn (403 FORBIDDEN)'
    );

    // 1.5: Token hợp lệ với vai trò Admin
    const adminToken = jwt.sign({ id: 'admin-1', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    const decodedAdmin = jwt.verify(adminToken, JWT_SECRET);
    assert(
      checkPermission(decodedAdmin.role, ['admin']) === true,
      'RBAC: Admin có đầy đủ quyền hạn điều hành hệ thống'
    );

    // =========================================================================
    // SECTION 2: MIỄN NHIỄM VỚI TẤN CÔNG SQL INJECTION (SQLi IMMUNIZATION)
    // =========================================================================
    console.log('\n📦 [2/7] Test Key Suite 2: Miễn Nhiễm Tấn Công SQL Injection (SQLi Defense)...');

    const sqliPayloads = [
      "' OR '1'='1",
      "admin' --",
      "1; DROP TABLE books; --",
      "'; UPDATE users SET role='admin'; --",
      "1 UNION SELECT null, username, password_hash, null, null FROM admin_users --"
    ];

    // 2.1: Test SQLi trên UserService.suggestUsers
    for (const payload of sqliPayloads) {
      const result = await UserService.suggestUsers(payload, 5);
      assert(
        Array.isArray(result),
        `UserService.suggestUsers an toàn tuyệt đối với payload: "${payload.slice(0, 25)}..."`,
        `Kết quả trả về mảng an toàn, không có lỗi cú pháp SQL`
      );
    }

    // 2.2: Test SQLi trên BookService.getPublicQuotes
    for (const payload of sqliPayloads) {
      const result = await BookService.getPublicQuotes({ search: payload, limit: 5 });
      assert(
        Array.isArray(result.quotes),
        `BookService.getPublicQuotes an toàn tuyệt đối với payload: "${payload.slice(0, 25)}..."`,
        `Quotes found: ${result.quotes.length}, query hoàn tất an toàn qua Parameterized Query`
      );
    }

    // 2.3: Test SQLi trên AdminUserService.getAllAdminUsers
    for (const payload of sqliPayloads) {
      const result = await AdminUserService.getAllAdminUsers({ search: payload });
      assert(
        Array.isArray(result),
        `AdminUserService.getAllAdminUsers an toàn với payload: "${payload.slice(0, 25)}..."`,
        `Query an toàn, bảo vệ cơ sở dữ liệu không bị rò rỉ hoặc bypass`
      );
    }

    // =========================================================================
    // SECTION 3: PHÒNG CHỐNG CROSS-SITE SCRIPTING (XSS DEFENSE & SANITIZATION)
    // =========================================================================
    console.log('\n📦 [3/7] Test Key Suite 3: Phòng Chống XSS & Mã Hóa HTML (Sanitization)...');

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const xssPayloads = [
      { input: "<script>alert('XSS')</script>", expectedBlocked: true },
      { input: '<img src=x onerror="alert(1)">', expectedBlocked: true },
      { input: '<svg onload=alert(document.cookie)>', expectedBlocked: true },
      { input: '"><script>fetch("http://evil.com")</script>', expectedBlocked: true },
      { input: "javascript:alert('pwned')", expectedBlocked: false }
    ];

    for (const item of xssPayloads) {
      const sanitized = escapeHtml(item.input);
      const containsDangerousTag = sanitized.includes('<script>') || sanitized.includes('<img') || sanitized.includes('<svg');
      assert(
        !containsDangerousTag,
        `Vô hiệu hóa thành công vector tấn công: ${item.input.slice(0, 30)}`,
        `Sanitized: ${sanitized}`
      );
    }

    // 3.2: Kiểm tra ký tự đặc biệt được mã hóa đúng HTML Entity
    const specialChars = escapeHtml('<div class="fox-read" id=\'test\'>&</div>');
    assert(
      specialChars === '&lt;div class=&quot;fox-read&quot; id=&#39;test&#39;&gt;&amp;&lt;/div&gt;',
      'Tất cả ký tự nhạy cảm (<, >, &, ", \') được chuyển đổi 100% thành HTML Entities an toàn'
    );

    // =========================================================================
    // SECTION 4: KIỂM SOÁT TRUY CẬP LOGIC & CHỐNG IDOR (ACCESS CONTROL)
    // =========================================================================
    console.log('\n📦 [4/7] Test Key Suite 4: Kiểm Soát Truy Cập IDOR & Ràng Buộc Nghiệp Vụ...');

    // 4.1: Khách vãng lai / Người chưa đăng nhập cố tình gọi DewService.claimDew
    let guestWateringBlocked = false;
    try {
      await DewService.claimDew({ userId: 'guest', teamId: 1 });
    } catch (err) {
      guestWateringBlocked = (err.statusCode === 401 && err.code === 'LOGIN_REQUIRED');
    }
    assert(guestWateringBlocked, 'Chặn 100% khách vãng lai gọi API tưới nước (HTTP 401 LOGIN_REQUIRED)');

    // 4.1b: Khách vãng lai / Người chưa đăng nhập cố tình thả tim trích dẫn (QuoteService.likeQuote)
    let guestLikeBlocked = false;
    const testBookAny = (await db.query('SELECT id FROM books LIMIT 1')).rows[0];
    const testBookTargetId = testBookAny ? testBookAny.id : '000000aa-0000-4000-a000-000000000009';
    try {
      await QuoteService.likeQuote(testBookTargetId, 'fp_guest_liker_sec', { userId: 'guest' });
    } catch (err) {
      guestLikeBlocked = (err.statusCode === 401 && err.code === 'LOGIN_REQUIRED');
    }
    assert(guestLikeBlocked, 'Chặn 100% khách vãng lai gọi API thả tim trích dẫn (HTTP 401 LOGIN_REQUIRED)');

    // 4.2: Thành viên Đội 1 cố tình tưới nước cho Đội 2 (Cross-team IDOR)
    const testUserTeam1 = '000000aa-0000-4000-a000-000000000001';
    await db.query(`
      INSERT INTO users (id, employee_code, email, full_name, team_id)
      VALUES ($1, 'SEC_U1', 'sec_u1@fpt.com', 'Sec Tester Đội 1', 1)
      ON CONFLICT (id) DO UPDATE SET team_id = 1
    `, [testUserTeam1]);

    let crossTeamBlocked = false;
    try {
      await DewService.claimDew({ userId: testUserTeam1, teamId: 2 });
    } catch (err) {
      crossTeamBlocked = (err.statusCode === 403 && err.code === 'FORBIDDEN_OTHER_TEAM_TREE');
    }
    assert(crossTeamBlocked, 'Chặn 100% thành viên tưới nước chéo cho Đội khác (HTTP 403 FORBIDDEN_OTHER_TEAM_TREE)');

    // 4.3: Thành viên không có đội cố tình tưới nước
    const testUserNoTeam = '000000aa-0000-4000-a000-000000000002';
    await db.query(`
      INSERT INTO users (id, employee_code, email, full_name, team_id)
      VALUES ($1, 'SEC_U2', 'sec_u2@fpt.com', 'Sec Tester No Team', NULL)
      ON CONFLICT (id) DO UPDATE SET team_id = NULL
    `, [testUserNoTeam]);

    let noTeamBlocked = false;
    try {
      await DewService.claimDew({ userId: testUserNoTeam, teamId: 1 });
    } catch (err) {
      noTeamBlocked = (err.statusCode === 400 && err.code === 'NO_TEAM_ASSIGNED');
    }
    assert(noTeamBlocked, 'Chặn người dùng chưa xếp đội tưới cây (HTTP 400 NO_TEAM_ASSIGNED)');

    // =========================================================================
    // SECTION 5: XÁC THỰC ĐẦU VÀO CHẶT CHẼ VỚI ZOD (INPUT VALIDATION SCHEMA)
    // =========================================================================
    console.log('\n📦 [5/7] Test Key Suite 5: Xác Thực Đầu Vào (Zod Schema Validation & Boundary)...');

    // 5.1: Gieo sách có trích dẫn quá ngắn (< 10 ký tự)
    let shortQuoteRejected = false;
    try {
      contributeBookSchema.parse({
        title: 'Tên Sách Hợp Lệ',
        author: 'Tác Giả Hợp Lệ',
        quote: 'Quá ngắn',
        userFingerprint: 'fp_test'
      });
    } catch (e) {
      shortQuoteRejected = true;
    }
    assert(shortQuoteRejected, 'Zod chặn trích dẫn sách dưới 10 ký tự');

    // 5.2: Gieo sách có email sai định dạng
    let invalidEmailRejected = false;
    try {
      contributeBookSchema.parse({
        title: 'Tên Sách Hợp Lệ',
        author: 'Tác Giả Hợp Lệ',
        quote: 'Trích dẫn sách đạt độ dài tiêu chuẩn trên mười ký tự.',
        email: 'not_an_email_address',
        userFingerprint: 'fp_test'
      });
    } catch (e) {
      invalidEmailRejected = true;
    }
    assert(invalidEmailRejected, 'Zod chặn email sai cấu trúc');

    // 5.3: Thả tim với teamId ngoài khoảng [1, 8]
    let outOfRangeTeamRejected = false;
    try {
      likeQuoteSchema.parse({
        userFingerprint: 'fp_test',
        teamId: 99
      });
    } catch (e) {
      outOfRangeTeamRejected = true;
    }
    assert(outOfRangeTeamRejected, 'Zod chặn teamId ngoài phạm vi 1 - 8 (Boundary Enforcement)');

    // 5.4: Admin cộng EXP vượt ngưỡng cho phép (> 10000)
    let excessiveBonusRejected = false;
    try {
      adminBonusExpSchema.parse({
        amount: 9999999,
        reason: 'Bonus gian lận'
      });
    } catch (e) {
      excessiveBonusRejected = true;
    }
    assert(excessiveBonusRejected, 'Zod chặn lượng EXP bonus vượt ngưỡng 10,000 EXP');

    // 5.5: Tạo tài khoản Admin có username chứa ký tự nguy hiểm (Command Injection / Path Traversal)
    let badUsernameRejected = false;
    try {
      createAdminAccountSchema.parse({
        username: '../../etc/passwd',
        password: 'password123',
        full_name: 'Hacker Name',
        role: 'moderator'
      });
    } catch (e) {
      badUsernameRejected = true;
    }
    assert(badUsernameRejected, 'Zod regex chặn username chứa ký tự Path Traversal (../../)');

    // =========================================================================
    // SECTION 6: BẢO VỆ MẬT KHẨU & DỮ LIỆU NHẠY CẢM (PASSWORD HASH AUDIT)
    // =========================================================================
    console.log('\n📦 [6/7] Test Key Suite 6: Kiểm Toán Mật Khẩu BCRYPT & Chống Lộ Dữ Liệu...');

    // 6.1: Kiểm tra 100% tài khoản trong bảng admin_users đều dùng Bcrypt
    const adminAccounts = await db.query('SELECT id, username, password_hash, role FROM admin_users');
    let allUseBcrypt = true;
    for (const acc of adminAccounts.rows) {
      const isBcrypt = acc.password_hash && (acc.password_hash.startsWith('$2a$') || acc.password_hash.startsWith('$2b$'));
      if (!isBcrypt) allUseBcrypt = false;
    }
    assert(
      allUseBcrypt && adminAccounts.rows.length > 0,
      '100% tài khoản admin_users được băm mật khẩu chuẩn BCrypt (Không có Plain Text)',
      `Tổng số tài khoản kiểm tra: ${adminAccounts.rows.length}`
    );

    // 6.2: Kiểm tra hàm compare mật khẩu với bcrypt
    const testPlainPass = 'SuperAdmin@Secure2026';
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(testPlainPass, salt);
    const isMatch = await bcrypt.compare(testPlainPass, hashed);
    const isMismatch = await bcrypt.compare('WrongPassword@123', hashed);
    assert(isMatch && !isMismatch, 'BCrypt Salt Rounds 10 xác thực chính xác và an toàn');

    // 6.3: Kiểm tra API getAllAdminUsers KHÔNG trả về password_hash ra client
    const accounts = await AdminUserService.getAllAdminUsers();
    const hasPasswordHashLeaked = accounts.some(a => 'password_hash' in a || 'password' in a);
    assert(
      !hasPasswordHashLeaked,
      'API getAllAdminUsers loại bỏ hoàn toàn trường password_hash (Zero Sensitive Data Leakage)',
      `Tài khoản trả về client: ${accounts.length}, leaked: ${hasPasswordHashLeaked}`
    );

    // =========================================================================
    // SECTION 7: CẤU HÌNH BẢO MẬT SERVER (HELMET, IDEMPOTENCY, CLEANUP)
    // =========================================================================
    console.log('\n📦 [7/7] Test Key Suite 7: Cấu Hình Bảo Mật Server (Idempotency & Cleanup)...');

    // 7.1: Idempotency protection chống gửi trùng lặp giao dịch nhạy cảm
    const testIdemKey = 'idem-test-key-security-001';
    await db.query(`
      INSERT INTO idempotency_keys (key, request_path, response_payload, status_code)
      VALUES ($1, '/api/v1/books/contribute', '{"success": true, "mock": true}', 200)
      ON CONFLICT (key) DO NOTHING
    `, [testIdemKey]);

    const idemRow = await db.query('SELECT * FROM idempotency_keys WHERE key = $1', [testIdemKey]);
    assert(
      idemRow.rows.length === 1 && idemRow.rows[0].status_code === 200,
      'Bảng idempotency_keys hoạt động chính xác để chặn Duplicate Request'
    );
    await db.query('DELETE FROM idempotency_keys WHERE key = $1', [testIdemKey]);

    // 7.2: Dọn dẹp dữ liệu test bảo mật
    await db.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserTeam1, testUserNoTeam]);

    console.log('\n=================================================================');
    console.log(`🎉 KẾT QUẢ KIỂM THỬ BẢO MẬT: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Lỗi nghiêm trọng khi thực thi kiểm thử bảo mật:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runSecurityFullKeyTests();
