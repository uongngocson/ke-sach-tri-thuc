import db from '../config/database.js';

const LITERARY_PREFIXES = [
  'Cáo Tri Thức', 'Người Gieo Mầm', 'Độc Giả Tinh Hoa', 'Tâm Hồn Sách', 'Kẻ Mộng Mơ',
  'Hạt Mầm Xanh', 'Cú Mèo Uyên Bác', 'Trang Sách Bay', 'Ngọn Lửa Nhỏ', 'Hạt Sương Mai',
  'Ánh Sao Đêm', 'Cánh Hạc Trắng', 'Suối Nguồn', 'Người Lữ Hành', 'Bình Minh Đọc Sách',
  'Cánh Buồm Tri Thức', 'Người Đưa Đò', 'Tầm Nhìn Xa', 'Trúc Lâm', 'Hải Đăng Soi Sáng',
  'Khát Vọng Xanh', 'Thuyền Trí Tuệ', 'Gió Mùa Thu', 'Dấu Chân Tri Thức', 'Vườn Tâm Hồn'
];

export async function migrateNickname() {
  console.log('🔄 Running migration: Add nickname column to users table...');

  await db.transaction(async (client) => {
    // 1. Add column if not exists
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
    `);
    console.log('✅ Column nickname and index created successfully.');

    // 2. Populate nicknames for existing users who don't have one
    const usersRes = await client.query(`
      SELECT id, employee_code, email, full_name, team_id
      FROM users
      ORDER BY team_id ASC, employee_code ASC
    `);

    console.log(`📦 Found ${usersRes.rows.length} users in database.`);

    for (let i = 0; i < usersRes.rows.length; i++) {
      const u = usersRes.rows[i];
      const prefix = LITERARY_PREFIXES[i % LITERARY_PREFIXES.length];
      const suffix = (u.employee_code || '').slice(-4) || String(i + 1).padStart(4, '0');
      const nickname = `${prefix} #${suffix}`;

      await client.query(`
        UPDATE users
        SET nickname = $1
        WHERE id = $2 AND (nickname IS NULL OR nickname = '')
      `, [nickname, u.id]);
    }

    console.log(`✅ Nicknames populated for ${usersRes.rows.length} users.`);
  });
}

if (process.argv[1] && process.argv[1].endsWith('migrate_nickname.js')) {
  migrateNickname()
    .then(() => {
      console.log('🎉 Nickname migration completed!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
