import db from '../config/database.js';
import { ROUNDS_CONFIG } from '../config/rounds.config.js';

async function migrateRounds() {
  console.log('🚀 Running Rounds & Team Scoring Migration...');

  await db.transaction(async (client) => {
    // 1. Create rounds table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rounds (
        round_number INT PRIMARY KEY CHECK (round_number BETWEEN 1 AND 15),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        stage_type VARCHAR(20) NOT NULL CHECK (stage_type IN ('SEEDING', 'GROWTH', 'FINALS')),
        label VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT false
      );
    `);

    // 2. Create team_rounds table
    await client.query(`
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
    `);

    // 3. Create round_contributions table (1 user / round unique anti-spam)
    await client.query(`
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
    `);

    // 4. Ensure teams table has tie-breaker and milestone columns
    await client.query(`
      DO $$ 
      BEGIN 
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
      END $$;
    `);

    // 5. Seed 15 fixed rounds
    for (const r of ROUNDS_CONFIG) {
      await client.query(`
        INSERT INTO rounds (round_number, start_date, end_date, stage_type, label)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (round_number) DO UPDATE SET
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          stage_type = EXCLUDED.stage_type,
          label = EXCLUDED.label;
      `, [r.round, r.date, r.endDate, r.stage, r.label]);
    }
    console.log(`✅ Seeded ${ROUNDS_CONFIG.length} rounds.`);

    // 6. Initialize team_rounds for existing teams x 15 rounds
    const teamsRes = await client.query('SELECT id FROM teams ORDER BY id ASC');
    if (teamsRes.rows.length > 0) {
      for (const team of teamsRes.rows) {
        for (const r of ROUNDS_CONFIG) {
          await client.query(`
            INSERT INTO team_rounds (team_id, round_number)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING;
          `, [team.id, r.round]);
        }
      }
      console.log(`✅ Initialized ${teamsRes.rows.length * ROUNDS_CONFIG.length} team_rounds entries.`);
    } else {
      console.log('ℹ️ Table "teams" is empty right now. team_rounds will be initialized during team seeding.');
    }
  });

  console.log('✨ Migration completed successfully!');
  process.exit(0);
}

migrateRounds().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
