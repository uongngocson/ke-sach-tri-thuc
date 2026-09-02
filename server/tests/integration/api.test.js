import request from 'supertest';
import { app, server } from '../../server.js';
import db from '../../config/database.js';
import { v4 as uuidv4 } from 'uuid';

describe('Integration Tests: Cáo Sách API & Database Transactions', () => {
  let adminToken = '';
  const testFingerprint = `test_device_${Date.now()}`;

  beforeAll(async () => {
    // 1. Authenticate Admin
    const loginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.token).toBeDefined();
    adminToken = loginRes.body.data.token;
  });

  afterAll(async () => {
    await db.pool.end();
    server.close();
  });

  test('GET /api/v1/growth - returns real-time community growth metrics', async () => {
    const res = await request(app).get('/api/v1/growth');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalEXP).toBeGreaterThanOrEqual(0);
    expect(res.body.data.level).toBeGreaterThanOrEqual(0);
  });

  test('POST /api/v1/books/contribute - Auto-Approve 100% (+15 EXP, visible, pending_review)', async () => {
    const idempotencyKey = uuidv4();
    const bookPayload = {
      title: 'Nhập Môn Lập Trình TypeScript',
      author: 'Anders Hejlsberg',
      quote: 'Kiểu tĩnh mang lại sự tự tin tuyệt đối cho các hệ thống phần mềm quy mô lớn.',
      category: 'Công Nghệ',
      reader: 'Dev Cáo Sách',
      email: 'dev@caosach.vn',
      userFingerprint: testFingerprint
    };

    const res = await request(app)
      .post('/api/v1/books/contribute')
      .set('Idempotency-Key', idempotencyKey)
      .send(bookPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.book.visibility_status).toBe('visible');
    expect(res.body.data.book.moderation_status).toBe('pending_review');
    expect(res.body.data.growth.expEarned).toBe(15);

    // Test Idempotency: Send the exact same request with same Idempotency-Key -> cached response
    const duplicateRes = await request(app)
      .post('/api/v1/books/contribute')
      .set('Idempotency-Key', idempotencyKey)
      .send(bookPayload);

    expect(duplicateRes.status).toBe(201);
    expect(duplicateRes.body.data.book.id).toBe(res.body.data.book.id);
  });

  test('POST /api/v1/dew/claim - Daily Dew (+1 EXP) & Anti-Spam unique constraint on same day', async () => {
    const dewFingerprint = `dew_user_${Date.now()}`;

    // Claim 1st time -> Success
    const res1 = await request(app)
      .post('/api/v1/dew/claim')
      .send({ userFingerprint: dewFingerprint });

    expect(res1.status).toBe(201);
    expect(res1.body.data.expEarned).toBe(1);

    // Claim 2nd time on same day -> 409 Conflict (Database-Level Constraint Enforced)
    const res2 = await request(app)
      .post('/api/v1/dew/claim')
      .send({ userFingerprint: dewFingerprint });

    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe('DUPLICATE_DEW_CLAIM');
  });

  test('POST /api/v1/quotes/:id/like - Like Quote (+2 EXP) & Anti-Spam duplicate prevention', async () => {
    // Get a quote ID
    const quotesRes = await request(app).get('/api/v1/quotes');
    const targetBook = quotesRes.body.data.quotes[0];

    const likeFingerprint = `like_user_${Date.now()}`;

    // Like 1st time -> Success
    const res1 = await request(app)
      .post(`/api/v1/quotes/${targetBook.id}/like`)
      .send({ userFingerprint: likeFingerprint });

    expect(res1.status).toBe(200);
    expect(res1.body.data.expEarned).toBe(2);

    // Like 2nd time on same book -> 409 Conflict
    const res2 = await request(app)
      .post(`/api/v1/quotes/${targetBook.id}/like`)
      .send({ userFingerprint: likeFingerprint });

    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe('DUPLICATE_QUOTE_LIKE');
  });

  test('Admin Moderation Workflow & Audit Logs', async () => {
    // 1. Get Books List
    const booksRes = await request(app)
      .get('/api/v1/admin/books')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(booksRes.status).toBe(200);
    expect(booksRes.body.data.books.length).toBeGreaterThan(0);
    const bookToReview = booksRes.body.data.books[0];

    // 2. Mark Reviewed
    const reviewRes = await request(app)
      .patch(`/api/v1/admin/books/${bookToReview.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ moderation_status: 'reviewed', moderation_notes: 'Verified safe quote' });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.moderation_status).toBe('reviewed');

    // 3. Verify Audit Log was generated
    const auditRes = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
  });
});
