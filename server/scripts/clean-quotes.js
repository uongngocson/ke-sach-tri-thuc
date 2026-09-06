import db from '../config/database.js';

async function cleanQuotes() {
  try {
    // 1. Delete test books with null team_id
    await db.query('DELETE FROM books WHERE team_id IS NULL');

    // 2. Delete test quotes with title 'Tư Duy Nhanh Và Chậm' and 0 likes created during testing
    await db.query(`DELETE FROM books WHERE (title = 'Tư Duy Nhanh Và Chậm' OR quote = 'Chúng ta có xu hướng phóng đại khả năng hiểu thế giới của mình.') AND likes_count = 0`);

    // 3. Verify counts per team
    const res = await db.query(`
      SELECT b.id, b.team_id, b.title, b.author, b.quote, u.full_name, b.likes_count 
      FROM books b 
      LEFT JOIN users u ON b.user_id = u.id 
      ORDER BY b.team_id ASC, b.likes_count DESC
    `);
    
    console.log(`Cleaned! Total books in DB: ${res.rows.length}`);
    const counts = {};
    res.rows.forEach(r => {
      counts[r.team_id] = (counts[r.team_id] || 0) + 1;
    });
    console.log('Team counts:', counts);
    process.exit(0);
  } catch (err) {
    console.error('Error cleaning quotes:', err);
    process.exit(1);
  }
}

cleanQuotes();
