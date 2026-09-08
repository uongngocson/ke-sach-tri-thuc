import db from '../config/database.js';

async function migrate() {
  console.log('🚀 Running PostgreSQL schema migrations...');
  
  const migrationSql = `
    -- Enable UUID extension if available
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "unaccent";

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
      category VARCHAR(100) DEFAULT NULL,
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
      deletion_reason VARCHAR(255),
      credibility_score INT DEFAULT NULL,
      credibility_rationale TEXT DEFAULT NULL,
      credibility_status VARCHAR(20) DEFAULT 'unscored',
      credibility_scored_at TIMESTAMPTZ DEFAULT NULL
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

    -- 11. Teams Table (8 Teams / 8 Trees)
    CREATE TABLE IF NOT EXISTS teams (
      id INT PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      full_composition TEXT,
      target_members INT DEFAULT 0,
      actual_members INT DEFAULT 0,
      total_exp BIGINT DEFAULT 0,
      tree_exp BIGINT DEFAULT 0,
      level INT DEFAULT 0,
      tree_level INT DEFAULT 0,
      tree_seeds INT DEFAULT 0,
      total_books INT DEFAULT 0,
      total_likes INT DEFAULT 0,
      avg_participation_rate NUMERIC(6,3) DEFAULT 0,
      milestone_150_at TIMESTAMPTZ,
      milestone_400_at TIMESTAMPTZ,
      milestone_1000_at TIMESTAMPTZ,
      milestone_2500_at TIMESTAMPTZ,
      perfect_rounds_count INT DEFAULT 0,
      color_code VARCHAR(30) DEFAULT '#70B928',
      color_primary VARCHAR(30) DEFAULT '#70B928',
      color_secondary VARCHAR(30) DEFAULT '#0054A6',
      leaf_color_hex VARCHAR(30) DEFAULT '#22c55e',
      icon VARCHAR(50) DEFAULT '🌳',
      slogan TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 12. Users Table (288 BGD_TDV_CLB FoxREAD members)
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_code VARCHAR(20) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      nickname VARCHAR(100),
      gender VARCHAR(10),
      branch VARCHAR(100),
      parent_department VARCHAR(100),
      child_department_1 VARCHAR(100),
      child_department_2 VARCHAR(100),
      officer_code VARCHAR(100),
      job_title VARCHAR(255),
      team_id INT REFERENCES teams(id),
      role VARCHAR(20) DEFAULT 'member',
      avatar_url VARCHAR(255),
      contributed_books_count INT DEFAULT 0,
      total_exp_earned INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
    CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_employee_code ON users(employee_code);
    CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);

    -- 13. Daily Quotes Table (1 quote per user/device per day)
    CREATE TABLE IF NOT EXISTS daily_quotes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      user_fingerprint VARCHAR(100),
      book_id UUID REFERENCES books(id) ON DELETE CASCADE,
      quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
      team_id INT REFERENCES teams(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT unq_user_daily_quote UNIQUE(user_id, quote_date)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_quotes_user_date ON daily_quotes(user_id, quote_date);
    CREATE INDEX IF NOT EXISTS idx_daily_quotes_fp_date ON daily_quotes(user_fingerprint, quote_date);
    CREATE INDEX IF NOT EXISTS idx_daily_quotes_date ON daily_quotes(quote_date);

    -- 14. Rounds Table
    CREATE TABLE IF NOT EXISTS rounds (
      round_number INT PRIMARY KEY CHECK (round_number BETWEEN 1 AND 15),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      stage_type VARCHAR(20) NOT NULL CHECK (stage_type IN ('SEEDING', 'GROWTH', 'FINALS')),
      label VARCHAR(100) NOT NULL,
      is_active BOOLEAN DEFAULT false
    );

    -- 15. Team Rounds Table
    CREATE TABLE IF NOT EXISTS team_rounds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      round_number INT NOT NULL REFERENCES rounds(round_number),
      team_id INT NOT NULL REFERENCES teams(id),
      participants_count INT DEFAULT 0,
      participation_rate NUMERIC(6,3) DEFAULT 0.000,
      raw_exp NUMERIC(8,2) DEFAULT 0.00,
      converted_exp NUMERIC(8,2) DEFAULT 0.00,
      seeds_count INT DEFAULT 0,
      is_sprouted_this_round BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS unq_team_round_idx ON team_rounds(team_id, round_number);

    -- 16. Round Contributions Table
    CREATE TABLE IF NOT EXISTS round_contributions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      round_number INT NOT NULL REFERENCES rounds(round_number),
      user_id UUID NOT NULL REFERENCES users(id),
      team_id INT NOT NULL REFERENCES teams(id),
      book_id UUID REFERENCES books(id),
      reading_code VARCHAR(100),
      is_valid BOOLEAN DEFAULT true,
      contributed_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS unq_user_round_participation_idx ON round_contributions(user_id, round_number);
    CREATE INDEX IF NOT EXISTS idx_round_contrib_team ON round_contributions(team_id, round_number);

    -- 17. System Settings Table
    CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_by UUID REFERENCES admin_users(id),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 18. Deleted Quotes Archive Table (Enterprise Archive)
    CREATE TABLE IF NOT EXISTS deleted_quotes_archive (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      book_id UUID NOT NULL,
      title VARCHAR(255) NOT NULL,
      author VARCHAR(255) NOT NULL,
      quote TEXT NOT NULL,
      category VARCHAR(100),
      reader_name VARCHAR(100),
      reader_email VARCHAR(255),
      team_id INT,
      credibility_score INT,
      credibility_rationale TEXT,
      deletion_source VARCHAR(50) DEFAULT 'AI_AUTO',
      deletion_reason TEXT,
      deleted_at TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB
    );

    -- Alter existing tables to associate books and exp with teams/users
    DO $$ 
    BEGIN 
      -- Ensure teams has all expected columns
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='total_exp') THEN
        ALTER TABLE teams ADD COLUMN total_exp BIGINT DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='level') THEN
        ALTER TABLE teams ADD COLUMN level INT DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='total_books') THEN
        ALTER TABLE teams ADD COLUMN total_books INT DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='total_likes') THEN
        ALTER TABLE teams ADD COLUMN total_likes INT DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='avg_participation_rate') THEN
        ALTER TABLE teams ADD COLUMN avg_participation_rate NUMERIC(6,3) DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='milestone_150_at') THEN
        ALTER TABLE teams ADD COLUMN milestone_150_at TIMESTAMPTZ;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='milestone_400_at') THEN
        ALTER TABLE teams ADD COLUMN milestone_400_at TIMESTAMPTZ;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='milestone_1000_at') THEN
        ALTER TABLE teams ADD COLUMN milestone_1000_at TIMESTAMPTZ;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='milestone_2500_at') THEN
        ALTER TABLE teams ADD COLUMN milestone_2500_at TIMESTAMPTZ;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='perfect_rounds_count') THEN
        ALTER TABLE teams ADD COLUMN perfect_rounds_count INT DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='display_name') THEN
        ALTER TABLE teams ADD COLUMN display_name VARCHAR(100);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='full_composition') THEN
        ALTER TABLE teams ADD COLUMN full_composition TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='actual_members') THEN
        ALTER TABLE teams ADD COLUMN actual_members INT DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='tree_exp') THEN
        ALTER TABLE teams ADD COLUMN tree_exp BIGINT DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='tree_level') THEN
        ALTER TABLE teams ADD COLUMN tree_level INT DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='tree_seeds') THEN
        ALTER TABLE teams ADD COLUMN tree_seeds INT DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='color_code') THEN
        ALTER TABLE teams ADD COLUMN color_code VARCHAR(30) DEFAULT '#70B928';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='color_primary') THEN
        ALTER TABLE teams ADD COLUMN color_primary VARCHAR(30) DEFAULT '#70B928';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='color_secondary') THEN
        ALTER TABLE teams ADD COLUMN color_secondary VARCHAR(30) DEFAULT '#0054A6';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='leaf_color_hex') THEN
        ALTER TABLE teams ADD COLUMN leaf_color_hex VARCHAR(30) DEFAULT '#22c55e';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='icon') THEN
        ALTER TABLE teams ADD COLUMN icon VARCHAR(50) DEFAULT '🌳';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='slogan') THEN
        ALTER TABLE teams ADD COLUMN slogan TEXT;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='user_id') THEN
        ALTER TABLE books ADD COLUMN user_id UUID REFERENCES users(id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='user_fingerprint') THEN
        ALTER TABLE books ADD COLUMN user_fingerprint VARCHAR(100);
      END IF;
      -- Ensure foreign key references users(id) correctly
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_user_id_fkey') THEN
        ALTER TABLE books DROP CONSTRAINT books_user_id_fkey;
      END IF;
      ALTER TABLE books ADD CONSTRAINT books_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='team_id') THEN
        ALTER TABLE books ADD COLUMN team_id INT REFERENCES teams(id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exp_ledger' AND column_name='team_id') THEN
        ALTER TABLE exp_ledger ADD COLUMN team_id INT REFERENCES teams(id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exp_ledger' AND column_name='user_id') THEN
        ALTER TABLE exp_ledger ADD COLUMN user_id UUID REFERENCES users(id);
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exp_ledger_user_id_fkey') THEN
        ALTER TABLE exp_ledger DROP CONSTRAINT exp_ledger_user_id_fkey;
      END IF;
      ALTER TABLE exp_ledger ADD CONSTRAINT exp_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_dews' AND column_name='user_id') THEN
        ALTER TABLE daily_dews ADD COLUMN user_id UUID REFERENCES users(id);
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_dews_user_id_fkey') THEN
        ALTER TABLE daily_dews DROP CONSTRAINT daily_dews_user_id_fkey;
      END IF;
      ALTER TABLE daily_dews ADD CONSTRAINT daily_dews_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_dews' AND column_name='team_id') THEN
        ALTER TABLE daily_dews ADD COLUMN team_id INT REFERENCES teams(id);
      END IF;
      -- Credibility Score & AI Moderation Columns on books
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='credibility_score') THEN
        ALTER TABLE books ADD COLUMN credibility_score INT DEFAULT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='credibility_rationale') THEN
        ALTER TABLE books ADD COLUMN credibility_rationale TEXT DEFAULT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='credibility_status') THEN
        ALTER TABLE books ADD COLUMN credibility_status VARCHAR(20) DEFAULT 'unscored';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='credibility_scored_at') THEN
        ALTER TABLE books ADD COLUMN credibility_scored_at TIMESTAMPTZ DEFAULT NULL;
      END IF;
      -- Unique 1 dew per user per day constraint
      CREATE UNIQUE INDEX IF NOT EXISTS unq_user_dew_daily_user_id ON daily_dews(user_id, claim_date) WHERE user_id IS NOT NULL;
    END $$;

    -- Backfill daily_quotes from existing books (if any)
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

    -- Backfill exp_ledger historical entries for users and teams
    UPDATE exp_ledger el
    SET user_id = u.id
    FROM users u
    WHERE el.user_id IS NULL
      AND (
        (el.user_fingerprint LIKE 'user_%' AND u.id::text = REPLACE(el.user_fingerprint, 'user_', ''))
        OR (el.user_fingerprint = u.id::text)
      );

    UPDATE exp_ledger el
    SET team_id = b.team_id
    FROM books b
    WHERE el.team_id IS NULL
      AND el.reference_type = 'books'
      AND el.reference_id = b.id
      AND b.team_id IS NOT NULL;

    UPDATE exp_ledger el
    SET team_id = u.team_id
    FROM users u
    WHERE el.team_id IS NULL
      AND el.user_id = u.id
      AND u.team_id IS NOT NULL;
  `;

  try {
    await db.query(migrationSql);
    console.log('✅ PostgreSQL Schema migrations completed successfully (13 tables ready)!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
