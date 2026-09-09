import db from '../config/database.js';
import { EXP_CONFIG } from '../config/constants.js';
import GrowthService from './growth.service.js';
import socketService from './socket.service.js';

/**
 * Returns YYYY-MM-DD in Asia/Ho_Chi_Minh timezone
 */
export function getVietnamDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export class DewService {
  /**
   * Claim daily dew for a registered user on their team's tree
   * Rules:
   * 1. 1 user (userId) is strictly allowed to water only 1 time per day (Asia/Ho_Chi_Minh).
   * 2. Guests / non-logged in users CANNOT water.
   * 3. Users can only water their own team's tree (teamId must match user's team_id).
   */
  static async claimDew({ userId, teamId, email, userFingerprint, customDate }) {
    // 1. Check user login
    if (!userId || userId === 'guest') {
      const err = new Error('Vui lòng đăng nhập hoặc chọn danh tính thành viên để tưới cây!');
      err.statusCode = 401;
      err.code = 'LOGIN_REQUIRED';
      throw err;
    }

    // 2. Query user from DB
    const userRes = await db.query(
      'SELECT id, full_name, team_id, total_exp_earned FROM users WHERE id = $1',
      [userId]
    );

    if (userRes.rows.length === 0) {
      const err = new Error('Không tìm thấy thông tin thành viên. Vui lòng đăng nhập lại.');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const user = userRes.rows[0];

    if (!user.team_id) {
      const err = new Error('Bạn chưa thuộc đội nào. Vui lòng liên hệ ban tổ chức để được xếp đội!');
      err.statusCode = 400;
      err.code = 'NO_TEAM_ASSIGNED';
      throw err;
    }

    // 3. Prevent watering other team's tree
    if (teamId && parseInt(teamId, 10) !== parseInt(user.team_id, 10)) {
      const err = new Error('Bạn chỉ có thể tưới nước cho cây của đội mình! Hãy chuyển về cây đội bạn để chăm sóc.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_OTHER_TEAM_TREE';
      throw err;
    }

    const todayVN = customDate || getVietnamDateString();
    const effectiveFingerprint = userFingerprint || `fp_user_${user.id.substring(0, 8)}`;

    const result = await db.transaction(async (client) => {
      // 4. Row-level lock on user to prevent race condition over-claiming
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);

      // Check if user already claimed max 3 times today
      const existingClaims = await client.query(
        'SELECT id, claim_date, streak FROM daily_dews WHERE user_id = $1 AND claim_date = $2',
        [user.id, todayVN]
      );

      if (existingClaims.rows.length >= 3) {
        const err = new Error('Hôm nay bạn đã tưới cây đủ 3 lần rồi. Hãy quay lại vào ngày mai nhé!');
        err.statusCode = 409;
        err.code = 'DUPLICATE_DEW_CLAIM';
        throw err;
      }

      // 5. Calculate streak (Preserve streak across multiple claims on the same day)
      let streak = 1;
      if (existingClaims.rows.length > 0) {
        streak = existingClaims.rows[0].streak || 1;
      } else {
        const [y, m, d] = todayVN.split('-').map(Number);
        const yesterdayObj = new Date(Date.UTC(y, m - 1, d - 1));
        const yesterdayVN = yesterdayObj.toISOString().split('T')[0];

        const prevDew = await client.query(
          'SELECT streak FROM daily_dews WHERE user_id = $1 AND claim_date = $2 ORDER BY streak DESC LIMIT 1',
          [user.id, yesterdayVN]
        );
        streak = prevDew.rows.length > 0 ? (prevDew.rows[0].streak || 0) + 1 : 1;
      }

      // 6. Insert Daily Dew
      const dewInsert = await client.query(`
        INSERT INTO daily_dews (user_id, team_id, user_fingerprint, claim_date, streak)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [user.id, user.team_id, effectiveFingerprint, todayVN, streak]);

      const newDew = dewInsert.rows[0];

      // 7. Insert into EXP Ledger (+1 EXP)
      await client.query(`
        INSERT INTO exp_ledger (user_id, team_id, user_fingerprint, amount, type, reference_type, reference_id)
        VALUES ($1, $2, $3, $4, 'DAILY_DEW', 'daily_dews', $5)
      `, [user.id, user.team_id, effectiveFingerprint, EXP_CONFIG.DAILY_DEW, newDew.id]);

      // 8. Update User Total EXP
      await client.query(`
        UPDATE users
        SET total_exp_earned = total_exp_earned + $1,
            updated_at = NOW()
        WHERE id = $2
      `, [EXP_CONFIG.DAILY_DEW, user.id]);

      // 9. Update Team Tree EXP
      const teamRes = await client.query(`
        UPDATE teams
        SET tree_exp = tree_exp + $1,
            total_exp = total_exp + $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, code, display_name, tree_exp, total_exp, tree_level, level
      `, [EXP_CONFIG.DAILY_DEW, user.team_id]);

      // 10. Update Community Growth
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

      const claimsToday = existingClaims.rows.length + 1;
      const remainingClaimsToday = Math.max(0, 3 - claimsToday);
      const hasClaimedToday = claimsToday >= 3;

      return {
        dew: newDew,
        streak,
        claimsToday,
        remainingClaimsToday,
        hasClaimedToday,
        expEarned: EXP_CONFIG.DAILY_DEW,
        team: teamRes.rows[0],
        user: {
          id: user.id,
          fullName: user.full_name,
          teamId: user.team_id
        },
        growth: {
          totalEXP: newTotalExp,
          level: levelInfo.level,
          levelName: levelInfo.name,
          progressPercent: levelInfo.progressPercent
        }
      };
    });

    // 11. Post-Commit Broadcast
    const fullGrowth = await GrowthService.getCommunityGrowth();
    socketService.broadcastGrowthUpdated(fullGrowth);

    return result;
  }

  /**
   * Get Dew claim status for a user today (Max 3 claims per day)
   */
  static async getDewStatus({ userId, userFingerprint, customDate }) {
    const todayVN = customDate || getVietnamDateString();
    let todayClaims = [];
    let latestRecord = null;

    if (userId && userId !== 'guest') {
      const todayRes = await db.query(
        'SELECT id, streak, claim_date::text as claim_date FROM daily_dews WHERE user_id = $1 AND claim_date = $2',
        [userId, todayVN]
      );
      todayClaims = todayRes.rows;

      const latestRes = await db.query(
        'SELECT streak, claim_date::text as claim_date FROM daily_dews WHERE user_id = $1 ORDER BY claim_date DESC, created_at DESC LIMIT 1',
        [userId]
      );
      latestRecord = latestRes.rows[0] || null;
    } else if (userFingerprint) {
      const todayRes = await db.query(
        'SELECT id, streak, claim_date::text as claim_date FROM daily_dews WHERE user_fingerprint = $1 AND claim_date = $2',
        [userFingerprint, todayVN]
      );
      todayClaims = todayRes.rows;

      const latestRes = await db.query(
        'SELECT streak, claim_date::text as claim_date FROM daily_dews WHERE user_fingerprint = $1 ORDER BY claim_date DESC, created_at DESC LIMIT 1',
        [userFingerprint]
      );
      latestRecord = latestRes.rows[0] || null;
    } else {
      return { hasClaimedToday: false, claimsToday: 0, remainingClaimsToday: 3, streak: 0 };
    }

    const claimsCount = todayClaims.length;
    const hasClaimedToday = claimsCount >= 3;

    return {
      hasClaimedToday,
      claimsToday: claimsCount,
      remainingClaimsToday: Math.max(0, 3 - claimsCount),
      streak: latestRecord ? (latestRecord.streak || 0) : 0,
      lastClaimDate: latestRecord ? latestRecord.claim_date : null
    };
  }
}

export default DewService;
