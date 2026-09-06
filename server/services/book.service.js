import db from '../config/database.js';
import { EXP_CONFIG } from '../config/constants.js';
import GrowthService from './growth.service.js';
import socketService from './socket.service.js';
import { RoundService } from './round.service.js';

export class BookService {
  static async contributeBook(payload) {
    const { title, author, quote, category, reader, email, userFingerprint } = payload;

    // ACID Database Transaction: Insert Book + Insert Ledger + Update Community Growth
    const result = await db.transaction(async (client) => {
      // 0. Auto-detect user and team if email provided
      let userId = null;
      let teamId = null;

      if (email) {
        const userRes = await client.query('SELECT id, team_id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
          teamId = userRes.rows[0].team_id;
        }
      }

      // 1. Insert book with publication: visible, moderation: pending_review (Auto-Approve 100%)
      const bookInsert = await client.query(`
        INSERT INTO books (title, author, quote, category, reader_name, reader_email, visibility_status, moderation_status, user_id, team_id)
        VALUES ($1, $2, $3, $4, $5, $6, 'visible', 'pending_review', $7, $8)
        RETURNING *
      `, [title, author, quote, category, reader, email ? email.trim() : null, userId, teamId]);

      const newBook = bookInsert.rows[0];

      // 2. Insert into EXP Ledger (+15 EXP)
      await client.query(`
        INSERT INTO exp_ledger (user_fingerprint, amount, type, reference_type, reference_id, team_id)
        VALUES ($1, $2, 'BOOK_CONTRIBUTION', 'books', $3, $4)
      `, [userFingerprint, EXP_CONFIG.BOOK_CONTRIBUTION, newBook.id, teamId]);

      // 3. Record Round Contribution & Update Team Normalized EXP / Seeds
      let roundResult = null;
      if (userId && teamId) {
        roundResult = await RoundService.recordContribution(client, { userId, teamId, bookId: newBook.id });
        await client.query(`
          UPDATE teams
          SET total_books = total_books + 1,
              updated_at = NOW()
          WHERE id = $1
        `, [teamId]);
      } else if (teamId) {
        await client.query(`
          UPDATE teams
          SET total_books = total_books + 1,
              updated_at = NOW()
          WHERE id = $1
        `, [teamId]);
      }

      // 4. Update user stats if matched
      if (userId) {
        await client.query(`
          UPDATE users
          SET contributed_books_count = contributed_books_count + 1,
              total_exp_earned = total_exp_earned + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [EXP_CONFIG.BOOK_CONTRIBUTION, userId]);
      }

      // 5. Update community growth
      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_exp = total_exp + $1,
            total_books = total_books + 1,
            updated_at = NOW()
        WHERE id = 1
        RETURNING total_exp
      `, [EXP_CONFIG.BOOK_CONTRIBUTION]);

      const newTotalExp = parseInt(growthRes.rows[0].total_exp, 10);
      const levelInfo = await GrowthService.recalculateAndSyncLevel(client, newTotalExp);

      return {
        book: newBook,
        growth: {
          totalEXP: newTotalExp,
          level: levelInfo.level,
          levelName: levelInfo.name,
          progressPercent: levelInfo.progressPercent,
          expEarned: EXP_CONFIG.BOOK_CONTRIBUTION
        }
      };
    });

    // Post-Commit Broadcast: Emit socket events ONLY AFTER DB commits successfully
    socketService.broadcastBookCreated(result.book);
    const fullGrowth = await GrowthService.getCommunityGrowth();
    socketService.broadcastGrowthUpdated(fullGrowth);
    socketService.broadcastAdminBookEvent('new_book_submitted', result.book);

    return result;
  }

  static async getPublicQuotes(options = {}) {
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const category = options.category;

    let query = `
      SELECT b.id, b.title, b.author, b.quote, b.category, b.reader_name, b.likes_count, b.moderation_status, b.created_at,
             b.team_id, t.name as team_name, t.code as team_code, t.short_name as team_short_name, t.display_name as team_display_name, t.color_code as team_color
      FROM books b
      LEFT JOIN teams t ON b.team_id = t.id
      WHERE b.visibility_status = 'visible'
    `;
    const params = [];

    if (category && category !== 'all') {
      params.push(category);
      query += ` AND b.category = $${params.length}`;
    }

    query += ` ORDER BY b.likes_count DESC, b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const quotesRes = await db.query(query, params);
    
    let countQuery = `SELECT COUNT(*) FROM books WHERE visibility_status = 'visible'`;
    if (category && category !== 'all') {
      countQuery += ` AND category = '${category}'`;
    }
    const countRes = await db.query(countQuery);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    return {
      quotes: quotesRes.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }
}

export default BookService;
