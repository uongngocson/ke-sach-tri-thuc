import db from '../config/database.js';
import socketService from './socket.service.js';
import { calculateLevelFromExp } from '../config/constants.js';

export class TesterService {
  static async setExp(exp, customSeedsCount = null) {
    const levelInfo = calculateLevelFromExp(exp);
    const seeds = customSeedsCount !== null ? customSeedsCount : (exp < 50 ? exp : 0);

    const result = await db.transaction(async (client) => {
      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_exp = $1,
            level = $2,
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `, [exp, levelInfo.level]);

      const updated = growthRes.rows[0];

      const fullGrowth = {
        totalEXP: parseInt(updated.total_exp, 10),
        level: updated.level,
        levelName: levelInfo.levelName,
        levelDescription: levelInfo.levelDescription,
        progressPercent: levelInfo.progressPercent,
        nextLevelThreshold: levelInfo.nextThreshold,
        currentLevelFloor: levelInfo.currentFloor,
        totalBooks: parseInt(updated.total_books, 10),
        totalDews: parseInt(updated.total_dews, 10),
        totalLikes: parseInt(updated.total_likes, 10),
        activeReaders: parseInt(updated.active_readers, 10),
        seedsCount: seeds
      };

      socketService.broadcastGrowthUpdated(fullGrowth);

      return fullGrowth;
    });

    return result;
  }

  static async addSeeds(count = 1) {
    const result = await db.transaction(async (client) => {
      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_books = total_books + $1,
            total_exp = total_exp + $1,
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `, [count]);

      const updated = growthRes.rows[0];
      const newExp = parseInt(updated.total_exp, 10);
      const levelInfo = calculateLevelFromExp(newExp);

      await client.query(`
        UPDATE community_growth
        SET level = $1
        WHERE id = 1
      `, [levelInfo.level]);

      const fullGrowth = {
        totalEXP: newExp,
        level: levelInfo.level,
        levelName: levelInfo.levelName,
        levelDescription: levelInfo.levelDescription,
        progressPercent: levelInfo.progressPercent,
        nextLevelThreshold: levelInfo.nextThreshold,
        currentLevelFloor: levelInfo.currentFloor,
        totalBooks: parseInt(updated.total_books, 10),
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

      // 2. Delete non-seeded/user-submitted books (keep seed books)
      await client.query(`
        DELETE FROM books 
        WHERE id NOT IN (
          SELECT id FROM books ORDER BY created_at ASC LIMIT 6
        )
      `);

      // 3. Reset community_growth to initial clean baseline
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
