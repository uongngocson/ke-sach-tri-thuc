import db from '../config/database.js';
import { calculateLevelFromExp } from '../config/constants.js';

export class GrowthService {
  static async getCommunityGrowth() {
    const res = await db.query('SELECT * FROM community_growth WHERE id = 1');
    const row = res.rows[0] || { total_exp: 0, level: 0, total_books: 0, total_dews: 0, total_likes: 0, active_readers: 2735 };
    
    const levelInfo = calculateLevelFromExp(row.total_exp);
    
    return {
      totalEXP: parseInt(row.total_exp, 10),
      level: levelInfo.level,
      levelName: levelInfo.name,
      levelDesc: levelInfo.desc,
      progressPercent: levelInfo.progressPercent,
      nextLevelExp: levelInfo.nextLevelExp,
      totalBooks: parseInt(row.total_books, 10),
      totalDews: parseInt(row.total_dews, 10),
      totalLikes: parseInt(row.total_likes, 10),
      activeReaders: parseInt(row.active_readers, 10),
      updatedAt: row.updated_at
    };
  }

  static async recalculateAndSyncLevel(client, totalExp) {
    const levelInfo = calculateLevelFromExp(totalExp);
    await client.query(
      'UPDATE community_growth SET level = $1, total_exp = $2, updated_at = NOW() WHERE id = 1',
      [levelInfo.level, totalExp]
    );
    return levelInfo;
  }
}

export default GrowthService;
