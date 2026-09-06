import jwt from 'jsonwebtoken';
import db from '../config/database.js';

const API_PORT = process.env.PORT || 5000;
const API_BASE = `http://127.0.0.1:${API_PORT}/api/v1`;
const JWT_SECRET = process.env.JWT_SECRET || 'caosach_super_secure_jwt_secret_2026_production';

function generateAdminToken() {
  return jwt.sign(
    {
      id: 'be07a95b-c197-4f8a-8830-b4c60bebe7b9',
      username: 'admin',
      role: 'admin',
      email: 'admin@fpt.com'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 =================================================================');
  console.log('🧪 RUNNING AUTOMATED TEST SUITE: CONTENT & RULES CUSTOMIZER');
  console.log('🧪 =================================================================\n');

  const adminToken = generateAdminToken();

  // Test 1: Public endpoint
  console.log('📦 [1/6] Test 1: Public endpoint GET /content/settings...');
  try {
    const res = await fetch(`${API_BASE}/content/settings`);
    const data = await res.json();
    assert(res.status === 200, 'Public settings returns HTTP 200');
    assert(data.success === true, 'Response success is true');
    assert(!!data.data.welcome_content, 'Contains welcome_content');
    assert(!!data.data.rules_content, 'Contains rules_content');
    assert(data.data.welcome_content.title === 'Mỗi Cuốn Sách Là Một Hạt Mầm', 'welcome_content title matches default');
    assert(data.data.rules_content.milestones?.length >= 5, 'rules_content contains milestones');
  } catch (err) {
    assert(false, `Public endpoint error: ${err.message}`);
  }

  // Test 2: Admin endpoint without auth
  console.log('\n📦 [2/6] Test 2: Admin endpoint without auth GET /admin/content-settings...');
  try {
    const res = await fetch(`${API_BASE}/admin/content-settings`);
    assert(res.status === 401, 'Unauthorized request blocked with HTTP 401');
  } catch (err) {
    assert(false, `Unauthorized test error: ${err.message}`);
  }

  // Test 3: Admin endpoint with auth
  console.log('\n📦 [3/6] Test 3: Admin endpoint with auth GET /admin/content-settings...');
  try {
    const res = await fetch(`${API_BASE}/admin/content-settings`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    assert(res.status === 200, 'Authorized admin request returns HTTP 200');
    assert(data.success === true, 'Admin response success is true');
    assert(data.data.welcome_content !== undefined, 'Admin response has welcome_content');
  } catch (err) {
    assert(false, `Admin GET error: ${err.message}`);
  }

  // Test 4: Admin update welcome_content
  console.log('\n📦 [4/6] Test 4: Admin PUT /admin/content-settings (Update Welcome)...');
  try {
    const updatedWelcome = {
      badge: '🌱 VƯỜN TRI THỨC TEST',
      title: 'Mỗi Cuốn Sách Là Một Hạt Mầm (Đã Tùy Biến)',
      subtitle: 'Mỗi Độc Giả Là Một Người Gieo Tri Thức',
      metaphor: 'Trích dẫn thử nghiệm tùy biến...',
      pillar1: 'Gieo Hạt Tri Thức',
      pillar2: 'Lan Tỏa Tri Thức',
      pillar3: 'Nhật Ký Tri Thức',
      buttonText: 'Khám Phá Ngay'
    };

    const res = await fetch(`${API_BASE}/admin/content-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ key: 'welcome_content', value: updatedWelcome })
    });
    const data = await res.json();
    assert(res.status === 200, 'Update welcome returns HTTP 200');
    assert(data.success === true, 'Update welcome success is true');
    assert(data.data.title === 'Mỗi Cuốn Sách Là Một Hạt Mầm (Đã Tùy Biến)', 'Updated title matches submitted value');

    // Verify audit log
    const auditRes = await db.query(
      "SELECT * FROM audit_logs WHERE action = 'UPDATE_CONTENT_SETTING' ORDER BY id DESC LIMIT 1"
    );
    assert(auditRes.rows.length > 0, 'Audit log entry created for UPDATE_CONTENT_SETTING');
    assert(auditRes.rows[0].target_type === 'system_settings', 'Audit log target_type is system_settings');
  } catch (err) {
    assert(false, `Update welcome error: ${err.message}`);
  }

  // Test 5: Admin update rules_content
  console.log('\n📦 [5/6] Test 5: Admin PUT /admin/content-settings (Update Rules)...');
  try {
    const pubRes = await fetch(`${API_BASE}/content/settings`);
    const pubData = await pubRes.json();
    const rules = pubData.data.rules_content;
    rules.confirmButton = '🌱 Đã Hiểu & Sẵn Sàng Gieo Mầm!';

    const res = await fetch(`${API_BASE}/admin/content-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ key: 'rules_content', value: rules })
    });
    const data = await res.json();
    assert(res.status === 200, 'Update rules returns HTTP 200');
    assert(data.data.confirmButton === '🌱 Đã Hiểu & Sẵn Sàng Gieo Mầm!', 'Updated confirmButton matches submitted value');
  } catch (err) {
    assert(false, `Update rules error: ${err.message}`);
  }

  // Test 6: Admin reset setting to default
  console.log('\n📦 [6/6] Test 6: Admin POST /admin/content-settings/reset (Reset Welcome & Rules)...');
  try {
    const resetRes1 = await fetch(`${API_BASE}/admin/content-settings/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ key: 'welcome_content' })
    });
    const resetData1 = await resetRes1.json();
    assert(resetRes1.status === 200, 'Reset welcome returns HTTP 200');
    assert(resetData1.data.title === 'Mỗi Cuốn Sách Là Một Hạt Mầm', 'Reset welcome title restored to BTC standard');

    const resetRes2 = await fetch(`${API_BASE}/admin/content-settings/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ key: 'rules_content' })
    });
    const resetData2 = await resetRes2.json();
    assert(resetRes2.status === 200, 'Reset rules returns HTTP 200');
    assert(resetData2.data.confirmButton === '🌱 Đã Hiểu & Bắt Đầu Gieo Mầm Nuôi Cây', 'Reset rules confirmButton restored to BTC standard');
  } catch (err) {
    assert(false, `Reset error: ${err.message}`);
  }

  console.log('\n=================================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passed} PASSED | ${failed} FAILED (${failed === 0 ? '100% SUCCESS' : 'HAS FAILURES'})`);
  console.log('=================================================================\n');

  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
