import db from '../config/database.js';
import { AnalyticsService } from '../services/analytics.service.js';

async function runTest() {
  console.log('--- STARTING TEST: ZERO DUPLICATE ROWS IN USER DIRECTORY ---');
  
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. Lấy 1 user bất kỳ thuộc team 5 (FPL_AU_FU)
    const userRes = await db.query('SELECT id, full_name, nickname, team_id FROM users WHERE team_id = 5 LIMIT 1');
    if (userRes.rows.length === 0) {
      console.error('Không tìm thấy user team 5');
      process.exit(1);
    }
    const testUser = userRes.rows[0];
    console.log(`Testing with user: ${testUser.nickname || testUser.full_name} (${testUser.id})`);

    // 2. Chèn giả lập 3 quotes vào daily_quotes cho user này trong ngày hôm nay nếu chưa có
    await db.query('DELETE FROM daily_quotes WHERE user_id = $1 AND quote_date = $2', [testUser.id, today]);
    
    const bookRes = await db.query('SELECT id FROM books LIMIT 3');
    const bIds = bookRes.rows.map(r => r.id);

    for (let i = 0; i < 3; i++) {
      await db.query(
        'INSERT INTO daily_quotes (user_id, team_id, book_id, quote_date) VALUES ($1, $2, $3, $4)',
        [testUser.id, testUser.team_id, bIds[i % bIds.length], today]
      );
    }
    console.log(`Inserted 3 daily_quotes for user ${testUser.id} on date ${today}`);

    // 3. Gọi getUsersDirectory cho team 5
    const dirResult = await AnalyticsService.getUsersDirectory({
      teamId: testUser.team_id,
      date: today,
      limit: 100
    });

    console.log(`Total count reported in pagination: ${dirResult.pagination.total}`);
    console.log(`Users returned in list: ${dirResult.users.length}`);

    // Đếm số lần user xuất hiện trong list
    const occurrences = dirResult.users.filter(u => u.id === testUser.id);
    console.log(`User ${testUser.id} occurrences in result: ${occurrences.length}`);

    if (occurrences.length !== 1) {
      throw new Error(`FAIL: User appeared ${occurrences.length} times instead of 1!`);
    }

    const returnedUser = occurrences[0];
    console.log(`User participation status: ${returnedUser.participated_today}`);
    console.log(`User today quotes count: ${returnedUser.today_quotes_count}`);

    if (!returnedUser.participated_today) {
      throw new Error(`FAIL: User should have participated_today = true!`);
    }
    if (returnedUser.today_quotes_count !== 3) {
      throw new Error(`FAIL: User should have today_quotes_count = 3, got ${returnedUser.today_quotes_count}`);
    }

    // 4. Kiểm tra xem có bất kỳ user ID nào bị duplicate trong toàn bộ danh sách không
    const idMap = new Map();
    let hasDup = false;
    for (const u of dirResult.users) {
      if (idMap.has(u.id)) {
        console.error(`DUPLICATE FOUND for user ${u.id} (${u.nickname})!`);
        hasDup = true;
      }
      idMap.set(u.id, true);
    }

    if (hasDup) {
      throw new Error('FAIL: Duplicate user IDs detected in getUsersDirectory output!');
    }

    // 5. Kiểm tra branchRes trong getOverview
    const overview = await AnalyticsService.getOverview({ date: today });
    console.log(`Overview KPI Total Books: ${overview.kpi.totalBooks}, EXP: ${overview.kpi.totalExp}`);
    console.log(`Branch breakdown entries: ${overview.branches.length}`);
    
    // Tổng members trong branches không được vượt quá tổng users thực tế
    const totalUsersInDbRes = await db.query('SELECT COUNT(*) FROM users');
    const actualTotalUsers = parseInt(totalUsersInDbRes.rows[0].count, 10);
    const branchSumMembers = overview.branches.reduce((sum, b) => sum + parseInt(b.total_members || 0, 10), 0);

    console.log(`Actual total users in DB: ${actualTotalUsers}`);
    console.log(`Sum of total_members across branches: ${branchSumMembers}`);

    if (branchSumMembers !== actualTotalUsers) {
      throw new Error(`FAIL: branch breakdown total members (${branchSumMembers}) does not match actual total users (${actualTotalUsers})!`);
    }

    console.log('✅ ALL TEST CHECKS PASSED 100%! No duplicate rows, data accurate.');
    process.exit(0);
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  }
}

runTest();
