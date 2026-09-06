import AnalyticsService from '../services/analytics.service.js';

export async function getAdminAnalytics(req, res, next) {
  try {
    const data = await AnalyticsService.getOverview();
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminLedger(req, res, next) {
  try {
    const { page, limit, type, teamId, search } = req.query;
    const data = await AnalyticsService.getLedger({ page, limit, type, teamId, search });
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminUsersDirectory(req, res, next) {
  try {
    const { page, limit, teamId, branch, status, search } = req.query;
    const data = await AnalyticsService.getUsersDirectory({ page, limit, teamId, branch, status, search });
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

export async function advanceAdminRound(req, res, next) {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const { roundNumber } = req.body;
    const result = await AnalyticsService.advanceRound(roundNumber, req.user, ip);
    res.json({
      success: true,
      message: `Đã kích hoạt chặng ${result.round_number}: ${result.label}`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminDeepDiveAnalytics(req, res, next) {
  try {
    const { teamId, period } = req.query;
    const data = await AnalyticsService.getDeepDiveAnalytics({ teamId, period });
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

