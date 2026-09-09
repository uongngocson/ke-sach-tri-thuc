import db from '../config/database.js';
/**
 * scratch/test_fruit_harvest_fullkey.js
 * Test Key Suite: Logic Hái Trái Tri Thức (5 Quả / Cây / Đội)
 * 1. User bắt buộc phải Login mới được hái quả (+5 EXP)
 * 2. +5 EXP được cộng chính xác cho ĐỘI CỦA CÂY ĐÓ, không phải đội chung
 * 3. Trạng thái quả lưu 100% trên PostgreSQL Database, KHÔNG phụ thuộc localStorage
 * 4. Chống SPAM tuyệt đối: Chuyển trình duyệt / Incognito / Đổi fingerprint vẫn bị chặn trùng lặp
 */


import { QuoteService } from '../services/quote.service.js';
import { TeamService } from '../services/team.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
    if (detail) console.log(`     ↳ ${detail}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${message}`);
    if (detail) console.error(`     ↳ ${detail}`);
  }
}

async function runFruitTestKey() {
  console.log('🍇 =================================================================');
  console.log('🍇 TEST-KEY SUITE: LOGIC HÁI TRÁI TRI THỨC (+5 EXP CHO ĐỘI CỦA CÂY)');
  console.log('🍇 =================================================================\n');

  const today = new Date().toISOString().split('T')[0];
  const API_BASE = 'http://127.0.0.1:5000/api/v1';

  // 1. Chuẩn bị tài khoản test (Lấy 1 User từ Đội 1)
  const userRes = await db.query('SELECT * FROM users WHERE team_id = 1 ORDER BY id LIMIT 1');
  const testUser = userRes.rows[0];
  assert(!!testUser, 'Tìm thấy độc giả Đội 1 để tiến hành kiểm thử', `User: ${testUser.full_name} (${testUser.email})`);

  // Dọn dẹp dữ liệu test cũ cho user này trong ngày hôm nay
  await db.query('DELETE FROM fruit_harvests WHERE user_id = $1 AND harvest_date = $2', [testUser.id, today]);

  // =========================================================================
  // TEST 1: KHÁCH VÃNG LAI (CHƯA ĐĂNG NHẬP) BỊ CHẶN HÁI QUẢ (401 LOGIN REQUIRED)
  // =========================================================================
  console.log('\n🔒 [1/5] Kiểm tra bảo vệ danh tính: Bắt buộc Login khi hái quả...');
  let guestHarvestBlocked = false;
  try {
    const res = await fetch(`${API_BASE}/fruits/harvest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: 2,
        fruitIndex: 0,
        userId: 'guest',
        userFingerprint: 'guest_fp_123'
      })
    });
    const data = await res.json();
    if (res.status === 401 && data.error === 'LOGIN_REQUIRED') {
      guestHarvestBlocked = true;
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
  assert(guestHarvestBlocked, 'Khách vãng lai (Guest) chưa đăng nhập bị chặn hái quả (HTTP 401 LOGIN_REQUIRED)');

  let missingUserBlocked = false;
  try {
    const res = await fetch(`${API_BASE}/fruits/harvest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: 2,
        fruitIndex: 0,
        userFingerprint: 'guest_fp_no_user'
      })
    });
    const data = await res.json();
    if (res.status === 401 && data.error === 'LOGIN_REQUIRED') {
      missingUserBlocked = true;
    }
  } catch (err) {}
  assert(missingUserBlocked, 'Yêu cầu thiếu userId bị từ chối với HTTP 401 LOGIN_REQUIRED');

  // =========================================================================
  // TEST 2: HÁI QUẢ CỦA CÂY ĐỘI NÀO -> CỘNG +5 EXP CHÍNH XÁC CHO ĐỘI ĐÓ
  // =========================================================================
  console.log('\n🍎 [2/5] Kiểm tra cộng EXP: +5 EXP vào Đội của cây đó (không vào đội chung)...');
  
  // Kiểm tra điểm ban đầu của Đội 3 và Đội 1 (User thuộc Đội 1, nhưng hái quả trên cây Đội 3)
  const team3Before = await db.query('SELECT total_exp, tree_exp FROM teams WHERE id = 3');
  const team1Before = await db.query('SELECT total_exp, tree_exp FROM teams WHERE id = 1');
  const userExpBefore = parseInt(testUser.total_exp_earned || 0, 10);

  const t3ExpInit = parseInt(team3Before.rows[0].tree_exp || 0, 10);
  const t1ExpInit = parseInt(team1Before.rows[0].tree_exp || 0, 10);

  // Độc giả Đội 1 hái Quả số 1 của CÂY ĐỘI 3
  const harvestRes = await QuoteService.harvestFruit(1, 'fp_test_team_target', {
    userId: testUser.id,
    teamId: 3
  });

  assert(harvestRes && harvestRes.expEarned === 5, 'Hái Trái Tri Thức số 1 trên cây Đội 3 thành công (+5 EXP)');
  assert(harvestRes.teamId === 3, 'Kết quả xác nhận Trái Tri Thức thuộc về Đội 3');

  // Kiểm tra điểm sau khi hái
  const team3After = await db.query('SELECT total_exp, tree_exp FROM teams WHERE id = 3');
  const team1After = await db.query('SELECT total_exp, tree_exp FROM teams WHERE id = 1');
  const userExpAfterRes = await db.query('SELECT total_exp_earned FROM users WHERE id = $1', [testUser.id]);
  const userExpAfter = parseInt(userExpAfterRes.rows[0].total_exp_earned || 0, 10);

  const t3ExpFinal = parseInt(team3After.rows[0].tree_exp || 0, 10);
  const t1ExpFinal = parseInt(team1After.rows[0].tree_exp || 0, 10);

  assert(t3ExpFinal === t3ExpInit + 5, 'Đội 3 (Đội của cây) được cộng chính xác +5 EXP', `EXP: ${t3ExpInit} -> ${t3ExpFinal}`);
  assert(t1ExpFinal === t1ExpInit, 'Đội 1 (Đội của người hái) KHÔNG bị cộng nhầm, bảo toàn điểm số', `EXP Đội 1 giữ nguyên: ${t1ExpInit}`);
  assert(userExpAfter === userExpBefore + 5, 'Độc giả hái quả được ghi nhận +5 EXP cá nhân', `User EXP: ${userExpBefore} -> ${userExpAfter}`);

  // Kiểm tra sổ cái exp_ledger
  const ledgerCheck = await db.query(`
    SELECT * FROM exp_ledger 
    WHERE user_id = $1 AND type = 'FRUIT_HARVEST' 
    ORDER BY created_at DESC LIMIT 1
  `, [testUser.id]);
  assert(ledgerCheck.rows.length > 0 && ledgerCheck.rows[0].team_id === 3, 'Sổ cái EXP ghi nhận team_id chính xác là Đội 3 (Đội của cây)');

  // =========================================================================
  // TEST 3: CHỐNG SPAM KHI ĐỔI TRÌNH DUYỆT / INCOGNITO / THAY ĐỔI FINGERPRINT
  // =========================================================================
  console.log('\n🛡️ [3/5] Kiểm tra chống Spam thực tế: Chuyển trình duyệt / Incognito vẫn bị chặn...');

  // Giả lập độc giả mở trình duyệt khác (Fingerprint hoàn toàn mới, localStorage trống rỗng)
  const differentBrowserFp = `completely_different_browser_safari_iphone_${Date.now()}`;
  let duplicateBlocked = false;

  try {
    await QuoteService.harvestFruit(1, differentBrowserFp, {
      userId: testUser.id,
      teamId: 3
    });
  } catch (err) {
    if (err.code === '23505' || err.message?.includes('hôm nay rồi')) {
      duplicateBlocked = true;
    }
  }

  assert(duplicateBlocked, 'Bảo vệ thành công: Chuyển trình duyệt / đổi thiết bị vẫn bị PostgreSQL chặn trùng lặp tuyệt đối');

  // Thử qua HTTP API với trình duyệt khác
  let apiDuplicateBlocked = false;
  try {
    const res = await fetch(`${API_BASE}/fruits/harvest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: 3,
        fruitIndex: 1,
        userId: testUser.id,
        userFingerprint: 'edge_browser_incognito_mode'
      })
    });
    const data = await res.json();
    if (res.status === 400 && data.error === 'ALREADY_HARVESTED') {
      apiDuplicateBlocked = true;
    }
  } catch (err) {
    console.error('API duplicate test error:', err);
  }

  assert(apiDuplicateBlocked, 'API trả về HTTP 400 ALREADY_HARVESTED khi cố tình hái lại quả đã hái');

  // =========================================================================
  // TEST 4: TRẠNG THÁI QUẢ ĐỒNG BỘ TRỰC TIẾP TỪ DATABASE (GET /api/v1/fruits/status)
  // =========================================================================
  console.log('\n📡 [4/5] Kiểm tra truy vấn trạng thái quả Server-Side (Không lưu LocalStorage)...');

  const statusRes = await fetch(`${API_BASE}/fruits/status?userId=${testUser.id}`);
  const statusJson = await statusRes.json();

  assert(statusJson.success === true, 'API /api/v1/fruits/status phản hồi thành công');
  assert(Array.isArray(statusJson.data?.harvestedByTeam[3]), 'Dữ liệu trả về danh sách quả đã hái của Đội 3');
  assert(statusJson.data?.harvestedByTeam[3].includes(1), 'Quả số 1 của Đội 3 được Database đánh dấu chính xác là ĐÃ HÁI');
  assert(!statusJson.data?.harvestedByTeam[3].includes(0), 'Quả số 0 của Đội 3 chưa hái vẫn ở trạng thái CÒN TRÊN CÂY');

  // =========================================================================
  // TEST 5: ĐỘC LẬP 5 QUẢ TRÊN 8 ĐỘI (MỖI ĐỘI 5 QUẢ TỐI ĐA)
  // =========================================================================
  console.log('\n🌳 [5/5] Kiểm tra tính độc lập của 5 quả trên từng đội...');

  // User có thể hái tiếp Quả số 0 của Đội 3
  const harvestFruit0 = await QuoteService.harvestFruit(0, 'fp_test_fruit_0', {
    userId: testUser.id,
    teamId: 3
  });
  assert(harvestFruit0 && harvestFruit0.fruitIndex === 0, 'Độc giả hái thành công Quả số 0 của Đội 3');

  // User có thể hái Quả số 1 của ĐỘI KHÁC (Đội 4) - Không bị nhầm lẫn giữa các đội
  const harvestTeam4Fruit1 = await QuoteService.harvestFruit(1, 'fp_test_team4_f1', {
    userId: testUser.id,
    teamId: 4
  });
  assert(harvestTeam4Fruit1 && harvestTeam4Fruit1.teamId === 4 && harvestTeam4Fruit1.fruitIndex === 1, 
    'Quả số 1 của Đội 4 độc lập với Quả số 1 của Đội 3, hái thành công');

  // Kiểm tra lại trạng thái quả sau khi hái
  const updatedStatusRes = await fetch(`${API_BASE}/fruits/status?userId=${testUser.id}`);
  const updatedStatusJson = await updatedStatusRes.json();
  const team3Harvested = updatedStatusJson.data?.harvestedByTeam[3];
  const team4Harvested = updatedStatusJson.data?.harvestedByTeam[4];

  assert(team3Harvested.includes(0) && team3Harvested.includes(1), 'Đội 3 đã ghi nhận hái Quả 0 và Quả 1');
  assert(team4Harvested.includes(1), 'Đội 4 đã ghi nhận hái Quả 1');

  // Dọn dẹp dữ liệu test
  await db.query('DELETE FROM fruit_harvests WHERE user_id = $1 AND harvest_date = $2', [testUser.id, today]);

  console.log('\n=================================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passed} PASSED | ${failed} FAILED`);
  console.log(`🎯 TỶ LỆ THÀNH CÔNG: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('=================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runFruitTestKey().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
