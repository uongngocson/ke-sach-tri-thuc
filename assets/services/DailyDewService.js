/**
 * assets/services/DailyDewService.js
 * Daily Dew Check-in Service & Wisdom Blessing Generator
 * Enforces 1 dew per user per day in Asia/Ho_Chi_Minh timezone, checks user identity & team
 */
import { MockDataStore } from '../data/MockDataStore.js?v=20260907_v3';

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

  static _serverStatusCache = {};

  static invalidateCache(userId) {
    if (userId) {
      delete this._serverStatusCache[userId];
    } else {
      this._serverStatusCache = {};
    }
  }

  /**
   * Check if user has already checked in today from server DB
   * Returns true only when user reached daily limit (3 dews / day)
   * @param {string} userId 
   * @param {boolean} forceRefresh
   */
  static async hasCheckedInToday(userId, forceRefresh = false) {
    if (!userId || userId === 'guest') return false;

    const today = this.getTodayDateString();
    const cached = this._serverStatusCache[userId];

    if (!forceRefresh && cached && cached.cacheDate === today) {
      return cached.hasClaimedToday;
    }

    try {
      if (MockDataStore && MockDataStore.getDewStatus) {
        const status = await MockDataStore.getDewStatus(userId);
        if (status) {
          const hasClaimedToday = status.hasClaimedToday !== undefined ? !!status.hasClaimedToday : ((status.claimsToday || 0) >= 3);
          this._serverStatusCache[userId] = {
            hasClaimedToday: hasClaimedToday,
            claimsToday: status.claimsToday || 0,
            remainingClaimsToday: status.remainingClaimsToday ?? Math.max(0, 3 - (status.claimsToday || 0)),
            streak: status.streak,
            lastClaimDate: status.lastClaimDate,
            cacheDate: today
          };
          const key = this.getStorageKey(userId);
          localStorage.setItem(key, hasClaimedToday ? 'true' : 'false');
          if (status.streak !== undefined) {
            localStorage.setItem(this.getStreakKey(userId), String(status.streak));
          }
          return hasClaimedToday;
        }
      }
    } catch (e) {
      console.warn('Error checking dew status from server, falling back to local cache:', e);
    }

    try {
      const key = this.getStorageKey(userId);
      return localStorage.getItem(key) === 'true';
    } catch (e) {
      return false;
    }
  }

  /**
   * Get detailed dew status for user today
   * @param {string} userId 
   * @param {boolean} forceRefresh
   */
  static async getDewStatusDetail(userId, forceRefresh = false) {
    if (!userId || userId === 'guest') {
      return { hasClaimedToday: false, claimsToday: 0, remainingClaimsToday: 3, streak: 0 };
    }
    await this.hasCheckedInToday(userId, forceRefresh);
    const cached = this._serverStatusCache[userId];
    if (cached) {
      return {
        hasClaimedToday: !!cached.hasClaimedToday,
        claimsToday: cached.claimsToday || 0,
        remainingClaimsToday: cached.remainingClaimsToday ?? Math.max(0, 3 - (cached.claimsToday || 0)),
        streak: cached.streak || 0,
        lastClaimDate: cached.lastClaimDate
      };
    }
    return { hasClaimedToday: false, claimsToday: 0, remainingClaimsToday: 3, streak: 0 };
  }

  /**
   * Get current streak for user from server DB (with cache fallback)
   * @param {string} userId 
   */
  static async getStreak(userId) {
    if (!userId || userId === 'guest') return 0;
    const today = this.getTodayDateString();
    const cached = this._serverStatusCache[userId];
    if (cached && cached.cacheDate === today && cached.streak !== undefined) {
      return cached.streak;
    }
    try {
      if (MockDataStore && MockDataStore.getDewStatus) {
        const status = await MockDataStore.getDewStatus(userId);
        if (status) {
          const hasClaimedToday = status.hasClaimedToday !== undefined ? !!status.hasClaimedToday : ((status.claimsToday || 0) >= 3);
          this._serverStatusCache[userId] = {
            hasClaimedToday: hasClaimedToday,
            claimsToday: status.claimsToday || 0,
            remainingClaimsToday: status.remainingClaimsToday ?? Math.max(0, 3 - (status.claimsToday || 0)),
            streak: status.streak,
            lastClaimDate: status.lastClaimDate,
            cacheDate: today
          };
          return status.streak || 0;
        }
      }
    } catch (e) {}

    try {
      const s = localStorage.getItem(this.getStreakKey(userId));
      return s ? parseInt(s, 10) : 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Claim daily morning dew (+1 EXP & Lucky Wisdom Quote, up to 3 times/day)
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

    // 4. Check if team's tree has unlocked watering (Level >= 2, >= 150 EXP)
    if (activeTeam) {
      const exp = parseInt(activeTeam.tree_exp || activeTeam.total_exp || 0, 10);
      const level = (activeTeam.tree_level !== undefined && activeTeam.tree_level !== null)
        ? parseInt(activeTeam.tree_level, 10)
        : ((activeTeam.level !== undefined && activeTeam.level !== null)
            ? parseInt(activeTeam.level, 10)
            : (exp >= 150 ? 2 : (exp >= 50 ? 1 : 0)));
      if (level < 2 && exp < 150) {
        return {
          success: false,
          code: 'TREE_LEVEL_TOO_LOW',
          message: 'Tính năng Tưới Nước chỉ mở khi Cây Tri Thức của đội bạn đạt Cấp 2 – Cây Con (từ 150 EXP trở lên)!'
        };
      }
    }

    // 5. Fast local check
    const today = this.getTodayDateString();
    if (await this.hasCheckedInToday(currentUser.id)) {
      return {
        success: false,
        code: 'ALREADY_CLAIMED',
        message: 'Hôm nay bạn đã tưới cây đủ 3 lần rồi! Hãy quay lại vào ngày mai nhé. 🌱'
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
        this._serverStatusCache[currentUser.id] = {
          hasClaimedToday: true,
          claimsToday: apiRes.claimsToday || 3,
          remainingClaimsToday: 0,
          streak: apiRes.streak || (await this.getStreak(currentUser.id)),
          cacheDate: today
        };
        localStorage.setItem(this.getStorageKey(currentUser.id), 'true');
      }
      return {
        success: false,
        code: apiRes.code || 'API_ERROR',
        message: apiRes.message || 'Không thể thực hiện tưới cây lúc này. Vui lòng thử lại!'
      };
    }

    // 6. Save checkin state locally and in server cache on success
    const currentStreak = apiRes.streak || (await this.getStreak(currentUser.id));
    const claimsToday = apiRes.claimsToday || 1;
    const hasClaimedToday = apiRes.hasClaimedToday !== undefined ? apiRes.hasClaimedToday : (claimsToday >= 3);
    const remainingClaimsToday = apiRes.remainingClaimsToday !== undefined ? apiRes.remainingClaimsToday : Math.max(0, 3 - claimsToday);

    this._serverStatusCache[currentUser.id] = {
      hasClaimedToday: hasClaimedToday,
      claimsToday: claimsToday,
      remainingClaimsToday: remainingClaimsToday,
      streak: currentStreak,
      lastClaimDate: today,
      cacheDate: today
    };
    localStorage.setItem(this.getStorageKey(currentUser.id), hasClaimedToday ? 'true' : 'false');
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
      claimsToday: claimsToday,
      remainingClaimsToday: remainingClaimsToday,
      hasClaimedToday: hasClaimedToday,
      streak: currentStreak,
      quote: luckyQuote,
      team: apiRes.team,
      user: currentUser,
      totalEXP: apiRes.growth ? apiRes.growth.totalEXP : null
    };
  }
}
