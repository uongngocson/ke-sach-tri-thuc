import testerService from '../services/tester.service.js';

class TesterController {
  async setExp(req, res, next) {
    try {
      const { exp, seedsCount } = req.body;
      const data = await testerService.setExp(exp, seedsCount);
      res.json({ success: true, message: `Đã cập nhật ${data.totalEXP} EXP (Level ${data.level})`, data });
    } catch (err) {
      next(err);
    }
  }

  async addSeeds(req, res, next) {
    try {
      const { count } = req.body;
      const data = await testerService.addSeeds(count || 1);
      res.json({ success: true, message: `Đã gieo +${count} hạt giống vào hệ sinh thái`, data });
    } catch (err) {
      next(err);
    }
  }

  async addExp(req, res, next) {
    try {
      const { exp } = req.body;
      const curGrowth = await testerService.setExp(Number(req.body.currentExp || 0) + Number(exp || 20));
      res.json({ success: true, message: `Đã thêm +${exp} EXP`, data: curGrowth });
    } catch (err) {
      next(err);
    }
  }

  async reset(req, res, next) {
    try {
      const data = await testerService.resetToInitialState();
      res.json({ success: true, message: 'Đã reset hệ sinh thái về Ban Đầu (0 Hạt, Mặt Đất Trống)', data });
    } catch (err) {
      next(err);
    }
  }
}

export default new TesterController();
