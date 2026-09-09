import db from '../config/database.js';

console.log('🔒 Bắt đầu xóa cột email và employee_code khỏi bảng users (bảo mật)...\n');

// Xóa cột employee_code
try {
  await db.query(`ALTER TABLE users DROP COLUMN IF EXISTS employee_code`);
  console.log('✅ Đã xóa cột employee_code');
} catch (e) {
  console.log('⚠️  employee_code:', e.message);
}

// Xóa cột email
try {
  await db.query(`ALTER TABLE users DROP COLUMN IF EXISTS email`);
  console.log('✅ Đã xóa cột email');
} catch (e) {
  console.log('⚠️  email:', e.message);
}

// Xác nhận lại cột còn lại
const cols = await db.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name='users' 
  ORDER BY ordinal_position
`);
console.log('\n📋 Cột còn lại trong bảng users:');
cols.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

process.exit(0);
