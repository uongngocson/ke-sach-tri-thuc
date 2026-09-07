import { z } from 'zod';

export const contributeBookSchema = z.object({
  title: z.string().trim().min(2, 'Tên sách phải từ 2 ký tự trở lên').max(200, 'Tên sách không vượt quá 200 ký tự'),
  author: z.string().trim().min(2, 'Tên tác giả phải từ 2 ký tự trở lên').max(150, 'Tên tác giả không vượt quá 150 ký tự'),
  quote: z.string().trim().min(10, 'Trích dẫn phải từ 10 ký tự trở lên').max(1000, 'Trích dẫn không vượt quá 1000 ký tự'),
  category: z.string().trim().optional().default('Sách Tinh Hoa'),
  reader: z.string().trim().max(80, 'Tên người gieo không vượt quá 80 ký tự').optional().default('Độc giả yêu sách'),
  email: z.string().email('Email không hợp lệ').optional().nullable().or(z.literal('')),
  userFingerprint: z.string().trim().min(1, 'Fingerprint thiết bị là bắt buộc')
});

export const likeQuoteSchema = z.object({
  userFingerprint: z.string().trim().min(1, 'Fingerprint thiết bị là bắt buộc')
});

export const claimDewSchema = z.object({
  userId: z.string().trim().min(1, 'User ID là bắt buộc'),
  teamId: z.number().int().min(1).max(8).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  userFingerprint: z.string().trim().optional().default('default_fp')
});

export const harvestFruitSchema = z.object({
  fruitIndex: z.number().int().min(0).max(100),
  userFingerprint: z.string().trim().min(1, 'Fingerprint thiết bị là bắt buộc')
});

export const adminLoginSchema = z.object({
  username: z.string().trim().min(3, 'Tên đăng nhập không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên')
});

export const updateBookStatusSchema = z.object({
  visibility_status: z.enum(['visible', 'hidden', 'deleted']).optional(),
  moderation_status: z.enum(['pending_review', 'reviewed', 'flagged', 'rejected']).optional(),
  moderation_notes: z.string().max(500).optional(),
  deletion_reason: z.string().max(255).optional(),
  deductExp: z.boolean().optional().default(false)
});

export const adminBonusExpSchema = z.object({
  amount: z.number().int().min(1).max(10000),
  reason: z.string().trim().min(3).max(255)
});

export const createAdminAccountSchema = z.object({
  username: z.string().trim()
    .min(3, 'Tên đăng nhập phải từ 3 đến 50 ký tự')
    .max(50, 'Tên đăng nhập không được quá 50 ký tự')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Tên đăng nhập chỉ chứa chữ cái, chữ số, dấu chấm, gạch ngang hoặc gạch dưới'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên'),
  full_name: z.string().trim().min(2, 'Họ và tên phải từ 2 ký tự trở lên').max(100, 'Họ và tên không quá 100 ký tự'),
  role: z.enum(['admin', 'moderator', 'reader']).default('moderator'),
  is_active: z.boolean().optional().default(true)
});

export const updateAdminAccountSchema = z.object({
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên').optional().or(z.literal('')),
  full_name: z.string().trim().min(2, 'Họ và tên phải từ 2 ký tự trở lên').max(100, 'Họ và tên không quá 100 ký tự').optional(),
  role: z.enum(['admin', 'moderator', 'reader']).optional(),
  is_active: z.boolean().optional()
});

export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}
