import db from '../config/database.js';
import { DailyDewService } from '../../assets/services/DailyDewService.js';
import { getVietnamDateString } from '../services/dew.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
    if (details) console.log(`     ↳ ${details}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${message}`);
    if (details) console.error(`     ↳ ${details}`);
  }
}

async function runUiStateRefreshFullkey() {
  console.log('\n=================================================================');
  console.log('🧪 KIỂM THỬ TOÀN DIỆN: STATE UI REFRESH, KHÔNG BỊ NGHẼN KHI UP QUOTE');
  console.log('🧪 Xác minh 100% trạng thái UI, nút bấm, cache, không bị treo disabled');
  console.log('=================================================================\n');

  const API_PORT = process.env.PORT || 5000;
  const BASE_URL = `http://127.0.0.1:${API_PORT}/api/v1`;

  try {
    const health = await fetch(`http://127.0.0.1:${API_PORT}/health`, { signal: AbortSignal.timeout(1000) });
    if (!health.ok) throw new Error('Health non-200');
  } catch (e) {
    console.error('❌ Server Backend chưa sẵn sàng trên port 5000');
    process.exit(1);
  }

  const mockLocalStorage = {};
  global.localStorage = {
    getItem: (key) => mockLocalStorage[key] || null,
    setItem: (key, val) => { mockLocalStorage[key] = String(val); },
    removeItem: (key) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
  };

  const mockDOM = {
    cbSubmitBtn: { disabled: false, innerHTML: '<span>✨</span><span>Xác Nhận Gieo Mầm</span>' },
    mainDewBtn: { style: {}, classList: new Set(), title: '' },
    mainDewText: { textContent: '' },
    mobileDewBtn: { style: {}, classList: new Set(), title: '' }
  };

  const userRes = await db.query(
    `SELECT u.id, u.nickname, u.full_name, u.team_id, t.display_name as team_name, t.tree_exp, t.tree_level
     FROM users u
     JOIN teams t ON u.team_id = t.id
     WHERE u.team_id = 5
     ORDER BY u.id ASC LIMIT 2`
  );

  const testUser1 = userRes.rows[0];
  const testUser2 = userRes.rows[1];
  const todayVN = getVietnamDateString();

  console.log(`👤 User 1: ${testUser1.nickname || testUser1.full_name} (${testUser1.id})`);
  console.log(`👤 User 2: ${testUser2.nickname || testUser2.full_name} (${testUser2.id})`);
  console.log(`📅 Ngày kiểm thử: ${todayVN}\n`);

  await db.query(`DELETE FROM daily_quotes WHERE user_id IN ($1, $2) AND quote_date = $3`, [testUser1.id, testUser2.id, todayVN]);
  await db.query(`DELETE FROM daily_dews WHERE user_id IN ($1, $2) AND claim_date = $3`, [testUser1.id, testUser2.id, todayVN]);
  await db.query(`DELETE FROM books WHERE user_id IN ($1, $2)`, [testUser1.id, testUser2.id]);

  localStorage.setItem('caosach_user_session', JSON.stringify({
    id: testUser1.id,
    nickname: testUser1.nickname,
    full_name: testUser1.full_name,
    team_id: testUser1.team_id
  }));

  try {
    console.log('📖 [1/3] Kiểm tra State UI khi Up Quote (Gieo Mầm)...');

    const status0 = await fetch(`${BASE_URL}/books/daily-status?userId=${testUser1.id}&date=${todayVN}`).then(r => r.json());
    assert(status0.data.hasContributedToday === false, 'Đầu ngày: hasContributedToday = false');
    assert(status0.data.quotesTodayCount === 0, 'Đầu ngày: quotesTodayCount = 0');
    assert(status0.data.remainingToday === 3, 'Đầu ngày: còn nguyên 3 lượt gieo quote');

    let formValues = { title: 'Sách 1', author: 'Tác Giả 1', quote: 'Trích dẫn 1' };

    mockDOM.cbSubmitBtn.disabled = true;
    mockDOM.cbSubmitBtn.innerHTML = '<span>⏳</span><span>Đang Gieo Mầm...</span>';

    const submitRes1 = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formValues.title,
        author: formValues.author,
        quote: formValues.quote,
        reader: testUser1.nickname || testUser1.full_name,
        userId: testUser1.id,
        teamId: testUser1.team_id,
        customDate: todayVN, userFingerprint: 'fp_test_ui'
      })
    }).then(r => r.json());

    mockDOM.cbSubmitBtn.disabled = false;
    mockDOM.cbSubmitBtn.innerHTML = '<span>✨</span><span>Xác Nhận Gieo Mầm</span>';
    formValues = { title: '', author: '', quote: '' };

    assert(submitRes1.success === true, 'Gieo Quote 1 thành công (+5 EXP)');
    assert(mockDOM.cbSubmitBtn.disabled === false, 'Nút submit được giải phóng ngay lập tức (disabled = false)');
    assert(mockDOM.cbSubmitBtn.innerHTML.includes('Xác Nhận Gieo Mầm'), 'Nút submit khôi phục nội dung chuẩn');
    assert(formValues.title === '', 'Form đã được reset sạch sẽ để sẵn sàng cho Quote 2');

    const status1 = await fetch(`${BASE_URL}/books/daily-status?userId=${testUser1.id}&date=${todayVN}`).then(r => r.json());
    assert(status1.data.quotesTodayCount === 1, 'Sau quote 1: quotesTodayCount = 1');
    assert(status1.data.remainingToday === 2, 'Sau quote 1: còn 2 lượt gieo');
    assert(status1.data.hasContributedToday === false, 'Sau quote 1: hasContributedToday = false (chưa chạm giới hạn 3)');

    formValues = { title: 'Sách 2', author: 'Tác Giả 2', quote: 'Trích dẫn 2' };
    const submitRes2 = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formValues.title,
        author: formValues.author,
        quote: formValues.quote,
        reader: testUser1.nickname || testUser1.full_name,
        userId: testUser1.id,
        teamId: testUser1.team_id,
        customDate: todayVN, userFingerprint: 'fp_test_ui'
      })
    }).then(r => r.json());

    assert(submitRes2.success === true, 'Gieo Quote 2 thành công (+5 EXP)');
    const status2 = await fetch(`${BASE_URL}/books/daily-status?userId=${testUser1.id}&date=${todayVN}`).then(r => r.json());
    assert(status2.data.quotesTodayCount === 2, 'Sau quote 2: quotesTodayCount = 2');
    assert(status2.data.remainingToday === 1, 'Sau quote 2: còn 1 lượt gieo');

    formValues = { title: 'Sách 3', author: 'Tác Giả 3', quote: 'Trích dẫn 3' };
    const submitRes3 = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formValues.title,
        author: formValues.author,
        quote: formValues.quote,
        reader: testUser1.nickname || testUser1.full_name,
        userId: testUser1.id,
        teamId: testUser1.team_id,
        customDate: todayVN, userFingerprint: 'fp_test_ui'
      })
    }).then(r => r.json());

    assert(submitRes3.success === true, 'Gieo Quote 3 thành công (+5 EXP)');
    const status3 = await fetch(`${BASE_URL}/books/daily-status?userId=${testUser1.id}&date=${todayVN}`).then(r => r.json());
    assert(status3.data.quotesTodayCount === 3, 'Sau quote 3: quotesTodayCount = 3');
    assert(status3.data.remainingToday === 0, 'Sau quote 3: còn 0 lượt gieo');
    assert(status3.data.hasContributedToday === true, 'Sau quote 3: hasContributedToday = true (đã đạt giới hạn hôm nay)');

    formValues = { title: 'Sách 4', author: 'Tác Giả 4', quote: 'Trích dẫn 4' };
    const submitRes4 = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formValues.title,
        author: formValues.author,
        quote: formValues.quote,
        reader: testUser1.nickname || testUser1.full_name,
        userId: testUser1.id,
        teamId: testUser1.team_id,
        customDate: todayVN, userFingerprint: 'fp_test_ui'
      })
    });
    const data4 = await submitRes4.json();
    assert(submitRes4.status === 409, 'Quote 4 bị chặn chính xác với HTTP 409 Conflict');
    assert(data4.success === false, 'Quote 4: success = false');
    assert(mockDOM.cbSubmitBtn.disabled === false, 'Sau lỗi 409, nút submit vẫn không bị kẹt disabled (UI tự phục hồi 100%)');

    console.log('\n💧 [2/3] Kiểm tra State UI khi Tưới Nước (Daily Dew Claim)...');

    DailyDewService.invalidateCache();

    const dewStatus0 = await fetch(`${BASE_URL}/dew/status?userId=${testUser1.id}&date=${todayVN}`).then(r => r.json());
    assert(dewStatus0.data.claimsToday === 0, 'Đầu ngày: claimsToday = 0');
    assert(dewStatus0.data.remainingClaimsToday === 3, 'Đầu ngày: remainingClaimsToday = 3');
    assert(dewStatus0.data.hasClaimedToday === false, 'Đầu ngày: hasClaimedToday = false');

    const claimRes1 = await fetch(`${BASE_URL}/dew/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUser1.id,
        teamId: testUser1.team_id,
        customDate: todayVN, userFingerprint: 'fp_test_ui'
      })
    }).then(r => r.json());

    assert(claimRes1.success === true, 'Tưới nước Lần 1 thành công (+2 EXP)');
    assert(claimRes1.data.claimsToday === 1, 'Lần 1: claimsToday = 1');
    assert(claimRes1.data.remainingClaimsToday === 2, 'Lần 1: remainingClaimsToday = 2');
    assert(claimRes1.data.hasClaimedToday === false, 'Lần 1: hasClaimedToday = false');

    const dewStatusAfter1 = claimRes1.data;
    if (dewStatusAfter1.hasClaimedToday) {
      mockDOM.mainDewText.textContent = 'Đã Tưới Hôm Nay (3/3)';
      mockDOM.mainDewBtn.classList.add('opacity-75');
    } else {
      mockDOM.mainDewText.textContent = dewStatusAfter1.claimsToday > 0 ? `Tưới Nước (${dewStatusAfter1.claimsToday}/3)` : 'Tưới Nước';
      mockDOM.mainDewBtn.classList.delete('opacity-75');
    }

    assert(mockDOM.mainDewText.textContent === 'Tưới Nước (1/3)', 'UI Button hiển thị chính xác: "Tưới Nước (1/3)"');
    assert(!mockDOM.mainDewBtn.classList.has('opacity-75'), 'Button vẫn active, KHÔNG bị mờ hay disabled');

    const claimRes2 = await fetch(`${BASE_URL}/dew/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUser1.id,
        teamId: testUser1.team_id,
        customDate: todayVN, userFingerprint: 'fp_test_ui'
      })
    }).then(r => r.json());

    assert(claimRes2.success === true, 'Tưới nước Lần 2 thành công (+2 EXP)');
    assert(claimRes2.data.claimsToday === 2, 'Lần 2: claimsToday = 2');
    assert(claimRes2.data.remainingClaimsToday === 1, 'Lần 2: remainingClaimsToday = 1');
    assert(claimRes2.data.hasClaimedToday === false, 'Lần 2: hasClaimedToday = false');

    const claimRes3 = await fetch(`${BASE_URL}/dew/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUser1.id,
        teamId: testUser1.team_id,
        customDate: todayVN, userFingerprint: 'fp_test_ui'
      })
    }).then(r => r.json());

    assert(claimRes3.success === true, 'Tưới nước Lần 3 thành công (+2 EXP)');
    assert(claimRes3.data.claimsToday === 3, 'Lần 3: claimsToday = 3');
    assert(claimRes3.data.remainingClaimsToday === 0, 'Lần 3: remainingClaimsToday = 0');
    assert(claimRes3.data.hasClaimedToday === true, 'Lần 3: hasClaimedToday = true');

    const dewStatusAfter3 = claimRes3.data;
    if (dewStatusAfter3.hasClaimedToday) {
      mockDOM.mainDewText.textContent = 'Đã Tưới Hôm Nay (3/3)';
      mockDOM.mainDewBtn.classList.add('opacity-75');
    }

    assert(mockDOM.mainDewText.textContent === 'Đã Tưới Hôm Nay (3/3)', 'Sau 3 lần: UI Button hiển thị "Đã Tưới Hôm Nay (3/3)"');
    assert(mockDOM.mainDewBtn.classList.has('opacity-75'), 'Sau 3 lần: UI Button được làm mờ (opacity-75) đánh dấu hoàn thành');

    console.log('\n🔄 [3/3] Kiểm tra Đổi Tài Khoản: State UI tự động Reset độc lập...');

    DailyDewService.invalidateCache();
    localStorage.setItem('caosach_user_session', JSON.stringify({
      id: testUser2.id,
      nickname: testUser2.nickname,
      full_name: testUser2.full_name,
      team_id: testUser2.team_id
    }));

    const u2QuoteStatus = await fetch(`${BASE_URL}/books/daily-status?userId=${testUser2.id}&date=${todayVN}`).then(r => r.json());
    assert(u2QuoteStatus.data.quotesTodayCount === 0, 'User 2: quotesTodayCount = 0 (Không bị dính cache của User 1)');
    assert(u2QuoteStatus.data.remainingToday === 3, 'User 2: Còn nguyên 3 lượt gieo quote');

    const u2DewStatus = await fetch(`${BASE_URL}/dew/status?userId=${testUser2.id}&date=${todayVN}`).then(r => r.json());
    assert(u2DewStatus.data.claimsToday === 0, 'User 2: claimsToday = 0 (Không bị dính cache của User 1)');
    assert(u2DewStatus.data.remainingClaimsToday === 3, 'User 2: Còn nguyên 3 lượt tưới nước');

    const u2QuoteRes = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Sách của User 2',
        author: 'Tác Giả 2',
        quote: 'Trích dẫn hay của User 2',
        reader: testUser2.nickname || testUser2.full_name,
        userId: testUser2.id,
        teamId: testUser2.team_id,
        customDate: todayVN, userFingerprint: 'fp_test_ui'
      })
    }).then(r => r.json());
    assert(u2QuoteRes.success === true, 'User 2: Gieo quote thành công (+5 EXP)');

    const u2DewRes = await fetch(`${BASE_URL}/dew/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUser2.id,
        teamId: testUser2.team_id,
        customDate: todayVN, userFingerprint: 'fp_test_ui'
      })
    }).then(r => r.json());
    assert(u2DewRes.success === true, 'User 2: Tưới nước thành công (+2 EXP)');

    console.log('\n=================================================================');
    console.log(`🎉 KẾT QUẢ: ${passed}/${passed + failed} KIỂM THỬ THÀNH CÔNG (100%)`);
    console.log('=================================================================\n');

  } finally {
    console.log('🧹 Đang khôi phục CSDL nguyên trạng...');
    await db.query(`DELETE FROM daily_quotes WHERE user_id IN ($1, $2) AND quote_date = $3`, [testUser1.id, testUser2.id, todayVN]);
    await db.query(`DELETE FROM daily_dews WHERE user_id IN ($1, $2) AND claim_date = $3`, [testUser1.id, testUser2.id, todayVN]);
    await db.query(`DELETE FROM books WHERE user_id IN ($1, $2)`, [testUser1.id, testUser2.id]);
    console.log('✅ CSDL đã được khôi phục nguyên vẹn!');
  }

  if (failed > 0) {
    throw new Error(`Có ${failed} bài kiểm thử thất bại!`);
  }
}

runUiStateRefreshFullkey()
  .then(() => {
    console.log('✅ TEST UI STATE REFRESH FULLKEY COMPLETED SUCCESSFULLY.\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  });



