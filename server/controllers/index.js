import BookService from '../services/book.service.js';
import GrowthService from '../services/growth.service.js';
import DewService from '../services/dew.service.js';
import QuoteService from '../services/quote.service.js';
import ModerationService from '../services/moderation.service.js';
import db from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// --- BOOKS CONTROLLER ---
export async function contributeBook(req, res, next) {
  try {
    const result = await BookService.contributeBook(req.body);
    res.status(201).json({
      success: true,
      message: 'Gieo mầm sách thành công (+15 EXP)!',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function getQuotes(req, res, next) {
  try {
    const result = await BookService.getPublicQuotes(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

// --- GROWTH CONTROLLER ---
export async function recordVisit(req, res, next) {
  try {
    const { userFingerprint } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const result = await GrowthService.recordVisitor(userFingerprint, ip, userAgent);
    res.json({
      success: true,
      message: 'Đã ghi nhận lượt ghé thăm của độc giả',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function getGrowth(req, res, next) {
  try {
    const growth = await GrowthService.getCommunityGrowth();
    res.json({
      success: true,
      data: growth
    });
  } catch (err) {
    next(err);
  }
}

// --- DEW CONTROLLER ---
export async function claimDew(req, res, next) {
  try {
    const result = await DewService.claimDew(req.body.userFingerprint);
    res.status(201).json({
      success: true,
      message: 'Tưới cây thành công (+1 EXP)!',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function getDewStatus(req, res, next) {
  try {
    const fingerprint = req.query.userFingerprint || '';
    const status = await DewService.getDewStatus(fingerprint);
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    next(err);
  }
}

// --- QUOTES & FRUIT CONTROLLER ---
export async function unlikeQuote(req, res, next) {
  try {
    const result = await QuoteService.unlikeQuote(req.params.id, req.body.userFingerprint);
    res.json({
      success: true,
      message: 'Đã bỏ thích trích dẫn',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function likeQuote(req, res, next) {
  try {
    const result = await QuoteService.likeQuote(req.params.id, req.body.userFingerprint);
    res.json({
      success: true,
      message: 'Đã thích trích dẫn (+2 EXP)!',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function harvestFruit(req, res, next) {
  try {
    const result = await QuoteService.harvestFruit(req.body.fruitIndex, req.body.userFingerprint);
    res.json({
      success: true,
      message: 'Hái trái tri thức thành công (+5 EXP)!',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

// --- ADMIN CONTROLLER ---
export async function adminLogin(req, res, next) {
  try {
    const { username, password } = req.body;
    const userRes = await db.query('SELECT * FROM admin_users WHERE username = $1 AND is_active = true', [username]);

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
      });
    }

    const admin = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
      });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role, fullName: admin.full_name },
      process.env.JWT_SECRET || 'caosach_super_secure_jwt_secret_2026_production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      data: {
        token,
        user: {
          id: admin.id,
          username: admin.username,
          fullName: admin.full_name,
          role: admin.role
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminStats(req, res, next) {
  try {
    const growth = await GrowthService.getCommunityGrowth();
    const moderationCounts = await db.query(`
      SELECT moderation_status, COUNT(*) as count
      FROM books
      GROUP BY moderation_status
    `);
    const recentLedger = await db.query(`
      SELECT * FROM exp_ledger ORDER BY created_at DESC LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        growth,
        moderationCounts: moderationCounts.rows,
        recentLedger: recentLedger.rows
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminBooks(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;
    const moderationStatus = req.query.moderation_status;
    const visibilityStatus = req.query.visibility_status;
    const search = req.query.search;

    let query = `SELECT * FROM books WHERE 1=1`;
    const params = [];

    if (moderationStatus) {
      params.push(moderationStatus);
      query += ` AND moderation_status = $${params.length}`;
    }
    if (visibilityStatus) {
      params.push(visibilityStatus);
      query += ` AND visibility_status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (title ILIKE $${params.length} OR author ILIKE $${params.length} OR reader_name ILIKE $${params.length})`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const booksRes = await db.query(query, params);
    const countRes = await db.query('SELECT COUNT(*) FROM books');

    res.json({
      success: true,
      data: {
        books: booksRes.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countRes.rows[0].count, 10)
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminBookStatus(req, res, next) {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const result = await ModerationService.updateBookStatus(req.params.id, req.body, req.user, ip);
    res.json({
      success: true,
      message: 'Cập nhật trạng thái sách thành công!',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function adminBonusExp(req, res, next) {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const result = await ModerationService.grantAdminBonus(req.body.amount, req.body.reason, req.user, ip);
    res.json({
      success: true,
      message: `Đã tặng +${req.body.amount} EXP thành công!`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const logsRes = await db.query(`
      SELECT a.*, u.username as admin_username, u.full_name as admin_name
      FROM audit_logs a
      LEFT JOIN admin_users u ON a.admin_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 50
    `);
    res.json({
      success: true,
      data: logsRes.rows
    });
  } catch (err) {
    next(err);
  }
}
