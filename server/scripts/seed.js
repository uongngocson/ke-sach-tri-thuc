import db from '../config/database.js';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding initial Cáo Sách data...');
  
  try {
    // 1. Seed Superadmin Account: admin / admin123
    const passwordHash = await bcrypt.hash('admin123', 10);
    await db.query(`
      INSERT INTO admin_users (username, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO NOTHING
    `, ['admin', passwordHash, 'Super Admin Cáo Sách', 'admin']);
    console.log(' - Admin user seeded: admin / admin123');

    // 2. Seed Curated Master Quotes
    const masterQuotes = [
      {
        title: 'Hoàng Tử Bé (Le Petit Prince)',
        author: 'Antoine de Saint-Exupéry',
        quote: 'Người ta chỉ thấy rõ bằng trái tim. Điều cốt lõi thì vô hình trong mắt trần.',
        category: 'Văn Học Kinh Điển',
        reader: 'Ban biên tập Cáo Sách',
        likes: 128
      },
      {
        title: 'Nhà Giả Kim (The Alchemist)',
        author: 'Paulo Coelho',
        quote: 'Khi bạn thực sự khao khát một điều gì đó, cả vũ trụ sẽ hợp lực giúp bạn đạt được nó.',
        category: 'Triết Lý Sống',
        reader: 'Độc giả yêu sách',
        likes: 142
      },
      {
        title: 'Đắc Nhân Tâm',
        author: 'Dale Carnegie',
        quote: 'Muốn lấy mật thì đừng phá tổ ong. Hãy chân thành khen ngợi và thấu hiểu người khác.',
        category: 'Tâm Lý - Kỹ Năng',
        reader: 'Bạn đọc Vườn Tri Thức',
        likes: 95
      },
      {
        title: 'Tư Duy Nhanh và Chậm',
        author: 'Daniel Kahneman',
        quote: 'Sự tự tin của con người vào niềm tin của mình thường không phản ánh sự thật, mà phản ánh sự mạch lạc của câu chuyện được não bộ dựng nên.',
        category: 'Khoa Học Tư Duy',
        reader: 'Cộng đồng Cáo Sách',
        likes: 78
      },
      {
        title: 'Hiểu Về Trái Tim',
        author: 'Thích Minh Niệm',
        quote: 'Có những ngày lòng bình yên đến lạ, chỉ muốn ngồi im lắng nghe cuộc đời đang trôi.',
        category: 'Nuôi Dưỡng Tâm Hồn',
        reader: 'Độc giả mến mộ',
        likes: 110
      }
    ];

    for (const q of masterQuotes) {
      await db.query(`
        INSERT INTO books (title, author, quote, category, reader_name, likes_count, visibility_status, moderation_status)
        VALUES ($1, $2, $3, $4, $5, $6, 'visible', 'reviewed')
      `, [q.title, q.author, q.quote, q.category, q.reader, q.likes]);
    }
    console.log(` - ${masterQuotes.length} curated master quotes seeded!`);

    // 3. Update community growth count
    await db.query(`
      UPDATE community_growth 
      SET total_books = (SELECT COUNT(*) FROM books WHERE visibility_status = 'visible'),
          total_likes = (SELECT COALESCE(SUM(likes_count), 0) FROM books WHERE visibility_status = 'visible'),
          updated_at = NOW()
      WHERE id = 1
    `);
    console.log(' - Community growth counters synchronized!');

    console.log('✅ Seeding completed successfully!');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
