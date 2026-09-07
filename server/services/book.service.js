import db from '../config/database.js';
import { EXP_CONFIG } from '../config/constants.js';
import GrowthService from './growth.service.js';
import socketService from './socket.service.js';

export class BookService {
  /**
   * Check if a user/device has already contributed a quote today
   */
  static async getDailyQuoteStatus({ userId, email, userFingerprint }) {
    let resolvedUserId = userId || null;
    if (!resolvedUserId && email) {
      const u = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
      if (u.rows.length > 0) resolvedUserId = u.rows[0].id;
    }

    if (resolvedUserId) {
      const res = await db.query(`
        SELECT dq.id, dq.quote_date, b.id as book_id, b.title, b.author, b.quote, b.created_at
        FROM daily_quotes dq
        LEFT JOIN books b ON dq.book_id = b.id
        WHERE dq.user_id = $1 AND dq.quote_date = CURRENT_DATE
        LIMIT 1
      `, [resolvedUserId]);

      const hasContributed = res.rows.length > 0;
      return {
        hasContributedToday: hasContributed,
        remainingToday: hasContributed ? 0 : 1,
        quote: res.rows[0] || null
      };
    } else if (userFingerprint) {
      const res = await db.query(`
        SELECT dq.id, dq.quote_date, b.id as book_id, b.title, b.author, b.quote, b.created_at
        FROM daily_quotes dq
        LEFT JOIN books b ON dq.book_id = b.id
        WHERE dq.user_fingerprint = $1 AND dq.quote_date = CURRENT_DATE
        LIMIT 1
      `, [userFingerprint]);

      const hasContributed = res.rows.length > 0;
      return {
        hasContributedToday: hasContributed,
        remainingToday: hasContributed ? 0 : 1,
        quote: res.rows[0] || null
      };
    }

    return { hasContributedToday: false, remainingToday: 1, quote: null };
  }

