import db from '../config/database.js';
import { ROUNDS_CONFIG, getCurrentRound, calculateNormalizedExp, SEEDS_FOR_SPROUT } from '../config/rounds.config.js';
import { calculateLevelFromExp } from '../config/constants.js';

export class RoundService {
  /**
   * Get current round info
   */
  static async getCurrentRound(dateStr = null) {
    const configRound = getCurrentRound(dateStr);
    const roundRes = await db.query('SELECT * FROM rounds WHERE round_number = $1', [configRound.round]);
    const r = roundRes.rows[0] || configRound;

    const start = r.start_date ? new Date(r.start_date) : new Date(configRound.date);
    const formatDate = (d) => {
      if (!d) return '';
      if (typeof d === 'string') {
        const parts = d.slice(0, 10).split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      }
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    };
    const dateLabel = `${formatDate(r.start_date || configRound.date)} - ${formatDate(r.end_date || configRound.endDate)}`;

    return {
      round_number: r.round_number || configRound.round,
      start_date: r.start_date || configRound.date,
      end_date: r.end_date || configRound.endDate,
      stage_type: r.stage_type || configRound.stage,
      label: r.label || configRound.label,
      date_label: dateLabel
    };
  }

  /**
   * Get all 15 rounds with team standings
   */
  static async getAllRounds() {
    const roundsRes = await db.query('SELECT * FROM rounds ORDER BY round_number ASC');
    const formatDate = (d) => {
      if (!d) return '';
      if (typeof d === 'string') {
        const parts = d.slice(0, 10).split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      }
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    };
    return roundsRes.rows.map(r => ({
      ...r,
      date_label: `${formatDate(r.start_date)} - ${formatDate(r.end_date)}`
    }));
  }

