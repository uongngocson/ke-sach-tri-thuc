import db from '../config/database.js';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5000/api/v1';

async function runExportTests() {
  console.log('\n📊 =================================================================');
  console.log('📊 TEST SUITE: XUẤT BÁO CÁO TẤT CẢ CÁC NGÀY (8 ĐỘI & 288 NHÂN SỰ)');
  console.log('📊 =================================================================\n');

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
    // 1. Get or create admin user for JWT token
    const adminRes = await db.query("SELECT id, username, role FROM admin_users WHERE role = 'admin' LIMIT 1");
    let admin = adminRes.rows[0];
    if (!admin) {
      const ins = await db.query(`
        INSERT INTO admin_users (username, password_hash, full_name, role)
        VALUES ('admin_test', 'hash123', 'Admin Test', 'admin')
        RETURNING id, username, role
      `);
      admin = ins.rows[0];
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET || 'dev_secret_jwt_key_2026_caosach_super_secure',
      { expiresIn: '2h' }
    );

    // 2. Test 8 Teams All Days API
    console.log('🏆 [1/3] Kiểm tra API Xuất Báo Cáo 8 Đội Tất Cả Các Ngày (/analytics/teams/all-days)...');
    const teamsRes = await fetch(`${BASE_URL}/admin/analytics/teams/all-days`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const teamsData = await teamsRes.json();

    assert(teamsRes.status === 200, 'Endpoint /admin/analytics/teams/all-days trả về HTTP 200');
    assert(teamsData.success === true, 'Response trả về success: true');
    assert(Array.isArray(teamsData.data.dates), 'Danh sách ngày thi đấu là một mảng');
    assert(teamsData.data.dates.length >= 1, 'Có ít nhất 1 ngày thi đấu được ghi nhận', `Số ngày: ${teamsData.data.dates.length}`);
    assert(Array.isArray(teamsData.data.teams_summary), 'Bảng tổng hợp 8 đội là một mảng');
    assert(teamsData.data.teams_summary.length === 8, 'Bảng tổng hợp có chính xác 8 đội thi đua', `Số đội: ${teamsData.data.teams_summary.length}`);
    assert(Array.isArray(teamsData.data.daily_history), 'Lịch sử chi tiết từng ngày là một mảng');
    assert(teamsData.data.daily_history.length >= 8, 'Lịch sử chi tiết có ít nhất 8 bản ghi (8 đội x N ngày)');
    
    // Check team summary structure
    const firstTeam = teamsData.data.teams_summary[0];
    assert(firstTeam.id !== undefined && firstTeam.name !== undefined, 'Thông tin đội tổng hợp có đầy đủ id và name');
    assert(firstTeam.tree_exp !== undefined && firstTeam.actual_members !== undefined, 'Thông tin đội có đầy đủ tree_exp và actual_members');

    // 3. Test 288 Personnel All Days API
    console.log('\n👥 [2/3] Kiểm tra API Xuất Danh Sách 288 Nhân Sự Tất Cả Các Ngày (/users/all-days)...');
    const usersRes = await fetch(`${BASE_URL}/admin/users/all-days`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const usersData = await usersRes.json();

    assert(usersRes.status === 200, 'Endpoint /admin/users/all-days trả về HTTP 200');
    assert(usersData.success === true, 'Response trả về success: true');
    assert(Array.isArray(usersData.data.users), 'Danh sách nhân sự là một mảng');
    assert(usersData.data.users.length >= 288, 'Danh sách trả về đầy đủ 288 nhân sự', `Số nhân sự: ${usersData.data.users.length}`);

    // Check user data structure
    const sampleUser = usersData.data.users[0];
    assert(sampleUser.id !== undefined && sampleUser.nickname !== undefined, 'Thông tin nhân sự có id và bút danh');
    assert(sampleUser.total_days_participated !== undefined, 'Nhân sự có chỉ số total_days_participated');
    assert(sampleUser.attendance_rate !== undefined, 'Nhân sự có chỉ số attendance_rate (%)');
    assert(sampleUser.daily_status !== undefined && typeof sampleUser.daily_status === 'object', 'Nhân sự có trường daily_status chứa trạng thái từng ngày');

    // 4. Test RBAC security (Unauthorized & Non-admin check)
    console.log('\n🔒 [3/3] Kiểm tra Bảo Mật RBAC cho 2 API Xuất Báo Cáo...');
    const unauthTeams = await fetch(`${BASE_URL}/admin/analytics/teams/all-days`);
    assert(unauthTeams.status === 401, 'Chặn truy cập không có Token (HTTP 401) cho /analytics/teams/all-days');

    const unauthUsers = await fetch(`${BASE_URL}/admin/users/all-days`);
    assert(unauthUsers.status === 401, 'Chặn truy cập không có Token (HTTP 401) cho /users/all-days');

    console.log('\n=================================================================');
    console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passed} PASSED | ${failed} FAILED`);
    console.log(`🎯 TỶ LỆ THÀNH CÔNG: ${Math.round((passed / (passed + failed)) * 100)}%`);
    console.log('=================================================================\n');

    await db.pool.end();
  } catch (err) {
    console.error('Lỗi kiểm thử:', err);
    await db.pool.end().catch(() => {});
    process.exitCode = 1;
  }
}

runExportTests();
