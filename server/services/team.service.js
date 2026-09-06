import db from '../config/database.js';
import { calculateLevelFromExp } from '../config/constants.js';

export class TeamService {
  /**
   * Get all 8 teams with current progress and tree stats
   */
  static async getAllTeams() {
    const result = await db.query(`
      SELECT 
        t.id,
        t.code,
        t.name,
        t.display_name,
        t.full_composition,
        t.target_members,
        t.actual_members,
        COALESCE(t.total_exp, 0) as total_exp,
        COALESCE(t.level, 0) as level,
        COALESCE(t.tree_seeds, 0) as tree_seeds,
        COALESCE(t.total_books, 0) as total_books,
        COALESCE(t.total_likes, 0) as total_likes,
        t.color_primary,
        t.color_secondary,
        t.leaf_color_hex,
        t.icon,
        t.slogan,
        t.color_code,
        (
          SELECT COUNT(*) 
          FROM books b 
          WHERE b.team_id = t.id AND b.visibility_status = 'visible'
        ) as approved_books_count
      FROM teams t
      ORDER BY t.id ASC
    `);

    return result.rows.map(team => {
      const levelInfo = calculateLevelFromExp(parseInt(team.total_exp, 10));
      return {
        ...team,
        total_exp: parseInt(team.total_exp, 10),
        level: levelInfo.level,
        level_name: levelInfo.name,
        level_progress: levelInfo.progressPercent,
        is_sprouted: parseInt(team.total_exp, 10) >= 50
      };
    });
  }

  /**
   * Get specific team details by ID
   */
  static async getTeamById(teamId) {
    const teamRes = await db.query(`
      SELECT 
        t.*,
        (SELECT COUNT(*) FROM users u WHERE u.team_id = t.id) as actual_members,
        (SELECT COUNT(*) FROM books b WHERE b.team_id = t.id AND b.visibility_status = 'visible') as approved_books_count
      FROM teams t
      WHERE t.id = $1
    `, [teamId]);

    if (teamRes.rows.length === 0) {
      return null;
    }

    const team = teamRes.rows[0];
    const levelInfo = calculateLevelFromExp(parseInt(team.total_exp, 10));

    // Also get members
    const membersRes = await db.query(`
      SELECT 
        id, employee_code, email, full_name, gender, branch,
        parent_department, child_department_1, child_department_2,
        officer_code, job_title, role, avatar_url, contributed_books_count, total_exp_earned
      FROM users
      WHERE team_id = $1
      ORDER BY full_name ASC
    `, [teamId]);

    return {
      ...team,
      total_exp: parseInt(team.total_exp, 10),
      level: levelInfo.level,
      level_name: levelInfo.name,
      level_progress: levelInfo.progressPercent,
      members: membersRes.rows
    };
  }

  /**
   * Get members of a specific team
   */
  static async getTeamMembers(teamId) {
    const result = await db.query(`
      SELECT 
        id, employee_code, email, full_name, gender, branch,
        parent_department, child_department_1, child_department_2,
        officer_code, job_title, role, avatar_url, contributed_books_count, total_exp_earned
      FROM users
      WHERE team_id = $1
      ORDER BY full_name ASC
    `, [teamId]);

    return result.rows;
  }
}
