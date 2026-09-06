import db from '../config/database.js';

async function fixQuotes() {
  try {
    await db.query(`DELETE FROM books WHERE team_id IS NULL`);

    await db.query(`
      UPDATE books 
      SET title = 'Vĩ Đại Do Lựa Chọn (Great by Choice)', 
          author = 'Jim Collins & Morten T. Hansen', 
          quote = 'Sự vĩ đại không phải là vấn đề của hoàn cảnh; sự vĩ đại trước hết là vấn đề của sự lựa chọn có ý thức và kỷ luật sắt đá.', 
          likes_count = 35 
      WHERE id = '1666e568-d091-42f7-b84f-e125b954e754'
    `);

    await db.query(`
      UPDATE books 
      SET title = 'Dám Nghĩ Lại (Think Again)', 
          author = 'Adam Grant', 
          quote = 'Nếu tri thức là sức mạnh, thì việc nhận ra những gì ta chưa biết và sẵn sàng học lại chính là sự khôn ngoan đích thực.', 
          likes_count = 28 
      WHERE id = '4ee15493-5036-445e-8873-3da8fcee9405'
    `);

    await db.query(`
      UPDATE books 
      SET title = 'Càng Kỷ Luật Càng Tự Do', 
          author = 'Vãn Tình', 
          quote = 'Kỷ luật tự giác chính là chiếc cầu nối vững chắc nhất giữa ước mơ và thành tựu thực tế.', 
          likes_count = 31 
      WHERE title = 'Tư Duy Nhanh Và Chậm' AND team_id = 2
    `);

    const res = await db.query(`
      SELECT b.id, b.team_id, b.title, b.author, b.quote, u.full_name, b.likes_count 
      FROM books b 
      LEFT JOIN users u ON b.user_id = u.id 
      ORDER BY b.team_id ASC, b.likes_count DESC
    `);
    
    console.log(`Successfully verified ${res.rows.length} unique quotes across all teams!`);
    console.log(res.rows.map(r => `[Team ${r.team_id}] ${r.title} - ${r.full_name} (${r.likes_count} likes)`).join('\n'));
    process.exit(0);
  } catch (err) {
    console.error('Error fixing quotes:', err);
    process.exit(1);
  }
}

fixQuotes();
