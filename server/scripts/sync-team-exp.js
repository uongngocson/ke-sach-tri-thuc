import db from '../config/database.js';

export async function syncTeamExp() {
  console.log('🔄 Đang đồng bộ tree_exp và total_exp cho 8 đội...');

  // 1. Đồng bộ theo exp_ledger (nguồn chân lý cho toàn bộ EXP phát sinh)
  await db.query(`
    UPDATE teams t
    SET total_exp = GREATEST(t.total_exp, COALESCE(l.sum_exp, 0)),
        tree_exp = GREATEST(t.total_exp, COALESCE(l.sum_exp, 0), t.tree_exp),
        tree_level = CASE 
          WHEN GREATEST(t.total_exp, COALESCE(l.sum_exp, 0), t.tree_exp) >= 1200 THEN 5
          WHEN GREATEST(t.total_exp, COALESCE(l.sum_exp, 0), t.tree_exp) >= 600 THEN 4
          WHEN GREATEST(t.total_exp, COALESCE(l.sum_exp, 0), t.tree_exp) >= 300 THEN 3
          WHEN GREATEST(t.total_exp, COALESCE(l.sum_exp, 0), t.tree_exp) >= 150 THEN 2
          WHEN t.tree_seeds >= 10 OR GREATEST(t.total_exp, COALESCE(l.sum_exp, 0), t.tree_exp) >= 50 THEN 1
          ELSE 0
        END,
        level = CASE 
          WHEN GREATEST(t.total_exp, COALESCE(l.sum_exp, 0), t.tree_exp) >= 1200 THEN 5
          WHEN GREATEST(t.total_exp, COALESCE(l.sum_exp, 0), t.tree_exp) >= 600 THEN 4
          WHEN GREATEST(t.total_exp, COALESCE(l.sum_exp, 0), t.tree_exp) >= 300 THEN 3
          WHEN GREATEST(t.total_exp, COALESCE(l.sum_exp, 0), t.tree_exp) >= 150 THEN 2
          WHEN t.tree_seeds >= 10 OR GREATEST(t.total_exp, COALESCE(l.sum_exp, 0), t.tree_exp) >= 50 THEN 1
          ELSE 0
        END,
        updated_at = NOW()
    FROM (
      SELECT team_id, SUM(amount) as sum_exp 
      FROM exp_ledger 
      WHERE team_id IS NOT NULL 
      GROUP BY team_id
    ) l
    WHERE t.id = l.team_id;
  `);

  // 2. Với các đội chưa có exp_ledger nhưng total_exp hoặc tree_exp khác 0
  await db.query(`
    UPDATE teams
    SET tree_exp = GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)),
        total_exp = GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)),
        tree_level = CASE 
          WHEN GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)) >= 1200 THEN 5
          WHEN GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)) >= 600 THEN 4
          WHEN GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)) >= 300 THEN 3
          WHEN GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)) >= 150 THEN 2
          WHEN tree_seeds >= 10 OR GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)) >= 50 THEN 1
          ELSE 0
        END,
        level = CASE 
          WHEN GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)) >= 1200 THEN 5
          WHEN GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)) >= 600 THEN 4
          WHEN GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)) >= 300 THEN 3
          WHEN GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)) >= 150 THEN 2
          WHEN tree_seeds >= 10 OR GREATEST(COALESCE(tree_exp, 0), COALESCE(total_exp, 0)) >= 50 THEN 1
          ELSE 0
        END,
        updated_at = NOW();
  `);

  // 3. Đồng bộ avg_participation_rate chuẩn xác theo công thức:
  // Tổng lượt người tham gia các ngày / (Số ngày diễn ra * target_members) * 100
  await db.query(`
    UPDATE teams t
    SET avg_participation_rate = ROUND(
      (
        COALESCE((
          SELECT COUNT(DISTINCT (dq.quote_date::text || '_' || COALESCE(dq.user_id::text, dq.user_fingerprint)))
          FROM daily_quotes dq
          WHERE dq.team_id = t.id
        ), 0)::numeric
        /
        (dc.total_days * GREATEST(COALESCE(t.target_members, t.actual_members, 40), 1))
        * 100
      )::numeric,
      1
    ),
    updated_at = NOW()
    FROM (
      SELECT GREATEST(COUNT(*), 1) as total_days
      FROM (
        SELECT DISTINCT quote_date::date as q_date FROM daily_quotes
        UNION
        SELECT CURRENT_DATE as q_date
      ) all_d
    ) dc;
  `);

  const res = await db.query('SELECT id, name, total_exp, tree_exp, avg_participation_rate, level, tree_level FROM teams ORDER BY id');
  console.log('✅ Bảng teams sau khi đồng bộ:');
  console.table(res.rows);
}

if (process.argv[1] && process.argv[1].includes('sync-team-exp.js')) {
  syncTeamExp().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
