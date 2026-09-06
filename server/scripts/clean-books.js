import db from '../config/database.js';

async function cleanBooks() {
  console.log('🧹 Cleaning duplicate and orphaned test quotes...');

  // 1. Keep only unique quotes
  await db.query(`
    DELETE FROM books 
    WHERE id NOT IN (
      SELECT DISTINCT ON (title, quote) id 
      FROM books 
      ORDER BY title, quote, likes_count DESC, created_at DESC
    )
  `);

  // 2. Remove orphaned quotes with NULL team_id to keep 100% team-attributed quotes
  await db.query(`DELETE FROM books WHERE team_id IS NULL`);

  // 3. Query all remaining quotes
  const res = await db.query(`
    SELECT team_id, count(*), json_agg(json_build_object('title', title, 'author', author, 'reader', reader_name, 'likes', likes_count)) as books
    FROM books 
    GROUP BY team_id 
    ORDER BY team_id
  `);

  console.log('✨ All Remaining Clean Quotes by Team:');
  for (const row of res.rows) {
    console.log(`Đội ${row.team_id} (${row.count} cuốn):`, row.books.map(b => `${b.title} (${b.reader})`));
  }

  // 4. Update community growth
  await db.query(`
    UPDATE community_growth 
    SET total_books = (SELECT COUNT(*) FROM books WHERE visibility_status = 'visible'),
        total_likes = (SELECT COALESCE(SUM(likes_count), 0) FROM books WHERE visibility_status = 'visible'),
        updated_at = NOW()
    WHERE id = 1
  `);

  console.log('✅ Database is now 100% clean with zero duplicates!');
  process.exit(0);
}

cleanBooks().catch(err => {
  console.error('Error cleaning books:', err);
  process.exit(1);
});
