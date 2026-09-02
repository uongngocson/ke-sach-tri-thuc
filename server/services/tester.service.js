import db from '../config/database.js';
import socketService from './socket.service.js';
import { calculateLevelFromExp } from '../config/constants.js';

export const MOCK_LIBRARY = [
  {
    title: 'Hoàng Tử Bé (Le Petit Prince)',
    author: 'Antoine de Saint-Exupéry',
    quote: 'Người ta chỉ thấy rõ bằng trái tim. Điều cốt lõi thì vô hình trong mắt trần.',
    category: 'Văn Học Kinh Điển',
    reader: 'Bạn đọc Sao Hỏa'
  },
  {
    title: 'Nhà Giả Kim (The Alchemist)',
    author: 'Paulo Coelho',
    quote: 'Khi bạn thực sự khao khát điều gì, toàn bộ vũ trụ sẽ hợp lực giúp bạn đạt được nó.',
    category: 'Triết Lý Sống',
    reader: 'Độc giả Sa Mạc'
  },
  {
    title: 'Đắc Nhân Tâm (How to Win Friends)',
    author: 'Dale Carnegie',
    quote: 'Cách duy nhất để đạt được điều tốt nhất trong một cuộc tranh cãi là tránh nó.',
    category: 'Kỹ Năng & Tâm Lý',
    reader: 'Minh Tuệ'
  },
  {
    title: 'Sapiens: Lược Sử Loài Người',
    author: 'Yuval Noah Harari',
    quote: 'Chúng ta thống trị thế giới vì chúng ta là loài duy nhất có thể tin vào những câu chuyện tưởng tượng.',
    category: 'Lịch Sử & Tri Thức',
    reader: 'Hà An'
  },
  {
    title: 'Tội Ác Và Trừng Phạt',
    author: 'Fyodor Dostoevsky',
    quote: 'Bước đi một bước mới, nói ra một lời mới là điều người ta sợ hãi nhất.',
    category: 'Văn Học Kinh Điển',
    reader: 'Quang Vinh'
  },
  {
    title: 'Chiến Tranh Và Hòa Bình',
    author: 'Leo Tolstoy',
    quote: 'Mọi thứ đều đến đúng lúc với người biết kiên nhẫn chờ đợi.',
    category: 'Văn Học Kinh Điển',
    reader: 'Trần Long'
  },
  {
    title: 'Suối Nguồn (The Fountainhead)',
    author: 'Ayn Rand',
    quote: 'Hàng ngàn năm trước, người đầu tiên tạo ra lửa có lẽ đã bị thiêu chết trên chính ngọn lửa ấy.',
    category: 'Triết Lý Sống',
    reader: 'Kiến Trúc Sư'
  },
  {
    title: 'Đi Tìm Lẽ Sống (Man’s Search for Meaning)',
    author: 'Viktor E. Frankl',
    quote: 'Khi chúng ta không còn khả năng thay đổi hoàn cảnh, chúng ta buộc phải thay đổi chính mình.',
    category: 'Tâm Lý Học',
    reader: 'Linh Chi'
  },
  {
    title: 'Tư Duy Nhanh Và Chậm (Thinking, Fast and Slow)',
    author: 'Daniel Kahneman',
    quote: 'Sự tự tin của chúng ta vào niềm tin của mình không phải là thước đo về độ chính xác.',
    category: 'Tư Duy & Trí Tuệ',
    reader: 'Đức Minh'
  },
  {
    title: 'Tôi Tự Học',
    author: 'Thu Giang Nguyễn Duy Cần',
    quote: 'Học mà không suy nghĩ thì luôn mù quáng, suy nghĩ mà không học thì luôn nguy hiểm.',
    category: 'Phát Triển Bản Thân',
    reader: 'Người Học Suốt Đời'
  },
  {
    title: 'Cây Cam Ngọt Của Tôi',
    author: 'José Mauro de Vasconcelos',
    quote: 'Bây giờ tôi đã biết đau đớn là gì. Đau đớn không phải là bị đánh đến ngất đi, mà là điều làm tan nát trái tim.',
    category: 'Văn Học Kinh Điển',
    reader: 'Bé Zezé'
  },
  {
    title: 'Không Gia Đình (Sans Famille)',
    author: 'Hector Malot',
    quote: 'Hãy luôn nhìn thẳng về phía trước, bước đi dũng cảm và không bao giờ đánh mất lòng nhân hậu.',
    category: 'Văn Học Kinh Điển',
    reader: 'Độc giả Rémi'
  },
  {
    title: 'Trăm Năm Cô Đơn',
    author: 'Gabriel García Márquez',
    quote: 'Bí quyết của tuổi già không gì khác ngoài việc ký kết một hiệp ước trung thực với sự cô đơn.',
    category: 'Văn Học Kinh Điển',
    reader: 'Macondo'
  },
  {
    title: 'Ông Già Và Biển Cả',
    author: 'Ernest Hemingway',
    quote: 'Con người không sinh ra để dành cho thất bại. Con người có thể bị hủy diệt nhưng không thể bị đánh bại.',
    category: 'Văn Học Kinh Điển',
    reader: 'Ngư Phủ'
  },
  {
    title: 'Bàn Về Tự Do (On Liberty)',
    author: 'John Stuart Mill',
    quote: 'Nếu cả nhân loại cùng một ý kiến và chỉ một người ngược lại, nhân loại cũng không có quyền bắt người ấy im lặng.',
    category: 'Triết Học',
    reader: 'Tự Do Tư Tưởng'
  },
  {
    title: 'Vũ Trụ (Cosmos)',
    author: 'Carl Sagan',
    quote: 'Chúng ta là một cách để vũ trụ tự nhận thức chính bản thân mình.',
    category: 'Khoa Học Vũ Trụ',
    reader: 'Ngắm Sao Đêm'
  },
  {
    title: 'Lược Sử Thời Gian',
    author: 'Stephen Hawking',
    quote: 'Kẻ thù lớn nhất của tri thức không phải là sự dốt nát, mà là ảo tưởng về sự hiểu biết.',
    category: 'Khoa Học',
    reader: 'Nhà Vật Lý'
  },
  {
    title: 'Hạt Giống Tâm Hồn',
    author: 'Jack Canfield & Mark Victor Hansen',
    quote: 'Cuộc sống như một trang sách, mỗi ngày trôi qua là một trang mới được lật mở.',
    category: 'Cảm Hứng Sống',
    reader: 'Độc giả Tích Cực'
  },
  {
    title: 'Búp Sen Xanh',
    author: 'Sơn Tùng',
    quote: 'Nước mắt chỉ chảy ngược vào tim khi ta khóc vì tình yêu quê hương đất nước.',
    category: 'Văn Học Lịch Sử',
    reader: 'Độc giả Đất Việt'
  },
  {
    title: 'Kẻ Trộm Sách (The Book Thief)',
    author: 'Markus Zusak',
    quote: 'Tôi đã căm ghét những lời nói và tôi cũng đã yêu chúng. Tôi hy vọng rằng tôi đã làm cho chúng trở nên đúng đắn.',
    category: 'Văn Học',
    reader: 'Liesel Meminger'
  },
  {
    title: 'Những Người Khốn Khổ (Les Misérables)',
    author: 'Victor Hugo',
    quote: 'Tương lai có nhiều cái tên: Với kẻ yếu, nó là Điều không thể. Với kẻ liều lĩnh, nó là Điều chưa biết. Với kẻ can đảm, nó là Cơ hội.',
    category: 'Văn Học Kinh Điển',
    reader: 'Jean Valjean'
  },
  {
    title: 'Bố Già (The Godfather)',
    author: 'Mario Puzo',
    quote: 'Một người đàn ông không dành thời gian cho gia đình mình thì không bao giờ có thể trở thành người đàn ông thực sự.',
    category: 'Văn Học Kinh Điển',
    reader: 'Don Vito'
  },
  {
    title: 'Hoàng Tử (The Prince)',
    author: 'Niccolò Machiavelli',
    quote: 'Mọi người nhìn thấy những gì bạn thể hiện ra ngoài, nhưng rất ít người cảm nhận được bạn thực sự là ai.',
    category: 'Chính Trị & Triết Học',
    reader: 'Nhà Lãnh Đạo'
  },
  {
    title: 'Dám Bị Ghét',
    author: 'Koga Fumitake & Kishimi Ichiro',
    quote: 'Tự do chính là dám bị người khác ghét bỏ.',
    category: 'Tâm Lý Học',
    reader: 'Người Tự Do'
  },
  {
    title: 'Khéo Ăn Nói Sẽ Có Được Thiên Hạ',
    author: 'Trác Nhã',
    quote: 'Lời nói là tấm gương phản chiếu tâm hồn và trí tuệ của một con người.',
    category: 'Giao Tiếp & Ứng Xử',
    reader: 'Nhã Uyên'
  }
];

