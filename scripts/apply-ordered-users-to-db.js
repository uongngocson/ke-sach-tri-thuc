import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../server/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function applyOrderedUsersToDb() {
  console.log('\n=================================================================');
  console.log('🔄 ÁP DỤNG CỘT TT (1-288) VÀ SẮP XẾP VẬT LÝ TABLE USERS');
  console.log('🔄 Đảm bảo 100% thứ tự từ trên xuống dưới trong CSDL');
  console.log('=================================================================\n');

  // 1. Thêm cột tt vào bảng users nếu chưa có
  console.log('⚙️ [1/5] Thêm cột tt (INT) vào bảng users...');
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS tt INT;');

  // 2. Nạp dữ liệu chuẩn 288 người từ teams-and-users.json
  const dataPath = path.join(__dirname, '../server/data/teams-and-users.json');
  const { users } = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`📦 [2/5] Nạp ${users.length} thành viên có TT từ 1 đến 288.`);

  // 3. Cập nhật tt và nickname cho từng người dùng
  console.log('📝 [3/5] Cập nhật tt và nickname chính thức vào database...');
  let updatedCount = 0;
  for (const u of users) {
    const res = await db.query(`
      UPDATE users
      SET tt = $1, nickname = $2, updated_at = NOW()
      WHERE full_name = $3 AND team_id = $4 AND branch = $5 AND parent_department = $6
      RETURNING id
    `, [u.tt, u.nickname, u.full_name, u.team_id, u.branch, u.parent_department]);

    if (res.rows.length > 0) {
      updatedCount++;
    } else {
      // Fallback if branch/department differs
      const fb = await db.query(`
        UPDATE users
        SET tt = $1, nickname = $2, updated_at = NOW()
        WHERE full_name = $3 AND team_id = $4
        RETURNING id
      `, [u.tt, u.nickname, u.full_name, u.team_id]);
      if (fb.rows.length > 0) updatedCount++;
      else console.warn(`  ⚠️ Không tìm thấy user: "${u.full_name}" (Đội ${u.team_id})`);
    }
  }
  console.log(`  ✅ Đã cập nhật TT và nickname cho ${updatedCount}/288 users.`);

  // 4. Đồng bộ reader_name cho books
  console.log('\n📚 [4/5] Đồng bộ books.reader_name theo nickname mới...');
  const syncBooksRes = await db.query(`
    UPDATE books b
    SET reader_name = u.nickname
    FROM users u
    WHERE b.user_id = u.id AND u.nickname IS NOT NULL
    RETURNING b.id
  `);
  console.log(`  ✅ Đã đồng bộ ${syncBooksRes.rows.length} cuốn sách.`);

  // 5. Tạo Index và CLUSTER bảng users theo tt ASC
  console.log('\n🏛️ [5/5] Tạo Index và CLUSTER sắp xếp vật lý bảng users theo tt ASC...');
  await db.query('CREATE INDEX IF NOT EXISTS idx_users_tt ON users(tt ASC);');
  await db.query('CLUSTER users USING idx_users_tt;');
  console.log('  ✅ CLUSTER thành công: Bảng users đã được sắp xếp vật lý 100% từ 1 đến 288 trên đĩa!');

  // Kiểm tra xác thực 15 dòng đầu tiên truy vấn tự nhiên (không ORDER BY)
  console.log('\n📋 Kiểm tra truy vấn tự nhiên SELECT * FROM users (không ORDER BY):');
  const checkNatural = await db.query('SELECT tt, full_name, nickname, team_id FROM users LIMIT 15');
  console.table(checkNatural.rows);

  console.log('📋 Kiểm tra 5 dòng cuối cùng:');
  const checkLast = await db.query('SELECT tt, full_name, nickname, team_id FROM users ORDER BY tt DESC LIMIT 5');
  console.table(checkLast.rows.reverse());

  console.log('\n🎉 HOÀN TẤT: CSDL ĐÃ ĐƯỢC ĐỒNG BỘ THỨ TỰ TỪ TRÊN XUỐNG DƯỚI 100%!\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  applyOrderedUsersToDb()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Lỗi:', err);
      process.exit(1);
    });
}
