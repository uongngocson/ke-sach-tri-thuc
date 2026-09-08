/**
 * server/services/credibilityQueue.service.js
 * 
 * Hệ Thống Hàng Đợi Tự Động Thẩm Định Độ Uy Tín Trích Dẫn (AI Credibility Queue Worker)
 * 
 * Đặc tính kỹ thuật:
 * - Đơn luồng điều phối an toàn (Concurrency = 1, FIFO)
 * - Tự động pacing (khoảng nghỉ 1000ms giữa các request) chống nghẽn RPM/TPM của Groq
 * - Cơ chế Deduplication (In-memory Set) ngăn chặn trùng lặp tuyệt đối
 * - Tự động quét DB tìm các trích dẫn chưa chấm (credibility_status IS NULL hoặc 'unscored')
 * - Bắt sự kiện Real-time: Gieo sách mới -> Tự động đưa vào queue chấm ngầm
 * - Kháng lỗi & Thử lại tối đa 3 lần với Exponential Backoff
 * - Phát sóng Socket.io tức thì khi chấm xong để UI cập nhật realtime không cần reload
 */

import db from '../config/database.js';
import { CredibilityService } from './credibility.service.js';
import socketService from './socket.service.js';

class CredibilityQueueService {
  constructor() {
    this.queue = [];                   // FIFO Job Queue: [{ bookId, retries, addedAt }]
    this.enqueuedSet = new Set();      // Deduplication Set: bookId -> boolean
    this.isProcessing = false;         // Mutex lock for concurrency = 1
    this.isRunning = false;            // Service lifecycle state
    this.isPaused = false;             // Paused during circuit breaker / admin toggle
    this.delayBetweenJobs = 1000;      // 1000ms inter-job pacing to guarantee safe RPM/TPM
    this.maxRetries = 3;               // Maximum retries for temporary failures
    this.pollingTimer = null;          // Safety net background interval
    this.pollingIntervalMs = 30000;    // 30s recurring safety check
    
    // Telemetry & Metrics
    this.stats = {
      totalProcessed: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      lastProcessedAt: null,
      lastError: null
    };
  }

  /**
   * Khởi động Worker và đăng ký Safety Net Polling
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🤖 [CredibilityQueue] Đã khởi động Hàng đợi Thẩm định AI tự động.');

    // 1. Quét tìm ngay các sách chưa chấm khi khởi động
    this.scanAndEnqueueUnscored().catch(err => {
      console.error('⚠️ [CredibilityQueue] Lỗi quét ban đầu:', err.message);
    });

    // 2. Kích hoạt Safety Net Polling định kỳ mỗi 30s
    if (!this.pollingTimer) {
      this.pollingTimer = setInterval(() => {
        if (this.isRunning && !this.isPaused) {
          this.scanAndEnqueueUnscored().catch(err => {
            console.error('⚠️ [CredibilityQueue] Lỗi safety polling:', err.message);
          });
        }
      }, this.pollingIntervalMs);
      if (this.pollingTimer.unref) this.pollingTimer.unref();
    }
  }

  /**
   * Dừng Worker
   */
  stop() {
    this.isRunning = false;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    console.log('🛑 [CredibilityQueue] Đã dừng Hàng đợi Thẩm định AI.');
  }

  /**
   * Thêm một cuốn sách vào hàng đợi
   * @param {string} bookId 
   * @param {Object} [options]
   * @param {boolean} [options.priority=false] - Ưu tiên đẩy lên đầu hàng đợi (cho nút "Chấm lại")
   * @returns {boolean} True nếu được nhận vào queue, False nếu đã nằm trong queue
   */
  enqueue(bookId, { priority = false } = {}) {
    if (!bookId) return false;

    // Deduplication check: Tránh push trùng lặp
    if (this.enqueuedSet.has(bookId)) {
      return false;
    }

    this.enqueuedSet.add(bookId);
    const job = {
      bookId,
      retries: 0,
      addedAt: Date.now()
    };

    if (priority) {
      this.queue.unshift(job);
    } else {
      this.queue.push(job);
    }

    // Kích hoạt xử lý nếu worker đang rảnh
    this._processNext();
    return true;
  }

  /**
   * Thêm hàng loạt sách vào hàng đợi
   * @param {string[]} bookIds 
   * @returns {number} Số lượng sách được nạp mới
   */
  enqueueMany(bookIds = []) {
    let addedCount = 0;
    for (const id of bookIds) {
      if (this.enqueue(id)) {
        addedCount++;
      }
    }
    return addedCount;
  }

