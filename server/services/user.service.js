import db from '../config/database.js';

export class UserService {
  /**
   * Search and filter users
   */
  static async getUsers({ keyword = '', teamId = null, branch = null, limit = 50, offset = 0 } = {}) {
    let whereClauses = [];
    let values = [];

    if (teamId) {
      values.push(parseInt(teamId, 10));
      whereClauses.push(`u.team_id = $${values.length}`);
    }

    if (branch) {
      values.push(branch.trim());
      whereClauses.push(`u.branch ILIKE $${values.length}`);
    }

    if (keyword && keyword.trim()) {
      values.push(`%${keyword.trim()}%`);
      whereClauses.push(`(
        u.nickname ILIKE $${values.length} OR
        u.full_name ILIKE $${values.length} OR 
        u.email ILIKE $${values.length} OR 
        u.employee_code ILIKE $${values.length} OR
        u.job_title ILIKE $${values.length} OR
        u.parent_department ILIKE $${values.length}
      )`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await db.query(`
      SELECT COUNT(*) FROM users u ${whereStr}
    `, values);
    const total = parseInt(countRes.rows[0].count, 10);

    values.push(limit);
    const limitIdx = values.length;
    values.push(offset);
    const offsetIdx = values.length;

    const dataRes = await db.query(`
      SELECT 
        u.id,
        u.employee_code,
        u.email,
        u.full_name,
        u.nickname,
        u.gender,
        u.branch,
        u.parent_department,
        u.child_department_1,
        u.child_department_2,
        u.officer_code,
        u.job_title,
        u.team_id,
        t.display_name as team_display_name,
        t.name as team_name,
        t.code as team_code,
        t.color_code as team_color,
        u.role,
        u.avatar_url,
        u.contributed_books_count,
        u.total_exp_earned,
        u.created_at
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      ${whereStr}
      ORDER BY u.team_id ASC, COALESCE(u.nickname, u.full_name) ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, values);

    return {
      total,
      limit,
      offset,
      users: dataRes.rows
    };
  }

  /**
   * Fast autocomplete suggestions for Nickname / Email / Employee Code input
   */
  static async suggestUsers(keyword = '', limit = 8) {
    if (!keyword || !keyword.trim()) return [];
    const term = `%${keyword.trim()}%`;
    const prefixTerm = `${keyword.trim()}%`;

    try {
      const res = await db.query(`
        SELECT 
          u.id, u.employee_code, u.nickname, u.email, u.gender,
          u.branch, u.parent_department, u.officer_code, u.job_title,
          u.team_id, t.display_name as team_display_name, t.color_code as team_color
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE unaccent(COALESCE(u.nickname, '')) ILIKE unaccent($1)
           OR unaccent(COALESCE(u.full_name, '')) ILIKE unaccent($1)
           OR u.employee_code ILIKE $1
           OR u.email ILIKE $1
        ORDER BY 
          CASE 
            WHEN unaccent(COALESCE(u.nickname, '')) ILIKE unaccent($2) THEN 1
            WHEN unaccent(COALESCE(u.full_name, '')) ILIKE unaccent($2) THEN 2
            ELSE 3 
          END ASC,
          COALESCE(u.nickname, u.full_name) ASC
        LIMIT $3
      `, [term, prefixTerm, limit]);
      return res.rows;
    } catch {
      const res = await db.query(`
        SELECT 
          u.id, u.employee_code, u.nickname, u.email, u.gender,
          u.branch, u.parent_department, u.officer_code, u.job_title,
          u.team_id, t.display_name as team_display_name, t.color_code as team_color
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.nickname ILIKE $1 OR u.employee_code ILIKE $1 OR u.email ILIKE $1 OR u.full_name ILIKE $1
        ORDER BY 
          CASE 
            WHEN u.nickname ILIKE $2 THEN 1
            WHEN u.full_name ILIKE $2 THEN 2
            ELSE 3 
          END ASC,
          COALESCE(u.nickname, u.full_name) ASC
        LIMIT $3
      `, [term, prefixTerm, limit]);
      return res.rows;
    }
  }

  /**
   * Find user by Nickname, Email, Username, or Employee Code (for book contribution & lookup)
   */
  static async lookupUser(query) {
    if (!query) return null;
    const cleanQuery = query.trim().toLowerCase();
    const queryWithDomain = cleanQuery.includes('@') ? cleanQuery : `${cleanQuery}@fpt.com`;
    const term = `%${query.trim()}%`;

    try {
      const res = await db.query(`
        SELECT 
          u.*,
          t.display_name as team_display_name,
          t.name as team_name,
          t.code as team_code,
          t.color_code as team_color
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE LOWER(u.nickname) = $1 
           OR LOWER(u.email) = $1 
           OR LOWER(u.email) = $2 
           OR u.employee_code = $3
           OR unaccent(LOWER(u.nickname)) = unaccent($1)
           OR u.nickname ILIKE $4
           OR unaccent(u.nickname) ILIKE unaccent($4)
        ORDER BY 
          CASE 
            WHEN LOWER(u.nickname) = $1 THEN 1
            WHEN unaccent(LOWER(u.nickname)) = unaccent($1) THEN 2
            WHEN u.employee_code = $3 THEN 3
            WHEN LOWER(u.email) = $1 OR LOWER(u.email) = $2 THEN 4
            ELSE 5 
          END ASC
        LIMIT 1
      `, [cleanQuery, queryWithDomain, query.trim(), term]);

      return res.rows[0] || null;
    } catch {
      const res = await db.query(`
        SELECT 
          u.*,
          t.display_name as team_display_name,
          t.name as team_name,
          t.code as team_code,
          t.color_code as team_color
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE LOWER(u.nickname) = $1 OR LOWER(u.email) = $1 OR LOWER(u.email) = $2 OR u.employee_code = $3 OR u.nickname ILIKE $4
        ORDER BY CASE WHEN LOWER(u.nickname) = $1 THEN 1 ELSE 2 END ASC
        LIMIT 1
      `, [cleanQuery, queryWithDomain, query.trim(), term]);

      return res.rows[0] || null;
    }
  }

  /**
   * Get User by ID
   */
  static async getUserById(userId) {
    const res = await db.query(`
      SELECT 
        u.*,
        t.display_name as team_display_name,
        t.name as team_name,
        t.code as team_code,
        t.color_code as team_color
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [userId]);

    return res.rows[0] || null;
  }

  /**
   * Chi tiết 1 nhân sự kèm số liệu hoạt động và đội thi đua
   */
  static async getPersonnelDetail(id) {
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const err = new Error('Nhân sự không tồn tại');
      err.statusCode = 404;
      err.code = 'PERSONNEL_NOT_FOUND';
      throw err;
    }

    const res = await db.query(`
      SELECT 
        u.id, u.employee_code, u.email, u.full_name, u.nickname, u.gender,
        u.branch, u.parent_department, u.child_department_1, u.child_department_2,
        u.officer_code, u.job_title, u.team_id, u.role, u.avatar_url,
        u.contributed_books_count, u.total_exp_earned, u.created_at, u.updated_at,
        t.display_name as team_display_name, t.name as team_name, t.code as team_code, t.color_code as team_color,
        (SELECT COUNT(*)::INT FROM daily_quotes dq WHERE dq.user_id = u.id) as total_quotes_count,
        (SELECT COUNT(*)::INT FROM daily_dews dd WHERE dd.user_id = u.id) as total_dews_count,
        (SELECT COUNT(*)::INT FROM round_contributions rc WHERE rc.user_id = u.id) as total_round_contributions_count,
        (
          SELECT COALESCE(json_agg(q), '[]'::json) FROM (
            SELECT dq.id, dq.quote_date, dq.created_at, b.title as book_title, b.author as book_author, b.quote as book_quote
            FROM daily_quotes dq
            LEFT JOIN books b ON dq.book_id = b.id
            WHERE dq.user_id = u.id
            ORDER BY dq.quote_date DESC, dq.created_at DESC
            LIMIT 5
          ) q
        ) as recent_quotes
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [id]);

    if (res.rows.length === 0) {
      const err = new Error('Nhân sự không tồn tại trong danh bạ');
      err.statusCode = 404;
      err.code = 'PERSONNEL_NOT_FOUND';
      throw err;
    }

    return res.rows[0];
  }

  /**
   * Thêm nhân sự mới vào danh bạ (Admin only)
   */
  static async createPersonnel(data, actorAdmin = null, ipAddress = null) {
    const nickname = data.nickname ? data.nickname.trim() : (data.full_name ? data.full_name.trim() : 'Độc giả Bút danh');
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const employeeCode = data.employee_code ? data.employee_code.trim() : `BD_${Date.now().toString().slice(-4)}${randomSuffix}`;
    const email = data.email ? data.email.trim().toLowerCase() : `butdanh_${Date.now().toString().slice(-4)}_${randomSuffix.toLowerCase()}@fpt.com`;
    const fullName = data.full_name ? data.full_name.trim() : nickname;
    const gender = data.gender ? data.gender.trim() : null;
    const branch = data.branch ? data.branch.trim() : null;
    const parentDepartment = data.parent_department ? data.parent_department.trim() : null;
    const childDepartment1 = data.child_department_1 ? data.child_department_1.trim() : null;
    const childDepartment2 = data.child_department_2 ? data.child_department_2.trim() : null;
    const officerCode = data.officer_code ? data.officer_code.trim() : null;
    const jobTitle = data.job_title ? data.job_title.trim() : null;
    const teamId = parseInt(data.team_id, 10);
    const role = data.role ? data.role.trim() : 'member';
    const avatarUrl = data.avatar_url ? data.avatar_url.trim() : null;

    // Kiểm tra trùng lặp employee_code hoặc email
    const dupCheck = await db.query(
      'SELECT id, employee_code, email FROM users WHERE LOWER(employee_code) = LOWER($1) OR LOWER(email) = LOWER($2)',
      [employeeCode, email]
    );

    if (dupCheck.rows.length > 0) {
      const conflict = dupCheck.rows[0];
      const isCodeConflict = conflict.employee_code.toLowerCase() === employeeCode.toLowerCase();
      const message = isCodeConflict 
        ? `Mã cán bộ "${employeeCode}" đã tồn tại trong hệ thống`
        : `Email "${email}" đã tồn tại trong hệ thống`;
      const err = new Error(message);
      err.statusCode = 409;
      err.code = 'PERSONNEL_ALREADY_EXISTS';
      throw err;
    }

    // Kiểm tra đội thi đua 1-8
    const teamRes = await db.query('SELECT id, name, display_name, color_code FROM teams WHERE id = $1', [teamId]);
    if (teamRes.rows.length === 0) {
      const err = new Error(`Đội thi đua #${teamId} không tồn tại`);
      err.statusCode = 400;
      err.code = 'INVALID_TEAM';
      throw err;
    }

    // Thêm nhân sự vào database
    const insertRes = await db.query(`
      INSERT INTO users (
        employee_code, email, full_name, nickname, gender,
        branch, parent_department, child_department_1, child_department_2,
        officer_code, job_title, team_id, role, avatar_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      employeeCode, email, fullName, nickname, gender,
      branch, parentDepartment, childDepartment1, childDepartment2,
      officerCode, jobTitle, teamId, role, avatarUrl
    ]);

    const newUser = insertRes.rows[0];

    // Cập nhật sĩ số đội thi đua
    await db.query(`
      UPDATE teams 
      SET actual_members = (SELECT COUNT(*) FROM users WHERE team_id = $1)
      WHERE id = $1
    `, [teamId]);

    // Ghi nhật ký kiểm toán (Audit Log)
    try {
      await db.query(`
        INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata, ip_address)
        VALUES ($1, 'CREATE_PERSONNEL', 'users', $2, $3, $4)
      `, [
        actorAdmin?.id || null,
        newUser.id,
        JSON.stringify({
          employee_code: newUser.employee_code,
          full_name: newUser.full_name,
          email: newUser.email,
          team_id: newUser.team_id,
          branch: newUser.branch
        }),
        ipAddress
      ]);
    } catch (logErr) {
      console.warn('Audit log write warning on CREATE_PERSONNEL:', logErr.message);
    }

    return {
      ...newUser,
      team_name: teamRes.rows[0].name,
      team_display_name: teamRes.rows[0].display_name,
      team_color: teamRes.rows[0].color_code
    };
  }

  /**
   * Cập nhật thông tin nhân sự (Admin only)
   */
  static async updatePersonnel(id, data, actorAdmin = null, ipAddress = null) {
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const err = new Error('Nhân sự không tồn tại');
      err.statusCode = 404;
      err.code = 'PERSONNEL_NOT_FOUND';
      throw err;
    }

    const existingRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      const err = new Error('Nhân sự không tồn tại');
      err.statusCode = 404;
      err.code = 'PERSONNEL_NOT_FOUND';
      throw err;
    }
    const existing = existingRes.rows[0];

    // Kiểm tra trùng lặp nếu có thay đổi employee_code hoặc email
    const newCode = data.employee_code ? data.employee_code.trim() : existing.employee_code;
    const newEmail = data.email ? data.email.trim().toLowerCase() : existing.email;

    if (newCode.toLowerCase() !== existing.employee_code.toLowerCase() || newEmail.toLowerCase() !== existing.email.toLowerCase()) {
      const dupCheck = await db.query(`
        SELECT id, employee_code, email FROM users 
        WHERE (LOWER(employee_code) = LOWER($1) OR LOWER(email) = LOWER($2)) AND id != $3
      `, [newCode, newEmail, id]);

      if (dupCheck.rows.length > 0) {
        const conflict = dupCheck.rows[0];
        const isCodeConflict = conflict.employee_code.toLowerCase() === newCode.toLowerCase();
        const message = isCodeConflict 
          ? `Mã cán bộ "${newCode}" đã được sử dụng bởi nhân sự khác`
          : `Email "${newEmail}" đã được sử dụng bởi nhân sự khác`;
        const err = new Error(message);
        err.statusCode = 409;
        err.code = 'PERSONNEL_ALREADY_EXISTS';
        throw err;
      }
    }

    const updates = [];
    const params = [];
    const changes = {};

    const fields = [
      { key: 'employee_code', val: data.employee_code ? data.employee_code.trim() : undefined },
      { key: 'email', val: data.email ? data.email.trim().toLowerCase() : undefined },
      { key: 'full_name', val: data.full_name ? data.full_name.trim() : (data.nickname ? data.nickname.trim() : undefined) },
      { key: 'nickname', val: data.nickname !== undefined ? (data.nickname ? data.nickname.trim() : null) : undefined },
      { key: 'gender', val: data.gender !== undefined ? (data.gender ? data.gender.trim() : null) : undefined },
      { key: 'branch', val: data.branch !== undefined ? (data.branch ? data.branch.trim() : null) : undefined },
      { key: 'parent_department', val: data.parent_department !== undefined ? (data.parent_department ? data.parent_department.trim() : null) : undefined },
      { key: 'child_department_1', val: data.child_department_1 !== undefined ? (data.child_department_1 ? data.child_department_1.trim() : null) : undefined },
      { key: 'child_department_2', val: data.child_department_2 !== undefined ? (data.child_department_2 ? data.child_department_2.trim() : null) : undefined },
      { key: 'officer_code', val: data.officer_code !== undefined ? (data.officer_code ? data.officer_code.trim() : null) : undefined },
      { key: 'job_title', val: data.job_title !== undefined ? (data.job_title ? data.job_title.trim() : null) : undefined },
      { key: 'team_id', val: data.team_id !== undefined ? parseInt(data.team_id, 10) : undefined },
      { key: 'role', val: data.role !== undefined ? data.role.trim() : undefined },
      { key: 'avatar_url', val: data.avatar_url !== undefined ? (data.avatar_url ? data.avatar_url.trim() : null) : undefined }
    ];

    for (const f of fields) {
      if (f.val !== undefined && f.val !== existing[f.key]) {
        params.push(f.val);
        updates.push(`${f.key} = $${params.length}`);
        changes[f.key] = { from: existing[f.key], to: f.val };
      }
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${params.length}
      RETURNING *
    `;

    const updateRes = await db.query(updateQuery, params);
    const updatedUser = updateRes.rows[0];

    // Cập nhật lại sĩ số các đội nếu đổi đội
    if (changes.team_id) {
      if (existing.team_id) {
        await db.query(
          'UPDATE teams SET actual_members = (SELECT COUNT(*) FROM users WHERE team_id = $1) WHERE id = $1',
          [existing.team_id]
        );
      }
      if (updatedUser.team_id) {
        await db.query(
          'UPDATE teams SET actual_members = (SELECT COUNT(*) FROM users WHERE team_id = $1) WHERE id = $1',
          [updatedUser.team_id]
        );
      }
    }

    // Ghi nhật ký kiểm toán
    try {
      await db.query(`
        INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata, ip_address)
        VALUES ($1, 'UPDATE_PERSONNEL', 'users', $2, $3, $4)
      `, [
        actorAdmin?.id || null,
        id,
        JSON.stringify({
          employee_code: updatedUser.employee_code,
          changes
        }),
        ipAddress
      ]);
    } catch (logErr) {
      console.warn('Audit log write warning on UPDATE_PERSONNEL:', logErr.message);
    }

    return updatedUser;
  }

  /**
   * Xóa nhân sự an toàn khỏi hệ thống (Admin only)
   */
  static async deletePersonnel(id, actorAdmin = null, ipAddress = null) {
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const err = new Error('Nhân sự không tồn tại');
      err.statusCode = 404;
      err.code = 'PERSONNEL_NOT_FOUND';
      throw err;
    }

    const existingRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      const err = new Error('Nhân sự không tồn tại');
      err.statusCode = 404;
      err.code = 'PERSONNEL_NOT_FOUND';
      throw err;
    }
    const existing = existingRes.rows[0];

