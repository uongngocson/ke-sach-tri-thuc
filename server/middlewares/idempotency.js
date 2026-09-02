import db from '../config/database.js';

export async function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return next();
  }

  try {
    const existing = await db.query(
      'SELECT response_payload, status_code FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()',
      [idempotencyKey]
    );

    if (existing.rows.length > 0) {
      const { response_payload, status_code } = existing.rows[0];
      return res.status(status_code).json(response_payload);
    }

    // Intercept res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      const statusCode = res.statusCode || 200;
      if (statusCode >= 200 && statusCode < 300) {
        db.query(
          'INSERT INTO idempotency_keys (key, request_path, response_payload, status_code) VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING',
          [idempotencyKey, req.originalUrl, JSON.stringify(payload), statusCode]
        ).catch((err) => console.error('Error saving idempotency key:', err));
      }
      return originalJson(payload);
    };

    next();
  } catch (err) {
    console.error('Idempotency middleware error:', err);
    next();
  }
}