  static async contributeBook(payload) {
    const { title, author, quote, category, reader, userFingerprint } = payload;
    let email = payload.email;

    // ACID Database Transaction: Insert Book + Insert Ledger + Update Community Growth
    const result = await db.transaction(async (client) => {
      // 0. Auto-detect user and team
      let userId = payload.userId || null;
      let teamId = payload.teamId ? parseInt(payload.teamId, 10) : null;

      if (email && email.trim()) {
        const userRes = await client.query('SELECT id, team_id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
          if (!teamId) teamId = userRes.rows[0].team_id;
        }
      } else if (userId) {
        const userRes = await client.query('SELECT id, team_id, email FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length > 0) {
          if (!teamId) teamId = userRes.rows[0].team_id;
          if (!email) email = userRes.rows[0].email;
        }
      }

      // 0.1 STRICT CONSTRAINT: Mỗi ngày mỗi userid chỉ được 1 câu quote
      if (userId) {
        const dailyCheck = await client.query(`
          SELECT id, book_id, created_at
          FROM daily_quotes
          WHERE user_id = $1 AND quote_date = CURRENT_DATE
          LIMIT 1
        `, [userId]);

        if (dailyCheck.rows.length > 0) {
          const err = new Error('Mỗi ngày mỗi thành viên chỉ được gieo 1 câu trích dẫn sách. Bạn đã gieo trích dẫn cho ngày hôm nay rồi, vui lòng quay lại vào ngày mai!');
          err.statusCode = 409;
          err.code = 'DAILY_QUOTE_LIMIT_EXCEEDED';
          throw err;
        }
      } else if (userFingerprint) {
        // Fallback constraint for anonymous / fingerprint
        const fpCheck = await client.query(`
          SELECT id FROM daily_quotes
          WHERE user_fingerprint = $1 AND quote_date = CURRENT_DATE
          LIMIT 1
        `, [userFingerprint]);

        if (fpCheck.rows.length > 0) {
          const err = new Error('Mỗi ngày mỗi độc giả chỉ được gieo 1 câu trích dẫn sách. Bạn đã gieo trích dẫn cho ngày hôm nay rồi, vui lòng quay lại vào ngày mai!');
          err.statusCode = 409;
          err.code = 'DAILY_QUOTE_LIMIT_EXCEEDED';
          throw err;
        }
      }

      // 1. Assign anonymous pen name (Bút danh)
      let penName = (reader || '').trim();
      if (!penName) {
        const fallbackPenNames = [
          'Người Gieo Mầm Tri Thức', 'Bạn Đọc Cáo Sách', 'Độc Giả Tinh Hoa',
          'Kẻ Mộng Mơ Đọc Sách', 'Người Vun Đắp Phù Sa', 'Tâm Hồn Tri Thức',
          'Người Lữ Hành Thời Gian', 'Cánh Chim Tự Do', 'Hạt Mầm Tự Chủ'
        ];
        penName = fallbackPenNames[Math.floor(Math.random() * fallbackPenNames.length)];
      }

      // 1.1 Insert book with publication: visible, moderation: pending_review (Auto-Approve 100%)
      const bookInsert = await client.query(`
        INSERT INTO books (title, author, quote, category, reader_name, reader_email, visibility_status, moderation_status, user_id, team_id, user_fingerprint)
        VALUES ($1, $2, $3, $4, $5, $6, 'visible', 'pending_review', $7, $8, $9)
        RETURNING *
      `, [title, author, quote, category, penName, email ? email.trim() : null, userId, teamId, userFingerprint]);

      const newBook = bookInsert.rows[0];

      // 1.1 Record in daily_quotes table
      await client.query(`
        INSERT INTO daily_quotes (user_id, user_fingerprint, book_id, quote_date, team_id)
        VALUES ($1, $2, $3, CURRENT_DATE, $4)
      `, [userId, userFingerprint, newBook.id, teamId]);

      // 2. Insert into EXP Ledger (+5 EXP)
      await client.query(`
        INSERT INTO exp_ledger (user_id, team_id, user_fingerprint, amount, type, reference_type, reference_id)
        VALUES ($1, $2, $3, $4, 'BOOK_CONTRIBUTION', 'books', $5)
      `, [userId, teamId, userFingerprint, EXP_CONFIG.BOOK_CONTRIBUTION, newBook.id]);

      // 3. Update Team EXP and Level directly (No rounds concept)
      if (teamId) {
        await client.query(`
          UPDATE teams
          SET total_books = total_books + 1,
              tree_seeds = CASE WHEN tree_seeds < 50 THEN tree_seeds + 1 ELSE tree_seeds END,
              total_exp = total_exp + $1,
              tree_level = CASE 
                WHEN total_exp + $1 >= 2500 THEN 5
                WHEN total_exp + $1 >= 1000 THEN 4
                WHEN total_exp + $1 >= 400 THEN 3
                WHEN total_exp + $1 >= 150 THEN 2
                WHEN tree_seeds + 1 >= 50 OR total_exp + $1 >= 50 THEN 1
                ELSE 0
              END,
              updated_at = NOW()
          WHERE id = $2
        `, [EXP_CONFIG.BOOK_CONTRIBUTION, teamId]);
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
    const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const category = options.category;
    const teamId = options.teamId ? parseInt(options.teamId, 10) : null;
    const search = options.search ? options.search.trim() : null;
    const sortBy = options.sortBy || 'most_liked';
    const userFingerprint = options.userFingerprint ? options.userFingerprint.trim() : null;

    const params = [];
    let isLikedSelect = 'false as is_liked';

    if (userFingerprint) {
      params.push(userFingerprint);
      isLikedSelect = `EXISTS(SELECT 1 FROM quote_likes ql WHERE ql.book_id = b.id AND ql.user_fingerprint = $1) as is_liked`;
    }

    let query = `
      SELECT b.id, b.title, b.author, b.quote, b.category, b.reader_name, b.likes_count, b.moderation_status, b.created_at,
             b.team_id, t.name as team_name, t.code as team_code, t.display_name as team_short_name, t.display_name as team_display_name, t.color_code as team_color,
             ${isLikedSelect}
      FROM books b
      LEFT JOIN teams t ON b.team_id = t.id
      WHERE b.visibility_status = 'visible'
    `;

    if (category && category !== 'all' && category !== 'Tất cả') {
      params.push(category);
      query += ` AND b.category = $${params.length}`;
    }

    if (teamId) {
      params.push(teamId);
      query += ` AND b.team_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (b.title ILIKE $${params.length} OR b.author ILIKE $${params.length} OR b.quote ILIKE $${params.length} OR b.reader_name ILIKE $${params.length})`;
    }

    // Sorting
    if (sortBy === 'newest' || sortBy === 'recent') {
      query += ` ORDER BY b.created_at DESC`;
    } else if (sortBy === 'oldest') {
      query += ` ORDER BY b.created_at ASC`;
    } else {
      // Default: most_liked
      query += ` ORDER BY b.likes_count DESC, b.created_at DESC`;
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const quotesRes = await db.query(query, params);
    
    // Count Query
    let countQuery = `SELECT COUNT(*) FROM books b WHERE b.visibility_status = 'visible'`;
    const countParams = [];
    if (category && category !== 'all' && category !== 'Tất cả') {
      countParams.push(category);
      countQuery += ` AND b.category = $${countParams.length}`;
    }
    if (teamId) {
      countParams.push(teamId);
      countQuery += ` AND b.team_id = $${countParams.length}`;
    }
    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (b.title ILIKE $${countParams.length} OR b.author ILIKE $${countParams.length} OR b.quote ILIKE $${countParams.length} OR b.reader_name ILIKE $${countParams.length})`;
    }

    const countRes = await db.query(countQuery, countParams);
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