export class TesterService {
  /**
   * Helper: Inserts real curated mock books into PostgreSQL
   */
  static async insertMockBooks(client, count) {
    const totalMocks = MOCK_LIBRARY.length;
    const inserted = [];

    for (let i = 0; i < count; i++) {
      const template = MOCK_LIBRARY[i % totalMocks];
      const cycle = Math.floor(i / totalMocks);
      const titleSuffix = cycle > 0 ? ` (Quyển ${cycle + 1})` : '';
      const fullTitle = `${template.title}${titleSuffix}`;
      
      const insertRes = await client.query(`
        INSERT INTO books (title, author, quote, category, reader_name, visibility_status, moderation_status, likes_count, created_at)
        VALUES ($1, $2, $3, $4, $5, 'visible', 'reviewed', $6, NOW() - ($7 || ' seconds')::interval)
        RETURNING *
      `, [
        fullTitle,
        template.author,
        template.quote,
        template.category,
        template.reader,
        Math.floor(Math.random() * 20) + 5,
        (count - i) * 10
      ]);

      inserted.push(insertRes.rows[0]);
    }

    return inserted;
  }

  static async setExp(exp, customSeedsCount = null) {
    const levelInfo = calculateLevelFromExp(exp);
    const targetSeeds = customSeedsCount !== null ? customSeedsCount : (exp < 50 ? exp : 0);

    const result = await db.transaction(async (client) => {
      // 1. Sync real books in PostgreSQL
      if (customSeedsCount !== null && customSeedsCount >= 0) {
        const countRes = await client.query('SELECT COUNT(*) FROM books');
        const currentCount = parseInt(countRes.rows[0].count, 10);

        if (currentCount < customSeedsCount) {
          await this.insertMockBooks(client, customSeedsCount - currentCount);
        } else if (currentCount > customSeedsCount) {
          await client.query(`
            DELETE FROM books 
            WHERE id IN (
              SELECT id FROM books ORDER BY created_at DESC LIMIT $1
            )
          `, [currentCount - customSeedsCount]);
        }
      }

      // 2. Count final books
      const finalCountRes = await client.query('SELECT COUNT(*) FROM books');
      const totalBooks = parseInt(finalCountRes.rows[0].count, 10);

      // 3. Update community_growth
      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_exp = $1,
            level = $2,
            total_books = $3,
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `, [exp, levelInfo.level, totalBooks]);

      const updated = growthRes.rows[0];

      const fullGrowth = {
        totalEXP: parseInt(updated.total_exp, 10),
        level: updated.level,
        levelName: levelInfo.levelName,
        levelDescription: levelInfo.levelDescription,
        progressPercent: levelInfo.progressPercent,
        nextLevelThreshold: levelInfo.nextThreshold,
        currentLevelFloor: levelInfo.currentFloor,
        totalBooks: totalBooks,
        totalDews: parseInt(updated.total_dews, 10),
        totalLikes: parseInt(updated.total_likes, 10),
        activeReaders: parseInt(updated.active_readers, 10),
        seedsCount: targetSeeds
      };

      socketService.broadcastGrowthUpdated(fullGrowth);

      return fullGrowth;
    });

    return result;
  }

  static async addSeeds(count = 1) {
    const result = await db.transaction(async (client) => {
      // 1. Insert real mock books into PostgreSQL
      await this.insertMockBooks(client, count);

      // 2. Count final books
      const finalCountRes = await client.query('SELECT COUNT(*) FROM books');
      const totalBooks = parseInt(finalCountRes.rows[0].count, 10);

      // 3. Update community_growth
      const newExp = totalBooks < 50 ? totalBooks : (totalBooks * 10);
      const levelInfo = calculateLevelFromExp(newExp);

      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_books = $1,
            total_exp = $2,
            level = $3,
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `, [totalBooks, newExp, levelInfo.level]);

      const updated = growthRes.rows[0];

      const fullGrowth = {
        totalEXP: parseInt(updated.total_exp, 10),
        level: updated.level,
        levelName: levelInfo.levelName,
        levelDescription: levelInfo.levelDescription,
        progressPercent: levelInfo.progressPercent,
        nextLevelThreshold: levelInfo.nextThreshold,
        currentLevelFloor: levelInfo.currentFloor,
        totalBooks: totalBooks,
        totalDews: parseInt(updated.total_dews, 10),
        totalLikes: parseInt(updated.total_likes, 10),
        activeReaders: parseInt(updated.active_readers, 10)
      };

      socketService.broadcastGrowthUpdated(fullGrowth);

      return fullGrowth;
    });

