import BookService from '../services/book.service.js';
import GrowthService from '../services/growth.service.js';
import DewService from '../services/dew.service.js';
import QuoteService from '../services/quote.service.js';
import ModerationService from '../services/moderation.service.js';
import TesterService from '../services/tester.service.js';
import { CredibilityService } from '../services/credibility.service.js';
import { CredibilityQueue } from '../services/credibilityQueue.service.js';
import db from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// --- BOOKS CONTROLLER ---
export async function contributeBook(req, res, next) {
  try {
    const result = await BookService.contributeBook(req.body);
    res.status(201).json({
      success: true,
      message: 'Gieo mầm sách thành công (+5 EXP)!',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function getDailyQuoteStatus(req, res, next) {
  try {
    const { userId, email, userFingerprint } = req.query;
    const status = await BookService.getDailyQuoteStatus({ userId, email, userFingerprint });
    res.json({
      success: true,
      data: status
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
    const rawIp = req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : '') || req.socket.remoteAddress || '';
    const ip = rawIp.trim().slice(0, 45);
    const userAgent = (req.headers['user-agent'] || '').slice(0, 255);

    const result = await GrowthService.recordVisitor(userFingerprint, ip, userAgent);
    res.json({
      success: true,
      message: 'Đã ghi nhận lượt ghé thăm của Bút danh',
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
    const { userId, teamId, email, userFingerprint } = req.body;
    const result = await DewService.claimDew({ userId, teamId, email, userFingerprint });
    res.status(201).json({
      success: true,
      message: 'Tưới cây thành công (+2 EXP)!',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function getDewStatus(req, res, next) {
  try {
    const { userId, userFingerprint } = req.query;
    const status = await DewService.getDewStatus({ userId, userFingerprint });
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
    const { userFingerprint, userId, teamId } = req.body;
    const result = await QuoteService.unlikeQuote(req.params.id, userFingerprint, { userId, teamId });
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
    const { userFingerprint, userId, teamId } = req.body;
    const result = await QuoteService.likeQuote(req.params.id, userFingerprint, { userId, teamId });
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
    const { fruitIndex, userFingerprint, userId, teamId } = req.body;
    if (!userId || userId === 'guest') {
      return res.status(401).json({
        success: false,
        error: 'LOGIN_REQUIRED',
        message: 'Vui lòng đăng nhập tài khoản FOXREAD để hái Trái Tri Thức!'
      });
    }

    const result = await QuoteService.harvestFruit(fruitIndex, userFingerprint, { userId, teamId });
    res.json({
      success: true,
      message: `Hái Trái Tri Thức thành công (+5 EXP cho ${result.team?.short_name || result.team?.display_name || 'Đội'})!`,
      data: result
    });
  } catch (err) {
    if (err.code === '23505' || err.message?.includes('hôm nay rồi') || err.message?.includes('duplicate')) {
      return res.status(400).json({
        success: false,
        error: 'ALREADY_HARVESTED',
        message: 'Bạn đã hái Trái Tri Thức này hôm nay rồi!'
      });
    }
    next(err);
  }
}

export async function getFruitHarvestStatus(req, res, next) {
  try {
    const { userId, teamId } = req.query;
    const status = await QuoteService.getHarvestStatus(userId, teamId ? parseInt(teamId, 10) : null);
    res.json({
      success: true,
      data: status
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
    const credibility = req.query.credibility;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (moderationStatus) {
      params.push(moderationStatus);
      whereClause += ` AND b.moderation_status = $${params.length}`;
    }
    if (visibilityStatus) {
      params.push(visibilityStatus);
      whereClause += ` AND b.visibility_status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (b.title ILIKE $${params.length} OR b.author ILIKE $${params.length} OR b.reader_name ILIKE $${params.length})`;
    }

    if (credibility === 'under_70') {
      whereClause += ` AND (b.credibility_score IS NOT NULL AND b.credibility_score < 70)`;
    } else if (credibility === 'under_60') {
      whereClause += ` AND (b.credibility_score IS NOT NULL AND b.credibility_score < 60)`;
    } else if (credibility === 'under_50') {
      whereClause += ` AND (b.credibility_score IS NOT NULL AND b.credibility_score < 50)`;
    } else if (credibility === 'gte_70') {
      whereClause += ` AND (b.credibility_score IS NOT NULL AND b.credibility_score >= 70)`;
    } else if (credibility === 'unscored') {
      whereClause += ` AND (b.credibility_status IS NULL OR b.credibility_status = 'unscored')`;
    }

    const query = `
      SELECT b.*, t.name as team_name, t.display_name as team_display_name, t.color_code as team_color 
      FROM books b 
      LEFT JOIN teams t ON b.team_id = t.id 
      ${whereClause}
      ORDER BY b.created_at DESC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM books b 
      ${whereClause}
    `;

    const booksRes = await db.query(query, [...params, limit, offset]);
    const countRes = await db.query(countQuery, params);

    // Lấy tổng số lượng theo trạng thái hiển thị cho thanh điều hướng Tab
    const [activeCountRes, deletedCountRes] = await Promise.all([
      db.query("SELECT COUNT(*) FROM books WHERE visibility_status = 'visible'"),
      db.query("SELECT COUNT(*) FROM books WHERE visibility_status = 'deleted'")
    ]);

    res.json({
      success: true,
      data: {
        books: booksRes.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countRes.rows[0].count, 10)
        },
        counts: {
          active: parseInt(activeCountRes.rows[0].count, 10),
          deleted: parseInt(deletedCountRes.rows[0].count, 10)
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

export async function scoreAdminBookCredibility(req, res, next) {
  try {
    const bookId = req.params.id;
    const scoredBook = await CredibilityService.scoreQuoteCredibility(bookId);
    res.json({
      success: true,
      message: 'Thẩm định điểm độ uy tín thành công!',
      data: scoredBook
    });
  } catch (err) {
    next(err);
  }
}

export async function batchScoreAdminBooks(req, res, next) {
  try {
    const limit = parseInt(req.body.limit, 10) || 15;
    const delayMs = parseInt(req.body.delayMs, 10) || 800;
    const forceRescore = Boolean(req.body.forceRescore);

    const report = await CredibilityService.batchScoreQuotes({ limit, delayMs, forceRescore });
    res.json({
      success: true,
      message: `Đã hoàn tất thẩm định ${report.successCount}/${report.totalRequested} trích dẫn!`,
      data: report
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminCredibilityQueueStatus(req, res, next) {
  try {
    const status = CredibilityQueue.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    next(err);
  }
}

export async function triggerAdminCredibilityScan(req, res, next) {
  try {
    const limit = parseInt(req.body.limit, 10) || 50;
    const addedCount = await CredibilityQueue.scanAndEnqueueUnscored({ limit });
    res.json({
      success: true,
      message: `Đã quét và nạp ${addedCount} trích dẫn chưa chấm vào Hàng đợi tự động!`,
      data: {
        addedCount,
        queueStatus: CredibilityQueue.getStatus()
      }
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

export async function adminWipeData(req, res, next) {
  try {
    const { password } = req.body || {};
    if (password !== 'Soncute@123') {
      return res.status(403).json({
        success: false,
        message: 'Mật khẩu xác nhận không chính xác! Vui lòng kiểm tra lại.'
      });
    }

    const ip = req.ip || req.connection?.remoteAddress || '';
    const result = await TesterService.wipeDatabaseExceptAccounts(req.user, ip);

    res.json({
      success: true,
      message: 'Đã dọn sạch toàn bộ dữ liệu hoạt động thành công (bảo lưu 288 tài khoản và 8 đội)!',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export * from './team.controller.js';
export * from './user.controller.js';
export * from './round.controller.js';
export * from './analytics.controller.js';
export * from './settings.controller.js';
export * from './admin-user.controller.js';
