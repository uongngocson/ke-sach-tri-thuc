import AdminUserService from '../services/admin-user.service.js';

export async function getAdminAccounts(req, res, next) {
  try {
    const { search, role, status } = req.query;
    const accounts = await AdminUserService.getAllAdminUsers({ search, role, status });
    res.json({
      success: true,
      data: accounts
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminAccountStats(req, res, next) {
  try {
    const stats = await AdminUserService.getAdminAccountStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminAccountById(req, res, next) {
  try {
    const { id } = req.params;
    const account = await AdminUserService.getAdminUserById(id);
    res.json({
      success: true,
      data: account
    });
  } catch (err) {
    next(err);
  }
}

export async function createAdminAccount(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const newAdmin = await AdminUserService.createAdminUser(req.body, req.user, ipAddress);
    res.status(201).json({
      success: true,
      message: `Đã tạo thành công tài khoản quản trị viên "${newAdmin.username}"!`,
      data: newAdmin
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminAccount(req, res, next) {
  try {
    const { id } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const updated = await AdminUserService.updateAdminUser(id, req.body, req.user, ipAddress);
    res.json({
      success: true,
      message: `Cập nhật tài khoản "${updated.username}" thành công!`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminAccount(req, res, next) {
  try {
    const { id } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const result = await AdminUserService.deleteAdminUser(id, req.user, ipAddress);
    res.json({
      success: true,
      message: `Đã xóa vĩnh viễn tài khoản "${result.user.username}" khỏi hệ thống!`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}
