import db from '../config/database.js';
import socketService from './socket.service.js';
import { DEFAULT_WELCOME_SETTINGS, DEFAULT_RULES_SETTINGS } from '../scripts/migrate_settings.js';

export class SettingsService {
  /**
   * Lấy cấu hình công khai cho Frontend
   */
  static async getPublicSettings() {
    const res = await db.query(`
      SELECT key, value FROM system_settings 
      WHERE key IN ('welcome_content', 'rules_content')
    `);

    const settingsMap = new Map(res.rows.map(r => [r.key, r.value]));

    const welcome = settingsMap.get('welcome_content') || DEFAULT_WELCOME_SETTINGS;
    const rules = settingsMap.get('rules_content') || DEFAULT_RULES_SETTINGS;

    return {
      welcome,
      rules,
      welcome_content: welcome,
      rules_content: rules
    };
  }

  /**
   * Cập nhật cấu hình bởi Quản trị viên
   */
  static async updateSetting(key, value, adminUser, ip = '') {
    if (!['welcome_content', 'rules_content'].includes(key)) {
      throw new Error('Khóa cấu hình không hợp lệ');
    }

    const candidateAdminId = (adminUser?.id && /^[0-9a-fA-F-]{36}$/.test(String(adminUser.id))) ? adminUser.id : null;

    const result = await db.transaction(async (client) => {
      let adminId = null;
      if (candidateAdminId) {
        const check = await client.query('SELECT id FROM admin_users WHERE id = $1', [candidateAdminId]);
        if (check.rows.length > 0) {
          adminId = candidateAdminId;
        }
      }

      // Upsert
      const upsertRes = await client.query(`
        INSERT INTO system_settings (key, value, updated_by, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `, [key, JSON.stringify(value), adminId]);

      // Audit log
      await client.query(`
        INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata, ip_address)
        VALUES ($1, 'UPDATE_CONTENT_SETTING', 'system_settings', NULL, $2, $3)
      `, [
        adminId,
        JSON.stringify({ key, fieldKeys: Object.keys(value) }),
        ip
      ]);

      return upsertRes.rows[0].value;
    });

    // Realtime broadcast to all connected clients
    try {
      const io = socketService.getIO();
      if (io) {
        io.emit('content:updated', { key, value: result });
      }
    } catch (e) {
      console.warn('Socket broadcast warning:', e.message);
    }

    return result;
  }

  /**
   * Khôi phục về cấu hình mặc định ban đầu
   */
  static async resetSetting(key, adminUser, ip = '') {
    let defaultValue;
    if (key === 'welcome_content') {
      defaultValue = DEFAULT_WELCOME_SETTINGS;
    } else if (key === 'rules_content') {
      defaultValue = DEFAULT_RULES_SETTINGS;
    } else {
      throw new Error('Khóa cấu hình không hợp lệ');
    }

    return await this.updateSetting(key, defaultValue, adminUser, ip);
  }
}

export default SettingsService;
