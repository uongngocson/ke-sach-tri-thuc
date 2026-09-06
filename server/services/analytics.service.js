import db from '../config/database.js';
import { calculateLevelFromExp } from '../config/constants.js';

export class AnalyticsService {
  /**
   * Lấy toàn bộ dữ liệu tổng quan cho Executive Dashboard & Charts
   */
  static async getOverview() {
    // 1. Current Active Round
    const roundRes = await db.query(
      'SELECT * FROM rounds WHERE is_active = true LIMIT 1'
    );
    const currentRound = roundRes.rows[0] || {
      round_number: 1,
      label: 'Chặng 1: Khởi Động Vườn Tri Thức',
      stage_type: 'SEEDING',
      start_date: '2026-09-05',
      end_date: '2026-09-07',
      is_active: true
    };

    // 2. High-level KPIs
    const [growthRes, booksCountRes, dewsCountRes, likesCountRes, visitorsRes, usersCountRes, harvestsRes] = await Promise.all([
      db.query('SELECT * FROM community_growth WHERE id = 1'),
      db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE moderation_status = 'reviewed') as reviewed,
          COUNT(*) FILTER (WHERE moderation_status = 'pending_review') as pending,
          COUNT(*) FILTER (WHERE moderation_status = 'rejected') as rejected,
          COUNT(*) FILTER (WHERE visibility_status = 'visible') as visible,
          COUNT(*) FILTER (WHERE visibility_status = 'hidden') as hidden
        FROM books
      `),
      db.query('SELECT COUNT(*) as total FROM daily_dews'),
      db.query('SELECT COUNT(*) as total FROM quote_likes'),
      db.query('SELECT COUNT(*) as total FROM site_visitors'),
      db.query('SELECT COUNT(*) as total FROM users'),
      db.query('SELECT COUNT(*) as total FROM fruit_harvests')
    ]);

    const growth = growthRes.rows[0] || {};
    const totalExp = parseInt(growth.total_exp || 0, 10);
    const levelInfo = calculateLevelFromExp(totalExp);

    // 3. Last 14 Days Trend (EXP & Books & Dews)
    const [expTrendRes, booksTrendRes, dewsTrendRes] = await Promise.all([
      db.query(`
        SELECT DATE(created_at) as date_str, COALESCE(SUM(amount), 0) as exp_amount
        FROM exp_ledger
        WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
        GROUP BY DATE(created_at)
        ORDER BY date_str ASC
      `),
      db.query(`
        SELECT DATE(created_at) as date_str, COUNT(*) as books_count
        FROM books
        WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
        GROUP BY DATE(created_at)
        ORDER BY date_str ASC
      `),
      db.query(`
        SELECT claim_date as date_str, COUNT(*) as dews_count
        FROM daily_dews
        WHERE claim_date >= CURRENT_DATE - INTERVAL '13 days'
        GROUP BY claim_date
        ORDER BY date_str ASC
      `)
    ]);

    // Build seamless 14-day timeline
    const timeline = [];
    const expMap = new Map(expTrendRes.rows.map(r => [new Date(r.date_str).toISOString().slice(0, 10), parseInt(r.exp_amount, 10)]));
    const booksMap = new Map(booksTrendRes.rows.map(r => [new Date(r.date_str).toISOString().slice(0, 10), parseInt(r.books_count, 10)]));
    const dewsMap = new Map(dewsTrendRes.rows.map(r => [new Date(r.date_str).toISOString().slice(0, 10), parseInt(r.dews_count, 10)]));

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoDate = d.toISOString().slice(0, 10);
      const displayDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      timeline.push({
        date: isoDate,
        label: displayDate,
        exp: expMap.get(isoDate) || 0,
        books: booksMap.get(isoDate) || 0,
        dews: dewsMap.get(isoDate) || 0
      });
    }

    // 4. 8 Teams Deep-Dive
    const teamsRes = await db.query(`
      SELECT 
        t.id, t.code, t.name, t.display_name, t.color_code,
        t.target_members, t.actual_members,
        t.tree_exp, t.tree_level, t.tree_seeds,
        t.avg_participation_rate, t.perfect_rounds_count,
        t.milestone_150_at, t.milestone_400_at, t.milestone_1000_at, t.milestone_2500_at,
        (SELECT COUNT(*) FROM books b WHERE b.team_id = t.id) as books_count,
        (SELECT COUNT(*) FROM daily_dews d WHERE d.team_id = t.id) as dews_count,
        (SELECT COUNT(DISTINCT rc.user_id) FROM round_contributions rc WHERE rc.team_id = t.id AND rc.round_number = $1) as current_round_participants
      FROM teams t
      ORDER BY t.tree_exp DESC, t.id ASC
    `, [currentRound.round_number]);

    const TEAM_SHORT_NAMES = {
      1: 'Đội 1', 2: 'Đội 2', 3: 'Đội 3', 4: 'Đội 4',
      5: 'Đội 5', 6: 'Đội 6', 7: 'Đội 7', 8: 'Đội 8'
    };

    const teams = teamsRes.rows.map((team, index) => {
      const target = team.target_members || 40;
      const participants = parseInt(team.current_round_participants || 0, 10);
      const currentRate = target > 0 ? parseFloat(((participants / target) * 100).toFixed(1)) : 0;
      const isSprouted = (team.tree_seeds >= 50) || (team.tree_level >= 1);
      const levelNames = ['Ủ Mầm (Hạt)', 'Cây Nảy Mầm', 'Cây Con', 'Cây Phát Triển', 'Cây Cổ Thụ', 'Đại Cổ Thụ'];

      return {
        ...team,
        rank: index + 1,
        shortName: TEAM_SHORT_NAMES[team.id] || `Đội ${team.id}`,
        levelName: levelNames[team.tree_level] || 'Ủ Mầm',
        isSprouted,
        books_count: parseInt(team.books_count || 0, 10),
        dews_count: parseInt(team.dews_count || 0, 10),
        current_round_participants: participants,
        current_participation_rate: currentRate
      };
    });

    // 5. Category Breakdown
    const catRes = await db.query(`
      SELECT 
        COALESCE(NULLIF(category, ''), 'Sách Tinh Hoa') as category,
        COUNT(*) as count,
        COALESCE(SUM(likes_count), 0) as total_likes
      FROM books
      GROUP BY category
      ORDER BY count DESC
    `);

    // 6. Branch / Department Breakdown
    const branchRes = await db.query(`
      SELECT 
        COALESCE(NULLIF(branch, ''), 'Khối Chung') as branch,
        COUNT(*) as total_members,
        COALESCE(SUM(u.total_exp_earned), 0) as total_exp,
        COALESCE(SUM(u.contributed_books_count), 0) as total_books,
        COUNT(DISTINCT rc.user_id) as active_round_members
      FROM users u
      LEFT JOIN round_contributions rc ON u.id = rc.user_id AND rc.round_number = $1
      GROUP BY branch
      ORDER BY total_members DESC
    `, [currentRound.round_number]);

    // 7. 15 Rounds Matrix
    const roundsRes = await db.query(`
      SELECT 
        r.round_number, r.label, r.stage_type, r.start_date, r.end_date, r.is_active,
        COALESCE(SUM(tr.participants_count), 0) as total_participants,
        COALESCE(AVG(tr.participation_rate), 0) as avg_rate,
        COALESCE(SUM(tr.raw_exp), 0) as total_raw_exp
      FROM rounds r
      LEFT JOIN team_rounds tr ON r.round_number = tr.round_number
      GROUP BY r.round_number, r.label, r.stage_type, r.start_date, r.end_date, r.is_active
      ORDER BY r.round_number ASC
    `);

    // 8. Calculate Overall Participation Rate for Active Round
    const totalUsers = parseInt(usersCountRes.rows[0]?.total || 288, 10);
    const activeRoundUsersRes = await db.query(`
      SELECT COUNT(DISTINCT user_id) as active_count
      FROM round_contributions
      WHERE round_number = $1
    `, [currentRound.round_number]);
    const activeRoundUsers = parseInt(activeRoundUsersRes.rows[0]?.active_count || 0, 10);
    const overallParticipationRate = totalUsers > 0 ? parseFloat(((activeRoundUsers / totalUsers) * 100).toFixed(1)) : 0;

    return {
      kpi: {
        totalExp,
        level: levelInfo.level,
        levelName: levelInfo.levelName,
        progressPercent: levelInfo.progressPercent,
        totalBooks: parseInt(booksCountRes.rows[0]?.total || 0, 10),
        reviewedBooks: parseInt(booksCountRes.rows[0]?.reviewed || 0, 10),
        pendingBooks: parseInt(booksCountRes.rows[0]?.pending || 0, 10),
        rejectedBooks: parseInt(booksCountRes.rows[0]?.rejected || 0, 10),
        visibleBooks: parseInt(booksCountRes.rows[0]?.visible || 0, 10),
        totalDews: parseInt(dewsCountRes.rows[0]?.total || 0, 10),
        totalLikes: parseInt(likesCountRes.rows[0]?.total || 0, 10),
        totalHarvests: parseInt(harvestsRes.rows[0]?.total || 0, 10),
        siteVisitors: parseInt(visitorsRes.rows[0]?.total || 0, 10),
        totalMembers: totalUsers,
        activeRoundUsers,
        overallParticipationRate,
        currentRound
      },
      timeline,
      teams,
      categories: catRes.rows,
      branches: branchRes.rows,
      rounds: roundsRes.rows
    };
  }

  /**
   * Sổ cái EXP đầy đủ
   */
  static async getLedger({ page = 1, limit = 25, type, teamId, search }) {
    page = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        el.id, el.amount, el.type, el.reference_type, el.reference_id, el.created_at,
        el.user_fingerprint,
        u.full_name as user_name, u.email as user_email, u.employee_code,
        t.id as team_id, t.name as team_name, t.display_name as team_display_name, t.color_code as team_color
      FROM exp_ledger el
      LEFT JOIN users u ON el.user_id = u.id
      LEFT JOIN teams t ON el.team_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      params.push(type);
      query += ` AND el.type = $${params.length}`;
    }
    if (teamId) {
      params.push(parseInt(teamId, 10));
      query += ` AND el.team_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.employee_code ILIKE $${params.length})`;
    }

    const countQuery = `SELECT COUNT(*) FROM (${query}) as filtered_ledger`;
    const countRes = await db.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count, 10);

    query += ` ORDER BY el.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const res = await db.query(query, params);

    return {
      ledger: res.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Danh bạ 288 nhân sự kèm trạng thái tham gia chặng hiện tại
   */
  static async getUsersDirectory({ page = 1, limit = 50, teamId, branch, status, search }) {
    page = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.min(300, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (page - 1) * limit;

    // Get current round
    const roundRes = await db.query('SELECT round_number FROM rounds WHERE is_active = true LIMIT 1');
    const currentRoundNum = roundRes.rows[0]?.round_number || 1;

    let query = `
      SELECT 
        u.id, u.employee_code, u.email, u.full_name, u.gender,
        u.branch, u.parent_department, u.child_department_1, u.child_department_2,
        u.job_title, u.team_id, u.role, u.avatar_url,
        u.contributed_books_count, u.total_exp_earned, u.created_at,
        t.display_name as team_display_name, t.color_code as team_color,
        CASE WHEN rc.id IS NOT NULL THEN true ELSE false END as participated_current_round,
        rc.contributed_at as round_contribution_time
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      LEFT JOIN round_contributions rc ON u.id = rc.user_id AND rc.round_number = $1
      WHERE 1=1
    `;
    const params = [currentRoundNum];

    if (teamId) {
      params.push(parseInt(teamId, 10));
      query += ` AND u.team_id = $${params.length}`;
    }
    if (branch) {
      params.push(branch);
      query += ` AND u.branch = $${params.length}`;
    }
    if (status === 'participated') {
      query += ' AND rc.id IS NOT NULL';
    } else if (status === 'not_participated') {
      query += ' AND rc.id IS NULL';
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.employee_code ILIKE $${params.length} OR u.job_title ILIKE $${params.length})`;
    }

    const countQuery = `SELECT COUNT(*) FROM (${query}) as filtered_users`;
    const countRes = await db.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count, 10);

    query += ` ORDER BY u.team_id ASC, u.full_name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const res = await db.query(query, params);

    return {
      users: res.rows,
      currentRoundNumber: currentRoundNum,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Kích hoạt hoặc chuyển chặng thi đấu
   */
  static async advanceRound(targetRoundNumber, adminUser, ip = '') {
    const targetRound = parseInt(targetRoundNumber, 10);
    if (targetRound < 1 || targetRound > 15) {
      throw new Error('Chặng thi đấu không hợp lệ (phải từ 1 đến 15)');
    }

    const result = await db.transaction(async (client) => {
      // Deactivate all
      await client.query('UPDATE rounds SET is_active = false');
      // Activate target
      const updateRes = await client.query(
        'UPDATE rounds SET is_active = true WHERE round_number = $1 RETURNING *',
        [targetRound]
      );

      const round = updateRes.rows[0];

      // Log audit
      await client.query(`
        INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata, ip_address)
        VALUES ($1, 'ADVANCE_ROUND', 'round', gen_random_uuid(), $2, $3)
      `, [
        adminUser?.id || null,
        JSON.stringify({ targetRound, roundLabel: round.label, stage: round.stage_type }),
        ip
      ]);

      return round;
    });

    return result;
  }
}

export default AnalyticsService;
