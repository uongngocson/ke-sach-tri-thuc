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
