import { UserService } from '../services/user.service.js';

export async function getUsers(req, res, next) {
  try {
    const { keyword, teamId, branch, limit, offset } = req.query;
    const result = await UserService.getUsers({
      keyword,
      teamId,
      branch,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0
    });
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function suggestUsers(req, res, next) {
  try {
    const { q, limit } = req.query;
    const users = await UserService.suggestUsers(q, limit ? parseInt(limit, 10) : 8);
    res.json({
      success: true,
      data: users
    });
  } catch (err) {
    next(err);
  }
}

export async function lookupUser(req, res, next) {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'QUERY_REQUIRED',
        message: 'Vui lòng cung cấp email hoặc mã nhân viên để tra cứu'
      });
    }

    const user = await UserService.lookupUser(q);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Không tìm thấy thông tin nhân sự'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req, res, next) {
  try {
    const { id } = req.params;
    const user = await UserService.getUserById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng'
      });
    }
    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
}

export async function createAdminPersonnel(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const newPersonnel = await UserService.createPersonnel(req.body, req.user, ipAddress);
    res.status(201).json({
      success: true,
      message: `Đã thêm thành công nhân sự "${newPersonnel.nickname || newPersonnel.full_name}" (${newPersonnel.employee_code})!`,
      data: newPersonnel
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminPersonnelDetail(req, res, next) {
  try {
    const { id } = req.params;
    const detail = await UserService.getPersonnelDetail(id);
    res.json({
      success: true,
      data: detail
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminPersonnel(req, res, next) {
  try {
    const { id } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const updated = await UserService.updatePersonnel(id, req.body, req.user, ipAddress);
    res.json({
      success: true,
      message: `Cập nhật thông tin nhân sự "${updated.nickname || updated.full_name}" thành công!`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminPersonnel(req, res, next) {
  try {
    const { id } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const deleted = await UserService.deletePersonnel(id, req.user, ipAddress);
    res.json({
      success: true,
      message: `Đã xóa vĩnh viễn nhân sự "${deleted.nickname || deleted.full_name}" (${deleted.employee_code}) khỏi hệ thống!`,
      data: deleted
    });
  } catch (err) {
    next(err);
  }
}

