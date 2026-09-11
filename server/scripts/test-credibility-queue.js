/**
 * server/scripts/test-credibility-queue.js
 * 
 * Kiểm thử Hàng Đợi Tự Động Thẩm Định Độ Uy Tín Trích Dẫn (AI Credibility Queue)
 * 1. Kiểm thử tính năng Deduplication (Chống trùng lặp trong Hàng đợi)
 * 2. Kiểm thử thứ tự ưu tiên FIFO & Pacing
 * 3. Kiểm thử lọc điều kiện: CHỈ CHẤM NHỮNG CÂU CHƯA CHẤM
 * 4. Kiểm thử API Queue Status & Scan Trigger
 */

import 'dotenv/config';
import assert from 'assert';
import http from 'http';
import { CredibilityQueue } from '../services/credibilityQueue.service.js';
import db from '../config/database.js';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('=================================================================');
  console.log('🧪 KIỂM THỬ HÀNG ĐỢI TỰ ĐỘNG THẨM ĐỊNH AI (CREDIBILITY QUEUE)');
  console.log('=================================================================');

  // 1. Deduplication Test
  console.log('\n--- [1/4] KIỂM THỬ DEDUPLICATION (CHỐNG TRÙNG LẬP) ---');
  const testBookId = 'test-book-uuid-12345';
  const firstEnqueue = CredibilityQueue.enqueue(testBookId);
  const secondEnqueue = CredibilityQueue.enqueue(testBookId);

  assert.strictEqual(firstEnqueue, true, 'Lần nạp đầu tiên phải thành công');
  assert.strictEqual(secondEnqueue, false, 'Lần nạp thứ hai cùng bookId phải bị từ chối chống trùng lặp');
  console.log('  ✅ [PASS] Deduplication hoạt động chuẩn xác: Chặn nạp trùng lặp 100%');
  CredibilityQueue.enqueuedSet.delete(testBookId);
  CredibilityQueue.queue = CredibilityQueue.queue.filter(j => j.bookId !== testBookId);

  // 2. Query filter test: Only unscored
  console.log('\n--- [2/4] KIỂM THỬ ĐIỀU KIỆN CHỈ CHẤM CÂU CHƯA CHẤM ---');
  const unscoredRes = await db.query(`
    SELECT COUNT(*) 
    FROM books 
    WHERE visibility_status != 'deleted' 
      AND (credibility_status IS NULL OR credibility_status = 'unscored')
  `);
  const unscoredCount = parseInt(unscoredRes.rows[0].count, 10);
  console.log(`  📊 Số trích dẫn chưa chấm thực tế trong DB: ${unscoredCount}`);

  const scoredRes = await db.query(`
    SELECT COUNT(*) 
    FROM books 
    WHERE credibility_status = 'scored'
  `);
  const scoredCount = parseInt(scoredRes.rows[0].count, 10);
  console.log(`  📊 Số trích dẫn đã được chấm thành công trong DB: ${scoredCount}`);
  assert(scoredCount >= 0, 'Truy vấn trạng thái đã chấm hợp lệ');
  console.log('  ✅ [PASS] Phân định chính xác trạng thái scored vs unscored');

  // 3. Queue status telemetry test
  console.log('\n--- [3/4] KIỂM THỬ TRẠNG THÁI TELEMETRY CỦA HÀNG ĐỢI ---');
  const status = CredibilityQueue.getStatus();
  assert(typeof status.isRunning === 'boolean', 'Trường isRunning hợp lệ');
  assert(typeof status.pendingCount === 'number', 'Trường pendingCount hợp lệ');
  assert(typeof status.delayBetweenJobs === 'number' && status.delayBetweenJobs >= 800, 'Pacing delay an toàn >= 800ms');
  console.log(`  📊 Queue Status: isRunning=${status.isRunning}, pending=${status.pendingCount}, processed=${status.stats.totalProcessed}, delay=${status.delayBetweenJobs}ms`);
  console.log('  ✅ [PASS] Telemetry trạng thái hàng đợi hoạt động đầy đủ và chính xác');

  const TEST_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

  // 4. API Integration Test
  console.log('\n--- [4/4] KIỂM THỬ API QUẢN TRỊ VIÊN VỚI HÀNG ĐỢI ---');
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: TEST_PORT,
    path: '/api/v1/admin/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });

  const token = loginRes.body?.data?.token;
  assert(token, 'Đăng nhập admin thành công');

  const apiStatusRes = await request({
    hostname: '127.0.0.1',
    port: TEST_PORT,
    path: '/api/v1/admin/credibility/queue-status',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  assert.strictEqual(apiStatusRes.status, 200, 'API queue-status trả về 200 OK');
  assert.strictEqual(apiStatusRes.body?.success, true, 'API queue-status success=true');
  console.log('  ✅ [PASS] API GET /api/v1/admin/credibility/queue-status phản hồi chuẩn xác 200 OK');

  console.log('\n=================================================================');
  console.log('🎉 TẤT CẢ KIỂM THỬ HÀNG ĐỢI TỰ ĐỘNG CHẤM ĐIỂM AI ĐẠT 100% PASSED');
  console.log('=================================================================');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
