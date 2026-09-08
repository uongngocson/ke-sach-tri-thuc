/**
 * =========================================================================
 * COMPREHENSIVE TEST SUITE: PERSONNEL CRUD (288 NHÂN SỰ) & RBAC SECURITY
 * =========================================================================
 * Full key test coverage for:
 * 1. Zod Validation & Schema Boundary Enforcement
 * 2. Create Personnel (POST /admin/users & UserService.createPersonnel)
 * 3. Duplicate & Conflict Prevention (409 Conflict on code and email)
 * 4. Read & Personnel Detail (GET /admin/users/:id & activity statistics)
 * 5. Update Personnel & Team Transfer (Sync actual_members between teams)
 * 6. Safe Deletion with Cascade and Nullify Cleanups (DELETE /admin/users/:id)
 * 7. Security & RBAC Enforcement (Moderator 403 vs Superadmin 200, 401 Unauthorized)
 * 8. Audit Trail Verification (CREATE_PERSONNEL, UPDATE_PERSONNEL, DELETE_PERSONNEL)
 */

import db from '../config/database.js';
import { UserService } from '../services/user.service.js';
import { createPersonnelSchema, updatePersonnelSchema } from '../middlewares/validator.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    if (detail) console.log(`     ↳ ${detail}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    if (detail) console.error(`     ↳ ${detail}`);
    failed++;
  }
}

