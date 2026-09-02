import { calculateLevelFromExp } from '../config/constants.js';
import db from '../config/database.js';
import BookService from '../services/book.service.js';
import DewService from '../services/dew.service.js';
import QuoteService from '../services/quote.service.js';
import ModerationService from '../services/moderation.service.js';
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
    // INTEGRATION TESTS: ANTI-SPAM DATABASE CONSTRAINTS
    // -------------------------------------------------------------
    console.log('\n📦 [3/4] Running Integration Tests: Anti-Spam Constraints...');

    // Daily Dew 1st time
    const dewFp = `dew_test_${Date.now()}`;
    const dew1 = await DewService.claimDew(dewFp);
    assert(dew1.expEarned === 1, 'Daily Dew: First claim succeeds (+1 EXP)');

    // Daily Dew 2nd time on same date -> Must throw 23505 Unique Constraint
    let dewSpamBlocked = false;
    try {
      await DewService.claimDew(dewFp);
    } catch (err) {
      if (err.code === '23505') dewSpamBlocked = true;
    }
    assert(dewSpamBlocked, 'Daily Dew: Second claim on same day blocked by UNIQUE(user_fingerprint, claim_date) constraint');

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

    const adminRow = await db.query("SELECT id, username FROM admin_users WHERE username = 'admin'");
    const adminUser = adminRow.rows[0];
    
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
