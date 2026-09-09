import db from '../config/database.js';

async function checkTT() {
  const res = await db.query('SELECT tt, full_name, nickname, team_id FROM users ORDER BY tt ASC NULLS LAST');
  console.log('Total users:', res.rows.length);
  const nullTT = res.rows.filter(u => u.tt === null);
  console.log('Null TT count:', nullTT.length);
  if (nullTT.length > 0) {
    console.log('Users with NULL TT:');
    console.table(nullTT);
  }
  const ttMap = {};
  const duplicates = [];
  res.rows.forEach(u => {
    if (u.tt !== null) {
      if (ttMap[u.tt]) duplicates.push({ tt: u.tt, u1: ttMap[u.tt], u2: u });
      else ttMap[u.tt] = u;
    }
  });
  console.log('Duplicate TT count:', duplicates.length);
  if (duplicates.length > 0) {
    console.log('Duplicates:');
    duplicates.forEach(d => console.log(`  TT ${d.tt}: "${d.u1.full_name}" vs "${d.u2.full_name}"`));
  }
  const missing = [];
  for (let i = 1; i <= 288; i++) {
    if (!ttMap[i]) missing.push(i);
  }
  console.log('Missing TT count:', missing.length);
  console.log('Missing TTs:', missing);
  process.exit(0);
}

checkTT().catch(e => { console.error(e); process.exit(1); });
