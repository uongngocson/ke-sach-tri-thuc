import db from '../config/database.js';
import { EXP_CONFIG } from '../config/constants.js';
import GrowthService from './growth.service.js';
import socketService from './socket.service.js';

export class QuoteService {
  static async likeQuote(bookId, userFingerprint, meta = {}) {
    // 0. Enforce user login (Strictly reject guests / unauthenticated users)
    let resolvedUserId = meta.userId || null;
    if (!resolvedUserId && userFingerprint) {
      if (userFingerprint.startsWith('user_')) {
        const potentialId = userFingerprint.replace('user_', '');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(potentialId)) {
          resolvedUserId = potentialId;
        }
      } else {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(userFingerprint)) {
          resolvedUserId = userFingerprint;
        }
      }
    }

    if (!resolvedUserId || resolvedUserId === 'guest') {
      const err = new Error('Vui lòng đăng nhập tài khoản FPT để thả tim trích dẫn!');
      err.statusCode = 401;
      err.code = 'LOGIN_REQUIRED';
      throw err;
    }

    const uCheck = await db.query('SELECT id, team_id FROM users WHERE id = $1', [resolvedUserId]);
    if (uCheck.rows.length === 0) {
      const err = new Error('Không tìm thấy thông tin thành viên FPT. Vui lòng đăng nhập lại để thả tim!');
      err.statusCode = 401;
      err.code = 'LOGIN_REQUIRED';
      throw err;
    }
    const loggedInUser = uCheck.rows[0];
    resolvedUserId = loggedInUser.id;

    const result = await db.transaction(async (client) => {
      // 1. Insert Quote Like with UNIQUE constraint on (user_fingerprint, book_id)
      const likeInsert = await client.query(`
        INSERT INTO quote_likes (book_id, user_fingerprint)
        VALUES ($1, $2)
        RETURNING *
      `, [bookId, userFingerprint]);

      // 2. Increment book likes count
      const bookUpdate = await client.query(`
        UPDATE books
        SET likes_count = likes_count + 1
        WHERE id = $1
        RETURNING id, title, likes_count, team_id
      `, [bookId]);

      if (bookUpdate.rows.length === 0) {
        throw new Error('BOOK_NOT_FOUND');
      }

      const likedTeamId = bookUpdate.rows[0].team_id;
      if (likedTeamId) {
        await client.query(`
          UPDATE teams
          SET total_likes = total_likes + 1,
              total_exp = total_exp + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [EXP_CONFIG.QUOTE_LIKE, likedTeamId]);
      }

      // 3. Insert into EXP Ledger (+2 EXP)
      await client.query(`
        INSERT INTO exp_ledger (user_id, team_id, user_fingerprint, amount, type, reference_type, reference_id)
        VALUES ($1, $2, $3, $4, 'QUOTE_LIKE', 'books', $5)
      `, [resolvedUserId, likedTeamId || null, userFingerprint, EXP_CONFIG.QUOTE_LIKE, bookId]);

      // 4. Update community growth
      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_exp = total_exp + $1,
            total_likes = total_likes + 1,
            updated_at = NOW()
        WHERE id = 1
        RETURNING total_exp
      `, [EXP_CONFIG.QUOTE_LIKE]);

      const newTotalExp = parseInt(growthRes.rows[0].total_exp, 10);
      const levelInfo = await GrowthService.recalculateAndSyncLevel(client, newTotalExp);

      return {
        bookId,
        newLikesCount: bookUpdate.rows[0].likes_count,
        expEarned: EXP_CONFIG.QUOTE_LIKE,
        growth: {
          totalEXP: newTotalExp,
          level: levelInfo.level,
          progressPercent: levelInfo.progressPercent
        }
      };
    });

    // Post-Commit Broadcast
    socketService.broadcastQuoteLiked(result);
    const fullGrowth = await GrowthService.getCommunityGrowth();
    socketService.broadcastGrowthUpdated(fullGrowth);

    return result;
  }

  static async unlikeQuote(bookId, userFingerprint) {
    const result = await db.transaction(async (client) => {
      // 1. Delete Quote Like
      const delRes = await client.query(`
        DELETE FROM quote_likes 
        WHERE book_id = $1 AND user_fingerprint = $2
        RETURNING id
      `, [bookId, userFingerprint]);

      const bookRes = await client.query(`
        SELECT id, title, likes_count, team_id FROM books WHERE id = $1
      `, [bookId]);

      if (bookRes.rows.length === 0) {
        throw new Error('BOOK_NOT_FOUND');
      }

      // 2. Only decrement if the like actually existed for this user
      if (delRes.rowCount > 0) {
        const bookUpdate = await client.query(`
          UPDATE books
          SET likes_count = GREATEST(0, likes_count - 1)
          WHERE id = $1
          RETURNING id, title, likes_count, team_id
        `, [bookId]);

        const unlikedTeamId = bookUpdate.rows[0].team_id;
        if (unlikedTeamId) {
          await client.query(`
            UPDATE teams
            SET total_likes = GREATEST(0, total_likes - 1),
                total_exp = GREATEST(0, total_exp - $1),
                updated_at = NOW()
            WHERE id = $2
          `, [EXP_CONFIG.QUOTE_LIKE, unlikedTeamId]);
        }

        // 3. Decrement total_likes in community_growth
        await client.query(`
          UPDATE community_growth
          SET total_likes = GREATEST(0, total_likes - 1),
              updated_at = NOW()
          WHERE id = 1
        `);

        return {
          bookId,
          newLikesCount: bookUpdate.rows[0].likes_count
        };
      }

      return {
        bookId,
        newLikesCount: bookRes.rows[0].likes_count
      };
    });

    socketService.broadcastQuoteLiked(result);
    return result;
  }

  static async harvestFruit(fruitIndex, userFingerprint, meta = {}) {
    const today = new Date().toISOString().split('T')[0];

    const result = await db.transaction(async (client) => {
      // 1. Insert Fruit Harvest with UNIQUE constraint on (user_fingerprint, fruit_index, harvest_date)
      const harvestInsert = await client.query(`
        INSERT INTO fruit_harvests (fruit_index, user_fingerprint, harvest_date, exp_granted)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [fruitIndex, userFingerprint, today, EXP_CONFIG.FRUIT_HARVEST]);

      // 2. Select a random featured/reviewed quote
      const quoteRes = await client.query(`
        SELECT id, title, author, quote, category
        FROM books
        WHERE visibility_status = 'visible'
        ORDER BY RANDOM()
        LIMIT 1
      `);

      const selectedQuote = quoteRes.rows[0] || {
        title: 'Hoàng Tử Bé',
        author: 'Antoine de Saint-Exupéry',
        quote: 'Điều cốt lõi thì vô hình trong mắt trần.'
      };

      // Resolve user_id and team_id if authenticated
      let resolvedUserId = meta.userId || null;
      let userTeamId = meta.teamId || null;
      if (!resolvedUserId && userFingerprint) {
        if (userFingerprint.startsWith('user_')) {
          const potentialId = userFingerprint.replace('user_', '');
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(potentialId)) {
            resolvedUserId = potentialId;
          }
        } else {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(userFingerprint)) {
            resolvedUserId = userFingerprint;
          }
        }
      }

      if (resolvedUserId) {
        const uCheck = await client.query('SELECT id, team_id FROM users WHERE id = $1', [resolvedUserId]);
        if (uCheck.rows.length > 0) {
          resolvedUserId = uCheck.rows[0].id;
          if (!userTeamId) userTeamId = uCheck.rows[0].team_id;
        } else {
          resolvedUserId = null;
        }
      }

      // 3. Record in EXP Ledger (+5 EXP)
      await client.query(`
        INSERT INTO exp_ledger (user_id, team_id, user_fingerprint, amount, type, reference_type, reference_id)
        VALUES ($1, $2, $3, $4, 'FRUIT_HARVEST', 'fruit_harvests', $5)
      `, [resolvedUserId, userTeamId, userFingerprint, EXP_CONFIG.FRUIT_HARVEST, harvestInsert.rows[0].id]);

      // 4. Update community growth (+5 EXP)
      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_exp = total_exp + $1,
            updated_at = NOW()
        WHERE id = 1
        RETURNING total_exp
      `, [EXP_CONFIG.FRUIT_HARVEST]);

      const newTotalExp = parseInt(growthRes.rows[0].total_exp, 10);
      const levelInfo = await GrowthService.recalculateAndSyncLevel(client, newTotalExp);

      return {
        fruitIndex,
        quote: selectedQuote,
        expEarned: EXP_CONFIG.FRUIT_HARVEST,
        growth: {
          totalEXP: newTotalExp,
          level: levelInfo.level,
          progressPercent: levelInfo.progressPercent
        }
      };
    });

    socketService.broadcastFruitHarvested(result);
    const fullGrowth = await GrowthService.getCommunityGrowth();
    socketService.broadcastGrowthUpdated(fullGrowth);

    return result;
  }
}

export default QuoteService;
