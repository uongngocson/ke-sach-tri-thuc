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
      ORDER BY u.team_id ASC, u.full_name ASC
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
   * Find user by Email or Employee Code (for book contribution & lookup)
   */
  static async lookupUser(query) {
    if (!query) return null;
    const cleanQuery = query.trim().toLowerCase();

    const res = await db.query(`
      SELECT 
        u.*,
        t.display_name as team_display_name,
        t.name as team_name,
        t.code as team_code,
        t.color_code as team_color
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE LOWER(u.email) = $1 OR u.employee_code = $2
      LIMIT 1
    `, [cleanQuery, query.trim()]);

    return res.rows[0] || null;
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
}
