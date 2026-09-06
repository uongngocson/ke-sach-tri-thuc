import { RoundService } from '../services/round.service.js';

export async function getCurrentRound(req, res, next) {
  try {
    const { date } = req.query;
    const round = await RoundService.getCurrentRound(date);
    res.json({
      success: true,
      data: round
    });
  } catch (err) {
    next(err);
  }
}

export async function getAllRounds(req, res, next) {
  try {
    const rounds = await RoundService.getAllRounds();
    res.json({
      success: true,
      data: rounds
    });
  } catch (err) {
    next(err);
  }
}