    // Thực hiện xóa và bảo lưu liên kết trong transaction
    const deletedUser = await db.transaction(async (client) => {
      // 1. Xóa đóng góp chặng
      await client.query('DELETE FROM round_contributions WHERE user_id = $1', [id]);
      
      // 2. Xóa quote cá nhân
      await client.query('DELETE FROM daily_quotes WHERE user_id = $1', [id]);
      
      // 3. Đặt user_id thành NULL đối với books, exp_ledger, daily_dews
      await client.query('UPDATE books SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE exp_ledger SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE daily_dews SET user_id = NULL WHERE user_id = $1', [id]);

      // 4. Xóa bản ghi nhân sự
      const delRes = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

      // 5. Cập nhật lại sĩ số đội
      if (existing.team_id) {
        await client.query(
          'UPDATE teams SET actual_members = (SELECT COUNT(*) FROM users WHERE team_id = $1) WHERE id = $1',
          [existing.team_id]
        );
      }

      return delRes.rows[0];
    });

    // Ghi nhật ký kiểm toán
    try {
      await db.query(`
        INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata, ip_address)
        VALUES ($1, 'DELETE_PERSONNEL', 'users', $2, $3, $4)
      `, [
        actorAdmin?.id || null,
        id,
        JSON.stringify({
          employee_code: existing.employee_code,
          full_name: existing.full_name,
          email: existing.email,
          team_id: existing.team_id
        }),
        ipAddress
      ]);
    } catch (logErr) {
      console.warn('Audit log write warning on DELETE_PERSONNEL:', logErr.message);
    }

    return deletedUser;
  }
}
