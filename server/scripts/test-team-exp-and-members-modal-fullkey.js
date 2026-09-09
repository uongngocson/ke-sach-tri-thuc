import assert from 'assert';
import db from '../config/database.js';
import { BookService } from '../services/book.service.js';
import { TeamService } from '../services/team.service.js';
import { AnalyticsService } from '../services/analytics.service.js';
import { syncTeamExp } from './sync-team-exp.js';

async function runTests() {
  console.log('🧪 =================================================================');
  console.log('🧪 UNIT TEST: TEAM EXP, TREE EXP & MEMBERS NICKNAME INTEGRITY');
  console.log('🧪 =================================================================\n');

  let passed = 0;
  function pass(msg) {
    passed++;
    console.log(`  ✅ [PASS] ${msg}`);
  }

  // 1. Đồng bộ lại EXP
  await syncTeamExp();
  pass('Đồng bộ tree_exp và total_exp thành công');

  // 2. Kiểm tra getTeamMembers cho cả 8 đội (288 users)
  console.log('\n👥 [1/4] Kiểm tra getTeamMembers trả về tt và nickname cho cả 8 đội...');
  let totalMembersChecked = 0;
  for (let teamId = 1; teamId <= 8; teamId++) {
    const members = await TeamService.getTeamMembers(teamId);
    assert(members.length > 0, `Đội ${teamId} phải có thành viên`);
    for (const m of members) {
      assert(m.nickname !== undefined && m.nickname !== null && m.nickname !== '', 
        `Thành viên ${m.full_name} (Đội ${teamId}) phải có nickname hợp lệ, nhận được: "${m.nickname}"`);
      assert(m.tt !== undefined && m.tt !== null && m.tt >= 1 && m.tt <= 288, 
        `Thành viên ${m.full_name} phải có số thứ tự tt trong [1..288], nhận được: ${m.tt}`);
      totalMembersChecked++;
    }
    pass(`Đội ${teamId} (${members.length} người) 100% có TT và Nickname hợp lệ`);
  }
  assert(totalMembersChecked === 288, `Tổng số thành viên kiểm tra phải đúng 288, thực tế: ${totalMembersChecked}`);
  pass('Toàn bộ 288 thành viên đều có Nickname và TT đầy đủ (Zero missing)');

  // 3. Kiểm tra getOverview trả về tree_exp và total_exp
  console.log('\n📊 [2/4] Kiểm tra AnalyticsService.getOverview() trả về tree_exp & total_exp...');
  const overview = await AnalyticsService.getOverview();
  assert(overview.teams && overview.teams.length === 8, 'getOverview phải trả về 8 đội');

  for (const team of overview.teams) {
    assert(team.tree_exp !== undefined, `Đội ${team.id} phải có tree_exp`);
    assert(team.total_exp !== undefined, `Đội ${team.id} phải có total_exp`);
    assert(team.tree_exp === team.total_exp, `Đội ${team.id} tree_exp (${team.tree_exp}) phải bằng total_exp (${team.total_exp})`);
    if (team.books_count > 0 || team.dews_count > 0) {
      assert(team.tree_exp > 0, `Đội ${team.id} có sách/sương thì tree_exp phải > 0, thực tế: ${team.tree_exp}`);
    }
    assert(team.avg_participation_rate !== undefined, `Đội ${team.id} phải có avg_participation_rate`);
    assert(team.all_days_participants !== undefined, `Đội ${team.id} phải có all_days_participants`);
    assert(team.total_campaign_days !== undefined && team.total_campaign_days >= 1, `Đội ${team.id} phải có total_campaign_days >= 1`);
    const expectedRate = parseFloat(((team.all_days_participants / (team.total_campaign_days * (team.target_members || 40))) * 100).toFixed(1));
    assert(Math.abs(team.avg_participation_rate - expectedRate) < 0.05, 
      `Đội ${team.id} avg_participation_rate (${team.avg_participation_rate}) phải bằng công thức mong đợi (${expectedRate})`);
  }
  pass('Toàn bộ 8 đội trong getOverview có tree_exp đồng nhất với total_exp và avg_participation_rate chuẩn 100%');

  // 4. Kiểm tra riêng đội 5 (FPL_AU_FU)
  const team5 = overview.teams.find(t => t.id === 5);
  console.log(`\n🌳 [3/4] Kiểm tra cụ thể Đội 5 (FPL_AU_FU): tree_exp=${team5.tree_exp}, total_exp=${team5.total_exp}, books=${team5.books_count}`);
  assert(team5.tree_exp >= 10, `Đội 5 phải có tree_exp >= 10, thực tế: ${team5.tree_exp}`);
  assert(team5.levelName !== undefined, 'Đội 5 phải có levelName');
  pass(`Đội 5 hiển thị chính xác tree_exp = ${team5.tree_exp} EXP (Không bị 0)`);

  // 5. Kiểm tra gieo sách mới thì tree_exp của đội tăng đúng +5
  console.log('\n🌱 [4/4] Kiểm tra Mutation contributeBook cập nhật đồng thời total_exp và tree_exp...');
  const eligibleUser = (await db.query(`
    SELECT u.id, u.team_id FROM users u 
    WHERE NOT EXISTS (
      SELECT 1 FROM daily_quotes dq 
      WHERE dq.user_id = u.id 
        AND dq.quote_date = CURRENT_DATE
    )
    ORDER BY u.id ASC
    LIMIT 1
  `)).rows[0];

  if (!eligibleUser) {
    console.log('  ⚠️ Không còn user nào chưa gieo sách hôm nay, bỏ qua bước tạo sách mới.');
  } else {
    const testTeamId = eligibleUser.team_id;
    const tBefore = (await db.query('SELECT total_exp, tree_exp FROM teams WHERE id = $1', [testTeamId])).rows[0];
    const uniqueNote = 'Muốn lấy mật thì đừng phá tổ ong - Test EXP & Tree sync ' + Date.now();
    const testBook = await BookService.contributeBook({
      title: 'Đắc Nhân Tâm Kiểm Thử Unit Test',
      author: 'Dale Carnegie',
      quote: uniqueNote,
      category: 'Tâm lý',
      userId: eligibleUser.id
    });
    const tAfter = (await db.query('SELECT total_exp, tree_exp FROM teams WHERE id = $1', [testTeamId])).rows[0];
    assert(parseInt(tAfter.tree_exp, 10) === parseInt(tAfter.total_exp, 10), 
      `Sau khi gieo sách, Đội ${testTeamId} tree_exp (${tAfter.tree_exp}) phải bằng total_exp (${tAfter.total_exp})`);
    assert(parseInt(tAfter.tree_exp, 10) === parseInt(tBefore.tree_exp, 10) + 5,
      `Điểm tree_exp của Đội ${testTeamId} phải tăng đúng +5 EXP (Trước: ${tBefore.tree_exp}, Sau: ${tAfter.tree_exp})`);
    pass(`Gieo sách cho Đội ${testTeamId} cập nhật chính xác đồng thời cả total_exp và tree_exp (+5 EXP)`);

    // Dọn dẹp bản ghi kiểm thử để bảo đảm tính toàn vẹn và có thể chạy lại vô hạn lần
    if (testBook && testBook.id) {
      await db.query('DELETE FROM exp_ledger WHERE reference_type = $1 AND reference_id = $2', ['books', testBook.id]);
      await db.query('DELETE FROM daily_quotes WHERE book_id = $1', [testBook.id]);
      await db.query('DELETE FROM books WHERE id = $1', [testBook.id]);
      await db.query('UPDATE teams SET total_exp = $1, tree_exp = $2 WHERE id = $3', [tBefore.total_exp, tBefore.tree_exp, testTeamId]);
    }
  }

  console.log('\n=================================================================');
  console.log(`🎉 TẤT CẢ TEST CASES HOÀN TOÀN THÀNH CÔNG (${passed} assertions PASSED)!`);
  console.log('=================================================================\n');
  process.exit(0);
}

runTests().catch(e => {
  console.error('❌ TEST FAILED:', e);
  process.exit(1);
});
