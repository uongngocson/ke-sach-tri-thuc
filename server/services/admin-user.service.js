import db from '../config/database.js';
import bcrypt from 'bcryptjs';

export class AdminUserService {
  /**
   * Lấy danh sách tất cả tài khoản admin / điều phối viên kèm bộ lọc
   */
  static async getAllAdminUsers({ search = '', role = '', status = '' } = {}) {
    let query = `
      SELECT id, username, full_name, role, is_active, created_at, updated_at 
      FROM admin_users 
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (username ILIKE $${params.length} OR full_name ILIKE $${params.length})`;
    }

    if (role && ['admin', 'moderator', 'reader'].includes(role)) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }

    if (status === 'active') {
      query += ` AND is_active = true`;
    } else if (status === 'inactive') {
      query += ` AND is_active = false`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Thống kê số lượng tài khoản theo vai trò và trạng thái
   */
  static async getAdminAccountStats() {
    const statsRes = await db.query(`
      SELECT 
        COUNT(*)::INT as total,
        COUNT(CASE WHEN role = 'admin' THEN 1 END)::INT as admins,
        COUNT(CASE WHEN role = 'moderator' THEN 1 END)::INT as moderators,
        COUNT(CASE WHEN role = 'reader' THEN 1 END)::INT as readers,
        COUNT(CASE WHEN is_active = true THEN 1 END)::INT as active,
        COUNT(CASE WHEN is_active = false THEN 1 END)::INT as inactive
      FROM admin_users
    `);
    return statsRes.rows[0];
  }

  /**
   * Lấy chi tiết 1 tài khoản quản trị theo ID
   */
  static async getAdminUserById(id) {
    const res = await db.query(
      'SELECT id, username, full_name, role, is_active, created_at, updated_at FROM admin_users WHERE id = $1',
      [id]
    );
    if (res.rows.length === 0) {
      const err = new Error('Tài khoản quản trị viên không tồn tại.');
      err.statusCode = 404;
      err.code = 'ADMIN_NOT_FOUND';
      throw err;
    }
    return res.rows[0];
  }

  /**
   * Tạo mới tài khoản quản trị viên / điều phối viên
   */
  static async createAdminUser({ username, password, full_name, role = 'moderator', is_active = true }, actorAdmin, ipAddress = null) {
    // 1. Kiểm tra username đã tồn tại chưa (case-insensitive)
    const existing = await db.query(
      'SELECT id FROM admin_users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );
    if (existing.rows.length > 0) {
      const err = new Error(`Tên đăng nhập "${username}" đã tồn tại. Vui lòng chọn tên khác.`);
      err.statusCode = 409;
      err.code = 'USERNAME_ALREADY_EXISTS';
      throw err;
    }

    // 2. Mã hóa mật khẩu
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 3. Thêm vào CSDL
    const insertRes = await db.query(`
      INSERT INTO admin_users (username, password_hash, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, full_name, role, is_active, created_at, updated_at
    `, [username.trim(), passwordHash, full_name.trim(), role, is_active]);

    const newAdmin = insertRes.rows[0];

    // 4. Ghi nhật ký kiểm toán (Audit Log)
    try {
      await db.query(`
        INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata, ip_address)
        VALUES ($1, 'CREATE_ADMIN_USER', 'admin_users', $2, $3, $4)
      `, [
        actorAdmin ? actorAdmin.id : null,
        newAdmin.id,
        JSON.stringify({
          created_username: newAdmin.username,
          created_full_name: newAdmin.full_name,
          role: newAdmin.role,
          is_active: newAdmin.is_active
        }),
        ipAddress
      ]);
    } catch (logErr) {
      console.warn('Audit log write warning on CREATE_ADMIN_USER:', logErr.message);
    }

    return newAdmin;
  }

  /**
   * Cập nhật thông tin tài khoản quản trị viên
   */
  static async updateAdminUser(id, { full_name, role, is_active, password }, actorAdmin, ipAddress = null) {
    // 1. Kiểm tra tài khoản tồn tại
    const existingRes = await db.query('SELECT * FROM admin_users WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      const err = new Error('Tài khoản quản trị viên không tồn tại.');
      err.statusCode = 404;
      err.code = 'ADMIN_NOT_FOUND';
      throw err;
    }
    const existing = existingRes.rows[0];

    // 2. Bảo vệ an toàn cho chính tài khoản đang đăng nhập (Self-protection)
    if (actorAdmin && actorAdmin.id === id) {
      if (is_active === false) {
        const err = new Error('Bạn không thể tự khóa tài khoản của chính mình!');
        err.statusCode = 400;
        err.code = 'SELF_DEACTIVATE_FORBIDDEN';
        throw err;
      }
      if (role && role !== 'admin') {
        const err = new Error('Bạn không thể tự hạ quyền quản trị viên của chính mình!');
        err.statusCode = 400;
        err.code = 'SELF_DEMOTE_FORBIDDEN';
        throw err;
      }
    }

    // 3. Xây dựng câu lệnh cập nhật động
    const updates = [];
    const params = [];
    const changes = {};

    if (full_name !== undefined && full_name.trim() !== '') {
      params.push(full_name.trim());
      updates.push(`full_name = $${params.length}`);
      changes.full_name = { from: existing.full_name, to: full_name.trim() };
    }

    if (role !== undefined && ['admin', 'moderator', 'reader'].includes(role)) {
      params.push(role);
      updates.push(`role = $${params.length}`);
      changes.role = { from: existing.role, to: role };
    }

    if (is_active !== undefined) {
      params.push(Boolean(is_active));
      updates.push(`is_active = $${params.length}`);
      changes.is_active = { from: existing.is_active, to: Boolean(is_active) };
    }

    if (password && password.trim().length >= 6) {
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
      const passwordHash = await bcrypt.hash(password.trim(), saltRounds);
      params.push(passwordHash);
      updates.push(`password_hash = $${params.length}`);
      changes.password_changed = true;
    }

    if (updates.length === 0) {
      return {
        id: existing.id,
        username: existing.username,
        full_name: existing.full_name,
        role: existing.role,
        is_active: existing.is_active,
        created_at: existing.created_at,
        updated_at: existing.updated_at
      };
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const updateQuery = `
      UPDATE admin_users 
      SET ${updates.join(', ')} 
      WHERE id = $${params.length}
      RETURNING id, username, full_name, role, is_active, created_at, updated_at
    `;

    const updateRes = await db.query(updateQuery, params);
    const updatedUser = updateRes.rows[0];

    // 4. Ghi audit log
    try {
      await db.query(`
        INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata, ip_address)
        VALUES ($1, 'UPDATE_ADMIN_USER', 'admin_users', $2, $3, $4)
      `, [
        actorAdmin ? actorAdmin.id : null,
        id,
        JSON.stringify({
          username: existing.username,
          changes
        }),
        ipAddress
      ]);
    } catch (logErr) {
      console.warn('Audit log write warning on UPDATE_ADMIN_USER:', logErr.message);
    }

    return updatedUser;
  }

  /**
   * Xóa tài khoản quản trị viên an toàn
   */
  static async deleteAdminUser(id, actorAdmin, ipAddress = null) {
    // 1. Kiểm tra tài khoản tồn tại
    const existingRes = await db.query('SELECT id, username, full_name, role FROM admin_users WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      const err = new Error('Tài khoản quản trị viên không tồn tại.');
      err.statusCode = 404;
      err.code = 'ADMIN_NOT_FOUND';
      throw err;
    }
    const existing = existingRes.rows[0];

    // 2. Chặn admin tự xóa chính mình
    if (actorAdmin && actorAdmin.id === id) {
      const err = new Error('Bạn không thể tự xóa tài khoản của chính mình!');
      err.statusCode = 400;
      err.code = 'SELF_DELETE_FORBIDDEN';
      throw err;
    }

    // 3. Chặn xóa admin cuối cùng
    if (existing.role === 'admin') {
      const otherAdminsRes = await db.query(
        "SELECT COUNT(*)::INT as count FROM admin_users WHERE role = 'admin' AND id != $1 AND is_active = true",
        [id]
      );
      if (otherAdminsRes.rows[0].count === 0) {
        const err = new Error('Không thể xóa Quản trị viên (Superadmin) duy nhất đang hoạt động!');
        err.statusCode = 400;
        err.code = 'LAST_ADMIN_CANNOT_BE_DELETED';
        throw err;
      }
    }

    // 4. Thực hiện xóa (foreign keys đã có ON DELETE SET NULL)
    await db.query('DELETE FROM admin_users WHERE id = $1', [id]);

    // 5. Ghi nhật ký kiểm toán
    try {
      await db.query(`
        INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata, ip_address)
        VALUES ($1, 'DELETE_ADMIN_USER', 'admin_users', $2, $3, $4)
      `, [
        actorAdmin ? actorAdmin.id : null,
        id,
        JSON.stringify({
          deleted_username: existing.username,
          deleted_full_name: existing.full_name,
          deleted_role: existing.role
        }),
        ipAddress
      ]);
    } catch (logErr) {
      console.warn('Audit log write warning on DELETE_ADMIN_USER:', logErr.message);
    }

    return {
      deleted: true,
      user: existing
    };
  }
}

export default AdminUserService;