async function runPersonnelCrudTests() {
  console.log('\n👥 =================================================================');
  console.log('👥 RUNNING COMPREHENSIVE TEST SUITE: PERSONNEL CRUD (288 NHÂN SỰ)');
  console.log('👥 =================================================================\n');

  try {
    // 0. Setup Superadmin & Moderator actors
    let superAdmin = (await db.query("SELECT * FROM admin_users WHERE username = 'admin' LIMIT 1")).rows[0];
    if (!superAdmin) {
      const hash = await bcrypt.hash('admin123', 10);
      const res = await db.query(`
        INSERT INTO admin_users (username, password_hash, full_name, role, is_active)
        VALUES ('admin', $1, 'Quản Trị Viên Hệ Thống', 'admin', true)
        RETURNING *
      `, [hash]);
      superAdmin = res.rows[0];
    }
    const superAdminActor = { id: superAdmin.id, username: superAdmin.username, role: 'admin' };

    let moderator = (await db.query("SELECT * FROM admin_users WHERE username = 'test_mod_personnel' LIMIT 1")).rows[0];
    if (!moderator) {
      const hash = await bcrypt.hash('mod123', 10);
      const res = await db.query(`
        INSERT INTO admin_users (username, password_hash, full_name, role, is_active)
        VALUES ('test_mod_personnel', $1, 'Điều Phối Viên Test', 'moderator', true)
        RETURNING *
      `, [hash]);
      moderator = res.rows[0];
    }
    const moderatorActor = { id: moderator.id, username: moderator.username, role: 'moderator' };

    // Clean up test personnel if left over from previous runs
    await db.query("DELETE FROM users WHERE employee_code IN ('TEST_PERS_001', 'TEST_PERS_002', 'TEST_PERS_003')");

    // =========================================================================
    // [1/8] TEST SUITE 1: ZOD VALIDATION & BOUNDARY ENFORCEMENT
    // =========================================================================
    console.log('🔍 [1/8] Kiểm tra tính chặt chẽ của Validation (Zod Schemas)...');

    // 1.1 Invalid employee_code (special characters)
    let invalidCodeCaught = false;
    try {
      createPersonnelSchema.parse({
        employee_code: 'NV#001!',
        email: 'test@fpt.com',
        full_name: 'Test Name',
        team_id: 1
      });
    } catch (e) {
      invalidCodeCaught = true;
    }
    assert(invalidCodeCaught, 'Chặn đứng mã cán bộ chứa ký tự đặc biệt không hợp lệ (NV#001!)');

    // 1.2 Invalid email format
    let invalidEmailCaught = false;
    try {
      createPersonnelSchema.parse({
        employee_code: 'NV001',
        email: 'invalid-email-format',
        full_name: 'Test Name',
        team_id: 1
      });
    } catch (e) {
      invalidEmailCaught = true;
    }
    assert(invalidEmailCaught, 'Chặn đứng email không đúng định dạng RFC (invalid-email-format)');

    // 1.3 Invalid team_id (< 1 or > 8)
    let invalidTeamCaught = false;
    try {
      createPersonnelSchema.parse({
        employee_code: 'NV001',
        email: 'test@fpt.com',
        full_name: 'Test Name',
        team_id: 9
      });
    } catch (e) {
      invalidTeamCaught = true;
    }
    assert(invalidTeamCaught, 'Chặn đứng Đội thi đua nằm ngoài khoảng 1-8 (team_id: 9)');

    // 1.4 Short full_name (< 2 chars)
    let shortNameCaught = false;
    try {
      createPersonnelSchema.parse({
        employee_code: 'NV001',
        email: 'test@fpt.com',
        full_name: 'A',
        team_id: 1
      });
    } catch (e) {
      shortNameCaught = true;
    }
    assert(shortNameCaught, 'Chặn đứng Họ và tên quá ngắn (< 2 ký tự)');

    // 1.5 Valid data passes cleanly
    const validParsed = createPersonnelSchema.parse({
      employee_code: 'TEST_PERS_001',
      email: 'pers001@fpt.com',
      full_name: 'Nguyễn Văn Test 1',
      nickname: 'Bình Minh #001',
      team_id: 1,
      gender: 'Nam',
      branch: 'FTELSCU',
      parent_department: 'FTP',
      child_department_1: 'Đối tác',
      job_title: 'Kỹ sư phần mềm'
    });
    assert(validParsed.employee_code === 'TEST_PERS_001' && validParsed.team_id === 1,
      'Dữ liệu hợp lệ vượt qua Zod validation hoàn hảo 100%');

    // =========================================================================
    // [2/8] TEST SUITE 2: THÊM NHÂN SỰ MỚI (CREATE PERSONEL)
    // =========================================================================
    console.log('\n➕ [2/8] Kiểm tra tạo mới nhân sự (UserService.createPersonnel)...');

    const team1BeforeRes = await db.query('SELECT actual_members FROM teams WHERE id = 1');
    const team1CountBefore = parseInt(team1BeforeRes.rows[0]?.actual_members || 0, 10);

    const createdPersonnel1 = await UserService.createPersonnel({
      employee_code: 'TEST_PERS_001',
      email: 'pers001@fpt.com',
      full_name: 'Nguyễn Văn Test 1',
      nickname: 'Bình Minh #001',
      team_id: 1,
      gender: 'Nam',
      branch: 'FTELSCU',
      parent_department: 'FTP',
      child_department_1: 'Đối tác',
      job_title: 'Kỹ sư phần mềm'
    }, superAdminActor, '127.0.0.1');

    assert(createdPersonnel1 && createdPersonnel1.id, 'Tạo nhân sự thành công, nhận UUID hợp lệ', `ID: ${createdPersonnel1.id}`);
    assert(createdPersonnel1.employee_code === 'TEST_PERS_001', 'Mã cán bộ lưu trữ chính xác', createdPersonnel1.employee_code);
    assert(createdPersonnel1.email === 'pers001@fpt.com', 'Email chuẩn hóa chữ thường thành công', createdPersonnel1.email);
    assert(createdPersonnel1.team_display_name !== undefined, 'Đính kèm thông tin đội thi đua', createdPersonnel1.team_display_name);

    // Verify team 1 actual_members count incremented
    const team1AfterRes = await db.query('SELECT actual_members FROM teams WHERE id = 1');
    const team1CountAfter = parseInt(team1AfterRes.rows[0]?.actual_members || 0, 10);
    assert(team1CountAfter === team1CountBefore + 1,
      'Sĩ số đội thi đua Team 1 tự động tăng chính xác (+1)',
      `${team1CountBefore} -> ${team1CountAfter}`);

    // 2.2 Tạo nhân sự chỉ bằng Bút danh và Đội thi đua (ẩn thông tin nhạy cảm)
    const anonymousPersonnel = await UserService.createPersonnel({
      nickname: 'Độc Giả Tri Thức #999',
      team_id: 2
    }, superAdminActor, '127.0.0.1');

    assert(anonymousPersonnel && anonymousPersonnel.id, 'Tạo độc giả chỉ với Bút danh & Đội thành công');
    assert(anonymousPersonnel.nickname === 'Độc Giả Tri Thức #999', 'Bút danh lưu trữ chính xác 100%');
    assert(anonymousPersonnel.employee_code.startsWith('BD_'), 'Tự động cấp mã nội bộ an toàn (BD_XXXX)');
    assert(anonymousPersonnel.email.includes('@fpt.com'), 'Tự động tạo email giả lập hợp lệ');
    assert(anonymousPersonnel.full_name === 'Độc Giả Tri Thức #999', 'Tự động đồng bộ full_name bằng Bút danh');

    // Dọn dẹp anonymousPersonnel
    await db.query('DELETE FROM users WHERE id = $1', [anonymousPersonnel.id]);
    await db.query('UPDATE teams SET actual_members = (SELECT COUNT(*) FROM users WHERE team_id = 2) WHERE id = 2');

    // =========================================================================
    // [3/8] TEST SUITE 3: CHỐNG TRÙNG LẶP DỮ LIỆU (409 CONFLICT)
    // =========================================================================
    console.log('\n🚫 [3/8] Kiểm tra chống trùng lặp mã cán bộ & email (409 Conflict)...');

    // 3.1 Trùng mã cán bộ
    let dupCodeBlocked = false;
    try {
      await UserService.createPersonnel({
        employee_code: 'TEST_PERS_001', // Duplicate
        email: 'other_email@fpt.com',
        full_name: 'Trùng Mã',
        team_id: 2
      }, superAdminActor);
    } catch (err) {
      if (err.statusCode === 409 && err.code === 'PERSONNEL_ALREADY_EXISTS') {
        dupCodeBlocked = true;
      }
    }
    assert(dupCodeBlocked, 'Chặn đứng hành vi tạo nhân sự trùng Mã cán bộ (409 Conflict)');

    // 3.2 Trùng email (case-insensitive)
    let dupEmailBlocked = false;
    try {
      await UserService.createPersonnel({
        employee_code: 'TEST_PERS_OTHER',
        email: 'PERS001@FPT.COM', // Duplicate (uppercase)
        full_name: 'Trùng Email',
        team_id: 3
      }, superAdminActor);
    } catch (err) {
      if (err.statusCode === 409 && err.code === 'PERSONNEL_ALREADY_EXISTS') {
        dupEmailBlocked = true;
      }
    }
    assert(dupEmailBlocked, 'Chặn đứng email trùng lặp không phân biệt hoa thường (409 Conflict)');

    // =========================================================================
    // [4/8] TEST SUITE 4: XEM CHI TIẾT NHÂN SỰ & THỐNG KÊ (READ DETAIL)
    // =========================================================================
    console.log('\n👁️ [4/8] Kiểm tra xem chi tiết nhân sự (UserService.getPersonnelDetail)...');

    const detail = await UserService.getPersonnelDetail(createdPersonnel1.id);
    assert(detail && detail.id === createdPersonnel1.id, 'Lấy chi tiết nhân sự theo ID chính xác 100%');
    assert(detail.team_id === 1 && detail.team_color !== undefined, 'Thông tin đội thi đua và màu sắc hiển thị đầy đủ');
    assert(typeof detail.total_quotes_count === 'number', 'Thống kê tổng số câu trích dẫn có sẵn (number)', `Quotes: ${detail.total_quotes_count}`);
    assert(typeof detail.total_dews_count === 'number', 'Thống kê tổng lượt tưới có sẵn (number)', `Dews: ${detail.total_dews_count}`);
    assert(Array.isArray(detail.recent_quotes), 'Danh sách trích dẫn gần nhất dạng mảng JSON', `Recent length: ${detail.recent_quotes.length}`);

    // Query with invalid ID throws 404
    let notFoundCaught = false;
    try {
      await UserService.getPersonnelDetail('00000000-0000-0000-0000-000000000000');
    } catch (err) {
      if (err.statusCode === 404 && err.code === 'PERSONNEL_NOT_FOUND') {
        notFoundCaught = true;
      }
    }
    assert(notFoundCaught, 'Truy vấn ID không tồn tại trả về lỗi 404 PERSONNEL_NOT_FOUND');

    // =========================================================================
    // [5/8] TEST SUITE 5: CẬP NHẬT THÔNG TIN & ĐỔI ĐỘI THI ĐUA (UPDATE)
    // =========================================================================
    console.log('\n✏️ [5/8] Kiểm tra cập nhật thông tin và chuyển đội thi đua (Update & Team Transfer)...');

    const team2BeforeRes = await db.query('SELECT actual_members FROM teams WHERE id = 2');
    const team2CountBefore = parseInt(team2BeforeRes.rows[0]?.actual_members || 0, 10);

    const updatedPersonnel = await UserService.updatePersonnel(createdPersonnel1.id, {
      nickname: 'Bút Danh Cập Nhật #001',
      job_title: 'Chuyên gia Phân Tích Dữ Liệu',
      branch: 'FTELBO',
      team_id: 2 // Chuyển từ Đội 1 sang Đội 2
    }, superAdminActor, '127.0.0.1');

    assert(updatedPersonnel.nickname === 'Bút Danh Cập Nhật #001', 'Cập nhật bút danh thành công');
    assert(updatedPersonnel.job_title === 'Chuyên gia Phân Tích Dữ Liệu', 'Cập nhật chức vụ thành công');
    assert(updatedPersonnel.branch === 'FTELBO', 'Cập nhật khối chi nhánh thành công');
    assert(updatedPersonnel.team_id === 2, 'Chuyển sang Đội 2 thành công');

    // Verify Team 1 decremented and Team 2 incremented
    const team1AfterTransfer = (await db.query('SELECT actual_members FROM teams WHERE id = 1')).rows[0]?.actual_members;
    const team2AfterTransfer = (await db.query('SELECT actual_members FROM teams WHERE id = 2')).rows[0]?.actual_members;

    assert(team1AfterTransfer === team1CountBefore,
      'Sĩ số Đội 1 giảm đi 1 sau khi nhân sự chuyển đội',
      `Team 1: ${team1CountAfter} -> ${team1AfterTransfer}`);
    assert(team2AfterTransfer === team2CountBefore + 1,
      'Sĩ số Đội 2 tăng thêm 1 sau khi nhân sự gia nhập',
      `Team 2: ${team2CountBefore} -> ${team2AfterTransfer}`);

    // Create a 2nd user to test update conflict
    const user2 = await UserService.createPersonnel({
      employee_code: 'TEST_PERS_002',
      email: 'pers002@fpt.com',
      full_name: 'Nguyễn Văn Test 2',
      team_id: 2
    }, superAdminActor);

    let updateConflictBlocked = false;
    try {
      // Try to change user1's email to user2's email
      await UserService.updatePersonnel(createdPersonnel1.id, {
        email: 'pers002@fpt.com'
      }, superAdminActor);
    } catch (err) {
      if (err.statusCode === 409 && err.code === 'PERSONNEL_ALREADY_EXISTS') {
        updateConflictBlocked = true;
      }
    }
    assert(updateConflictBlocked, 'Cập nhật trùng email với nhân sự khác bị chặn đứng (409 Conflict)');

    // =========================================================================
    // [6/8] TEST SUITE 6: XÓA AN TOÀN VÀ DỌN DẸP LIÊN KẾT (DELETE)
    // =========================================================================
    console.log('\n🗑️ [6/8] Kiểm tra xóa nhân sự an toàn và bảo lưu liên kết CSDL (Delete & Cascades)...');

    // Insert mock activity data linked to user 1
    const mockBookRes = await db.query(`
      INSERT INTO books (title, author, quote, category, reader_name, reader_email, user_id)
      VALUES ('Sách Test Cascade', 'Tác Giả Test', 'Trích dẫn thử nghiệm', 'CN', 'Test', 'pers001@fpt.com', $1)
      RETURNING id
    `, [createdPersonnel1.id]);
    const mockBookId = mockBookRes.rows[0].id;

    await db.query(`
      INSERT INTO daily_quotes (user_id, book_id, quote_date, team_id)
      VALUES ($1, $2, CURRENT_DATE, 2)
      ON CONFLICT DO NOTHING
    `, [createdPersonnel1.id, mockBookId]);

    await db.query(`
      INSERT INTO daily_dews (user_id, user_fingerprint, claim_date, streak)
      VALUES ($1, 'fp_test_pers_001', CURRENT_DATE, 1)
      ON CONFLICT DO NOTHING
    `, [createdPersonnel1.id]);

    await db.query(`
      INSERT INTO exp_ledger (user_id, user_fingerprint, amount, type)
      VALUES ($1, 'fp_test_pers_001', 5, 'BOOK_CONTRIBUTION')
    `, [createdPersonnel1.id]);

    // Perform safe deletion
    const deletedUser = await UserService.deletePersonnel(createdPersonnel1.id, superAdminActor, '127.0.0.1');
    assert(deletedUser && deletedUser.id === createdPersonnel1.id, 'Xóa nhân sự thành công, nhận bản ghi đã xóa');

    // Verify user is gone from users table
    const checkDeletedRes = await db.query('SELECT id FROM users WHERE id = $1', [createdPersonnel1.id]);
    assert(checkDeletedRes.rows.length === 0, 'Bản ghi nhân sự đã bị xóa hoàn toàn khỏi bảng users');

    // Verify daily_quotes deleted
    const quotesCheck = await db.query('SELECT id FROM daily_quotes WHERE user_id = $1', [createdPersonnel1.id]);
    assert(quotesCheck.rows.length === 0, 'Dữ liệu daily_quotes của nhân sự đã được xóa sạch');

    // Verify books and dews user_id was set to null (no FK crash)
    const booksCheck = await db.query('SELECT user_id FROM books WHERE id = $1', [mockBookId]);
    assert(booksCheck.rows[0]?.user_id === null, 'Cột user_id trong books được đặt NULL an toàn');

    const dewsCheck = await db.query("SELECT user_id FROM daily_dews WHERE user_fingerprint = 'fp_test_pers_001'");
    assert(dewsCheck.rows[0]?.user_id === null, 'Cột user_id trong daily_dews được đặt NULL an toàn');

    // Clean up mock records
    await db.query('DELETE FROM books WHERE id = $1', [mockBookId]);
    await db.query("DELETE FROM daily_dews WHERE user_fingerprint = 'fp_test_pers_001'");
    await db.query("DELETE FROM exp_ledger WHERE user_fingerprint = 'fp_test_pers_001'");
    await UserService.deletePersonnel(user2.id, superAdminActor);

    // =========================================================================
    // [7/8] TEST SUITE 7: PHÂN QUYỀN RBAC (SUPERADMIN VS MODERATOR)
    // =========================================================================
    console.log('\n🛡️ [7/8] Kiểm tra phân quyền RBAC (Superadmin vs Moderator)...');

    const superAdminToken = jwt.sign(superAdminActor, process.env.JWT_SECRET || 'caosach_super_secure_jwt_secret_2026_production');
    const moderatorToken = jwt.sign(moderatorActor, process.env.JWT_SECRET || 'caosach_super_secure_jwt_secret_2026_production');

    assert(moderatorActor.role === 'moderator', 'Tài khoản Moderator nhận diện đúng vai trò moderator');
    assert(superAdminActor.role === 'admin', 'Tài khoản Superadmin nhận diện đúng vai trò admin');

    const API_BASE = 'http://localhost:5000/api/v1';

    // 7.1 Moderator attempts to create personnel -> 403 Forbidden
    const modCreateRes = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${moderatorToken}`
      },
      body: JSON.stringify({
        employee_code: 'TEST_MOD_FAIL',
        email: 'modfail@fpt.com',
        full_name: 'Mod Unauthorized',
        team_id: 1
      })
    });
    assert(modCreateRes.status === 403, 'Điều phối viên (Moderator) không thể tạo nhân sự mới (403 Forbidden)');

    // 7.2 Moderator attempts to delete personnel -> 403 Forbidden
    const modDeleteRes = await fetch(`${API_BASE}/admin/users/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${moderatorToken}` }
    });
    assert(modDeleteRes.status === 403, 'Điều phối viên (Moderator) không thể xóa nhân sự (403 Forbidden)');

    // 7.3 Moderator CAN read directory -> 200 OK
    const modReadRes = await fetch(`${API_BASE}/admin/users?limit=5`, {
      headers: { 'Authorization': `Bearer ${moderatorToken}` }
    });
    assert(modReadRes.status === 200, 'Điều phối viên (Moderator) được phép xem danh bạ nhân sự (200 OK)');

    // 7.4 Unauthenticated request -> 401 Unauthorized
    const anonRes = await fetch(`${API_BASE}/admin/users`);
    assert(anonRes.status === 401, 'Yêu cầu không có JWT Token bị chặn đứng với mã 401 Unauthorized');

    // =========================================================================
    // [8/8] TEST SUITE 8: NHẬT KÝ KIỂM TOÁN (AUDIT TRAIL LOGGING)
    // =========================================================================
    console.log('\n📜 [8/8] Kiểm tra lưu trữ nhật ký kiểm toán (Audit Trail)...');

    const auditRes = await db.query(`
      SELECT action, target_type, metadata
      FROM audit_logs
      WHERE action IN ('CREATE_PERSONNEL', 'UPDATE_PERSONNEL', 'DELETE_PERSONNEL')
      ORDER BY created_at DESC
      LIMIT 5
    `);

    const loggedActions = auditRes.rows.map(r => r.action);
    assert(loggedActions.includes('CREATE_PERSONNEL'), 'Hành động CREATE_PERSONNEL được ghi nhận đầy đủ trong audit_logs');
    assert(loggedActions.includes('UPDATE_PERSONNEL'), 'Hành động UPDATE_PERSONNEL được ghi nhận đầy đủ trong audit_logs');
    assert(loggedActions.includes('DELETE_PERSONNEL'), 'Hành động DELETE_PERSONNEL được ghi nhận đầy đủ trong audit_logs');

    // Clean up test moderator user
    await db.query("DELETE FROM admin_users WHERE username = 'test_mod_personnel'");

    console.log('\n=================================================================');
    console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passed} PASSED | ${failed} FAILED`);
    console.log(`🎯 TỶ LỆ THÀNH CÔNG: ${failed === 0 ? '100% (HOÀN HẢO)' : Math.round((passed / (passed + failed)) * 100) + '%'}`);
    console.log('=================================================================\n');

  } catch (err) {
    console.error('💥 LỖI KHÔNG MONG MUỐN TRONG TEST SUITE:', err);
    failed++;
  } finally {
    try {
      await db.pool.end();
    } catch (e) {}
    process.exitCode = (failed > 0 ? 1 : 0);
  }
}

runPersonnelCrudTests();


