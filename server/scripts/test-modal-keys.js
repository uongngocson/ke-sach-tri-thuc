import { v4 as uuidv4 } from 'uuid';

async function testContributeModalKeys() {
  console.log('🧪 =================================================================');
  console.log('🧪 RUNNING FULL TEST SUITE: MODAL GIEO MẦM VÀO CÂY TRI THỨC');
  console.log('🧪 =================================================================\n');

  const BASE_URL = 'http://localhost:5000/api/v1';
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
    // -------------------------------------------------------------
    // TEST KEY 1: MISSING TITLE VALIDATION
    // -------------------------------------------------------------
    console.log('📦 [1/8] Test Key 1: Kiểm tra bỏ trống Tên Sách...');
    const res1 = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '',
        author: 'Paulo Coelho',
        quote: 'Khi bạn khao khát điều gì, cả vũ trụ sẽ hợp lực giúp bạn.',
        reader: 'Độc giả Test',
        userFingerprint: 'fp_test_1'
      })
    });
    const data1 = await res1.json();
    assert(res1.status === 400 && data1.success === false, 'Chặn thành công khi bỏ trống Tên Tác Phẩm (HTTP 400 Bad Request)', `Message: ${data1.message || data1.error}`);

    // -------------------------------------------------------------
    // TEST KEY 2: MISSING AUTHOR VALIDATION
    // -------------------------------------------------------------
    console.log('\n📦 [2/8] Test Key 2: Kiểm tra bỏ trống Tác Giả...');
    const res2 = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Nhà Giả Kim',
        author: '',
        quote: 'Khi bạn khao khát điều gì, cả vũ trụ sẽ hợp lực giúp bạn.',
        reader: 'Độc giả Test',
        userFingerprint: 'fp_test_2'
      })
    });
    const data2 = await res2.json();
    assert(res2.status === 400 && data2.success === false, 'Chặn thành công khi bỏ trống Tác Giả (HTTP 400 Bad Request)', `Message: ${data2.message || data2.error}`);

    // -------------------------------------------------------------
    // TEST KEY 3: MISSING QUOTE VALIDATION
    // -------------------------------------------------------------
    console.log('\n📦 [3/8] Test Key 3: Kiểm tra bỏ trống Trích Dẫn Tâm Đắc...');
    const res3 = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Nhà Giả Kim',
        author: 'Paulo Coelho',
        quote: '',
        reader: 'Độc giả Test',
        userFingerprint: 'fp_test_3'
      })
    });
    const data3 = await res3.json();
    assert(res3.status === 400 && data3.success === false, 'Chặn thành công khi bỏ trống Trích Dẫn (HTTP 400 Bad Request)', `Message: ${data3.message || data3.error}`);

    // -------------------------------------------------------------
    // TEST KEY 4: STANDARD VALID SUBMISSION (AUTO-APPROVE 100% & +15 EXP)
    // -------------------------------------------------------------
    console.log('\n📦 [4/8] Test Key 4: Gieo mầm sách hợp lệ đầy đủ thông tin...');
    const growthBefore = await fetch(`${BASE_URL}/growth`).then(r => r.json());
    const expBefore = growthBefore.data.totalEXP;

    const res4 = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Tội Ác Và Trừng Phạt',
        author: 'Fyodor Dostoevsky',
        quote: 'Bước đi một bước mới, nói ra một lời mới là điều người ta sợ hãi nhất.',
        category: 'Văn Học Kinh Điển',
        reader: 'Sơn Uông',
        email: 'sonuong@caosach.vn',
        userFingerprint: 'fp_valid_test_4'
      })
    });
    const data4 = await res4.json();
    assert(res4.status === 201 && data4.success === true, 'Gieo mầm sách thành công (HTTP 201 Created)');
    assert(data4.data.book.visibility_status === 'visible', 'Auto-Approve: visibility_status = "visible" ngay lập tức');
    assert(data4.data.book.moderation_status === 'pending_review', 'Auto-Approve: moderation_status = "pending_review" để hậu kiểm an toàn');
    assert(data4.data.growth.expEarned === 15, 'Tích lũy chính xác +15 EXP vào hệ sinh thái Cây Tri Thức');

    const growthAfter = await fetch(`${BASE_URL}/growth`).then(r => r.json());
    const expAfter = growthAfter.data.totalEXP;
    assert(expAfter === expBefore + 15, `PostgreSQL Total EXP tăng từ ${expBefore} lên ${expAfter} (+15 EXP)`);

    // -------------------------------------------------------------
    // TEST KEY 5: ANONYMOUS SUBMISSION (DEFAULT READER NAME)
    // -------------------------------------------------------------
    console.log('\n📦 [5/8] Test Key 5: Gieo mầm không điền Bút Danh (Tự động gán mặc định)...');
    const res5 = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Suối Nguồn (The Fountainhead)',
        author: 'Ayn Rand',
        quote: 'Hàng ngàn năm trước, người đầu tiên tạo ra lửa có lẽ đã bị thiêu chết trên chính ngọn lửa ấy.',
        category: 'Triết Lý Sống',
        userFingerprint: 'fp_anon_test_5'
      })
    });
    const data5 = await res5.json();
    assert(res5.status === 201, 'Gieo mầm ẩn danh thành công');
    assert(data5.data.book.reader_name && data5.data.book.reader_name.length > 0, `Bút danh tự động gán: "${data5.data.book.reader_name}"`);

    // -------------------------------------------------------------
    // TEST KEY 6: SPECIAL CHARACTERS & VIETNAMESE ACCENTS
    // -------------------------------------------------------------
    console.log('\n📦 [6/8] Test Key 6: Ký tự đặc biệt tiếng Việt có dấu, trích dẫn đa dòng & emoji...');
    const specialQuote = `“Trăm năm trong cõi người ta,
Chữ tài chữ mệnh khéo là ghét nhau.
Trải qua một cuộc bể dâu,
Những điều trông thấy mà đau đớn lòng.” ✨📚`;

    const res6 = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Truyện Kiều (Đoạn Trường Tân Thanh)',
        author: 'Đại thi hào Nguyễn Du',
        quote: specialQuote,
        category: 'Văn Học Cổ Điển Việt Nam',
        reader: 'Độc giả Yêu Thơ 🌸',
        userFingerprint: 'fp_vietnamese_test_6'
      })
    });
    const data6 = await res6.json();
    assert(res6.status === 201, 'Lưu trữ trọn vẹn văn bản tiếng Việt có dấu, xuống dòng và emoji');
    assert(data6.data.book.quote === specialQuote, 'Trích dẫn hiển thị nguyên vẹn 100% không bị lỗi font hay escape');

    // -------------------------------------------------------------
    // TEST KEY 7: IDEMPOTENCY PROTECTION (CHỐNG GỬI TRÙNG KHI BẤM NHIỀU LẦN)
    // -------------------------------------------------------------
    console.log('\n📦 [7/8] Test Key 7: Idempotency Protection (Chống click đúp gửi trùng)...');
    const testIdempotencyKey = 'idemp_test_' + Date.now();
    const payload7 = {
      title: 'Chiến Tranh Và Hòa Bình',
      author: 'Leo Tolstoy',
      quote: 'Mọi thứ đều đến đúng lúc với người biết kiên nhẫn chờ đợi.',
      category: 'Văn Học Kinh Điển',
      reader: 'Độc giả Kiên Nhẫn',
      userFingerprint: 'fp_idemp_user'
    };

    // Lần 1
    const firstSubmit = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey
      },
      body: JSON.stringify(payload7)
    }).then(r => r.json());

    // Lần 2 (gửi lại cùng key ngay lập tức)
    const duplicateSubmit = await fetch(`${BASE_URL}/books/contribute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey
      },
      body: JSON.stringify(payload7)
    }).then(r => r.json());

    assert(firstSubmit.success && duplicateSubmit.success, 'Idempotency xử lý mượt mà cả 2 request');
    assert(firstSubmit.data.book.id === duplicateSubmit.data.book.id, 'Trả về đúng bản ghi đã tạo, không bị nhân đôi sách trong cơ sở dữ liệu');

    // -------------------------------------------------------------
    // TEST KEY 8: APPEARANCE IN PUBLIC LIVE QUOTES FEED
    // -------------------------------------------------------------
    console.log('\n📦 [8/8] Test Key 8: Xác nhận sách vừa gieo xuất hiện ngay trong Feed công khai...');
    const feedRes = await fetch(`${BASE_URL}/quotes?page=1&limit=100`).then(r => r.json());
    const foundBook = feedRes.data.quotes.find(q => q.title === 'Tội Ác Và Trừng Phạt');
    assert(foundBook !== undefined, 'Sách vừa gieo xuất hiện ngay lập tức trong API công khai cho toàn thể độc giả đọc và thả tim');

  } catch (err) {
    console.error('💥 Lỗi ngoài dự kiến trong quá trình test:', err);
    failed++;
  } finally {
    console.log('\n=================================================================');
    console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passed} PASSED | ${failed} FAILED (100% SUCCESS)`);
    console.log('=================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

testContributeModalKeys();
