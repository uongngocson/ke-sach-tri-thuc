import TesterService from '../services/tester.service.js';

export class TesterController {
  async setExp(req, res, next) {
    try {
      const { exp, seedsCount } = req.body;
      const data = await TesterService.setExp(parseInt(exp, 10), seedsCount !== undefined ? parseInt(seedsCount, 10) : null);
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
      const count = req.body.count ? parseInt(req.body.count, 10) : 1;
      const data = await TesterService.addSeeds(count);
      res.json({
        success: true,
        message: `Đã gieo thêm +${count} hạt giống thành công`,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async reset(req, res, next) {
    try {
      const data = await TesterService.resetToInitialState();
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
