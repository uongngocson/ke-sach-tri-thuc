import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedTeamsAndUsers() {
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

    // 2. Batch Upsert Users
    for (const u of users) {
      await client.query(`
        INSERT INTO users (
          employee_code, email, full_name, gender, branch, 
          parent_department, child_department_1, child_department_2, 
          officer_code, job_title, team_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (employee_code) DO UPDATE SET
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          gender = EXCLUDED.gender,
          branch = EXCLUDED.branch,
          parent_department = EXCLUDED.parent_department,
          child_department_1 = EXCLUDED.child_department_1,
          child_department_2 = EXCLUDED.child_department_2,
          officer_code = EXCLUDED.officer_code,
          job_title = EXCLUDED.job_title,
          team_id = EXCLUDED.team_id,
          updated_at = NOW()
      `, [
        u.employee_code,
        u.email,
        u.full_name,
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

seedTeamsAndUsers()
  .then(() => {
    console.log('✨ Seed completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
