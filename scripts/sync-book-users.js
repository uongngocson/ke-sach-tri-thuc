import db from '../server/config/database.js';
import { getVietnamDateString } from '../server/services/dew.service.js';

async function syncBooks() {
  console.log('🔄 Synchronizing existing books with users table...');
  const booksRes = await db.query('SELECT * FROM books');
  const todayVN = getVietnamDateString();

  for (const b of booksRes.rows) {
    if (!b.user_id && b.reader_name) {
      const uRes = await db.query(`
        SELECT id, team_id, nickname, full_name FROM users
        WHERE unaccent(LOWER(COALESCE(nickname, ''))) = unaccent(LOWER($1))
           OR LOWER(COALESCE(nickname, '')) = LOWER($1)
           OR unaccent(LOWER(COALESCE(full_name, ''))) = unaccent(LOWER($1))
           OR LOWER(COALESCE(full_name, '')) = LOWER($1)
        LIMIT 1
      `, [b.reader_name.trim()]);

      if (uRes.rows.length > 0) {
        const u = uRes.rows[0];
        const newTeamId = u.team_id || b.team_id || 1;
        await db.query(`
          UPDATE books 
          SET user_id = $1, team_id = $2
          WHERE id = $3
        `, [u.id, newTeamId, b.id]);

        // Ensure daily_quotes entry exists
        const dqCheck = await db.query('SELECT id FROM daily_quotes WHERE book_id = $1', [b.id]);
        if (dqCheck.rows.length === 0) {
          const bookDate = b.created_at ? new Date(b.created_at).toISOString().slice(0, 10) : todayVN;
          try {
            await db.query(`
              INSERT INTO daily_quotes (user_id, user_fingerprint, book_id, quote_date, team_id, created_at)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (user_id, quote_date) DO NOTHING
            `, [u.id, b.user_fingerprint, b.id, bookDate, newTeamId, b.created_at || new Date()]);
          } catch (e) {
            // Ignore duplicate daily quote for same user on same day
          }
        } else {
          try {
            await db.query(`
              UPDATE daily_quotes
              SET user_id = $1, team_id = $2
              WHERE book_id = $3
            `, [u.id, newTeamId, b.id]);
          } catch (e) {
            // Ignore conflict
          }
        }

        // Update user stats
        await db.query(`
          UPDATE users
          SET contributed_books_count = (SELECT COUNT(*) FROM books WHERE user_id = $1 AND visibility_status = 'visible'),
              total_exp_earned = (SELECT COALESCE(SUM(amount), 0) FROM exp_ledger WHERE user_id = $1)
          WHERE id = $1
        `, [u.id]);

        console.log(`  ✅ Linked book "${b.title}" to user ${u.full_name} (${u.nickname}), Team ${newTeamId}`);
      }
    }
  }

  // Recalculate team total_books
  await db.query(`
    UPDATE teams t
    SET total_books = (SELECT COUNT(*) FROM books b WHERE b.team_id = t.id AND b.visibility_status = 'visible'),
        tree_seeds = LEAST(10, (SELECT COUNT(*) FROM books b WHERE b.team_id = t.id AND b.visibility_status = 'visible'))
  `);

  console.log('✅ Synchronization completed successfully!');
  process.exit(0);
}

syncBooks().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
