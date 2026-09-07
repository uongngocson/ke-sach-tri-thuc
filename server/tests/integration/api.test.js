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

  test('POST /api/v1/dew/claim - Daily Dew (+2 EXP) & Anti-Spam unique constraint on same day', async () => {
    const dewFingerprint = `dew_user_${Date.now()}`;

    // Claim 1st time -> Success
    const res1 = await request(app)
      .post('/api/v1/dew/claim')
      .send({ userFingerprint: dewFingerprint });

    expect(res1.status).toBe(201);
    expect(res1.body.data.expEarned).toBe(2);

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

  test('Admin Accounts CRUD HTTP Endpoints & RBAC Security', async () => {
    // 1. Unauthorized without token -> 401
    const unauthRes = await request(app).get('/api/v1/admin/accounts');
    expect(unauthRes.status).toBe(401);

    // 2. Create Moderator Account via Superadmin
    const testUsername = `mod_test_${Date.now()}`;
    const createRes = await request(app)
      .post('/api/v1/admin/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: testUsername,
        password: 'secure_password_123',
        full_name: 'Test Moderator HTTP',
        role: 'moderator',
        is_active: true
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.username).toBe(testUsername);
    expect(createRes.body.data.password_hash).toBeUndefined();
    const createdId = createRes.body.data.id;

    // 3. Moderator Token cannot access Admin CRUD -> 403 Forbidden
    const modToken = jwt.sign(
      { id: createdId, username: testUsername, role: 'moderator' },
      process.env.JWT_SECRET || 'caosach_super_secure_jwt_secret_2026_production',
      { expiresIn: '1h' }
    );
    const forbiddenRes = await request(app)
      .get('/api/v1/admin/accounts')
      .set('Authorization', `Bearer ${modToken}`);
    expect(forbiddenRes.status).toBe(403);

    // 4. Update Account
    const updateRes = await request(app)
      .put(`/api/v1/admin/accounts/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Updated Moderator Name',
        is_active: true
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.full_name).toBe('Updated Moderator Name');

    // 5. Get Account Stats
    const statsRes = await request(app)
      .get('/api/v1/admin/accounts/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.total).toBeGreaterThan(0);

    // 6. Delete Account
    const deleteRes = await request(app)
      .delete(`/api/v1/admin/accounts/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.deleted).toBe(true);
  });
});
