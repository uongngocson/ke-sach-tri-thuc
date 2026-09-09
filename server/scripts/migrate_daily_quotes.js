import db from '../config/database.js';

export async function migrateDailyQuotes() {
  console.log('🚀 Running Daily Quotes Table Migration...');

  // 1. Add user_fingerprint column to books if not exists
  await db.query(`
    ALTER TABLE books ADD COLUMN IF NOT EXISTS user_fingerprint VARCHAR(100);
  `);

  // 2. Create daily_quotes table (Max 3 quotes per user per day)
  await db.query(`
    CREATE TABLE IF NOT EXISTS daily_quotes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      user_fingerprint VARCHAR(100),
      book_id UUID REFERENCES books(id) ON DELETE CASCADE,
      quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
      team_id INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE daily_quotes DROP CONSTRAINT IF EXISTS unq_user_daily_quote;

    CREATE INDEX IF NOT EXISTS idx_daily_quotes_user_date ON daily_quotes(user_id, quote_date);
    CREATE INDEX IF NOT EXISTS idx_daily_quotes_fp_date ON daily_quotes(user_fingerprint, quote_date);
    CREATE INDEX IF NOT EXISTS idx_daily_quotes_date ON daily_quotes(quote_date);
  `);

  // 3. Backfill daily_quotes from existing books (if any)
  await db.query(`
    INSERT INTO daily_quotes (user_id, user_fingerprint, book_id, quote_date, team_id, created_at)
    SELECT DISTINCT ON (user_id, DATE(created_at))
      user_id,
      user_fingerprint,
      id,
      DATE(created_at),
      team_id,
      created_at
    FROM books
    WHERE user_id IS NOT NULL
    ON CONFLICT (user_id, quote_date) DO NOTHING;
  `);

  console.log('✅ Daily Quotes migration completed successfully!');
}

if (process.argv[1].endsWith('migrate_daily_quotes.js')) {
  migrateDailyQuotes().then(() => process.exit(0)).catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}