    return result;
  }

  static async resetToInitialState() {
    return await db.transaction(async (client) => {
      // 1. Delete dependent child records
      await client.query('DELETE FROM quote_likes');
      await client.query('DELETE FROM fruit_harvests');
      await client.query('DELETE FROM daily_dews');
      await client.query('DELETE FROM exp_ledger');
      await client.query('DELETE FROM idempotency_keys');
      await client.query('DELETE FROM audit_logs');

      // 2. Delete all books to return to clean baseline
      await client.query('DELETE FROM books');

      // 3. Reset community_growth to initial clean baseline (0 EXP, Level 0, 0 books)
      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_exp = 0,
            level = 0,
            total_books = 0,
            total_dews = 0,
            total_likes = 0,
            active_readers = 0,
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `);

      const levelInfo = calculateLevelFromExp(0);
      const fullGrowth = {
        totalEXP: 0,
        level: 0,
        levelName: levelInfo.levelName,
        levelDescription: levelInfo.levelDescription,
        progressPercent: 0,
        nextLevelThreshold: levelInfo.nextThreshold,
        currentLevelFloor: levelInfo.currentFloor,
        totalBooks: 0,
        totalDews: 0,
        totalLikes: 0,
        activeReaders: 0
      };

      socketService.broadcastGrowthUpdated(fullGrowth);

      return fullGrowth;
    });
  }

  static async wipeDatabaseExceptAccounts() {
    return await db.transaction(async (client) => {
      // 1. Delete all dependent child records
      await client.query('DELETE FROM quote_likes');
      await client.query('DELETE FROM fruit_harvests');
      await client.query('DELETE FROM daily_dews');
      await client.query('DELETE FROM exp_ledger');
      await client.query('DELETE FROM idempotency_keys');
      await client.query('DELETE FROM audit_logs');

      // 2. Delete ALL books to make CSDL completely EMPTY
      await client.query('DELETE FROM books');

      // 3. Reset community_growth to completely empty baseline (0 EXP, 0 books, 0 dews, 0 likes)
      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_exp = 0,
            level = 0,
            total_books = 0,
            total_dews = 0,
            total_likes = 0,
            active_readers = 0,
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `);

      // NOTE: admin_users table is 100% PRESERVED!

      const levelInfo = calculateLevelFromExp(0);
      const fullGrowth = {
        totalEXP: 0,
        level: 0,
        levelName: levelInfo.levelName,
        levelDescription: levelInfo.levelDescription,
        progressPercent: 0,
        nextLevelThreshold: levelInfo.nextThreshold,
        currentLevelFloor: levelInfo.currentFloor,
        totalBooks: 0,
        totalDews: 0,
        totalLikes: 0,
        activeReaders: 0
      };

      socketService.broadcastGrowthUpdated(fullGrowth);

      return fullGrowth;
    });
  }
}

export default TesterService;
