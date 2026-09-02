import db from '../config/database.js';
import { calculateLevelFromExp } from '../config/constants.js';
import socketService from './socket.service.js';

class TesterService {
  /**
   * Set exact EXP and sync level in PostgreSQL
   */
  async setExp(targetExp, customSeeds = null) {
    return await db.transaction(async (client) => {
      const exp = Math.max(0, parseInt(targetExp, 10) || 0);
      const levelInfo = calculateLevelFromExp(exp);

      let totalBooks = customSeeds !== null ? customSeeds : (exp < 50 ? exp : 50 + Math.floor((exp - 50) / 15));

      const updateRes = await client.query(
        `UPDATE community_growth 
         SET total_exp = $1,
             level = $2,
             total_books = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = 1
         RETURNING *`,
        [exp, levelInfo.level, totalBooks]
      );

      const row = updateRes.rows[0];
      const payload = {
        totalEXP: parseInt(row.total_exp, 10),
        level: row.level,
        levelName: levelInfo.name,
        levelDesc: levelInfo.description,
        progressPercent: levelInfo.progressPercent,
        nextLevelExp: levelInfo.nextLevelExp,
        totalBooks: parseInt(row.total_books, 10),
        totalDews: parseInt(row.total_dews, 10),
        totalLikes: parseInt(row.total_likes, 10),
        activeReaders: parseInt(row.active_readers, 10),
        updatedAt: row.updated_at
      };

      socketService.broadcastGrowthUpdate(payload);
      return payload;
    });
  }

  /**
   * Simulate adding N seeds into PostgreSQL books table
   */
  async addSeeds(count = 1) {
    const seedCount = Math.max(1, parseInt(count, 10) || 1);
    
    return await db.transaction(async (client) => {
      const sampleTitles = [
        ['Đắc Nhân Tâm', 'Dale Carnegie', 'Biết lắng nghe và thấu hiểu là khởi đầu của mọi thành công.'],
        ['Nhà Giả Kim', 'Paulo Coelho', 'Khi bạn khao khát điều gì, cả vũ trụ sẽ hợp lực giúp bạn.'],
        ['Hoàng Tử Bé', 'Antoine de Saint-Exupéry', 'Điều cốt lõi thì vô hình trong mắt trần.'],
        ['Sapiens', 'Yuval Noah Harari', 'Khả năng chia sẻ câu chuyện gắn kết nhân loại.'],
        ['Hành Trình Về Phương Đông', 'Baird T. Spalding', 'Khoa học và tâm linh là hai cánh nâng con người bay lên.'],
        ['Tư Duy Nhanh Và Chậm', 'Daniel Kahneman', 'Nhận diện điểm mù của trực giác để ra quyết định sáng suốt.'],
        ['Cây Cam Ngọt Của Tôi', 'José Mauro de Vasconcelos', 'Yêu thương là điều kỳ diệu nhất xoa dịu tâm hồn.']
      ];

      for (let i = 0; i < seedCount; i++) {
        const sample = sampleTitles[i % sampleTitles.length];
        const title = `${sample[0]} #${Date.now() % 10000 + i}`;
        await client.query(
          `INSERT INTO books (title, author, quote, category, reader_name, visibility_status, moderation_status)
           VALUES ($1, $2, $3, $4, $5, 'visible', 'pending_review')`,
          [title, sample[1], sample[2], 'Sách Tinh Hoa', `Tester_${i + 1}`]
        );
      }

      // Add EXP (1 EXP per seed)
      const expGain = seedCount * 1;
      const growthRes = await client.query('SELECT total_exp, total_books FROM community_growth WHERE id = 1 FOR UPDATE');
      const curExp = parseInt(growthRes.rows[0].total_exp, 10);
      const curBooks = parseInt(growthRes.rows[0].total_books, 10);

      const newExp = curExp + expGain;
      const newBooks = curBooks + seedCount;
      const levelInfo = calculateLevelFromExp(newExp);

      const updateRes = await client.query(
        `UPDATE community_growth
         SET total_exp = $1,
             level = $2,
             total_books = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = 1
         RETURNING *`,
        [newExp, levelInfo.level, newBooks]
      );

      const row = updateRes.rows[0];
      const payload = {
        totalEXP: parseInt(row.total_exp, 10),
        level: row.level,
        levelName: levelInfo.name,
        levelDesc: levelInfo.description,
        progressPercent: levelInfo.progressPercent,
        nextLevelExp: levelInfo.nextLevelExp,
        totalBooks: parseInt(row.total_books, 10),
        totalDews: parseInt(row.total_dews, 10),
        totalLikes: parseInt(row.total_likes, 10),
        activeReaders: parseInt(row.active_readers, 10),
        updatedAt: row.updated_at
      };

      socketService.broadcastGrowthUpdate(payload);
      return payload;
    });
  }

  /**
   * Reset everything to Level 0 (0 seeds, 0 EXP, blank ground)
   */
  async resetToInitialState() {
    return await db.transaction(async (client) => {
      // Clear child tables first to satisfy Foreign Key constraints
      await client.query("DELETE FROM quote_likes");
      await client.query("DELETE FROM daily_dews");
      await client.query("DELETE FROM fruit_harvests");
      await client.query("DELETE FROM exp_ledger");
      await client.query("DELETE FROM books WHERE id NOT IN (SELECT id FROM books ORDER BY created_at ASC LIMIT 6)");

      const levelInfo = calculateLevelFromExp(0);
      const updateRes = await client.query(
        `UPDATE community_growth
         SET total_exp = 0,
             level = 0,
             total_books = 0,
             total_dews = 0,
             total_likes = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = 1
         RETURNING *`
      );

      const row = updateRes.rows[0];
      const payload = {
        totalEXP: 0,
        level: 0,
        levelName: levelInfo.name,
        levelDesc: levelInfo.description,
        progressPercent: 0,
        nextLevelExp: 50,
        totalBooks: 0,
        totalDews: 0,
        totalLikes: 0,
        activeReaders: 2735,
        updatedAt: row.updated_at
      };

      socketService.broadcastGrowthUpdate(payload);
      return payload;
    });
  }
}

export default new TesterService();
