/**
 * assets/services/DailyDewService.js
 * Daily Dew Check-in Service & Wisdom Blessing Generator
 * Enforces 1 dew per user per day in Asia/Ho_Chi_Minh timezone, checks user identity & team
 */
import { MockDataStore } from '../data/MockDataStore.js?v=20260907_v1';

export class DailyDewService {
  /**
   * Get today's date in Asia/Ho_Chi_Minh timezone (YYYY-MM-DD)
   */
  static getTodayDateString() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  static getStorageKey(userId) {
    const today = this.getTodayDateString();
    return `fpt_dew_checkin_${userId || 'guest'}_${today}`;
  }

  static getStreakKey(userId) {
    return `fpt_dew_streak_${userId || 'guest'}`;
  }

  /**
   * Check if user has already checked in today
   * @param {string} userId 
   */
  static async hasCheckedInToday(userId) {
    if (!userId || userId === 'guest') return false;
    try {
      const key = this.getStorageKey(userId);
      return localStorage.getItem(key) === 'true';
    } catch (e) {
      return false;
    }
  }

  /**
   * Get current streak for user
   * @param {string} userId 
   */
  static async getStreak(userId) {
    try {
      const s = localStorage.getItem(this.getStreakKey(userId));
      return s ? parseInt(s, 10) : 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Claim daily morning dew (+1 EXP & Lucky Wisdom Quote)
   * @param {Object} params
   * @param {Object} params.currentUser - The logged-in user object
   * @param {Object} params.activeTeam - The team tree currently being viewed
   */
  static async claimDailyDew({ currentUser, activeTeam } = {}) {
    // 1. Must be logged in (no guest)
    if (!currentUser || currentUser.isGuest || currentUser.id === 'guest') {
      return {
        success: false,
        code: 'NEED_LOGIN',
        message: 'Vui lòng đăng nhập hoặc xác nhận danh tính thành viên để tưới nước cho cây tri thức!'
      };
    }

    // 2. Must belong to a team
    if (!currentUser.team_id) {
      return {
        success: false,
        code: 'NO_TEAM',
        message: 'Bạn chưa thuộc đội nào trong 8 đội tri thức. Vui lòng liên hệ ban tổ chức để được xếp đội!'
      };
    }

    // 3. User can only water their own team's tree
    if (activeTeam && parseInt(activeTeam.id, 10) !== parseInt(currentUser.team_id, 10)) {
      return {
        success: false,
        code: 'WRONG_TEAM',
        message: `Bạn đang xem cây của ${activeTeam.display_name || 'đội khác'}. Bạn chỉ có thể tưới nước cho cây của đội mình!`
      };
    }

    // 4. Fast local check
    const today = this.getTodayDateString();
    if (await this.hasCheckedInToday(currentUser.id)) {
      return {
        success: false,
        code: 'ALREADY_CLAIMED',
        message: 'Hôm nay bạn đã tưới cây đội mình rồi! Hãy quay lại vào ngày mai nhé. 🌱'
      };
    }

    // 5. Call API backend
    const apiRes = await MockDataStore.claimDailyDew({
      userId: currentUser.id,
      teamId: currentUser.team_id,
      email: currentUser.email,
      userFingerprint: MockDataStore.fingerprint
    });

    if (!apiRes.success) {
      if (apiRes.code === 'DUPLICATE_DEW_CLAIM') {
        localStorage.setItem(this.getStorageKey(currentUser.id), 'true');
      }
      return {
        success: false,
        code: apiRes.code || 'API_ERROR',
        message: apiRes.message || 'Không thể thực hiện tưới cây lúc này. Vui lòng thử lại!'
      };
    }

    // 6. Save checkin state locally on success
    const currentStreak = apiRes.streak || (await this.getStreak(currentUser.id)) + 1;
    localStorage.setItem(this.getStorageKey(currentUser.id), 'true');
    localStorage.setItem(this.getStreakKey(currentUser.id), String(currentStreak));

    // 7. Pick an inspiring blessing quote of the day
    let luckyQuote = null;
    try {
      const quotes = await MockDataStore.getMasterQuotes();
      if (quotes && quotes.length > 0) {
        luckyQuote = quotes[Math.floor(Math.random() * quotes.length)];
      }
    } catch (e) {
      // ignore
    }

    // 8. Broadcast event for UI and Particle FX
    const expGained = (apiRes && (apiRes.expEarned || apiRes.expGained)) || 2;
    MockDataStore.emitEvent('dew:collected', {
      expGained: expGained,
      streak: currentStreak,
      quote: luckyQuote,
      team: apiRes.team,
      user: currentUser,
      totalEXP: apiRes.growth ? apiRes.growth.totalEXP : null
    });

    return {
      success: true,
      expGained: expGained,
      streak: currentStreak,
      quote: luckyQuote,
      team: apiRes.team,
      user: currentUser,
      totalEXP: apiRes.growth ? apiRes.growth.totalEXP : null
    };
  }
}
