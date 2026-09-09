import db from '../config/database.js';
import { calculateLevelFromExp } from '../config/constants.js';

export class AnalyticsService {
  /**
   * Lấy toàn bộ dữ liệu tổng quan cho Executive Dashboard & Charts
   */
  static async getOverview(options = {}) {
    const filterDate = (options.date && /^\d{4}-\d{2}-\d{2}$/.test(String(options.date).trim()))
      ? String(options.date).trim()
      : null;
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
        (SELECT COUNT(*) FROM books b WHERE b.team_id = t.id AND DATE(b.created_at) = COALESCE($2::date, CURRENT_DATE)) as date_books_count,
        (SELECT COUNT(*) FROM daily_dews d WHERE d.team_id = t.id) as dews_count,
        (SELECT COUNT(*) FROM daily_dews d WHERE d.team_id = t.id AND d.claim_date = COALESCE($2::date, CURRENT_DATE)) as date_dews_count,
        (SELECT COUNT(DISTINCT dq.user_id) FROM daily_quotes dq WHERE dq.team_id = t.id AND dq.quote_date = CURRENT_DATE) as today_participants,
        (SELECT COUNT(DISTINCT dq.user_id) FROM daily_quotes dq WHERE dq.team_id = t.id AND dq.quote_date = COALESCE($2::date, CURRENT_DATE)) as date_participants,
        (SELECT COUNT(DISTINCT rc.user_id) FROM round_contributions rc WHERE rc.team_id = t.id AND rc.round_number = $1) as current_round_participants
      FROM teams t
      ORDER BY t.tree_exp DESC, t.id ASC
    `, [currentRound.round_number, filterDate]);

    const TEAM_SHORT_NAMES = {
      1: 'SCU_BO', 2: 'Hà Đông Tây Bắc', 3: 'Trung Đông Tây Nam', 4: 'Thập đại Miền Nam',
      5: 'FPL_AU_FU', 6: 'FTIBU_BOM', 7: 'FTI BA_TU_BOP', 8: 'IMU_PSU'
    };

    const teams = teamsRes.rows.map((team, index) => {
      const target = team.target_members || 40;
      const todayParticipants = parseInt(team.today_participants || team.current_round_participants || 0, 10);
      const dateParticipants = parseInt(team.date_participants || 0, 10);
      const currentRate = target > 0 ? parseFloat(((todayParticipants / target) * 100).toFixed(1)) : 0;
      const dateRate = target > 0 ? parseFloat(((dateParticipants / target) * 100).toFixed(1)) : 0;
      const totalExp = parseFloat(team.tree_exp || team.total_exp || 0);
      const isSprouted = (team.tree_level >= 1) || (totalExp >= 50) || (team.tree_seeds >= 10);
      const levelNames = ['Ủ Mầm', 'Mầm Non', 'Cây Con', 'Trưởng Thành', 'Cổ Thụ', 'Đại Cổ Thụ'];

      return {
        ...team,
        rank: index + 1,
        shortName: TEAM_SHORT_NAMES[team.id] || `Đội ${team.id}`,
        levelName: isSprouted ? (levelNames[team.tree_level] || 'Mầm Non') : 'Ủ Mầm',
        isSprouted,
        books_count: parseInt(team.books_count || 0, 10),
        date_books_count: parseInt(team.date_books_count || 0, 10),
        dews_count: parseInt(team.dews_count || 0, 10),
        date_dews_count: parseInt(team.date_dews_count || 0, 10),
        today_participants: todayParticipants,
        date_participants: dateParticipants,
        current_round_participants: todayParticipants,
        current_participation_rate: currentRate,
        today_participation_rate: currentRate,
        date_participation_rate: dateRate
      };
    });

    // 5. 8 Teams Contribution Breakdown (Thay thế Thể loại sách bằng 8 Đội thi đua)
    const catRes = await db.query(`
      SELECT 
        t.id,
        t.name,
        t.display_name,
        t.display_name as category,
        t.color_code,
        COUNT(b.id)::INT as count,
        COALESCE(SUM(b.likes_count), 0)::INT as total_likes,
        t.tree_exp
      FROM teams t
      LEFT JOIN books b ON t.id = b.team_id AND b.visibility_status = 'visible'
      GROUP BY t.id, t.name, t.display_name, t.color_code, t.tree_exp
      ORDER BY t.id ASC
    `);

    // 6. Branch / Department Breakdown
    const branchRes = await db.query(`
      SELECT 
        COALESCE(NULLIF(branch, ''), 'Khối Chung') as branch,
        COUNT(*) as total_members,
        COALESCE(SUM(u.total_exp_earned), 0) as total_exp,
        COALESCE(SUM(u.contributed_books_count), 0) as total_books,
        COUNT(DISTINCT dq.user_id) as active_round_members,
        COUNT(DISTINCT dq.user_id) as today_active_members
      FROM users u
      LEFT JOIN daily_quotes dq ON u.id = dq.user_id AND dq.quote_date = CURRENT_DATE
      GROUP BY branch
      ORDER BY total_members DESC
    `);

    // 7. 15 Rounds Matrix (Preserved for compatibility)
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

    // 8. Calculate Overall Daily Participation Rate (1 quote / user / day)
    const totalUsers = parseInt(usersCountRes.rows[0]?.total || 288, 10);
    const todayActiveUsersRes = await db.query(`
      SELECT COUNT(DISTINCT user_id) as active_count
      FROM daily_quotes
      WHERE quote_date = CURRENT_DATE
    `);
    const todayActiveUsers = parseInt(todayActiveUsersRes.rows[0]?.active_count || 0, 10);
    const todayParticipationRate = totalUsers > 0 ? parseFloat(((todayActiveUsers / totalUsers) * 100).toFixed(1)) : 0;

    const dateActiveUsersRes = await db.query(`
      SELECT COUNT(DISTINCT user_id) as active_count
      FROM daily_quotes
      WHERE quote_date = COALESCE($1::date, CURRENT_DATE)
    `, [filterDate]);
    const dateActiveUsers = parseInt(dateActiveUsersRes.rows[0]?.active_count || 0, 10);
    const dateParticipationRate = totalUsers > 0 ? parseFloat(((dateActiveUsers / totalUsers) * 100).toFixed(1)) : 0;

    const effectiveDate = filterDate || new Date().toISOString().slice(0, 10);

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
        todayActiveUsers,
        todayParticipationRate,
        dateActiveUsers,
        dateParticipationRate,
        filterDate: effectiveDate,
        activeRoundUsers: todayActiveUsers,
        overallParticipationRate: todayParticipationRate,
        currentRound
      },
      filterDate: effectiveDate,
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
        COALESCE(u.nickname, u.full_name) as user_name, u.nickname,
        COALESCE(t.id, bt.id, ut.id) as team_id,
        COALESCE(t.name, bt.name, ut.name) as team_name,
        COALESCE(t.display_name, bt.display_name, ut.display_name) as team_display_name,
        COALESCE(t.color_code, bt.color_code, ut.color_code) as team_color
      FROM exp_ledger el
      LEFT JOIN users u ON el.user_id = u.id
        OR (el.user_fingerprint LIKE 'user_%' AND u.id::text = REPLACE(el.user_fingerprint, 'user_', ''))
        OR (el.user_fingerprint = u.id::text)
      LEFT JOIN teams t ON el.team_id = t.id
      LEFT JOIN books b ON el.reference_type = 'books' AND el.reference_id = b.id
      LEFT JOIN teams bt ON b.team_id = bt.id
      LEFT JOIN teams ut ON u.team_id = ut.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      params.push(type);
      query += ` AND el.type = $${params.length}`;
    }
    if (teamId) {
      params.push(parseInt(teamId, 10));
      query += ` AND COALESCE(el.team_id, b.team_id, u.team_id) = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.nickname ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
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
  static async getUsersDirectory({ page = 1, limit = 50, teamId, branch, status, search, date }) {
    page = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.min(300, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (page - 1) * limit;

    // Get current round
    const roundRes = await db.query('SELECT round_number FROM rounds WHERE is_active = true LIMIT 1');
    const currentRoundNum = roundRes.rows[0]?.round_number || 1;

    const targetDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : null;

    let query = `
      SELECT 
        u.id, u.full_name, u.nickname, u.gender,
        u.branch, u.parent_department, u.child_department_1, u.child_department_2,
        u.job_title, u.team_id, u.role, u.avatar_url,
        u.contributed_books_count, u.total_exp_earned, u.created_at,
        t.display_name as team_display_name, t.color_code as team_color,
        CASE WHEN dq.id IS NOT NULL THEN true ELSE false END as participated_today,
        CASE WHEN dq.id IS NOT NULL THEN true ELSE false END as participated_current_round,
        dq.created_at as today_contribution_time
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      LEFT JOIN daily_quotes dq ON u.id = dq.user_id AND dq.quote_date = COALESCE($1::date, CURRENT_DATE)
      WHERE 1=1
    `;
    const params = [targetDate];

    if (teamId) {
      params.push(parseInt(teamId, 10));
      query += ` AND u.team_id = $${params.length}`;
    }
    if (branch) {
      params.push(branch);
      query += ` AND u.branch = $${params.length}`;
    }
    if (status === 'participated') {
      query += ' AND dq.id IS NOT NULL';
    } else if (status === 'not_participated') {
      query += ' AND dq.id IS NULL';
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.nickname ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.job_title ILIKE $${params.length})`;
    }

    const countQuery = `SELECT COUNT(*) FROM (${query}) as filtered_users`;
    const countRes = await db.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count, 10);

    query += ` ORDER BY u.team_id ASC, COALESCE(u.nickname, u.full_name) ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const res = await db.query(query, params);

    return {
      users: res.rows,
      currentRoundNumber: currentRoundNum,
      filterDate: targetDate,
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

  /**
   * PHÂN TÍCH CHUYÊN SÂU 3 CHIỀU (DEEP-DIVE ANALYTICS):
   * 1. Đóng góp cá nhân (Hall of Fame)
   * 2. Nội dung tri thức của cây (Lọc theo từng cây 1..8 hoặc toàn vườn)
   * 3. Sự phát triển của cây & So sánh 8 cây / 8 đội
   */
  static async getDeepDiveAnalytics({ teamId = null, period = 'all' } = {}) {
    const filterTeamId = teamId ? parseInt(teamId, 10) : null;

    // -------------------------------------------------------------
    // PHẦN 1: ĐÓNG GÓP CÁ NHÂN (CONTRIBUTOR INSIGHTS & HALL OF FAME)
    // -------------------------------------------------------------
    const [
      topExpRes,
      topWaterersRes,
      topSeedersRes,
      topQuoteWritersRes,
      topAppreciatedRes,
      topVisitorsRes
    ] = await Promise.all([
      // 1.1: Ai đóng góp nhiều điểm EXP nhất
      db.query(`
        SELECT u.id, COALESCE(u.nickname, u.full_name) as full_name, u.nickname, u.job_title, u.branch, u.team_id,
               t.name as team_name, t.display_name as team_display_name, t.color_code as team_color,
               u.total_exp_earned, u.contributed_books_count
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE ($1::INT IS NULL OR u.team_id = $1)
        ORDER BY u.total_exp_earned DESC, u.contributed_books_count DESC
        LIMIT 10
      `, [filterTeamId]),

      // 1.2: Ai là người tưới cây nhiều nhất (kèm chuỗi streak)
      db.query(`
        SELECT u.id, COALESCE(u.nickname, u.full_name) as full_name, u.nickname, u.job_title, u.team_id,
               t.name as team_name, t.display_name as team_display_name, t.color_code as team_color,
               COUNT(d.id)::INT as total_dews,
               COALESCE(MAX(d.streak), 1)::INT as max_streak,
               MAX(d.claim_date) as last_watered_date
        FROM daily_dews d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE ($1::INT IS NULL OR d.team_id = $1)
        GROUP BY u.id, u.full_name, u.nickname, u.job_title, u.team_id, t.name, t.display_name, t.color_code
        ORDER BY total_dews DESC, max_streak DESC
        LIMIT 10
      `, [filterTeamId]),

      // 1.3: Ai là người gieo mầm nhiều nhất
      db.query(`
        SELECT u.id, COALESCE(u.nickname, u.full_name) as full_name, u.nickname, u.job_title, u.team_id,
               t.name as team_name, t.display_name as team_display_name, t.color_code as team_color,
               COUNT(b.id)::INT as books_count,
               COALESCE(SUM(b.likes_count), 0)::INT as total_likes_received
        FROM books b
        JOIN users u ON b.user_id = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE b.visibility_status = 'visible' AND ($1::INT IS NULL OR b.team_id = $1)
        GROUP BY u.id, u.full_name, u.nickname, u.job_title, u.team_id, t.name, t.display_name, t.color_code
        ORDER BY books_count DESC, total_likes_received DESC
        LIMIT 10
      `, [filterTeamId]),

      // 1.4: Ai viết nhiều câu trích dẫn & có độ sâu nội dung nhất
      db.query(`
        SELECT u.id, u.full_name, u.job_title, u.team_id,
               t.name as team_name, t.color_code as team_color,
               COUNT(b.id)::INT as quotes_count,
               COALESCE(AVG(LENGTH(b.quote)), 0)::INT as avg_quote_length,
               COALESCE(SUM(b.likes_count), 0)::INT as total_likes
        FROM books b
        JOIN users u ON b.user_id = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE b.visibility_status = 'visible' AND ($1::INT IS NULL OR b.team_id = $1)
        GROUP BY u.id, u.full_name, u.job_title, u.team_id, t.name, t.color_code
        ORDER BY quotes_count DESC, total_likes DESC
        LIMIT 10
      `, [filterTeamId]),

      // 1.5: Ai được nhiều người cảm ơn / ghi nhận (nhiều like nhất)
      db.query(`
        SELECT u.id, u.full_name, u.job_title, u.team_id,
               t.name as team_name, t.display_name as team_display_name, t.color_code as team_color,
               COALESCE(SUM(b.likes_count), 0)::INT as total_likes_received,
               COUNT(b.id)::INT as books_count
        FROM books b
        JOIN users u ON b.user_id = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE b.visibility_status = 'visible' AND ($1::INT IS NULL OR b.team_id = $1)
        GROUP BY u.id, u.full_name, u.job_title, u.team_id, t.name, t.display_name, t.color_code
        HAVING COALESCE(SUM(b.likes_count), 0) > 0
        ORDER BY total_likes_received DESC, books_count DESC
        LIMIT 10
      `, [filterTeamId]),

      // 1.6: Ai là người truy cập cây nhiều nhất
      db.query(`
        SELECT sv.id, sv.user_fingerprint, sv.visit_count, sv.first_visited_at, sv.last_visited_at,
               COALESCE(u.nickname, u.full_name, 'Bút Danh Thân Thiết') as user_name,
               t.name as team_name, t.color_code as team_color
        FROM site_visitors sv
        LEFT JOIN users u ON sv.user_fingerprint LIKE '%' || SUBSTRING(u.id::text, 1, 8) || '%'
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE ($1::INT IS NULL OR t.id = $1)
        ORDER BY sv.visit_count DESC, sv.last_visited_at DESC
        LIMIT 10
      `, [filterTeamId])
    ]);

    // -------------------------------------------------------------
    // PHẦN 2: PHÂN TÍCH NỘI DUNG TRI THỨC (CONTENT & KNOWLEDGE)
    // -------------------------------------------------------------
    const [
      topBooksRes,
      topCategoriesRes,
      topQuotesRes,
      topInteractorsRes
    ] = await Promise.all([
      // 2.1: Cuốn sách nào được trích dẫn nhiều nhất
      db.query(`
        SELECT b.title, b.author,
               COALESCE(t.display_name, t.name, 'Đội ' || b.team_id, 'Toàn Vườn') as team_display_name,
               t.color_code as team_color,
               COUNT(b.id)::INT as quote_count,
               COALESCE(SUM(b.likes_count), 0)::INT as total_likes,
               MAX(b.created_at) as latest_shared_at
        FROM books b
        LEFT JOIN teams t ON b.team_id = t.id
        WHERE b.visibility_status = 'visible' AND ($1::INT IS NULL OR b.team_id = $1)
        GROUP BY b.title, b.author, t.display_name, t.name, b.team_id, t.color_code
        ORDER BY quote_count DESC, total_likes DESC
        LIMIT 10
      `, [filterTeamId]),

      // 2.2: Tỷ trọng đóng góp tri thức của 8 Đội thi đua (Không phân loại sách)
      db.query(`
        SELECT t.id as team_id,
               t.name as team_name,
               t.display_name as category,
               t.display_name as team_display_name,
               t.color_code as team_color,
               COUNT(b.id)::INT as book_count,
               COALESCE(SUM(b.likes_count), 0)::INT as total_likes,
               ROUND(
                 (COUNT(b.id)::numeric / NULLIF((SELECT COUNT(*) FROM books WHERE visibility_status = 'visible' AND ($1::INT IS NULL OR team_id = $1)), 0)) * 100, 
                 1
               )::FLOAT as percentage
        FROM teams t
        LEFT JOIN books b ON t.id = b.team_id AND b.visibility_status = 'visible'
        WHERE ($1::INT IS NULL OR t.id = $1)
        GROUP BY t.id, t.name, t.display_name, t.color_code
        ORDER BY book_count DESC, t.id ASC
      `, [filterTeamId]),

      // 2.3: Những câu cốt được nhiều thành viên tương tác nhất
      db.query(`
        SELECT b.id, b.title, b.author, b.quote, b.likes_count, b.created_at,
               u.id as user_id, COALESCE(u.nickname, u.full_name) as reader_name, u.nickname,
               t.id as team_id, t.name as team_name, t.display_name as team_display_name, t.color_code as team_color
        FROM books b
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN teams t ON b.team_id = t.id
        WHERE b.visibility_status = 'visible' AND ($1::INT IS NULL OR b.team_id = $1)
        ORDER BY b.likes_count DESC, b.created_at DESC
        LIMIT 10
      `, [filterTeamId]),

      // 2.4: Thành viên tích cực tương tác / thả tim
      db.query(`
        SELECT ql.user_fingerprint,
               COUNT(ql.id)::INT as likes_given,
               MAX(ql.created_at) as last_liked_at,
               u.id as user_id, u.full_name as user_name,
               t.name as team_name, t.color_code as team_color
        FROM quote_likes ql
        LEFT JOIN users u ON ql.user_fingerprint LIKE '%' || SUBSTRING(u.id::text, 1, 8) || '%'
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE ($1::INT IS NULL OR t.id = $1)
        GROUP BY ql.user_fingerprint, u.id, u.full_name, t.name, t.color_code
        ORDER BY likes_given DESC
        LIMIT 10
      `, [filterTeamId])
    ]);

    // -------------------------------------------------------------
    // PHẦN 3: SỰ PHÁT TRIỂN CỦA CÂY & SO SÁNH 8 CÂY (TREE GROWTH)
    // -------------------------------------------------------------
    const [
      treesComparisonRes,
      activityBreakdownRes,
      teamMvpsRes
    ] = await Promise.all([
      // 3.1: So sánh tổng hợp 8 cây (Tốc độ bứt phá, Lượt tưới, Sách, EXP, Level)
      db.query(`
        SELECT t.id, t.code, t.name, t.display_name, t.color_code, t.icon, t.slogan,
               t.actual_members, t.target_members,
               COALESCE(t.total_exp, 0)::BIGINT as total_exp,
               COALESCE(t.tree_exp, 0)::BIGINT as tree_exp,
               COALESCE(t.level, 0)::INT as level,
               COALESCE(t.tree_level, 0)::INT as tree_level,
               COALESCE(t.tree_seeds, 0)::INT as tree_seeds,
               COALESCE(t.avg_participation_rate, 0)::FLOAT as avg_participation_rate,
               (SELECT COUNT(*)::INT FROM daily_dews d WHERE d.team_id = t.id) as total_dews,
               (SELECT COUNT(*)::INT FROM books b WHERE b.team_id = t.id AND b.visibility_status = 'visible') as total_books,
               (SELECT COUNT(*)::INT FROM quote_likes ql JOIN books b ON ql.book_id = b.id WHERE b.team_id = t.id) as total_likes,
               COALESCE((
                 SELECT SUM(amount)::INT FROM exp_ledger el 
                 WHERE el.team_id = t.id AND el.created_at >= NOW() - INTERVAL '24 hours'
               ), 0) as velocity_24h,
               COALESCE((
                 SELECT SUM(amount)::INT FROM exp_ledger el 
                 WHERE el.team_id = t.id AND el.created_at >= NOW() - INTERVAL '7 days'
               ), 0) as velocity_7d
        FROM teams t
        ORDER BY t.total_exp DESC, t.id ASC
      `),

      // 3.2: Tỷ trọng các hoạt động nuôi dưỡng cây (Activity EXP Contribution)
      db.query(`
        SELECT el.type,
               COUNT(*)::INT as transaction_count,
               COALESCE(SUM(el.amount), 0)::BIGINT as total_exp,
               ROUND(
                 (SUM(el.amount)::numeric / NULLIF((SELECT SUM(amount) FROM exp_ledger WHERE ($1::INT IS NULL OR team_id = $1)), 0)) * 100, 
                 1
               )::FLOAT as percentage
        FROM exp_ledger el
        WHERE ($1::INT IS NULL OR el.team_id = $1)
        GROUP BY el.type
        ORDER BY total_exp DESC
      `, [filterTeamId]),

      // 3.3: Gương mặt tiêu biểu số 1 (MVP) của từng đội trong 8 đội
      db.query(`
        SELECT DISTINCT ON (u.team_id)
               u.id, COALESCE(u.nickname, u.full_name) as full_name, u.nickname, u.job_title, u.avatar_url,
               u.contributed_books_count, u.total_exp_earned,
               t.id as team_id, t.name as team_name, t.display_name as team_display_name, 
               t.color_code as team_color, t.icon as team_icon
        FROM users u
        JOIN teams t ON u.team_id = t.id
        ORDER BY u.team_id ASC, u.total_exp_earned DESC, u.contributed_books_count DESC
      `)
    ]);

    // Format 8 Trees Comparison with stage names & interaction scores
    const formattedTrees = treesComparisonRes.rows.map((t, idx) => {
      const exp = parseInt(t.total_exp || t.tree_exp || 0, 10);
      const levelInfo = calculateLevelFromExp(exp);
      const interactionScore = t.total_dews + t.total_books + t.total_likes;

      return {
        ...t,
        rank: idx + 1,
        levelName: levelInfo.name,
        progressPercent: levelInfo.progressPercent,
        interactionScore
      };
    });

    return {
      filterTeamId,
      period,
      contributors: {
        topExp: topExpRes.rows,
        topWaterers: topWaterersRes.rows,
        topSeeders: topSeedersRes.rows,
        topQuoteWriters: topQuoteWritersRes.rows,
        topAppreciated: topAppreciatedRes.rows,
        topVisitors: topVisitorsRes.rows
      },
      content: {
        topBooks: topBooksRes.rows,
        topCategories: topCategoriesRes.rows,
        topQuotes: topQuotesRes.rows,
        topInteractors: topInteractorsRes.rows
      },
      growth: {
        treesComparison: formattedTrees,
        activityBreakdown: activityBreakdownRes.rows,
        teamMvps: teamMvpsRes.rows
      }
    };
  }

  /**
   * Xuất toàn bộ dữ liệu lịch sử thi đấu của 8 Đội cho tất cả các ngày
   */
  static async getTeamsAllDaysExport() {
    // 1. Get all distinct dates from daily_quotes, daily_dews, books
    const datesRes = await db.query(`
      SELECT DISTINCT d::text as date_str
      FROM (
        SELECT quote_date as d FROM daily_quotes
        UNION
        SELECT claim_date as d FROM daily_dews
        UNION
        SELECT DATE(created_at) as d FROM books WHERE created_at IS NOT NULL
      ) all_dates
      ORDER BY date_str ASC
    `);

    let dates = datesRes.rows.map(r => {
      if (r.date_str instanceof Date) {
        return r.date_str.toISOString().slice(0, 10);
      }
      return String(r.date_str).slice(0, 10);
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    if (!dates.includes(todayStr)) {
      dates.push(todayStr);
      dates.sort();
    }

    // 2. Query 8 Teams overall summary
    const teamsRes = await db.query(`
      SELECT 
        t.id, t.code, t.name, t.display_name, t.color_code,
        t.target_members, t.actual_members,
        t.tree_exp, t.tree_level, t.tree_seeds,
        t.avg_participation_rate,
        (SELECT COUNT(*) FROM books b WHERE b.team_id = t.id) as books_count,
        (SELECT COUNT(*) FROM daily_dews d WHERE d.team_id = t.id) as dews_count
      FROM teams t
      ORDER BY t.tree_exp DESC, t.id ASC
    `);

    const levelNames = ['Ủ Mầm (Hạt)', 'Cây Nảy Mầm', 'Cây Con', 'Cây Phát Triển', 'Cây Cổ Thụ', 'Đại Cổ Thụ'];

    const teamsSummary = teamsRes.rows.map((t, idx) => ({
      ...t,
      rank: idx + 1,
      levelName: levelNames[t.tree_level] || 'Ủ Mầm',
      books_count: parseInt(t.books_count || 0, 10),
      dews_count: parseInt(t.dews_count || 0, 10),
      tree_exp: parseInt(t.tree_exp || 0, 10),
      tree_seeds: parseInt(t.tree_seeds || 0, 10),
      actual_members: parseInt(t.actual_members || 0, 10),
      target_members: parseInt(t.target_members || 40, 10),
      avg_participation_rate: parseFloat(t.avg_participation_rate || 0).toFixed(1)
    }));

    // 3. For each date, query stats for each team
    const dailyQuotesRes = await db.query(`
      SELECT 
        quote_date::text as date_str,
        team_id,
        COUNT(DISTINCT user_id) as participants_count
      FROM daily_quotes
      GROUP BY quote_date, team_id
    `);

    const dailyBooksRes = await db.query(`
      SELECT 
        DATE(created_at)::text as date_str,
        team_id,
        COUNT(*) as books_count
      FROM books
      WHERE team_id IS NOT NULL
      GROUP BY DATE(created_at), team_id
    `);

    const dailyDewsRes = await db.query(`
      SELECT 
        claim_date::text as date_str,
        team_id,
        COUNT(*) as dews_count
      FROM daily_dews
      WHERE team_id IS NOT NULL
      GROUP BY claim_date, team_id
    `);

    const parseKey = (dateVal, teamId) => {
      const d = (dateVal instanceof Date) ? dateVal.toISOString().slice(0, 10) : String(dateVal).slice(0, 10);
      return `${d}_${teamId}`;
    };

    const quotesMap = new Map();
    dailyQuotesRes.rows.forEach(r => quotesMap.set(parseKey(r.date_str, r.team_id), parseInt(r.participants_count || 0, 10)));

    const booksMap = new Map();
    dailyBooksRes.rows.forEach(r => booksMap.set(parseKey(r.date_str, r.team_id), parseInt(r.books_count || 0, 10)));

    const dewsMap = new Map();
    dailyDewsRes.rows.forEach(r => dewsMap.set(parseKey(r.date_str, r.team_id), parseInt(r.dews_count || 0, 10)));

    const dailyHistory = [];
    const reversedDates = [...dates].reverse(); // newest date first

    for (const d of reversedDates) {
      for (const team of teamsSummary) {
        const key = `${d}_${team.id}`;
        const participants = quotesMap.get(key) || 0;
        const target = team.target_members || 40;
        const rate = target > 0 ? parseFloat(((participants / target) * 100).toFixed(1)) : 0;
        const books = booksMap.get(key) || 0;
        const dews = dewsMap.get(key) || 0;

        dailyHistory.push({
          date: d,
          team_id: team.id,
          team_code: team.code,
          team_name: team.display_name || team.name,
          level_name: team.levelName,
          rank: team.rank,
          tree_exp: team.tree_exp,
          tree_seeds: team.tree_seeds,
          actual_members: team.actual_members,
          target_members: target,
          participants_count: participants,
          participation_rate: rate,
          books_count: books,
          dews_count: dews
        });
      }
    }

    return {
      dates,
      teams_summary: teamsSummary,
      daily_history: dailyHistory
    };
  }

  /**
   * Xuất toàn bộ danh sách 288 nhân sự kèm lịch sử chuyên cần tất cả các ngày
   */
  static async getUsersAllDaysExport() {
    // 1. Get all distinct active dates
    const datesRes = await db.query(`
      SELECT DISTINCT quote_date::text as date_str
      FROM daily_quotes
      ORDER BY date_str ASC
    `);

    let dates = datesRes.rows.map(r => {
      if (r.date_str instanceof Date) {
        return r.date_str.toISOString().slice(0, 10);
      }
      return String(r.date_str).slice(0, 10);
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    if (!dates.includes(todayStr)) {
      dates.push(todayStr);
      dates.sort();
    }

    // 2. Query all users
    const usersRes = await db.query(`
      SELECT 
        u.id, u.nickname, u.full_name, u.gender,
        u.branch, u.parent_department, u.child_department_1, u.job_title,
        u.team_id, u.role, u.contributed_books_count, u.total_exp_earned,
        t.display_name as team_display_name, t.code as team_code
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      ORDER BY u.team_id ASC, COALESCE(u.nickname, u.full_name) ASC
    `);

    // 3. Query all quotes per user with book title
    const quotesRes = await db.query(`
      SELECT 
        dq.user_id,
        dq.quote_date::text as date_str,
        dq.book_id,
        b.title as book_title,
        b.author as book_author,
        dq.created_at
      FROM daily_quotes dq
      LEFT JOIN books b ON dq.book_id = b.id
      ORDER BY dq.quote_date ASC
    `);

    // 4. Query watering count per user
    const dewsRes = await db.query(`
      SELECT user_id, COUNT(*)::int as total_dews
      FROM daily_dews
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    `);
    const userDewsMap = new Map();
    dewsRes.rows.forEach(r => userDewsMap.set(r.user_id, r.total_dews));

    // Build user quotes mapping
    const userQuotesMap = new Map();
    quotesRes.rows.forEach(r => {
      const d = (r.date_str instanceof Date) ? r.date_str.toISOString().slice(0, 10) : String(r.date_str).slice(0, 10);
      if (!userQuotesMap.has(r.user_id)) {
        userQuotesMap.set(r.user_id, new Map());
      }
      userQuotesMap.get(r.user_id).set(d, {
        book_title: r.book_title || '',
        book_author: r.book_author || '',
        created_at: r.created_at
      });
    });

    const totalCampaignDays = dates.length || 1;

    const users = usersRes.rows.map(u => {
      const qMap = userQuotesMap.get(u.id) || new Map();
      const participatedDaysCount = qMap.size;
      const attendanceRate = parseFloat(((participatedDaysCount / totalCampaignDays) * 100).toFixed(1));

      // Calculate latest date
      let latestQuoteDate = null;
      for (let i = dates.length - 1; i >= 0; i--) {
        if (qMap.has(dates[i])) {
          latestQuoteDate = dates[i];
          break;
        }
      }

      // Build day-by-day status
      const dailyStatus = {};
      dates.forEach(d => {
        const quote = qMap.get(d);
        if (quote) {
          dailyStatus[d] = {
            participated: true,
            book_title: quote.book_title,
            book_author: quote.book_author
          };
        } else {
          dailyStatus[d] = {
            participated: false
          };
        }
      });

      return {
        id: u.id,
        nickname: u.nickname || '',
        full_name: u.full_name || '',
        branch: u.branch || '',
        parent_department: u.parent_department || '',
        job_title: u.job_title || '',
        team_id: u.team_id,
        team_code: u.team_code || `TEAM_${u.team_id}`,
        team_name: u.team_display_name || `Đội ${u.team_id}`,
        contributed_books_count: parseInt(u.contributed_books_count || 0, 10),
        total_exp_earned: parseInt(u.total_exp_earned || 0, 10),
        total_dews_count: userDewsMap.get(u.id) || 0,
        total_days_participated: participatedDaysCount,
        attendance_rate: attendanceRate,
        latest_quote_date: latestQuoteDate,
        daily_status: dailyStatus
      };
    });

    return {
      dates,
      total_days: totalCampaignDays,
      total_users: users.length,
      users
    };
  }
}

export default AnalyticsService;

