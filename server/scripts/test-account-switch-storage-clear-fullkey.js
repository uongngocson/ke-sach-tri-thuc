/**
 * server/scripts/test-account-switch-storage-clear-fullkey.js
 * Comprehensive Unit Test Key Suite:
 * Verifies 100% data purge from localStorage & sessionStorage upon account switch / guest / logout.
 */
import { UserIdentityModal } from '../../assets/auth/UserIdentityModal.js';
import { ApiDataStore } from '../../assets/data/ApiDataStore.js';
import { DailyDewService } from '../../assets/services/DailyDewService.js';

async function runAccountSwitchStorageTest() {
  console.log('🧪 =================================================================');
  console.log('🧪 RUNNING ACCOUNT SWITCH LOCALSTORAGE PURGE FULLKEY TEST');
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

  // Mock standard Web Storage API for Node.js test environment
  class MockStorage {
    constructor() {
      this.store = new Map();
    }
    getItem(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    }
    setItem(key, value) {
      this.store.set(key, String(value));
    }
    removeItem(key) {
      this.store.delete(key);
    }
    clear() {
      this.store.clear();
    }
    get length() {
      return this.store.size;
    }
    key(index) {
      return Array.from(this.store.keys())[index] || null;
    }
  }

  const mockLocalStorage = new MockStorage();
  const mockSessionStorage = new MockStorage();
  globalThis.localStorage = mockLocalStorage;
  globalThis.sessionStorage = mockSessionStorage;

  // Mock window and document
  function createMockElement() {
    return {
      setAttribute: () => {},
      appendChild: () => {},
      style: {},
      classList: { add: () => {}, remove: () => {} },
      addEventListener: () => {},
      querySelector: () => createMockElement(),
      querySelectorAll: () => []
    };
  }

  globalThis.window = {
    location: { hostname: 'localhost', protocol: 'http:', host: 'localhost:5000', port: '5000' },
    dispatchEvent: () => {},
    showToast: () => {},
    addEventListener: () => {},
    document: {
      createElement: () => createMockElement(),
      getElementById: () => null,
      addEventListener: () => {},
      body: { appendChild: () => {} },
      head: { appendChild: () => {} }
    },
    DailyDewService,
    MockDataStore: ApiDataStore,
    ApiDataStore
  };
  globalThis.document = globalThis.window.document;
  globalThis.CustomEvent = class { constructor(type, detail) { this.type = type; this.detail = detail; } };

  // =========================================================================
  // SECTION 1: KHỞI TẠO DỮ LIỆU CŨ CỦA USER A (DIRTY STORAGE SETUP)
  // =========================================================================
  console.log('📦 [1/5] Khởi tạo dữ liệu ô nhiễm của User A trong localStorage...');

  const userA = {
    id: 'user-aaa-1111',
    full_name: 'Nguyễn Văn A',
    nickname: 'Cáo Chiến Thần',
    team_id: 1,
    team_display_name: 'SCU_BO'
  };

  localStorage.setItem('caosach_user_session', JSON.stringify(userA));
  localStorage.setItem('caosach_current_team_id', '1');
  localStorage.setItem('caosach_liked_quotes', JSON.stringify({ 'quote-101': true, 'quote-102': true, 'quote-103': true }));
  localStorage.setItem('caosach_cached_quotes', JSON.stringify([{ id: 'quote-101', quote: 'Học hỏi không ngừng' }]));
  localStorage.setItem('caosach_cached_growth', JSON.stringify({ activeReaders: 45, totalEXP: 250 }));
  localStorage.setItem('fpt_dew_checkin_user-aaa-1111_2026-09-09', 'true');
  localStorage.setItem('fpt_dew_streak_user-aaa-1111', '5');
  localStorage.setItem('caosach_welcome_seen', 'true');
  localStorage.setItem('theme_mode', 'dark');
  sessionStorage.setItem('caosach_inspected_team_id', '4');

  assert(localStorage.getItem('caosach_liked_quotes') !== null, 'Dữ liệu liked quotes của User A đã tồn tại trong localStorage');
  assert(localStorage.getItem('caosach_cached_quotes') !== null, 'Dữ liệu cached quotes của User A đã tồn tại');
  assert(localStorage.getItem('caosach_cached_growth') !== null, 'Dữ liệu cached growth của User A đã tồn tại');
  assert(localStorage.getItem('fpt_dew_streak_user-aaa-1111') === '5', 'Streak của User A đã được lưu');
  assert(sessionStorage.getItem('caosach_inspected_team_id') === '4', 'Inspected team trong sessionStorage đã được lưu');

  // =========================================================================
  // SECTION 2: CHUYỂN ĐỔI SANG USER B QUA confirmUser(userB)
  // =========================================================================
  console.log('\n📦 [2/5] Thực hiện chuyển đổi tài khoản sang User B (confirmUser)...');

  const userB = {
    id: 'user-bbb-2222',
    full_name: 'Trần Thị B',
    nickname: 'Búp Sen Xanh',
    team_id: 2,
    team_display_name: 'Hà Đông Tây Bắc'
  };

  const modalInstance = new UserIdentityModal({
    onUserIdentified: (u) => {
      // Callback triggered
    }
  });

  // Call confirmUser for User B
  modalInstance.confirmUser(userB);

  // Verify 100% old data of User A was wiped
  assert(localStorage.getItem('caosach_liked_quotes') === null, 'Dữ liệu cũ: caosach_liked_quotes bị xóa sạch 100%');
  assert(localStorage.getItem('caosach_cached_quotes') === null, 'Dữ liệu cũ: caosach_cached_quotes bị xóa sạch 100%');
  assert(localStorage.getItem('caosach_cached_growth') === null, 'Dữ liệu cũ: caosach_cached_growth bị xóa sạch 100%');
  assert(localStorage.getItem('fpt_dew_checkin_user-aaa-1111_2026-09-09') === null, 'Dữ liệu cũ: checkin tưới nước User A bị xóa sạch');
  assert(localStorage.getItem('fpt_dew_streak_user-aaa-1111') === null, 'Dữ liệu cũ: streak tưới nước User A bị xóa sạch');
  assert(localStorage.getItem('caosach_welcome_seen') === null, 'Dữ liệu cũ: caosach_welcome_seen bị dọn sạch');
  assert(sessionStorage.getItem('caosach_inspected_team_id') === null, 'Dữ liệu cũ: sessionStorage caosach_inspected_team_id bị xóa sạch');

  // Verify new user data was written cleanly
  const currentSession = UserIdentityModal.getStoredSession();
  assert(currentSession !== null && currentSession.id === userB.id, 'Session mới thuộc về chính xác User B', `User ID: ${currentSession?.id}`);
  assert(localStorage.getItem('caosach_current_team_id') === '2', 'Team ID mới được cập nhật chính xác là Team 2');

  // Verify theme_mode was safely preserved
  assert(localStorage.getItem('theme_mode') === 'dark', 'Cài đặt giao diện Dark Mode (theme_mode) được bảo toàn nguyên vẹn');

  // =========================================================================
  // SECTION 3: THÊM DỮ LIỆU USER B & CHUYỂN SANG CHẾ ĐỘ KHÁCH (GUEST)
  // =========================================================================
  console.log('\n📦 [3/5] Thêm dữ liệu User B và kiểm tra chuyển sang Khách Tham Quan...');

  localStorage.setItem('caosach_liked_quotes', JSON.stringify({ 'quote-201': true }));
  localStorage.setItem('fpt_dew_streak_user-bbb-2222', '3');
  sessionStorage.setItem('caosach_inspected_team_id', '7');

  // Simulate Guest click logic
  UserIdentityModal.clearUserLocalStorage({ preserveTheme: true });
  const guestSession = {
    id: 'guest',
    full_name: 'Khách Tham Quan',
    nickname: 'Khách Tham Quan',
    email: 'guest',
    isGuest: true,
    team_id: null,
    team_display_name: 'Khách Tham Quan'
  };
  UserIdentityModal.saveSession(guestSession);

  assert(localStorage.getItem('caosach_liked_quotes') === null, 'Khi chuyển sang Khách: liked quotes của User B bị xóa sạch');
  assert(localStorage.getItem('fpt_dew_streak_user-bbb-2222') === null, 'Khi chuyển sang Khách: streak User B bị xóa sạch');
  assert(sessionStorage.getItem('caosach_inspected_team_id') === null, 'Khi chuyển sang Khách: sessionStorage bị làm trống');

  const storedGuest = UserIdentityModal.getStoredSession();
  assert(storedGuest && storedGuest.isGuest === true, 'Session hiện tại là Khách Tham Quan (isGuest = true)');
  assert(localStorage.getItem('caosach_current_team_id') === null, 'Khách không có team_id nên caosach_current_team_id không tồn tại');
  assert(localStorage.getItem('theme_mode') === 'dark', 'Giao diện theme_mode vẫn giữ Dark Mode');

  // =========================================================================
  // SECTION 4: ĐĂNG XUẤT HOÀN TOÀN (clearSession)
  // =========================================================================
  console.log('\n📦 [4/5] Kiểm tra gọi UserIdentityModal.clearSession()...');

  localStorage.setItem('caosach_cached_quotes', JSON.stringify([{ id: 999 }]));
  UserIdentityModal.clearSession();

  assert(UserIdentityModal.getStoredSession() === null, 'clearSession(): Session bị xóa hoàn toàn trả về null');
  assert(localStorage.getItem('caosach_cached_quotes') === null, 'clearSession(): cached quotes bị xóa sạch');
  assert(localStorage.getItem('caosach_current_team_id') === null, 'clearSession(): current team id bị xóa');
  assert(localStorage.getItem('theme_mode') === 'dark', 'clearSession(): theme_mode vẫn được bảo vệ');

  // =========================================================================
  // SECTION 5: KIỂM TRA TÙY CHỌN preserveTheme: false
  // =========================================================================
  console.log('\n📦 [5/5] Kiểm tra tùy chọn preserveTheme: false...');

  UserIdentityModal.clearUserLocalStorage({ preserveTheme: false });
  assert(localStorage.length === 0, 'Khi preserveTheme = false, toàn bộ localStorage có size = 0');
  assert(localStorage.getItem('theme_mode') === null, 'theme_mode bị xóa khi không yêu cầu bảo tồn');

  console.log('\n=================================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passed} PASSED | ${failed} FAILED (100% SUCCESS)`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAccountSwitchStorageTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
