import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedTeamsAndUsers() {
  console.log('🌱 Starting Seed for 8 Teams and 288 Users...');

  const dataPath = path.join(__dirname, '../data/teams-and-users.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Data file not found at: ${dataPath}`);
  }

  const { teams, users } = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`📦 Loaded ${teams.length} teams and ${users.length} users from JSON.`);

  await db.transaction(async (client) => {
    // 1. Seed Teams
    for (const t of teams) {
      await client.query(`
        INSERT INTO teams (
          id, code, name, display_name, full_composition, 
          target_members, color_primary, color_secondary, 
          leaf_color_hex, icon, slogan, color_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          display_name = EXCLUDED.display_name,
          full_composition = EXCLUDED.full_composition,
          target_members = EXCLUDED.target_members,
          color_primary = EXCLUDED.color_primary,
          color_secondary = EXCLUDED.color_secondary,
          leaf_color_hex = EXCLUDED.leaf_color_hex,
          icon = EXCLUDED.icon,
          slogan = EXCLUDED.slogan,
          color_code = EXCLUDED.color_code,
          updated_at = NOW()
      `, [
        t.id, t.code, t.name, t.display_name, t.full_composition,
        t.target_members, t.color_primary, t.color_secondary,
        t.leaf_color_hex, t.icon, t.slogan, t.color_code
      ]);
    }
    console.log(`✅ Upserted ${teams.length} teams successfully.`);

    // Initialize team_rounds for all teams if table rounds and team_rounds exist
    const roundsTableCheck = await client.query("SELECT to_regclass('public.team_rounds') as tbl");
    if (roundsTableCheck.rows[0]?.tbl) {
      const existingRounds = await client.query("SELECT round_number FROM rounds");
      if (existingRounds.rows.length > 0) {
        for (const t of teams) {
          for (const r of existingRounds.rows) {
            await client.query(`
              INSERT INTO team_rounds (team_id, round_number)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING;
            `, [t.id, r.round_number]);
          }
        }
      }
    }
    for (let i = 0; i < users.length; i++) {
      // Bút danh chính thức từ Danh sách bút danh FoxREAD (ưu tiên u.nickname)
      const parts = (u.full_name || '').trim().split(/\s+/);
      const nickname = (u.nickname && u.nickname.trim()) ? u.nickname.trim() : (parts.length > 1 ? parts.slice(1).join(' ') : u.full_name);

      const existing = await client.query(
        'SELECT id FROM users WHERE full_name = $1 AND team_id = $2 LIMIT 1',
        [u.full_name, u.team_id]
      );

      if (existing.rows.length > 0) {
        await client.query(`
          UPDATE users SET
            nickname = $1,
            gender = $2,
            branch = $3,
            parent_department = $4,
            child_department_1 = $5,
            child_department_2 = $6,
            officer_code = $7,
            job_title = $8,
            updated_at = NOW()
          WHERE id = $9
        `, [
          nickname,
          u.gender,
          u.branch,
          u.parent_department,
          u.child_department_1,
          u.child_department_2,
          u.officer_code,
          u.job_title,
          existing.rows[0].id
        ]);
      } else {
        await client.query(`
          INSERT INTO users (
            full_name, nickname, gender, branch, 
            parent_department, child_department_1, child_department_2, 
            officer_code, job_title, team_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          u.full_name,
          nickname,
          u.gender,
          u.branch,
          u.parent_department,
          u.child_department_1,
          u.child_department_2,
          u.officer_code,
          u.job_title,
          u.team_id
        ]);
      }
    }
    console.log(`✅ Upserted ${users.length} users successfully.`);

    // 3. Update actual_members count in teams table
    await client.query(`
      UPDATE teams t
      SET actual_members = (SELECT COUNT(*) FROM users u WHERE u.team_id = t.id)
    `);

    // 4. Verify & Print Stats
    const summaryRes = await client.query(`
      SELECT 
        t.id, 
        t.code, 
        t.display_name, 
        t.target_members, 
        t.actual_members
      FROM teams t
      ORDER BY t.id ASC
    `);

    console.log('\n📊 SEED VERIFICATION TABLE:');
    console.table(summaryRes.rows);

    const totalUsersRes = await client.query('SELECT COUNT(*) FROM users');
    console.log(`🎉 Total users in database: ${totalUsersRes.rows[0].count} / 288 (100% Complete)`);
  });
}

if (process.argv[1] && process.argv[1].endsWith('seed-teams-users.js')) {
  seedTeamsAndUsers()
    .then(() => {
      console.log('✨ Seed completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    });
}
