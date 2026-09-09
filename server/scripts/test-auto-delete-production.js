import db from '../config/database.js';
import jwt from 'jsonwebtoken';
import { CredibilityService } from '../services/credibility.service.js';
import { ModerationService } from '../services/moderation.service.js';
import GrowthService from '../services/growth.service.js';

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

async function runAutoDeleteProductionTests() {
  console.log('\n🛡️ =================================================================');
  console.log('🛡️ KIỂM THỬ TỰ ĐỘNG XÓA TRÍCH DẪN ĐIỂM < 60 & UI DANH SÁCH ĐÃ XÓA');
  console.log('🛡️ =================================================================\n');

  try {
    let adminUser = (await db.query("SELECT * FROM admin_users WHERE username = 'admin' LIMIT 1")).rows[0];
    if (!adminUser) {
      adminUser = (await db.query("SELECT * FROM admin_users LIMIT 1")).rows[0];
    }

    const adminToken = jwt.sign(
      { id: adminUser.id, username: adminUser.username, role: adminUser.role },
      process.env.JWT_SECRET || 'caosach_super_secure_jwt_secret_2026_production',
      { expiresIn: '1h' }
    );

    // Dọn dữ liệu test cũ nếu có
    await db.query("DELETE FROM books WHERE title LIKE 'PROD_TEST_%'");
    await db.query("DELETE FROM deleted_quotes_archive WHERE title LIKE 'PROD_TEST_%'");

    // 1. Tạo 1 sách test lành mạnh (dự kiến >= 60 điểm)
    const goodBookRes = await db.query(`
      INSERT INTO books (title, author, quote, reader_name, visibility_status, moderation_status, team_id)
      VALUES ('PROD_TEST_GOOD_BOOK', 'Dale Carnegie', 'Đắc nhân tâm là chìa khóa mở cánh cửa thấu cảm con người.', 'Tester Good', 'visible', 'pending_review', 1)
      RETURNING *
    `);
    const goodBook = goodBookRes.rows[0];

    // 2. Tạo 1 sách test chứa từ ngữ bạo lực/chửi bậy (dự kiến < 60 điểm)
    const badBookRes = await db.query(`
      INSERT INTO books (title, author, quote, reader_name, visibility_status, moderation_status, team_id)
      VALUES ('PROD_TEST_BAD_BOOK', 'Khuyết Danh', 'Mẹ kiếp thằng chó chết cút xéo tao giết mày', 'Tester Toxic', 'visible', 'pending_review', 1)
      RETURNING *
    `);
    const badBook = badBookRes.rows[0];

    // Cập nhật total_books để theo dõi trừ điểm chính xác
    await db.query("UPDATE community_growth SET total_books = total_books + 2 WHERE id = 1");
    const growthBefore = await GrowthService.getCommunityGrowth();

    console.log('--- [1/4] KIỂM THỬ CHẤM ĐIỂM SÁCH LÀNH MẠNH (ĐIỂM >= 60) ---');
    const scoredGood = await CredibilityService.scoreQuoteCredibility(goodBook.id);
    console.log(`  📊 Điểm AI chấm sách lành mạnh: ${scoredGood.credibility_score}/100`);
    assert(scoredGood.credibility_score >= 60, 'Sách lành mạnh có điểm >= 60');
    assert(scoredGood.visibility_status === 'visible', 'Sách lành mạnh GIỮ NGUYÊN trạng thái visible');

    console.log('\n--- [2/4] KIỂM THỬ TỰ ĐỘNG XÓA KHI ĐIỂM < 60 (CHỮI BẬY/BẠO LỰC) ---');
    const scoredBad = await CredibilityService.scoreQuoteCredibility(badBook.id);
    console.log(`  📊 Điểm AI chấm sách vi phạm: ${scoredBad.credibility_score}/100`);
    assert(scoredBad.credibility_score < 60, 'Sách vi phạm chuẩn mực được chấm điểm < 60');
    assert(scoredBad.visibility_status === 'deleted', 'Sách vi phạm TỰ ĐỘNG chuyển thành visibility_status = "deleted"');
    assert(scoredBad.moderation_status === 'rejected', 'Sách vi phạm TỰ ĐỘNG chuyển thành moderation_status = "rejected"');
    assert(scoredBad.deleted_at !== null, 'Trường deleted_at được ghi nhận thời gian xóa tự động');
    assert(scoredBad.deletion_reason && scoredBad.deletion_reason.includes('< 60'), 'Lý do xóa deletion_reason thể hiện rõ vi phạm điểm < 60');

    // Kiểm tra lưu trữ trong deleted_quotes_archive
    const archiveRes = await db.query("SELECT * FROM deleted_quotes_archive WHERE book_id = $1", [badBook.id]);
    assert(archiveRes.rows.length === 1, 'Bản sao sách vi phạm được lưu trữ vĩnh viễn trong deleted_quotes_archive');
    assert(archiveRes.rows[0].deletion_source === 'AI_AUTO', 'Nguồn xóa trong archive ghi nhận rõ là AI_AUTO');

    // Kiểm tra audit_logs
    const auditRes = await db.query("SELECT * FROM audit_logs WHERE target_id = $1 AND action = 'AI_AUTO_DELETE_BOOK'", [badBook.id]);
    assert(auditRes.rows.length === 1, 'Hệ thống đã ghi log truy vết tự động xóa trong audit_logs');

    // Kiểm tra đồng bộ total_books
    const growthAfterBad = await GrowthService.getCommunityGrowth();
    assert(growthAfterBad.totalBooks === growthBefore.totalBooks - 1, 'total_books trong community_growth đã tự động giảm đi 1 khi sách bị xóa');

    console.log('\n--- [3/4] KIỂM THỬ API QUẢN TRỊ VIÊN: DANH SÁCH ĐÃ XÓA & BỘ ĐẾM COUNTS ---');
    const apiRes = await fetch('http://localhost:5000/api/v1/admin/books?visibility_status=deleted', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const apiData = await apiRes.json();
    assert(apiData.success === true, 'API GET /admin/books?visibility_status=deleted thành công');
    assert(apiData.data.counts && apiData.data.counts.deleted >= 1, 'counts.deleted phản hồi chính xác số lượng sách đã xóa');
    const hasBadBookInDeleted = apiData.data.books.some(b => b.id === badBook.id);
    assert(hasBadBookInDeleted === true, 'Sách bị AI xóa xuất hiện chuẩn xác trong danh sách đã xóa của Admin');

    console.log('\n--- [4/4] KIỂM THỬ KHÔI PHỤC (RESTORE) TRÍCH DẪN TỪ DANH SÁCH ĐÃ XÓA ---');
    const restoreRes = await ModerationService.updateBookStatus(
      badBook.id, 
      { visibility_status: 'visible', moderation_status: 'reviewed', moderation_notes: 'Khôi phục kiểm thử' },
      adminUser,
      '127.0.0.1'
    );
    assert(restoreRes.visibility_status === 'visible', 'Trích dẫn đã được khôi phục thành công sang visible');
    assert(restoreRes.deleted_at === null, 'Trường deleted_at được xóa (NULL) sau khi khôi phục');
    assert(restoreRes.deletion_reason === null, 'Lý do xóa deletion_reason được xóa sau khi khôi phục');

    const growthAfterRestore = await GrowthService.getCommunityGrowth();
    assert(growthAfterRestore.totalBooks === growthAfterBad.totalBooks + 1, 'total_books tự động tăng lại 1 khi khôi phục trích dẫn');

    // Dọn dẹp
    await db.query("DELETE FROM books WHERE title LIKE 'PROD_TEST_%'");
    await db.query("DELETE FROM deleted_quotes_archive WHERE title LIKE 'PROD_TEST_%'");
    await db.query("DELETE FROM audit_logs WHERE target_id IN ($1, $2)", [goodBook.id, badBook.id]);
    await db.query("UPDATE community_growth SET total_books = total_books - 2 WHERE id = 1");

    console.log('\n🛡️ =================================================================');
    console.log(`🎉 KẾT QUẢ: ${passed} PASSED | ${failed} FAILED`);
    console.log('🛡️ =================================================================\n');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Lỗi khi chạy test:', err);
    process.exit(1);
  }
}

runAutoDeleteProductionTests();
