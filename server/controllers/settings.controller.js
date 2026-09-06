import SettingsService from '../services/settings.service.js';

export async function getPublicContentSettings(req, res, next) {
  try {
    const data = await SettingsService.getPublicSettings();
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminContentSettings(req, res, next) {
  try {
    const data = await SettingsService.getPublicSettings();
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminContentSetting(req, res, next) {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const { key, value } = req.body;
    if (!key || !value) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PAYLOAD',
        message: 'Thiếu key hoặc value cần cập nhật'
      });
    }

    const updated = await SettingsService.updateSetting(key, value, req.user, ip);
    res.json({
      success: true,
      message: 'Cập nhật cấu hình giao diện thành công!',
      data: { key, value: updated, ...updated }
    });
  } catch (err) {
    next(err);
  }
}

export async function resetAdminContentSetting(req, res, next) {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'KEY_REQUIRED',
        message: 'Thiếu key cần khôi phục'
      });
    }

    const resetValue = await SettingsService.resetSetting(key, req.user, ip);
    res.json({
      success: true,
      message: 'Đã khôi phục cấu hình về mặc định ban đầu!',
      data: { key, value: resetValue, ...resetValue }
    });
  } catch (err) {
    next(err);
  }
}
