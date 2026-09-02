import db from '../config/database.js';
import { EXP_CONFIG } from '../config/constants.js';
import GrowthService from './growth.service.js';
import socketService from './socket.service.js';

export class DewService {
  static async claimDew(userFingerprint) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const result = await db.transaction(async (client) => {
      // 1. Calculate streak from yesterday
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const prevDew = await client.query(
        'SELECT streak FROM daily_dews WHERE user_fingerprint = $1 AND claim_date = $2',
        [userFingerprint, yesterday]
      );
      const streak = prevDew.rows.length > 0 ? prevDew.rows[0].streak + 1 : 1;

      // 2. Insert Daily Dew with UNIQUE constraint on (user_fingerprint, claim_date)
      const dewInsert = await client.query(`
        INSERT INTO daily_dews (user_fingerprint, claim_date, streak)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [userFingerprint, today, streak]);

      const newDew = dewInsert.rows[0];

      // 3. Insert into EXP Ledger (+1 EXP)
      await client.query(`
        INSERT INTO exp_ledger (user_fingerprint, amount, type, reference_type, reference_id)
        VALUES ($1, $2, 'DAILY_DEW', 'daily_dews', $3)
      `, [userFingerprint, EXP_CONFIG.DAILY_DEW, newDew.id]);

      // 4. Update community growth
      const growthRes = await client.query(`
        UPDATE community_growth
        SET total_exp = total_exp + $1,
            total_dews = total_dews + 1,
            updated_at = NOW()
        WHERE id = 1
        RETURNING total_exp
      `, [EXP_CONFIG.DAILY_DEW]);

      const newTotalExp = parseInt(growthRes.rows[0].total_exp, 10);
      const levelInfo = await GrowthService.recalculateAndSyncLevel(client, newTotalExp);

      return {
        dew: newDew,
        streak,
        expEarned: EXP_CONFIG.DAILY_DEW,
        growth: {
          totalEXP: newTotalExp,
          level: levelInfo.level,
          levelName: levelInfo.name,
          progressPercent: levelInfo.progressPercent
        }
      };
    });

    // Post-Commit Broadcast
    const fullGrowth = await GrowthService.getCommunityGrowth();
    socketService.broadcastGrowthUpdated(fullGrowth);

    return result;
  }

  static async getDewStatus(userFingerprint) {
    const today = new Date().toISOString().split('T')[0];
    const res = await db.query(
      'SELECT streak, claim_date FROM daily_dews WHERE user_fingerprint = $1 ORDER BY claim_date DESC LIMIT 1',
      [userFingerprint]
    );

    if (res.rows.length === 0) {
      return { hasClaimedToday: false, streak: 0 };
    }

    const last = res.rows[0];
    const hasClaimedToday = last.claim_date.toISOString().split('T')[0] === today;
    return {
      hasClaimedToday,
      streak: last.streak,
      lastClaimDate: last.claim_date
    };
  }
}

export default DewService;
