import db from '../config/database.js';

async function migrate() {
  console.log('🚀 Running PostgreSQL schema migrations...');
  
  const migrationSql = `
    -- Enable UUID extension if available
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    -- 1. Admin Users Table (RBAC)
    CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      role VARCHAR(20) DEFAULT 'moderator' CHECK (role IN ('reader', 'moderator', 'admin')),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. Community Growth Singleton Table
    CREATE TABLE IF NOT EXISTS community_growth (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      total_exp BIGINT DEFAULT 0,
      level INT DEFAULT 0 CHECK (level BETWEEN 0 AND 5),
      total_books INT DEFAULT 0,
      total_dews INT DEFAULT 0,
      total_likes INT DEFAULT 0,
      active_readers INT DEFAULT 1,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Insert default community growth row if not exists
    INSERT INTO community_growth (id, total_exp, level, total_books, total_dews, total_likes, active_readers)
    VALUES (1, 0, 0, 0, 0, 0, 1)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Books & Quotes Table
    CREATE TABLE IF NOT EXISTS books (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      author VARCHAR(255) NOT NULL,
      quote TEXT NOT NULL,
      category VARCHAR(100) DEFAULT 'Sách Tinh Hoa',
      reader_name VARCHAR(100) NOT NULL,
      reader_email VARCHAR(255),
      likes_count INT DEFAULT 0,
      visibility_status VARCHAR(20) DEFAULT 'visible' CHECK (visibility_status IN ('visible', 'hidden', 'deleted')),
      moderation_status VARCHAR(20) DEFAULT 'pending_review' CHECK (moderation_status IN ('pending_review', 'reviewed', 'flagged', 'rejected')),
      reviewed_by UUID REFERENCES admin_users(id),
      moderation_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      deleted_by UUID REFERENCES admin_users(id),
      deletion_reason VARCHAR(255)
    );

    -- 4. EXP Ledger Table
    CREATE TABLE IF NOT EXISTS exp_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_fingerprint VARCHAR(100) NOT NULL,
      amount INT NOT NULL,
      type VARCHAR(50) NOT NULL CHECK (type IN ('BOOK_CONTRIBUTION', 'QUOTE_LIKE', 'DAILY_DEW', 'FRUIT_HARVEST', 'ADMIN_BONUS', 'MODERATION_PENALTY')),
      reference_type VARCHAR(50),
      reference_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 5. Daily Dews Table (Unique constraint: 1 claim per user per day)
    CREATE TABLE IF NOT EXISTS daily_dews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_fingerprint VARCHAR(100) NOT NULL,
      claim_date DATE NOT NULL,
      streak INT DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT unq_user_dew_date UNIQUE(user_fingerprint, claim_date)
    );

    -- 6. Quote Likes Table (Unique constraint: 1 like per user per book)
    CREATE TABLE IF NOT EXISTS quote_likes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      user_fingerprint VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT unq_user_quote_like UNIQUE(user_fingerprint, book_id)
    );

    -- 7. Fruit Harvests Table (Cooldown & daily limit per fruit)
    CREATE TABLE IF NOT EXISTS fruit_harvests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fruit_index INT NOT NULL,
      user_fingerprint VARCHAR(100) NOT NULL,
      harvest_date DATE NOT NULL,
      exp_granted INT DEFAULT 5,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT unq_user_fruit_harvest UNIQUE(user_fingerprint, fruit_index, harvest_date)
    );

    -- 8. Idempotency Keys Table
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key VARCHAR(100) PRIMARY KEY,
      request_path VARCHAR(255) NOT NULL,
      response_payload JSONB NOT NULL,
      status_code INT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
    );

    -- 9. Audit Logs Table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id UUID REFERENCES admin_users(id),
      action VARCHAR(50) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_id UUID,
      metadata JSONB,
      ip_address VARCHAR(45),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 10. Site Visitors Table (Real Unique Device Visitor Tracking)
    CREATE TABLE IF NOT EXISTS site_visitors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_fingerprint VARCHAR(100) UNIQUE NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      visit_count INT DEFAULT 1,
      first_visited_at TIMESTAMPTZ DEFAULT NOW(),
      last_visited_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_site_visitors_fingerprint ON site_visitors(user_fingerprint);
  `;

  try {
    await db.query(migrationSql);
    console.log('✅ PostgreSQL Schema migrations completed successfully (10 tables ready)!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
