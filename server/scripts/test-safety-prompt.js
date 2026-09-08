/**
 * server/scripts/test-safety-prompt.js
 * Kiểm thử prompt chấm điểm an toàn nội dung: chỉ xét chửi bậy, bạo lực, thiếu đạo đức
 */

import 'dotenv/config';
import { CredibilityService } from '../services/credibility.service.js';
import db from '../config/database.js';

async function test() {
  console.log('=== TEST 1: CÂU TRÍCH DẪN CHUẨN MỰC, LÀNH MẠNH ===');
  const cleanRes = await db.query(`
    INSERT INTO books (title, author, quote, category, reader_name, visibility_status)
    VALUES ('Đắc Nhân Tâm', 'Dale Carnegie', 'Một nụ cười chân thành có thể làm ấm áp cả một ngày đông giá lạnh.', 'Kỹ năng sống', 'Độc giả #999', 'visible')
    RETURNING id
  `);
  const cleanId = cleanRes.rows[0].id;
  const scoredClean = await CredibilityService.scoreQuoteCredibility(cleanId);
  console.log('Clean Quote Score:', scoredClean.credibility_score);
  console.log('Clean Quote Status:', scoredClean.credibility_rationale);

  console.log('\n=== TEST 2: CÂU CHỨA TỪ NGỮ CHỬI BẬY / THÔ TỤC / BẠO LỰC ===');
  const toxicRes = await db.query(`
    INSERT INTO books (title, author, quote, category, reader_name, visibility_status)
    VALUES ('Sách Test', 'Ẩn Danh', 'Mẹ kiếp thằng khốn nạn cút xéo đi không tao đập chết mẹ mày', 'Test', 'Spammer', 'visible')
    RETURNING id
  `);
  const toxicId = toxicRes.rows[0].id;
  const scoredToxic = await CredibilityService.scoreQuoteCredibility(toxicId);
  console.log('Toxic Quote Score:', scoredToxic.credibility_score);
  console.log('Toxic Quote Status:', scoredToxic.credibility_rationale);

  // Clean up test records
  await db.query('DELETE FROM books WHERE id IN ($1, $2)', [cleanId, toxicId]);
  console.log('\n✅ Đã dọn dẹp dữ liệu test!');
  process.exit(0);
}

test().catch(err => {
  console.error('Lỗi:', err);
  process.exit(1);
});
