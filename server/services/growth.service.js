import db from '../config/database.js';
import { calculateLevelFromExp } from '../config/constants.js';
import socketService from './socket.service.js';

export class GrowthService {
  static async getCommunityGrowth() {
    const res = await db.query('SELECT * FROM community_growth WHERE id = 1');
    const row = res.rows[0] || { total_exp: 0, level: 0, total_books: 0, total_dews: 0, total_likes: 0, active_readers: 1 };

    const exp = parseInt(row.total_exp, 10);
    const levelInfo = calculateLevelFromExp(exp);

    // Get true count of distinct visitors
    const visitorsRes = await db.query('SELECT COUNT(*) FROM site_visitors');
    const realVisitors = parseInt(visitorsRes.rows[0].count, 10);
    const activeReaders = Math.max(realVisitors, parseInt(row.active_readers, 10) || 1);

    return {
      totalEXP: exp,
      level: row.level,
      levelName: levelInfo.levelName,
      levelDescription: levelInfo.levelDescription,
      progressPercent: levelInfo.progressPercent,
      nextLevelThreshold: levelInfo.nextThreshold,
      currentLevelFloor: levelInfo.currentFloor,
      totalBooks: parseInt(row.total_books, 10),
      totalDews: parseInt(row.total_dews, 10),
      totalLikes: parseInt(row.total_likes, 10),
      activeReaders: activeReaders
    };
  }

  static async recordVisitor(userFingerprint, ip = '', userAgent = '') {
    if (!userFingerprint) return null;

    const result = await db.transaction(async (client) => {
      // 1. Upsert into site_visitors
      const visitRes = await client.query(`
        INSERT INTO site_visitors (user_fingerprint, ip_address, user_agent, visit_count, last_visited_at)
        VALUES ($1, $2, $3, 1, NOW())
        ON CONFLICT (user_fingerprint)
        DO UPDATE SET 
          visit_count = site_visitors.visit_count + 1,
          last_visited_at = NOW(),
          ip_address = COALESCE($2, site_visitors.ip_address),
          user_agent = COALESCE($3, site_visitors.user_agent)
        RETURNING (xmax = 0) AS is_new_visitor
      `, [userFingerprint, ip, userAgent]);

      const isNewVisitor = visitRes.rows[0]?.is_new_visitor || false;

      // 2. Count total distinct visitors
      const countRes = await client.query('SELECT COUNT(*) FROM site_visitors');
      const totalVisitors = parseInt(countRes.rows[0].count, 10);

      // 3. Sync into community_growth
      await client.query(`
        UPDATE community_growth
        SET active_readers = $1,
            updated_at = NOW()
        WHERE id = 1
      `, [totalVisitors]);

      return {
        totalVisitors,
        isNewVisitor
      };
    });

    // Broadcast if a new visitor arrived
    if (result && result.isNewVisitor) {
      const fullGrowth = await this.getCommunityGrowth();
      socketService.broadcastGrowthUpdated(fullGrowth);
    }

    return result;
  }

  static async recalculateAndSyncLevel(client, newExp) {
    const levelInfo = calculateLevelFromExp(newExp);
    await client.query(`
      UPDATE community_growth
      SET level = $1,
          updated_at = NOW()
      WHERE id = 1
    `, [levelInfo.level]);

    return levelInfo;
  }
}

export default GrowthService;
