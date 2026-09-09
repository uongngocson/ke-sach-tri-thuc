import db from '../config/database.js';

// Lấy tên đệm + tên từ full_name (bỏ họ = từ đầu tiên)
// VD: "Nguyễn Xuân Diễn" -> "Xuân Diễn"
// VD: "Đỗ Viết Kim Hoàng" -> "Viết Kim Hoàng"
function extractMiddleAndGivenName(fullName) {
  if (!fullName) return null;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName; // Chỉ có 1 từ thì giữ nguyên
  return parts.slice(1).join(' '); // Bỏ từ đầu (họ), lấy phần còn lại
}

async function reseedNicknames() {
  console.log('🔄 Bắt đầu cập nhật nickname = tên đệm + tên từ full_name...\n');

  // Lấy toàn bộ users
  const users = await db.query(`SELECT id, full_name, nickname FROM users ORDER BY id`);
  console.log(`📊 Tổng số users: ${users.rows.length}`);

  // Preview 10 mẫu
  console.log('\n📋 Preview 10 mẫu đầu:');
  users.rows.slice(0, 10).forEach(u => {
    const newNick = extractMiddleAndGivenName(u.full_name);
    console.log(`  "${u.full_name}" → nickname: "${newNick}" (cũ: "${u.nickname}")`);
  });

  // Cập nhật nickname cho tất cả users
  console.log('\n⚙️  Đang cập nhật...');
  let updated = 0;
  for (const u of users.rows) {
    const newNick = extractMiddleAndGivenName(u.full_name);
    await db.query(`UPDATE users SET nickname = $1 WHERE id = $2`, [newNick, u.id]);
    updated++;
  }
  console.log(`✅ Đã cập nhật ${updated} users.`);

  // Cập nhật luôn books.reader_name theo user_id
  console.log('\n⚙️  Đang sync books.reader_name...');
  const syncResult = await db.query(`
    UPDATE books b
    SET reader_name = u.nickname
    FROM users u
    WHERE b.user_id = u.id
    RETURNING b.id
  `);
  console.log(`✅ Đã sync ${syncResult.rows.length} books.reader_name.`);

  // Xác nhận kết quả
  console.log('\n📋 Kết quả sau cập nhật (10 mẫu users):');
  const check = await db.query(`SELECT full_name, nickname FROM users LIMIT 10`);
  check.rows.forEach(u => console.log(`  "${u.full_name}" → "${u.nickname}"`));

  console.log('\n📋 Kết quả books.reader_name (10 mẫu):');
  const bookCheck = await db.query(`
    SELECT b.title, b.reader_name, u.full_name 
    FROM books b 
    JOIN users u ON b.user_id = u.id 
    LIMIT 10
  `);
  bookCheck.rows.forEach(r => console.log(`  [${r.full_name}] → reader_name: "${r.reader_name}"`));

  process.exit(0);
}

reseedNicknames().catch(e => { console.error('❌ Lỗi:', e.message); process.exit(1); });
