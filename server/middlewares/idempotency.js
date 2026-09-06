import db from '../config/database.js';

export async function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return next();
  }

  try {
    // 1. Check if already completed
    const existing = await db.query(
      'SELECT response_payload, status_code FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()',
      [idempotencyKey]
    );

    if (existing.rows.length > 0 && existing.rows[0].status_code !== 102) {
      const { response_payload, status_code } = existing.rows[0];
      return res.status(status_code).json(response_payload);
    }

    // 2. Lock for in-flight concurrent requests (Stripe-pattern concurrent lock)
    const lockRes = await db.query(
      `INSERT INTO idempotency_keys (key, request_path, response_payload, status_code)
       VALUES ($1, $2, '{"status":"processing"}'::jsonb, 102)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [idempotencyKey, req.originalUrl]
    );

    if (lockRes.rows.length === 0) {
      // Another concurrent request is actively executing this exact idempotency key!
      // Wait for it to complete (up to 40 attempts * 50ms = 2000ms)
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const check = await db.query(
          'SELECT response_payload, status_code FROM idempotency_keys WHERE key = $1 AND status_code != 102',
          [idempotencyKey]
        );
        if (check.rows.length > 0) {
          const { response_payload, status_code } = check.rows[0];
          return res.status(status_code).json(response_payload);
        }
      }
    }

    // Intercept res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = async (payload) => {
      const statusCode = res.statusCode || 200;
      if (statusCode >= 200 && statusCode < 300) {
        try {
          await db.query(
            `INSERT INTO idempotency_keys (key, request_path, response_payload, status_code)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (key) DO UPDATE SET 
               response_payload = EXCLUDED.response_payload, 
               status_code = EXCLUDED.status_code`,
            [idempotencyKey, req.originalUrl, JSON.stringify(payload), statusCode]
          );
        } catch (err) {
          console.error('Error saving idempotency key:', err);
        }
      } else {
        // If request failed with 4xx or 5xx, release in-flight lock
        try {
          await db.query('DELETE FROM idempotency_keys WHERE key = $1 AND status_code = 102', [idempotencyKey]);
        } catch {}
      }
      return originalJson(payload);
    };

    next();
  } catch (err) {
    console.error('Idempotency middleware error:', err);
    next();
  }
}