  /**
   * Tự động quét Database và nạp TOÀN BỘ các câu trích dẫn CHƯA ĐƯỢC CHẤM
   * Điều kiện: visibility_status != 'deleted' AND (credibility_status IS NULL OR credibility_status = 'unscored')
   */
  async scanAndEnqueueUnscored({ limit = 50 } = {}) {
    try {
      const res = await db.query(`
        SELECT id, title 
        FROM books 
        WHERE visibility_status != 'deleted' 
          AND (credibility_status IS NULL OR credibility_status = 'unscored')
        ORDER BY created_at ASC 
        LIMIT $1
      `, [limit]);

      if (res.rows.length === 0) return 0;

      let enqueuedCount = 0;
      for (const row of res.rows) {
        if (this.enqueue(row.id)) {
          enqueuedCount++;
        }
      }

      if (enqueuedCount > 0) {
        console.log(`📥 [CredibilityQueue] Đã tự động nạp ${enqueuedCount} trích dẫn chưa chấm vào Hàng đợi.`);
      }
      return enqueuedCount;
    } catch (err) {
      console.error('❌ [CredibilityQueue] Lỗi truy vấn sách chưa chấm:', err.message);
      return 0;
    }
  }

  /**
   * Vòng lặp xử lý tuần tự từng Job (Concurrency = 1, FIFO)
   */
  async _processNext() {
    if (!this.isRunning || this.isPaused || this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift();

    try {
      // 1. Kiểm tra lại trong DB xem câu này đã được chấm hay chưa trước khi gọi Groq AI
      // (Đảm bảo nguyên tắc: CHỈ CHẤM NHỮNG CÂU CHƯA CHẤM)
      const checkRes = await db.query(
        "SELECT credibility_status FROM books WHERE id = $1",
        [job.bookId]
      );

      if (checkRes.rows.length === 0) {
        // Sách không còn tồn tại
        this.enqueuedSet.delete(job.bookId);
        this.isProcessing = false;
        this._scheduleNext();
        return;
      }

      const currentStatus = checkRes.rows[0].credibility_status;
      // Nếu đã được chấm bởi tiến trình khác, bỏ qua ngay
      if (currentStatus === 'scored') {
        this.enqueuedSet.delete(job.bookId);
        this.isProcessing = false;
        this._scheduleNext();
        return;
      }

      // 2. Tiến hành thẩm định bằng CredibilityService (Groq Pool)
      const scoredBook = await CredibilityService.scoreQuoteCredibility(job.bookId);
      
      if (!scoredBook) {
        this.enqueuedSet.delete(job.bookId);
        return;
      }

      this.stats.totalProcessed++;
      this.stats.totalSucceeded++;
      this.stats.lastProcessedAt = new Date().toISOString();
      this.enqueuedSet.delete(job.bookId);

      // 3. Phát sóng Realtime qua Socket.io để Admin Hub cập nhật trực tiếp
      socketService.broadcastAdminBookEvent('credibility_scored', scoredBook);
      if (typeof socketService.broadcastBookCredibilityScored === 'function') {
        socketService.broadcastBookCredibilityScored(scoredBook);
      }

      console.log(`✅ [CredibilityQueue] Đã chấm tự động sách "${scoredBook.title || job.bookId}": ${scoredBook.credibility_score}/100`);

    } catch (err) {
      console.error(`⚠️ [CredibilityQueue] Lỗi chấm sách ${job.bookId}:`, err.message);
      this.stats.lastError = err.message;

      // 4. Retry Logic & Exponential Backoff
      job.retries = (job.retries || 0) + 1;

      if (job.retries <= this.maxRetries) {
        console.log(`🔁 [CredibilityQueue] Thử lại sách ${job.bookId} (Lần ${job.retries}/${this.maxRetries})...`);
        // Đẩy lại vào hàng đợi sau một khoảng giãn cách
        setTimeout(() => {
          this.queue.push(job);
          this._processNext();
        }, 2000 * job.retries);
      } else {
        // Vượt quá số lần thử lại tối đa -> Đánh dấu failed trong DB
        this.stats.totalProcessed++;
        this.stats.totalFailed++;
        this.enqueuedSet.delete(job.bookId);
        console.error(`❌ [CredibilityQueue] Đã quá số lần thử lại cho sách ${job.bookId}. Đánh dấu thất bại.`);
      }
    } finally {
      // 5. Khoảng nghỉ Pacing an toàn giữa 2 jobs (1000ms) để không bao giờ vượt RPM/TPM của Groq
      setTimeout(() => {
        this.isProcessing = false;
        this._scheduleNext();
      }, this.delayBetweenJobs);
    }
  }

  /**
   * Lên lịch chạy job tiếp theo
   */
  _scheduleNext() {
    if (this.queue.length > 0 && !this.isProcessing && this.isRunning && !this.isPaused) {
      this._processNext();
    }
  }

  /**
   * Trả về báo cáo trạng thái hàng đợi theo thời gian thực
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isProcessing: this.isProcessing,
      pendingCount: this.queue.length,
      enqueuedTotal: this.enqueuedSet.size,
      delayBetweenJobs: this.delayBetweenJobs,
      stats: { ...this.stats }
    };
  }
}

// Export singleton instance
export const CredibilityQueue = new CredibilityQueueService();
export default CredibilityQueue;
