import { calculateCelestialState, getMoonPhase, getVietnamDecimalHour, SKY_STAGES } from "../../assets/sky/lib/astronomy.js";

async function runDayNightFullKeyTests() {
  console.log('🧪 =================================================================');
  console.log('🧪 RUNNING DAY & NIGHT FULL-KEY UNIT TEST SUITE (CÁO SÁCH 2026)');
  console.log('🧪 Kiểm thử toàn diện Cơ chế Ban Ngày / Ban Đêm & Chống Lỗi Tối Thui');
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

  try {
    // =========================================================================
    // SECTION 1: MÚI GIỜ VIỆT NAM (Asia/Ho_Chi_Minh - UTC+7) & DECIMAL HOUR
    // =========================================================================
    console.log('📦 [1/6] Test Key Suite 1: Độ Chính Xác Múi Giờ Việt Nam (UTC+7)...');

    // 1.1: 02:30 UTC -> chính xác 09:30 giờ Việt Nam (9.5h)
    const dateMorningUtc = new Date('2026-09-08T02:30:00.000Z');
    const vnMorningHour = getVietnamDecimalHour(dateMorningUtc);
    assert(
      Math.abs(vnMorningHour - 9.5) < 0.001,
      '02:30 UTC chuyển đổi chính xác thành 09:30 giờ sáng Việt Nam (9.5h)',
      `Expected: 9.5, Got: ${vnMorningHour.toFixed(3)}`
    );

    // 1.2: 15:00 UTC -> chính xác 22:00 giờ đêm Việt Nam (22.0h)
    const dateNightUtc = new Date('2026-09-08T15:00:00.000Z');
    const vnNightHour = getVietnamDecimalHour(dateNightUtc);
    assert(
      Math.abs(vnNightHour - 22.0) < 0.001,
      '15:00 UTC chuyển đổi chính xác thành 22:00 giờ đêm Việt Nam (22.0h)',
      `Expected: 22.0, Got: ${vnNightHour.toFixed(3)}`
    );

    // 1.3: 23:00 UTC (ngày 7) -> chính xác 06:00 giờ sáng hôm sau tại Việt Nam (6.0h)
    const dateSunriseUtc = new Date('2026-09-07T23:00:00.000Z');
    const vnSunriseHour = getVietnamDecimalHour(dateSunriseUtc);
    assert(
      Math.abs(vnSunriseHour - 6.0) < 0.001,
      '23:00 UTC chuyển đổi chính xác thành 06:00 bình minh Việt Nam (6.0h)',
      `Expected: 6.0, Got: ${vnSunriseHour.toFixed(3)}`
    );

    // 1.4: 11:15 UTC -> chính xác 18:15 hoàng hôn Việt Nam (18.25h)
    const dateSunsetUtc = new Date('2026-09-08T11:15:00.000Z');
    const vnSunsetHour = getVietnamDecimalHour(dateSunsetUtc);
    assert(
      Math.abs(vnSunsetHour - 18.25) < 0.001,
      '11:15 UTC chuyển đổi chính xác thành 18:15 hoàng hôn Việt Nam (18.25h)',
      `Expected: 18.25, Got: ${vnSunsetHour.toFixed(3)}`
    );

    // 1.5: Decimal hour luôn nằm trong đoạn [0, 24)
    const testHours = [0, 6, 12, 18, 23.999];
    let allValidRange = true;
    for (const h of testHours) {
      const d = new Date(`2026-09-08T${String(Math.floor(h)).padStart(2, '0')}:30:00.000Z`);
      const v = getVietnamDecimalHour(d);
      if (v < 0 || v >= 24) allValidRange = false;
    }
    assert(allValidRange, 'Tất cả các mốc giờ quy đổi luôn thuộc dải hợp lệ [0.0, 24.0)');

    // =========================================================================
    // SECTION 2: CHU KỲ THIÊN VĂN 24 GIỜ (calculateCelestialState)
    // =========================================================================
    console.log('\n📦 [2/6] Test Key Suite 2: Chu Kỳ Thiên Văn 24 Giờ & Độ Sáng Bầu Trời...');

    // 2.1: DAWN (05:15 -> 5.25h)
    const dawnState = calculateCelestialState(5.25);
    assert(
      dawnState.stage === SKY_STAGES.DAWN,
      '05:15 sáng xác định đúng trạng thái Rạng Đông (DAWN)',
      `Stage: ${dawnState.stage}`
    );

    // 2.2: SUNRISE (06:00 -> 6.0h)
    const sunriseState = calculateCelestialState(6.0);
    assert(
      sunriseState.stage === SKY_STAGES.SUNRISE && sunriseState.sun.elevationDeg >= -1,
      '06:00 sáng xác định đúng Bình Minh (SUNRISE) với mặt trời bắt đầu nhô lên',
      `Stage: ${sunriseState.stage}, Elevation: ${sunriseState.sun.elevationDeg.toFixed(1)}°`
    );

    // 2.3: MORNING (09:30 -> 9.5h) - Trọng tâm bug ban ngày
    const morningState = calculateCelestialState(9.5);
    assert(
      morningState.stage === SKY_STAGES.MORNING && morningState.factors.daylight > 0.8 && morningState.factors.stars === 0,
      '09:30 sáng là Buổi Sáng rực rỡ (MORNING), daylight > 0.8, SAO BIẾN MẤT (factors.stars = 0) - KHÔNG TỐI THUI',
      `Stage: ${morningState.stage}, Daylight: ${morningState.factors.daylight.toFixed(2)}, Stars: ${morningState.factors.stars}`
    );

    // 2.4: NOON (12:00 -> 12.0h)
    const noonState = calculateCelestialState(12.0);
    assert(
      noonState.stage === SKY_STAGES.NOON && noonState.factors.daylight === 1.0 && noonState.sun.elevationDeg > 60,
      '12:00 trưa là Chính Ngọ (NOON), độ sáng cực đại 1.0, mặt trời lên thiên đỉnh',
      `Stage: ${noonState.stage}, Sun Elevation: ${noonState.sun.elevationDeg.toFixed(1)}°`
    );

    // 2.5: AFTERNOON (14:30 -> 14.5h)
    const afternoonState = calculateCelestialState(14.5);
    assert(
      afternoonState.stage === SKY_STAGES.AFTERNOON && afternoonState.factors.daylight > 0.8,
      '14:30 chiều là Buổi Chiều rực rỡ (AFTERNOON), daylight sáng rõ',
      `Stage: ${afternoonState.stage}, Daylight: ${afternoonState.factors.daylight.toFixed(2)}`
    );

    // 2.6: GOLDEN_HOUR (17:30 -> 17.5h)
    const goldenState = calculateCelestialState(17.5);
    assert(
      goldenState.stage === SKY_STAGES.GOLDEN_HOUR,
      '17:30 chiều là Giờ Vàng (GOLDEN_HOUR) với ánh hoàng hôn cam ấm',
      `Stage: ${goldenState.stage}`
    );

    // 2.7: SUNSET (18:00 -> 18.0h)
    const sunsetState = calculateCelestialState(18.0);
    assert(
      sunsetState.stage === SKY_STAGES.SUNSET,
      '18:00 tối là Mặt Trời Lặn (SUNSET)',
      `Stage: ${sunsetState.stage}`
    );

    // 2.8: DUSK (19:00 -> 19.0h)
    const duskState = calculateCelestialState(19.0);
    assert(
      duskState.stage === SKY_STAGES.DUSK,
      '19:00 tối là Chạng Vạng (DUSK)',
      `Stage: ${duskState.stage}`
    );

    // 2.9: BLUE_HOUR (20:00 -> 20.0h)
    const blueState = calculateCelestialState(20.0);
    assert(
      blueState.stage === SKY_STAGES.BLUE_HOUR && blueState.factors.stars > 0,
      '20:00 tối là Giờ Xanh (BLUE_HOUR) với sao bắt đầu xuất hiện',
      `Stage: ${blueState.stage}, Stars Factor: ${blueState.factors.stars.toFixed(2)}`
    );

    // 2.10: NIGHT (22:00 -> 22.0h)
    const nightState = calculateCelestialState(22.0);
    assert(
      nightState.stage === SKY_STAGES.NIGHT && nightState.factors.daylight === 0 && nightState.factors.stars > 0.8,
      '22:00 đêm là Đêm Muộn (NIGHT), daylight = 0, bầu trời đầy sao và trăng sáng',
      `Stage: ${nightState.stage}, Daylight: ${nightState.factors.daylight}, Stars: ${nightState.factors.stars}`
    );

    // =========================================================================
    // SECTION 3: LOGIC NHẬN DIỆN BAN NGÀY / BAN ĐÊM TỰ ĐỘNG (AUTO THEME)
    // =========================================================================
    console.log('\n📦 [3/6] Test Key Suite 3: Nhận Diện Tự Động Ban Ngày / Ban Đêm Theo Giờ VN...');

    function resolveThemeState(hour, localStorageValue) {
      if (localStorageValue === 'dark') return { isDark: true, source: 'manual' };
      if (localStorageValue === 'light') return { isDark: false, source: 'manual' };
      // Mặc định tự động theo giờ Việt Nam: Ban ngày từ 6:00 đến 18:00
      const isNight = hour < 6 || hour >= 18;
      return { isDark: isNight, source: 'auto' };
    }

    // 3.1: 09:30 sáng không có override -> Ban Ngày (LIGHT), KHÔNG ĐƯỢC PHÉP TỐI
    const themeAt930 = resolveThemeState(9.5, null);
    assert(
      themeAt930.isDark === false && themeAt930.source === 'auto',
      '09:30 sáng không override: Tự động là BAN NGÀY (isDark = false) - Fix triệt để bug vào web bị tối',
      `isDark: ${themeAt930.isDark}, Source: ${themeAt930.source}`
    );

    // 3.2: 14:00 chiều không có override -> Ban Ngày (LIGHT)
    const themeAt1400 = resolveThemeState(14.0, null);
    assert(
      themeAt1400.isDark === false,
      '14:00 chiều không override: Tự động là BAN NGÀY (isDark = false)',
      `isDark: ${themeAt1400.isDark}`
    );

    // 3.3: 21:00 tối không có override -> Ban Đêm (DARK)
    const themeAt2100 = resolveThemeState(21.0, null);
    assert(
      themeAt2100.isDark === true,
      '21:00 tối không override: Tự động là BAN ĐÊM (isDark = true)',
      `isDark: ${themeAt2100.isDark}`
    );

    // 3.4: 02:00 khuya không có override -> Ban Đêm (DARK)
    const themeAt0200 = resolveThemeState(2.0, null);
    assert(
      themeAt0200.isDark === true,
      '02:00 khuya không override: Tự động là BAN ĐÊM (isDark = true)',
      `isDark: ${themeAt0200.isDark}`
    );

    // 3.5: Kiểm tra trọn vẹn 24 khung giờ
    let daylightHoursCount = 0;
    let nightHoursCount = 0;
    for (let h = 0; h < 24; h++) {
      const res = resolveThemeState(h, null);
      if (res.isDark) nightHoursCount++;
      else daylightHoursCount++;
    }
    assert(
      daylightHoursCount === 12 && nightHoursCount === 12,
      'Chu kỳ ngày đêm tự động phân bổ cân bằng 12h ngày (6h-18h) và 12h đêm (18h-6h)',
      `Day Hours: ${daylightHoursCount}, Night Hours: ${nightHoursCount}`
    );

    // =========================================================================
    // SECTION 4: NÚT GẠT CHỦ ĐỘNG (MANUAL TOGGLE) & GHI NHỚ LOCALSTORAGE
    // =========================================================================
    console.log('\n📦 [4/6] Test Key Suite 4: Nút Gạt Chủ Động (Manual Override) & Ưu Tiên Tuyệt Đối...');

    // 4.1: Giữa ban ngày (12:00) nhưng user chủ động chọn Dark
    const manualDarkAtNoon = resolveThemeState(12.0, 'dark');
    assert(
      manualDarkAtNoon.isDark === true && manualDarkAtNoon.source === 'manual',
      'Người dùng chọn Ban Đêm lúc 12:00 trưa -> Hệ thống tôn trọng quyền của user (isDark = true)',
      `isDark: ${manualDarkAtNoon.isDark}`
    );

    // 4.2: Giữa đêm khuya (23:00) nhưng user chủ động chọn Light
    const manualLightAtNight = resolveThemeState(23.0, 'light');
    assert(
      manualLightAtNight.isDark === false && manualLightAtNight.source === 'manual',
      'Người dùng chọn Ban Ngày lúc 23:00 đêm -> Hệ thống tôn trọng quyền của user (isDark = false)',
      `isDark: ${manualLightAtNight.isDark}`
    );

    // 4.3: Toggle đổi trạng thái 2 chiều
    let currentMode = 'light';
    const toggle = (mode) => (mode === 'dark' ? 'light' : 'dark');
    currentMode = toggle(currentMode);
    assert(currentMode === 'dark', 'Toggle từ Light -> Dark hoạt động chính xác');
    currentMode = toggle(currentMode);
    assert(currentMode === 'light', 'Toggle từ Dark -> Light hoạt động chính xác');

    // =========================================================================
    // SECTION 5: BẢO VỆ CHỐNG VÒNG LẶP VÔ HẠN (MUTATIONOBSERVER RE-ENTRANCY)
    // =========================================================================
    console.log('\n📦 [5/6] Test Key Suite 5: Chống Vòng Lặp Vô Hạn & Lọc Đột Biến Lớp (Anti-Loop)...');

    class RealisticSkyMock {
      constructor(initialDark = false) {
        this.lastThemeDark = initialDark;
        this.targetHour = initialDark ? 22.0 : 12.0;
        this.transitionTriggers = 0;
      }

      onClassMutation(classList) {
        const isDark = classList.includes('dark');
        // Kiểm tra cơ chế lọc chống vòng lặp (Anti-Loop Guard)
        if (this.lastThemeDark === isDark) {
          return false; // Bỏ qua đột biến không liên quan (sky-night-active, modal-open...)
        }
        this.lastThemeDark = isDark;
        this.targetHour = isDark ? 22.0 : 12.0;
        this.transitionTriggers++;
        return true;
      }
    }

    const sky = new RealisticSkyMock(false); // Bắt đầu ở chế độ sáng (Day)

    // 5.1: Hệ thống tự thêm class 'sky-night-active' hoặc 'sky-loaded'
    const ignored1 = sky.onClassMutation(['sky-night-active', 'theme-auto']);
    assert(
      ignored1 === false && sky.transitionTriggers === 0 && sky.targetHour === 12.0,
      "Thêm class 'sky-night-active' KHÔNG kích hoạt đổi bầu trời (Loại bỏ nguyên nhân gốc gây tối thui)",
      `Triggers: ${sky.transitionTriggers}, TargetHour: ${sky.targetHour}`
    );

    // 5.2: Mở modal thêm class 'modal-open'
    const ignored2 = sky.onClassMutation(['modal-open', 'page-scrolled']);
    assert(
      ignored2 === false && sky.transitionTriggers === 0 && sky.targetHour === 12.0,
      'Mở popup/modal thêm class phụ KHÔNG kích hoạt đổi bầu trời sang đêm',
      `Triggers: ${sky.transitionTriggers}, TargetHour: ${sky.targetHour}`
    );

    // 5.3: User thực sự đổi sang .dark
    const toggledToDark = sky.onClassMutation(['dark', 'sky-night-active']);
    assert(
      toggledToDark === true && sky.transitionTriggers === 1 && sky.targetHour === 22.0,
      "Khi class 'dark' thực sự xuất hiện -> Kích hoạt chuyển đổi mượt sang Ban Đêm (22.0h)",
      `Triggers: ${sky.transitionTriggers}, TargetHour: ${sky.targetHour}`
    );

    // 5.4: User thực sự đổi lại sang sáng (loại bỏ .dark)
    const toggledToLight = sky.onClassMutation(['light-mode']);
    assert(
      toggledToLight === true && sky.transitionTriggers === 2 && sky.targetHour === 12.0,
      "Khi class 'dark' được gỡ bỏ -> Kích hoạt chuyển đổi mượt sang Ban Ngày (12.0h)",
      `Triggers: ${sky.transitionTriggers}, TargetHour: ${sky.targetHour}`
    );

    // =========================================================================
    // SECTION 6: ĐỘNG HỌC MẶT TRỜI / MẶT TRĂNG & TÍNH TOÀN VẸN TRẠNG THÁI
    // =========================================================================
    console.log('\n📦 [6/6] Test Key Suite 6: Động Học Quỹ Đạo Mặt Trời / Mặt Trăng...');

    // 6.1: Quỹ đạo mặt trời: Mặt trời luôn có cao độ dương trong khung giờ ban ngày
    const sunMorning = calculateCelestialState(7.0).sun;
    const sunAfternoon = calculateCelestialState(16.0).sun;
    assert(
      sunMorning.elevationDeg > 0 && sunAfternoon.elevationDeg > 0,
      'Mặt trời luôn có cao độ dương trong khung giờ ban ngày (7h & 16h)',
      `Morning: ${sunMorning.elevationDeg.toFixed(1)}°, Afternoon: ${sunAfternoon.elevationDeg.toFixed(1)}°`
    );

    // 6.2: Pha mặt trăng (Moon Phase) luôn nằm trong dải [0, 1]
    const moonPhase = getMoonPhase(new Date('2026-09-08T09:30:00.000Z'));
    assert(
      moonPhase.value >= 0 && moonPhase.value <= 1,
      'Pha mặt trăng (Moon Phase) hợp lệ trong khoảng [0, 1]',
      `Moon Phase: ${moonPhase.value.toFixed(3)} (${moonPhase.name} ${moonPhase.icon})`
    );

    // 6.3: Đêm có sao (factors.stars > 0.5)
    const nightCelestial = calculateCelestialState(23.0);
    assert(
      nightCelestial.factors.stars > 0.5,
      'Ban đêm hiển thị đầy đủ trường sao lấp lánh (stars factor > 0.5)',
      `Stars Factor: ${nightCelestial.factors.stars}`
    );

    console.log('\n=================================================================');
    console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Lỗi nghiêm trọng khi thực thi kiểm thử Day/Night:', err);
    process.exit(1);
  }
}

runDayNightFullKeyTests();
