import db from '../config/database.js';
import { calculateLevelFromExp } from '../config/constants.js';
import { getCurrentRound, ROUNDS_CONFIG } from '../config/rounds.config.js';

export class TeamService {
  /**
   * Get all 8 teams sorted by 4-tier leaderboard criteria:
   * 1. Total Converted EXP DESC
   * 2. Average Participation Rate DESC (Stability)
   * 3. Milestone Completion Speed (Earlier timestamp = better)
   * 4. Perfect Rounds Count DESC
   */
  static async getAllTeams() {
    const currentRound = getCurrentRound();
    const roundNum = currentRound.round;

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
        COALESCE(t.avg_participation_rate, 0) as avg_participation_rate,
        t.milestone_150_at,
        t.milestone_400_at,
        t.milestone_1000_at,
        t.milestone_2500_at,
        COALESCE(t.perfect_rounds_count, 0) as perfect_rounds_count,
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
        ) as approved_books_count,
        (
          SELECT json_build_object(
            'round_number', tr.round_number,
            'participants_count', tr.participants_count,
            'participation_rate', tr.participation_rate,
            'converted_exp', tr.converted_exp,
            'seeds_count', tr.seeds_count
          )
          FROM team_rounds tr
          WHERE tr.team_id = t.id AND tr.round_number = $1
          LIMIT 1
        ) as current_round_stats
      FROM teams t
      ORDER BY 
        t.total_exp DESC, 
        t.avg_participation_rate DESC,
        t.milestone_2500_at ASC NULLS LAST,
        t.milestone_1000_at ASC NULLS LAST,
        t.milestone_400_at ASC NULLS LAST,
        t.milestone_150_at ASC NULLS LAST,
        t.perfect_rounds_count DESC,
        t.id ASC
    `, [roundNum]);

    return result.rows.map((team, idx) => {
      const exp = parseFloat(team.total_exp) || 0;
      const seeds = parseInt(team.tree_seeds, 10) || 0;
      const lvlInfo = calculateLevelFromExp(exp);
      const isSprouted = exp >= 50 || parseInt(team.level, 10) >= 1 || seeds >= 10;

      return {
        ...team,
        rank: idx + 1,
        total_exp: exp,
        tree_seeds: seeds,
        level: isSprouted ? Math.max(1, lvlInfo.level) : 0,
        level_name: isSprouted ? (lvlInfo.levelName || 'Mầm Non') : 'Ủ Mầm',
        level_description: lvlInfo.levelDescription,
        progress_percent: lvlInfo.progressPercent,
        next_threshold: lvlInfo.nextThreshold,
        is_sprouted: isSprouted,
        avg_participation_rate: parseFloat(team.avg_participation_rate) || 0
      };
    });
  }

  /**
   * Get specific team details by ID with 15 rounds history and member list
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
    const exp = parseFloat(team.total_exp) || 0;
    const seeds = parseInt(team.tree_seeds, 10) || 0;
    const lvlInfo = calculateLevelFromExp(exp);
    const isSprouted = seeds >= 10 || exp >= 50 || parseInt(team.level, 10) >= 1;

    // Get 15 rounds history for this team
    const roundsHistoryRes = await db.query(`
      SELECT 
        r.round_number,
        r.start_date,
        r.end_date,
        r.stage_type,
        r.label,
        COALESCE(tr.participants_count, 0) as participants_count,
        COALESCE(tr.participation_rate, 0) as participation_rate,
        COALESCE(tr.converted_exp, 0) as converted_exp,
        COALESCE(tr.seeds_count, 0) as seeds_count,
        tr.is_sprouted_this_round
      FROM rounds r
      LEFT JOIN team_rounds tr ON r.round_number = tr.round_number AND tr.team_id = $1
      ORDER BY r.round_number ASC
    `, [teamId]);

    // Also get members
    const membersRes = await db.query(`
      SELECT 
        id, employee_code, email, full_name, gender, branch,
        parent_department, child_department_1, child_department_2,
        officer_code, job_title, team_id, role, avatar_url, contributed_books_count, total_exp_earned
      FROM users
      WHERE team_id = $1
      ORDER BY full_name ASC
    `, [teamId]);

    return {
      ...team,
      total_exp: exp,
      tree_seeds: seeds,
      level: isSprouted ? Math.max(1, lvlInfo.level) : 0,
      level_name: isSprouted ? (lvlInfo.levelName || 'Mầm Non') : 'Ủ Mầm',
      level_description: lvlInfo.levelDescription,
      progress_percent: lvlInfo.progressPercent,
      next_threshold: lvlInfo.nextThreshold,
      is_sprouted: isSprouted,
      rounds_history: roundsHistoryRes.rows,
      rounds: roundsHistoryRes.rows,
      members: membersRes.rows
    };
  }

  /**
   * Get members of a specific team with participation status on specific date
   */
  static async getTeamMembers(teamId, filterDate = null) {
    const validDate = (filterDate && /^\d{4}-\d{2}-\d{2}$/.test(String(filterDate).trim()))
      ? String(filterDate).trim()
      : null;

    const result = await db.query(`
      SELECT 
        u.id, u.employee_code, u.email, u.full_name, u.gender, u.branch,
        u.parent_department, u.child_department_1, u.child_department_2,
        u.officer_code, u.job_title, u.team_id, u.role, u.avatar_url, 
        u.contributed_books_count, u.total_exp_earned,
        EXISTS (
          SELECT 1 FROM daily_quotes dq 
          WHERE dq.user_id = u.id AND dq.quote_date = COALESCE($2::date, CURRENT_DATE)
        ) as participated_on_date,
        (
          SELECT COUNT(*) FROM books b 
          WHERE b.user_id = u.id AND DATE(b.created_at) = COALESCE($2::date, CURRENT_DATE)
        ) as date_books_count
      FROM users u
      WHERE u.team_id = $1
      ORDER BY u.full_name ASC
    `, [teamId, validDate]);

    return result.rows;
  }
}
