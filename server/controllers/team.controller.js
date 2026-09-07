import { TeamService } from '../services/team.service.js';

export async function getTeams(req, res, next) {
  try {
    const teams = await TeamService.getAllTeams();
    res.json({
      success: true,
      data: teams
    });
  } catch (err) {
    next(err);
  }
}

export async function getTeamById(req, res, next) {
  try {
    const { id } = req.params;
    const team = await TeamService.getTeamById(parseInt(id, 10));
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'TEAM_NOT_FOUND',
        message: `Không tìm thấy đội với ID ${id}`
      });
    }
    res.json({
      success: true,
      data: team
    });
  } catch (err) {
    next(err);
  }
}

export async function getTeamMembers(req, res, next) {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const members = await TeamService.getTeamMembers(parseInt(id, 10), date);
    res.json({
      success: true,
      data: members
    });
  } catch (err) {
    next(err);
  }
}
