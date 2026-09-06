import TesterService from '../services/tester.service.js';

export class TesterController {
  async setExp(req, res, next) {
    try {
      const { exp, seedsCount, teamId } = req.body;
      const data = await TesterService.setExp(
        parseInt(exp, 10),
        seedsCount !== undefined && seedsCount !== null ? parseInt(seedsCount, 10) : null,
        teamId
      );
      res.json({
        success: true,
        message: `Đã thiết lập trạng thái Cây thành công (${exp} EXP)`,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async addSeeds(req, res, next) {
    try {
      const { count, teamId } = req.body;
      const data = await TesterService.addSeeds(
        count ? parseInt(count, 10) : 1,
        teamId
      );
      res.json({
        success: true,
        message: `Đã gieo thêm +${count || 1} hạt giống thành công`,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async addHeart(req, res, next) {
    try {
      const { count = 10, exp = 20, teamId } = req.body;
      const data = await TesterService.addHeart(count, exp, teamId);
      res.json({
        success: true,
        message: `Đã thả tim thành công (+${count} Tim, +${exp} EXP)`,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async reset(req, res, next) {
    try {
      const { teamId } = req.body;
      const data = await TesterService.resetToInitialState(teamId);
      res.json({
        success: true,
        message: 'Đã reset hệ thống về trạng thái ban đầu (0 Hạt, Mặt đất trống)',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async wipeDatabase(req, res, next) {
    try {
      const data = await TesterService.wipeDatabaseExceptAccounts();
      res.json({
        success: true,
        message: 'Đã dọn sạch cơ sở dữ liệu về Empty (Giữ nguyên tài khoản)',
        data
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new TesterController();
