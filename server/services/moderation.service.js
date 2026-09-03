import db from '../config/database.js';
import { EXP_CONFIG } from '../config/constants.js';
import GrowthService from './growth.service.js';
import socketService from './socket.service.js';

export class ModerationService {
  static async updateBookStatus(bookId, options, adminUser, ipAddress) {
    const { visibility_status, moderation_status, moderation_notes, deletion_reason, deductExp } = options;

    const result = await db.transaction(async (client) => {
      // 1. Fetch current book
      const currentBookRes = await client.query('SELECT * FROM books WHERE id = $1', [bookId]);
      if (currentBookRes.rows.length === 0) {
        throw new Error('BOOK_NOT_FOUND');
      }
      const currentBook = currentBookRes.rows[0];

      // 2. Update book
      const updateRes = await client.query(`
        UPDATE books
        SET visibility_status = COALESCE($1, visibility_status),
            moderation_status = COALESCE($2, moderation_status),
            reviewed_by = $3,
            moderation_notes = COALESCE($4, moderation_notes),
            reviewed_at = NOW(),
            deleted_at = CASE WHEN $1 IN ('hidden', 'deleted') THEN NOW() ELSE deleted_at END,
            deleted_by = CASE WHEN $1 IN ('hidden', 'deleted') THEN $3 ELSE deleted_by END,
            deletion_reason = COALESCE($5, deletion_reason)
        WHERE id = $6
        RETURNING *
      `, [visibility_status, moderation_status, adminUser?.id || null, moderation_notes, deletion_reason, bookId]);

      const updatedBook = updateRes.rows[0];

      // 3. If deductExp is requested (e.g. spam penalty)
      if (deductExp && visibility_status === 'deleted') {
        await client.query(`
          INSERT INTO exp_ledger (user_fingerprint, amount, type, reference_type, reference_id)
          VALUES ($1, $2, 'MODERATION_PENALTY', 'books', $3)
        `, [currentBook.reader_name, EXP_CONFIG.MODERATION_PENALTY, bookId]);

        await client.query(`
          UPDATE community_growth
          SET total_exp = GREATEST(0, total_exp - $1),
              total_books = GREATEST(0, total_books - 1),
              updated_at = NOW()
          WHERE id = 1
        `, [Math.abs(EXP_CONFIG.MODERATION_PENALTY)]);
      }

      // 4. Create Audit Log
      await client.query(`
        INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata, ip_address)
        VALUES ($1, $2, 'books', $3, $4, $5)
      `, [
        adminUser?.id || null,
        visibility_status === 'deleted' ? 'HIDE_BOOK' : 'REVIEW_BOOK',
        bookId,
        JSON.stringify({ previous: currentBook, updated: updatedBook, deductExp }),
        ipAddress
      ]);

      const fullGrowthRes = await client.query('SELECT total_exp FROM community_growth WHERE id = 1');
      await GrowthService.recalculateAndSyncLevel(client, parseInt(fullGrowthRes.rows[0].total_exp, 10));

      return updatedBook;
    });

    const fullGrowth = await GrowthService.getCommunityGrowth();
    socketService.broadcastGrowthUpdated(fullGrowth);
    socketService.broadcastAdminBookEvent('book_status_updated', result);

    return result;
  }

  static async grantAdminBonus(amount, reason, adminUser, ipAddress) {
    const result = await db.transaction(async (client) => {
      // 1. Insert into EXP Ledger
      await client.query(`
        INSERT INTO exp_ledger (user_fingerprint, amount, type, reference_type, reference_id)
        VALUES ($1, $2, 'ADMIN_BONUS', 'admin', $3)
      `, [adminUser?.username || 'admin', amount, adminUser?.id || null]);

      // 2. Update community growth
      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_exp = total_exp + $1,
            updated_at = NOW()
        WHERE id = 1
        RETURNING total_exp
      `, [amount]);

      const newTotalExp = parseInt(growthRes.rows[0].total_exp, 10);
      const levelInfo = await GrowthService.recalculateAndSyncLevel(client, newTotalExp);

      // 3. Create Audit Log
      await client.query(`
        INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata, ip_address)
        VALUES ($1, 'OVERRIDE_EXP', 'community_growth', NULL, $2, $3)
      `, [
        adminUser?.id || null,
        JSON.stringify({ amount, reason, newTotalExp, newLevel: levelInfo.level }),
        ipAddress
      ]);

      return {
        amount,
        reason,
        newTotalExp,
        level: levelInfo.level
      };
    });

    const fullGrowth = await GrowthService.getCommunityGrowth();
    socketService.broadcastGrowthUpdated(fullGrowth);

    return result;
  }
}

export default ModerationService;
