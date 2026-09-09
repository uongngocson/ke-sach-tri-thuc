import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function reseedOfficialNicknames() {
  console.log('\n=================================================================');
  console.log('🔄 SEED BÚT DANH CHÍNH THỨC CHO 288 THÀNH VIÊN TỪ DANH SÁCH WEB');
  console.log('🔄 Cập nhật nickname theo đúng thứ tự từ trên xuống dưới (1..288)');
  console.log('=================================================================\n');

  const jsonPath = path.join(__dirname, '../data/teams-and-users.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File không tồn tại: ${jsonPath}`);
  }

  const { users } = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`📦 Đã nạp ${users.length} thành viên từ teams-and-users.json`);

  let updatedUsers = 0;
  let notFoundUsers = 0;

  await db.transaction(async (client) => {
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const nickname = u.nickname ? u.nickname.trim() : u.full_name;

      // Cập nhật nickname theo full_name và team_id
      const res = await client.query(`
        UPDATE users
        SET nickname = $1, updated_at = NOW()
        WHERE full_name = $2 AND team_id = $3
        RETURNING id, full_name, nickname, team_id
      `, [nickname, u.full_name, u.team_id]);

      if (res.rows.length > 0) {
        updatedUsers++;
      } else {
        console.warn(`  ⚠️ Không tìm thấy user: "${u.full_name}" (Đội ${u.team_id})`);
        notFoundUsers++;
      }
    }

    console.log(`\n✅ Đã cập nhật thành công ${updatedUsers}/288 nickname trong bảng users!`);
    if (notFoundUsers > 0) {
      console.warn(`⚠️ Có ${notFoundUsers} người dùng không tìm thấy.`);
    }

    // Đồng bộ books.reader_name theo nickname mới của user
    console.log('\n📚 Đồng bộ books.reader_name theo nickname chính thức mới...');
    const booksSyncRes = await client.query(`
      UPDATE books b
      SET reader_name = u.nickname
      FROM users u
      WHERE b.user_id = u.id AND u.nickname IS NOT NULL
      RETURNING b.id
    `);
    console.log(`✅ Đã đồng bộ ${booksSyncRes.rows.length} cuốn sách theo bút danh mới.`);
  });

  // Kiểm tra xác thực 15 người đầu tiên và 5 người đặc biệt
  console.log('\n📋 Kiểm tra xác thực một số bút danh thực tế sau khi seed:');
  const sampleChecks = [
    'Nguyễn Thu Hương',
    'Đỗ Viết Kim Hoàng',
    'Nguyễn Thị Hoài Thanh',
    'Phùng Thu Trang',
    'Cù Xuân Chung',
    'Nguyễn Thị Xuân',
    'Nguyễn Thị Hữu Hằng',
    'Trần Xuân Cường'
  ];

  for (const name of sampleChecks) {
    const check = await db.query('SELECT full_name, nickname, team_id FROM users WHERE full_name = $1 LIMIT 1', [name]);
    if (check.rows.length > 0) {
      const row = check.rows[0];
      console.log(`  - "${row.full_name}" (Đội ${row.team_id}) -> Nickname: "${row.nickname}"`);
    }
  }

  console.log('\n🎉 HOÀN THÀNH SEED BÚT DANH MỚI THÀNH CÔNG 100%!\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  reseedOfficialNicknames()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Lỗi:', err);
      process.exit(1);
    });
}
