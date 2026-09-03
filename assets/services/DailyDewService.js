/**
 * assets/services/DailyDewService.js
 * Daily Dew Check-in Service & Wisdom Blessing Generator
 * Fully decoupled and architected for easy future Backend / REST API integration
 */
import { MockDataStore } from '../data/MockDataStore.js';

export class DailyDewService {
  static STORAGE_KEY_LAST_CHECKIN = 'fpt_tree_last_checkin_date_v1';
  static STORAGE_KEY_STREAK = 'fpt_tree_checkin_streak_v1';

  static getTodayDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  static async hasCheckedInToday() {
    try {
      const last = localStorage.getItem(this.STORAGE_KEY_LAST_CHECKIN);
      return last === this.getTodayDateString();
    } catch (e) {
      return false;
    }
  }

  static async getStreak() {
    try {
      const s = localStorage.getItem(this.STORAGE_KEY_STREAK);
      return s ? parseInt(s, 10) : 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Claim daily morning dew (+1 EXP & Lucky Wisdom Quote)
   */
  static async claimDailyDew() {
    const today = this.getTodayDateString();
    const already = await this.hasCheckedInToday();
    if (already) {
      return { success: false, message: 'Hôm nay bạn đã tưới cây rồi! Hãy quay lại vào ngày mai nhé. 🌱' };
    }

    let currentStreak = await this.getStreak();
    currentStreak += 1;

    // Save checkin state
    localStorage.setItem(this.STORAGE_KEY_LAST_CHECKIN, today);
    localStorage.setItem(this.STORAGE_KEY_STREAK, String(currentStreak));

    // Add +1 EXP to user & tree growth
    const growth = await MockDataStore.addEXP(1);

    // Pick an inspiring blessing quote of the day
    const quotes = await MockDataStore.getMasterQuotes();
    const luckyQuote = quotes[Math.floor(Math.random() * quotes.length)];

    // Broadcast event for UI and Particle FX
    MockDataStore.emitEvent('dew:collected', {
      expGained: 1,
      streak: currentStreak,
      quote: luckyQuote,
      totalEXP: growth.totalEXP
    });

    return {
      success: true,
      expGained: 1,
      streak: currentStreak,
      quote: luckyQuote,
      totalEXP: growth.totalEXP
    };
  }
}
