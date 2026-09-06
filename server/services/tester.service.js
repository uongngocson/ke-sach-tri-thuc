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
   * Helper: Inserts real curated mock books into PostgreSQL with team_id
   */
  static async insertMockBooks(client, count, teamId = 1) {
    if (count <= 0) return [];
    const totalMocks = MOCK_LIBRARY.length;
    const values = [];
    const valuePlaceholders = [];

    const effectiveTeamId = (teamId && !isNaN(parseInt(teamId, 10))) ? parseInt(teamId, 10) : 1;

    // Get real users for this team if present
    let teamUsers = [];
    try {
      const uRes = await client.query('SELECT id, full_name FROM users WHERE team_id = $1 LIMIT 50', [effectiveTeamId]);
      teamUsers = uRes.rows;
    } catch (e) {}

    for (let i = 0; i < count; i++) {
      const template = MOCK_LIBRARY[i % totalMocks];
      const cycle = Math.floor(i / totalMocks);
      const titleSuffix = cycle > 0 ? ` (Quyển ${cycle + 1})` : '';
      const fullTitle = `${template.title}${titleSuffix}`;
      const offset = i * 8;

      const randomUser = teamUsers.length > 0 ? teamUsers[i % teamUsers.length] : null;
      const readerName = randomUser ? randomUser.full_name : template.reader;

      valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, 'visible', 'reviewed', $${offset + 6}, $${offset + 7}, NOW() - ($${offset + 8} || ' seconds')::interval)`);

      values.push(
        fullTitle,
        template.author,
        template.quote,
        template.category,
        readerName,
        Math.floor(Math.random() * 20) + 5,
        effectiveTeamId,
        (count - i) * 10
      );
    }

    const insertRes = await client.query(`
      INSERT INTO books (title, author, quote, category, reader_name, visibility_status, moderation_status, likes_count, team_id, created_at)
      VALUES ${valuePlaceholders.join(', ')}
      RETURNING *
    `, values);

    return insertRes.rows;
  }

  static async setExp(exp, customSeedsCount = null, teamId = null) {
    const levelInfo = calculateLevelFromExp(exp);
    const targetSeeds = customSeedsCount !== null ? customSeedsCount : (exp < 50 ? exp : 0);
    const isSprouted = (levelInfo.level >= 1 || targetSeeds >= 50 || exp >= 50);

    const result = await db.transaction(async (client) => {
      // 1. Determine target teams
      let targetTeamIds = [];
      if (teamId === 'all') {
        const allRes = await client.query('SELECT id FROM teams ORDER BY id ASC');
        targetTeamIds = allRes.rows.map(r => r.id);
      } else if (teamId && !isNaN(parseInt(teamId, 10))) {
        targetTeamIds = [parseInt(teamId, 10)];
      } else {
        // If teamId not specified, apply to all 8 teams so entire system is in sync!
        const allRes = await client.query('SELECT id FROM teams ORDER BY id ASC');
        targetTeamIds = allRes.rows.map(r => r.id);
      }

      // 2. Sync books and teams table for each target team
      for (const tId of targetTeamIds) {
        if (targetSeeds !== null && targetSeeds >= 0) {
          const countRes = await client.query("SELECT COUNT(*) FROM books WHERE team_id = $1 AND visibility_status = 'visible'", [tId]);
          const currentCount = parseInt(countRes.rows[0].count, 10);

          if (currentCount < targetSeeds) {
            await this.insertMockBooks(client, targetSeeds - currentCount, tId);
          } else if (currentCount > targetSeeds) {
            await client.query(`
              DELETE FROM books 
              WHERE id IN (
                SELECT id FROM books WHERE team_id = $1 AND visibility_status = 'visible' ORDER BY created_at DESC LIMIT $2
              )
            `, [tId, currentCount - targetSeeds]);
          }
        }

        // Update team in PostgreSQL
        await client.query(`
          UPDATE teams
          SET total_exp = $1,
              tree_exp = $1,
              tree_seeds = $2,
              level = $3,
              tree_level = $3,
              updated_at = NOW()
          WHERE id = $4
        `, [exp, targetSeeds, levelInfo.level, tId]);
      }

      // 3. Count final books
      const finalCountRes = await client.query("SELECT COUNT(*) FROM books WHERE visibility_status = 'visible'");
      const totalBooks = parseInt(finalCountRes.rows[0].count, 10);

      // 4. Update community_growth for legacy
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
        seedsCount: targetSeeds,
        targetTeamId: targetTeamIds.length === 1 ? targetTeamIds[0] : 'all'
      };

      socketService.broadcastGrowthUpdated(fullGrowth);
      socketService.broadcastSeedsUpdated();

      return fullGrowth;
    });

    return result;
  }

  static async addSeeds(count = 1, teamId = null) {
    const result = await db.transaction(async (client) => {
      let targetTeamIds = [];
      if (teamId === 'all') {
        const allRes = await client.query('SELECT id FROM teams ORDER BY id ASC');
        targetTeamIds = allRes.rows.map(r => r.id);
      } else if (teamId && !isNaN(parseInt(teamId, 10))) {
        targetTeamIds = [parseInt(teamId, 10)];
      } else {
        targetTeamIds = [1];
      }

      for (const tId of targetTeamIds) {
        await this.insertMockBooks(client, count, tId);

        const countRes = await client.query("SELECT COUNT(*) FROM books WHERE team_id = $1 AND visibility_status = 'visible'", [tId]);
        const totalSeeds = parseInt(countRes.rows[0].count, 10);

        const isSprouted = totalSeeds >= 50;
        const newExp = totalSeeds < 50 ? totalSeeds : (totalSeeds * 10);
        const levelInfo = calculateLevelFromExp(newExp);

        await client.query(`
          UPDATE teams
          SET tree_seeds = $1,
              total_exp = $2,
              tree_exp = $2,
              level = $3,
              tree_level = $3,
              updated_at = NOW()
          WHERE id = $4
        `, [totalSeeds, newExp, levelInfo.level, tId]);
      }

      const finalCountRes = await client.query('SELECT COUNT(*) FROM books');
      const totalBooks = parseInt(finalCountRes.rows[0].count, 10);

      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_books = $1,
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `, [totalBooks]);

      const updated = growthRes.rows[0];
      const levelInfo = calculateLevelFromExp(parseInt(updated.total_exp, 10));

      const fullGrowth = {
        totalEXP: parseInt(updated.total_exp, 10),
        level: updated.level,
        levelName: levelInfo.levelName,
        levelDescription: levelInfo.levelDescription,
        progressPercent: levelInfo.progressPercent,
        totalBooks: totalBooks
      };

      socketService.broadcastGrowthUpdated(fullGrowth);
      socketService.broadcastSeedsUpdated();

      return fullGrowth;
    });

    return result;
  }

  static async addHeart(count = 10, expBonus = 20, teamId = null) {
    const result = await db.transaction(async (client) => {
      let targetTeamIds = [];
      if (teamId === 'all') {
        const allRes = await client.query('SELECT id FROM teams ORDER BY id ASC');
        targetTeamIds = allRes.rows.map(r => r.id);
      } else if (teamId && !isNaN(parseInt(teamId, 10))) {
        targetTeamIds = [parseInt(teamId, 10)];
      } else {
        targetTeamIds = [1];
      }

      for (const tId of targetTeamIds) {
        await client.query("UPDATE books SET likes_count = likes_count + 1 WHERE team_id = $1", [tId]);

        const teamRes = await client.query(`
          UPDATE teams
          SET total_exp = total_exp + $1,
              total_likes = total_likes + $2,
              updated_at = NOW()
          WHERE id = $3
          RETURNING *
        `, [expBonus, count, tId]);

        if (teamRes.rows.length > 0) {
          const team = teamRes.rows[0];
          const levelInfo = calculateLevelFromExp(parseInt(team.total_exp, 10));
          await client.query(`
            UPDATE teams
            SET level = $1,
                tree_level = $1,
                tree_exp = total_exp
            WHERE id = $2
          `, [levelInfo.level, tId]);
        }
      }

      await client.query(`
        UPDATE community_growth
        SET total_exp = total_exp + $1,
            total_likes = total_likes + $2,
            updated_at = NOW()
        WHERE id = 1
      `, [expBonus, count]);

      socketService.broadcastGrowthUpdated({ totalEXP: expBonus });
      socketService.broadcastSeedsUpdated();

      return { success: true };
    });

    return result;
  }

  static async resetToInitialState(teamId = null) {
    return await db.transaction(async (client) => {
      if (teamId && teamId !== 'all' && !isNaN(parseInt(teamId, 10))) {
        const tId = parseInt(teamId, 10);
        await client.query('DELETE FROM books WHERE team_id = $1', [tId]);
        await client.query('DELETE FROM round_contributions WHERE team_id = $1', [tId]);

        await client.query(`
          UPDATE teams
          SET total_exp = 0,
              tree_exp = 0,
              tree_seeds = 0,
              level = 0,
              tree_level = 0,
              total_likes = 0,
              updated_at = NOW()
          WHERE id = $1
        `, [tId]);
      } else {
        await client.query('DELETE FROM quote_likes');
        await client.query('DELETE FROM fruit_harvests');
        await client.query('DELETE FROM daily_dews');
        await client.query('DELETE FROM exp_ledger');
        await client.query('DELETE FROM idempotency_keys');
        await client.query('DELETE FROM audit_logs');
        await client.query('DELETE FROM site_visitors');
        await client.query('DELETE FROM round_contributions');
        await client.query('DELETE FROM books');

        await client.query(`
          UPDATE teams
          SET total_exp = 0,
              tree_exp = 0,
              tree_seeds = 0,
              level = 0,
              tree_level = 0,
              total_likes = 0,
              updated_at = NOW()
        `);

        await client.query(`
          UPDATE community_growth
          SET total_exp = 0,
              level = 0,
              total_books = 0,
              total_dews = 0,
              total_likes = 0,
              active_readers = 0,
              updated_at = NOW()
          WHERE id = 1
        `);
      }

      const fullGrowth = {
        totalEXP: 0,
        level: 0,
        levelName: 'Ủ Mầm Lòng Đất',
        progressPercent: 0,
        totalBooks: 0
      };

      socketService.broadcastGrowthUpdated(fullGrowth);
      socketService.broadcastSeedsUpdated();

      return fullGrowth;
    });
  }

  static async wipeDatabaseExceptAccounts(adminUser = null, clientIp = null) {
    return await db.transaction(async (client) => {
      await client.query('DELETE FROM quote_likes');
      await client.query('DELETE FROM fruit_harvests');
      await client.query('DELETE FROM daily_dews');
      await client.query('DELETE FROM daily_quotes');
      await client.query('DELETE FROM exp_ledger');
      await client.query('DELETE FROM idempotency_keys');
      await client.query('DELETE FROM audit_logs');
      await client.query('DELETE FROM site_visitors');
      await client.query('DELETE FROM round_contributions');
      await client.query('DELETE FROM books');

      await client.query(`
        UPDATE teams
        SET total_exp = 0,
            tree_exp = 0,
            tree_seeds = 0,
            level = 0,
            tree_level = 0,
            total_likes = 0,
            avg_participation_rate = 0,
            milestone_150_at = NULL,
            milestone_400_at = NULL,
            milestone_1000_at = NULL,
            milestone_2500_at = NULL,
            perfect_rounds_count = 0,
            updated_at = NOW()
      `);

      await client.query(`
        UPDATE team_rounds
        SET participants_count = 0,
            participation_rate = 0,
            raw_exp = 0,
            converted_exp = 0,
            seeds_count = 0,
            is_sprouted_this_round = false,
            updated_at = NOW()
      `);

      await client.query(`
        UPDATE users
        SET contributed_books_count = 0,
            total_exp_earned = 0,
            updated_at = NOW()
      `);

      await client.query(`
        UPDATE community_growth
        SET total_exp = 0,
            level = 0,
            total_books = 0,
            total_dews = 0,
            total_likes = 0,
            active_readers = 0,
            updated_at = NOW()
        WHERE id = 1
      `);

      if (adminUser) {
        await client.query(`
          INSERT INTO audit_logs (admin_id, action, target_type, metadata, ip_address)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          adminUser.id,
          'WIPE_DATABASE',
          'SYSTEM_DATABASE',
          JSON.stringify({
            reason: 'Dọn sạch toàn bộ dữ liệu hoạt động CSDL (bảo lưu 288 tài khoản và 8 đội nhóm)',
            performed_by: adminUser.username || adminUser.full_name || 'Admin'
          }),
          clientIp || null
        ]);
      }

      const fullGrowth = {
        totalEXP: 0,
        level: 0,
        levelName: 'Ủ Mầm Lòng Đất',
        progressPercent: 0,
        totalBooks: 0
      };

      socketService.broadcastGrowthUpdated(fullGrowth);
      socketService.broadcastSeedsUpdated();

      return fullGrowth;
    });
  }
}

export default TesterService;
