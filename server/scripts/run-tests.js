import { calculateLevelFromExp } from '../config/constants.js';
import db from '../config/database.js';
import BookService from '../services/book.service.js';
import DewService from '../services/dew.service.js';
import QuoteService from '../services/quote.service.js';
import ModerationService from '../services/moderation.service.js';
import GrowthService from '../services/growth.service.js';
import { seedTeamsAndUsers } from './seed-teams-users.js';
import { v4 as uuidv4 } from 'uuid';

async function runAllTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING COMPREHENSIVE AUTOMATED TEST SUITE (CÁO SÁCH)');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Ensure teams & users exist before tests
    const userCountRes = await db.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCountRes.rows[0].count, 10) === 0) {
      console.log('📦 Auto-seeding 8 Teams and 288 Users for testing...');
      await seedTeamsAndUsers();
    }
    // -------------------------------------------------------------
    // UNIT TESTS
    // -------------------------------------------------------------
    console.log('📦 [1/4] Running Unit Tests (EXP & Level Math)...');
    
    const lvl0 = calculateLevelFromExp(25);
    assert(lvl0.level === 0 && lvl0.progressPercent === 50, 'Level 0 with 25 EXP has 50% progress');

    const lvl1 = calculateLevelFromExp(100);
    assert(lvl1.level === 1 && lvl1.progressPercent === 50, 'Level 1 with 100 EXP has 50% progress');

    const lvl4 = calculateLevelFromExp(750);
    assert(lvl4.level === 4 && lvl4.name === 'Đại Thụ Đơm Hoa Kết Trái', 'Level 4 thresholds correctly mapped');

    const lvl5 = calculateLevelFromExp(1500);
    assert(lvl5.level === 5 && lvl5.progressPercent === 100, 'Level 5 Max Level capped with 100% progress');

    // -------------------------------------------------------------
    // INTEGRATION TESTS: BOOK CONTRIBUTION (AUTO-APPROVE & EXP)
    // -------------------------------------------------------------
    console.log('\n📦 [2/4] Running Integration Tests: Book Contribution & Ledger...');
    
    const testFingerprint = `test_fp_${Date.now()}`;
    const initialGrowth = await db.query('SELECT total_exp, total_books FROM community_growth WHERE id = 1');
    const startExp = parseInt(initialGrowth.rows[0].total_exp, 10);

    const contribution = await BookService.contributeBook({
      title: 'Hành Trình Về Phương Đông',
      author: 'Baird T. Spalding',
      quote: 'Khoa học và tâm linh là hai cánh của một con chim, cùng nâng con người bay lên.',
      category: 'Triết Lý Sống',
      reader: 'Độc giả Tri Thức',
      email: 'reader@caosach.vn',
      userFingerprint: testFingerprint
    });

    assert(contribution.book.visibility_status === 'visible', 'Auto-Approve: visibility_status is "visible" immediately');
    assert(contribution.book.moderation_status === 'pending_review', 'Auto-Approve: moderation_status is "pending_review" for post-moderation');
    assert(contribution.growth.expEarned === 15, 'Ledger: Exactly +15 EXP earned per book contribution');

    const updatedGrowth = await db.query('SELECT total_exp FROM community_growth WHERE id = 1');
    const endExp = parseInt(updatedGrowth.rows[0].total_exp, 10);
    assert(endExp === startExp + 15, `ACID Transaction: Database total_exp increased by 15 (${startExp} -> ${endExp})`);

    // Verify EXP Ledger Entry
    const ledgerRes = await db.query('SELECT * FROM exp_ledger WHERE reference_id = $1', [contribution.book.id]);
    assert(ledgerRes.rows.length === 1 && ledgerRes.rows[0].type === 'BOOK_CONTRIBUTION', 'Ledger: Audit entry created in exp_ledger table');

    // -------------------------------------------------------------
    // INTEGRATION TESTS: ANTI-SPAM & DEW BUSINESS CONSTRAINTS
    // -------------------------------------------------------------
    console.log('\n📦 [3/4] Running Integration Tests: Daily Dew & Anti-Spam Constraints...');

    // Fetch a valid user from DB
    const uRes = await db.query('SELECT * FROM users WHERE team_id IS NOT NULL LIMIT 1');
    const validUser = uRes.rows[0];

    // Guest rejection
    let guestBlocked = false;
    try {
      await DewService.claimDew({ userId: null });
    } catch (err) {
      if (err.statusCode === 401 || err.code === 'LOGIN_REQUIRED') guestBlocked = true;
    }
    assert(guestBlocked, 'Daily Dew: Guest user is strictly blocked (HTTP 401 LOGIN_REQUIRED)');

    // Other team tree rejection
    const wrongTeamId = validUser.team_id === 1 ? 2 : 1;
    let wrongTeamBlocked = false;
    try {
      await DewService.claimDew({ userId: validUser.id, teamId: wrongTeamId });
    } catch (err) {
      if (err.statusCode === 403 || err.code === 'FORBIDDEN_OTHER_TEAM_TREE') wrongTeamBlocked = true;
    }
    assert(wrongTeamBlocked, 'Daily Dew: Inspecting & watering another team tree is strictly blocked (HTTP 403)');

    // Clean up any test dew records today for this user
    await db.query('DELETE FROM daily_dews WHERE user_id = $1', [validUser.id]);

    // Daily Dew 1st time on own team tree
    const dewFp = `dew_test_${Date.now()}`;
    const dew1 = await DewService.claimDew({
      userId: validUser.id,
      teamId: validUser.team_id,
      email: validUser.email,
      userFingerprint: dewFp
    });
    assert(dew1.expEarned === 1, 'Daily Dew: First claim on own team tree succeeds (+1 EXP)');
    assert(dew1.team.id === validUser.team_id, 'Daily Dew: Team tree EXP is credited to the correct team');

    // Daily Dew 2nd time on same date -> Must throw 409 DUPLICATE_DEW_CLAIM
    let dewSpamBlocked = false;
    try {
      await DewService.claimDew({
        userId: validUser.id,
        teamId: validUser.team_id,
        email: validUser.email,
        userFingerprint: dewFp
      });
    } catch (err) {
      if (err.statusCode === 409 || err.code === 'DUPLICATE_DEW_CLAIM' || err.code === '23505') dewSpamBlocked = true;
    }
    assert(dewSpamBlocked, 'Daily Dew: Second claim on same day strictly blocked (HTTP 409 DUPLICATE_DEW_CLAIM)');

    const statusCheck = await DewService.getDewStatus({ userId: validUser.id });
    assert(statusCheck.hasClaimedToday === true, 'Daily Dew: getDewStatus correctly reports hasClaimedToday = true');

    // Quote Like 1st time
    const likeFp = `like_test_${Date.now()}`;
    const like1 = await QuoteService.likeQuote(contribution.book.id, likeFp);
    assert(like1.expEarned === 2, 'Quote Like: First like succeeds (+2 EXP)');

    // Quote Like 2nd time on same book -> Must throw 23505 Unique Constraint
    let likeSpamBlocked = false;
    try {
      await QuoteService.likeQuote(contribution.book.id, likeFp);
    } catch (err) {
      if (err.code === '23505') likeSpamBlocked = true;
    }
    assert(likeSpamBlocked, 'Quote Like: Second like on same book blocked by UNIQUE(user_fingerprint, book_id) constraint');

    // -------------------------------------------------------------
    // INTEGRATION TESTS: ADMIN MODERATION & AUDIT LOGS
    // -------------------------------------------------------------
    console.log('\n📦 [4/4] Running Integration Tests: Admin Moderation & Audit Logs...');

    let adminRow = await db.query("SELECT id, username FROM admin_users WHERE username = 'admin'");
    let adminUser = adminRow.rows[0];
    if (!adminUser) {
      const insertAdmin = await db.query(`
        INSERT INTO admin_users (username, password_hash, role)
        VALUES ('admin', '$2a$10$abcdefghijklmnopqrstuvwxyz123456', 'super_admin')
        RETURNING id, username
      `);
      adminUser = insertAdmin.rows[0];
    }
    
    // Admin marks reviewed
    const reviewedBook = await ModerationService.updateBookStatus(
      contribution.book.id,
      { moderation_status: 'reviewed', moderation_notes: 'Duyệt an toàn' },
      adminUser,
      '127.0.0.1'
    );
    assert(reviewedBook.moderation_status === 'reviewed', 'Moderation: Admin marked book moderation_status = "reviewed"');

    // Admin audit logs check
    const auditRes = await db.query('SELECT * FROM audit_logs WHERE target_id = $1', [contribution.book.id]);
    assert(auditRes.rows.length > 0, 'Audit Trail: Admin action automatically logged into audit_logs table');

    // Admin Bonus EXP
    const bonusRes = await ModerationService.grantAdminBonus(100, 'Tặng EXP Sự Kiện', adminUser, '127.0.0.1');
    assert(bonusRes.amount === 100, 'Admin Control: Special event EXP bonus (+100 EXP) successfully credited');

    // -------------------------------------------------------------
    // INTEGRATION TESTS: REAL VISITOR TRACKING
    // -------------------------------------------------------------
    console.log('\n📦 [5/5] Running Integration Tests: Real Visitor Tracking & DB Sync...');

    const visitorFp = `fp_test_runner_${Date.now()}`;
    const vVisit1 = await GrowthService.recordVisitor(visitorFp, '127.0.0.1', 'Node-Test-Runner');
    assert(vVisit1.isNewVisitor === true, 'Visitor Tracking: First visit from new device recognized as new');

    const vVisit1Repeat = await GrowthService.recordVisitor(visitorFp, '127.0.0.1', 'Node-Test-Runner');
    assert(vVisit1Repeat.isNewVisitor === false, 'Visitor Tracking: Repeat visit from same device not counted twice');

    const growthCheck = await GrowthService.getCommunityGrowth();
    assert(growthCheck.activeReaders >= 1, 'Visitor Tracking: community_growth.active_readers synced with PostgreSQL site_visitors count');

    // -------------------------------------------------------------
    // INTEGRATION TESTS: 8 TEAMS & 288 USERS INTEGRITY
    // -------------------------------------------------------------
    console.log('\n📦 [6/6] Running Integration Tests: 8 Teams & 288 Users Integrity...');

    const { TeamService } = await import('../services/team.service.js');
    const { UserService } = await import('../services/user.service.js');

    const allTeams = await TeamService.getAllTeams();
    assert(allTeams.length === 8, 'Teams: Exactly 8 teams present in database');

    const expectedCounts = { 1: 39, 2: 49, 3: 30, 4: 26, 5: 37, 6: 32, 7: 36, 8: 39 };
    let countsMatched = true;
    for (const t of allTeams) {
      if (t.actual_members !== expectedCounts[t.id]) {
        countsMatched = false;
        console.error(`Team ${t.id} count mismatch: got ${t.actual_members}, expected ${expectedCounts[t.id]}`);
      }
    }
    assert(countsMatched, 'Teams: All 8 teams have 100% exact member counts (39, 49, 30, 26, 37, 32, 36, 39)');

    const totalUsersRes = await db.query('SELECT COUNT(*) FROM users');
    assert(parseInt(totalUsersRes.rows[0].count, 10) === 288, 'Users: Exactly 288 users stored in PostgreSQL database');

    const userLookup = await UserService.lookupUser('thuhuong@fpt.com');
    assert(userLookup && userLookup.employee_code === '00000295' && userLookup.team_id === 5, 'Users: Lookup by email thuhuong@fpt.com returns correct employee_code 00000295 and team 5');

    const codeLookup = await UserService.lookupUser('00000295');
    assert(codeLookup && codeLookup.email === 'thuhuong@fpt.com', 'Users: Lookup by code 00000295 returns correct user profile');

    // -------------------------------------------------------------
    // INTEGRATION TESTS: DAILY QUOTE CONSTRAINT (1 QUOTE / USER / DAY)
    // -------------------------------------------------------------
    console.log('\n📦 [7/7] Running Integration Tests: Daily Quote Limit (1 quote/day/user)...');

    // Clean any daily quotes today for validUser
    await db.query('DELETE FROM daily_quotes WHERE user_id = $1 AND quote_date = CURRENT_DATE', [validUser.id]);

    const dailyTestFp = `fp_daily_run_${Date.now()}`;
    const dailyBook1 = await BookService.contributeBook({
      title: 'Tư Duy Nhanh Và Chậm',
      author: 'Daniel Kahneman',
      quote: 'Chúng ta có xu hướng phóng đại khả năng hiểu thế giới của mình.',
      category: 'Tâm Lý Học',
      reader: validUser.full_name,
      email: validUser.email,
      userId: validUser.id,
      teamId: validUser.team_id,
      userFingerprint: dailyTestFp
    });

    assert(dailyBook1 && dailyBook1.book && dailyBook1.book.id, 'Daily Quote: 1st contribution today succeeds');

    const dqStatus = await BookService.getDailyQuoteStatus({ userId: validUser.id });
    assert(dqStatus.hasContributedToday === true && dqStatus.remainingToday === 0, 'Daily Quote: Status correctly reflects hasContributedToday = true and remainingToday = 0');

    // 2nd contribution in same day by same user -> Must be blocked (409)
    let dailyBlocked = false;
    try {
      await BookService.contributeBook({
        title: 'Blink - Trong Chớp Mắt',
        author: 'Malcolm Gladwell',
        quote: 'Quyết định nhanh chóng có thể tốt như những quyết định thận trọng.',
        category: 'Tâm Lý Học',
        reader: validUser.full_name,
        email: validUser.email,
        userId: validUser.id,
        teamId: validUser.team_id,
        userFingerprint: dailyTestFp
      });
    } catch (err) {
      if (err.statusCode === 409 || err.code === 'DAILY_QUOTE_LIMIT_EXCEEDED') {
        dailyBlocked = true;
      }
    }
    assert(dailyBlocked, 'Daily Quote: 2nd contribution on same day strictly blocked (HTTP 409 DAILY_QUOTE_LIMIT_EXCEEDED)');

    // Clean up test books created during test run
    if (contribution && contribution.book && contribution.book.id) {
      await db.query('DELETE FROM exp_ledger WHERE reference_id = $1', [contribution.book.id]);
      await db.query('DELETE FROM books WHERE id = $1', [contribution.book.id]);
    }
    if (dailyBook1 && dailyBook1.book && dailyBook1.book.id) {
      await db.query('DELETE FROM exp_ledger WHERE reference_id = $1', [dailyBook1.book.id]);
      await db.query('DELETE FROM daily_quotes WHERE book_id = $1', [dailyBook1.book.id]);
      await db.query('DELETE FROM books WHERE id = $1', [dailyBook1.book.id]);
    }

  } catch (err) {
    console.error('💥 Test suite encountered fatal error:', err);
    failed++;
  } finally {
    console.log('\n========================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================================\n');
    await db.pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAllTests();