  /**
   * Record a user contribution in current round with anti-spam (1 contribution per user per round)
   */
  static async recordContribution(client, { userId, teamId, bookId = null, code = null, dateStr = null }) {
    const currentRound = await this.getCurrentRound(dateStr);
    const roundNum = currentRound.round_number;

    // 1. Check if user already contributed in this round
    const existingRes = await client.query(`
      SELECT id FROM round_contributions
      WHERE user_id = $1 AND round_number = $2
    `, [userId, roundNum]);

    if (existingRes.rows.length > 0) {
      return {
        isNewParticipation: false,
        round: roundNum,
        message: 'Bạn đã đóng góp trong lượt này rồi. Trích dẫn vẫn được lưu nhưng chỉ tính 1 lượt người tham gia cho đội.'
      };
    }

    // 2. Insert new valid round contribution
    await client.query(`
      INSERT INTO round_contributions (round_number, user_id, team_id, book_id, reading_code, is_valid)
      VALUES ($1, $2, $3, $4, $5, true)
    `, [roundNum, userId, teamId, bookId, code]);

    // 3. Count total unique participants for this team in this round
    const countRes = await client.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM round_contributions
      WHERE team_id = $1 AND round_number = $2 AND is_valid = true
    `, [teamId, roundNum]);
    const participantsCount = parseInt(countRes.rows[0].count, 10);

    // 4. Get team info (target members)
    const teamRes = await client.query('SELECT target_members FROM teams WHERE id = $1', [teamId]);
    const targetMembers = parseInt(teamRes.rows[0]?.target_members, 10) || 40;
    const participationRate = Math.min(1.0, participantsCount / targetMembers);
    const participationRatePercent = Math.round(participationRate * 10000) / 100; // e.g. 76.92

    // 5. Handle SEEDING STAGE (Rounds 1 & 2: 05/09 & 08/09)
    if (roundNum <= 2) {
      // Seeds count for this round
      await client.query(`
        UPDATE team_rounds
        SET participants_count = $1,
            participation_rate = $2,
            seeds_count = $1,
            updated_at = NOW()
        WHERE team_id = $3 AND round_number = $4
      `, [participantsCount, participationRatePercent, teamId, roundNum]);

      // Calculate total seeds across Round 1 + Round 2
      const seedsRes = await client.query(`
        SELECT COALESCE(SUM(seeds_count), 0) as total_seeds
        FROM team_rounds
        WHERE team_id = $1 AND round_number IN (1, 2)
      `, [teamId]);
      const totalSeeds = parseInt(seedsRes.rows[0].total_seeds, 10);

      const isSprouted = totalSeeds >= SEEDS_FOR_SPROUT;
      const teamLevel = isSprouted ? 1 : 0;

      await client.query(`
        UPDATE teams
        SET tree_seeds = $1,
            level = CASE WHEN level < 1 AND $2 THEN 1 ELSE level END,
            updated_at = NOW()
        WHERE id = $3
      `, [totalSeeds, isSprouted, teamId]);

      return {
        isNewParticipation: true,
        round: roundNum,
        stage: 'SEEDING',
        participantsCount,
        participationRate: participationRatePercent,
        totalSeeds,
        isSprouted
      };
    }

    // 6. Handle GROWTH STAGE (Rounds 3 to 15: 11/09 onwards)
    const convertedExp = calculateNormalizedExp(participantsCount, targetMembers);

    await client.query(`
      UPDATE team_rounds
      SET participants_count = $1,
          participation_rate = $2,
          converted_exp = $3,
          updated_at = NOW()
      WHERE team_id = $4 AND round_number = $5
    `, [participantsCount, participationRatePercent, convertedExp, teamId, roundNum]);

    // Recalculate total converted EXP from all rounds (rounds 3 to 15)
    const totalExpRes = await client.query(`
      SELECT COALESCE(SUM(converted_exp), 0) as sum_exp
      FROM team_rounds
      WHERE team_id = $1 AND round_number >= 3
    `, [teamId]);
    const newTotalExp = Math.round(parseFloat(totalExpRes.rows[0].sum_exp) * 100) / 100;

    // Calculate level based on EXP
    let newLevel = 1;
    if (newTotalExp >= 2500) newLevel = 5;
    else if (newTotalExp >= 1000) newLevel = 4;
    else if (newTotalExp >= 400) newLevel = 3;
    else if (newTotalExp >= 150) newLevel = 2;

    // Check milestones
    const milestoneUpdates = [];
    if (newTotalExp >= 150) milestoneUpdates.push("milestone_150_at = COALESCE(milestone_150_at, NOW())");
    if (newTotalExp >= 400) milestoneUpdates.push("milestone_400_at = COALESCE(milestone_400_at, NOW())");
    if (newTotalExp >= 1000) milestoneUpdates.push("milestone_1000_at = COALESCE(milestone_1000_at, NOW())");
    if (newTotalExp >= 2500) milestoneUpdates.push("milestone_2500_at = COALESCE(milestone_2500_at, NOW())");

    const milestoneSql = milestoneUpdates.length > 0 ? `, ${milestoneUpdates.join(', ')}` : '';

    // Calculate average participation rate
    const avgRateRes = await client.query(`
      SELECT COALESCE(AVG(participation_rate), 0) as avg_rate
      FROM team_rounds
      WHERE team_id = $1 AND round_number <= $2
    `, [teamId, roundNum]);
    const avgParticipationRate = Math.round(parseFloat(avgRateRes.rows[0].avg_rate) * 100) / 100;

    // Update team
    await client.query(`
      UPDATE teams
      SET total_exp = $1,
          level = GREATEST(level, $2),
          avg_participation_rate = $3,
          updated_at = NOW()
          ${milestoneSql}
      WHERE id = $4
    `, [newTotalExp, newLevel, avgParticipationRate, teamId]);

    return {
      isNewParticipation: true,
      round: roundNum,
      stage: 'GROWTH',
      participantsCount,
      participationRate: participationRatePercent,
      convertedExp,
      teamTotalExp: newTotalExp,
      teamLevel: newLevel
    };
  }
}
