import { z } from 'zod';

export const contributeBookSchema = z.object({
  title: z.string().trim().min(2, 'Tên sách phải từ 2 ký tự trở lên').max(200, 'Tên sách không vượt quá 200 ký tự'),
  author: z.string().trim().min(2, 'Tên tác giả phải từ 2 ký tự trở lên').max(150, 'Tên tác giả không vượt quá 150 ký tự'),
  quote: z.string().trim().min(10, 'Trích dẫn phải từ 10 ký tự trở lên').max(1000, 'Trích dẫn không vượt quá 1000 ký tự'),
  category: z.string().trim().optional().nullable(),
  reader: z.string().trim().max(80, 'Bút danh không vượt quá 80 ký tự').optional().default('Bút danh'),
  email: z.string().email('Email không hợp lệ').optional().nullable().or(z.literal('')),
  userFingerprint: z.string().trim().min(1, 'Fingerprint thiết bị là bắt buộc')
});

export const likeQuoteSchema = z.object({
  userFingerprint: z.string().trim().min(1, 'Fingerprint thiết bị là bắt buộc'),
  userId: z.string().trim().optional().nullable(),
  teamId: z.number().int().min(1).max(8).optional().nullable()
});

export const claimDewSchema = z.object({
  userId: z.string().trim().min(1, 'User ID là bắt buộc'),
  teamId: z.number().int().min(1).max(8).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  userFingerprint: z.string().trim().optional().default('default_fp')
});

export const harvestFruitSchema = z.object({
  fruitIndex: z.number().int().min(0).max(4),
  userFingerprint: z.string().trim().optional().default('default_fp'),
  userId: z.string().trim().optional().nullable(),
  teamId: z.number().int().min(1).max(8).optional().nullable()
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

export const createPersonnelSchema = z.object({
  employee_code: z.string().trim()
    .min(2, 'Mã cán bộ phải từ 2 ký tự trở lên')
    .max(20, 'Mã cán bộ không được quá 20 ký tự')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Mã cán bộ chỉ chứa chữ cái, số, gạch ngang hoặc gạch dưới')
    .optional(),
  email: z.string().trim().email('Email không hợp lệ').optional(),
  full_name: z.string().trim()
    .min(2, 'Họ và tên phải từ 2 ký tự trở lên')
    .max(150, 'Họ và tên không quá 150 ký tự')
    .optional(),
  nickname: z.string().trim().max(100, 'Bút danh không quá 100 ký tự').optional().nullable(),
  gender: z.string().trim().max(10).optional().nullable(),
  branch: z.string().trim().max(100).optional().nullable(),
  parent_department: z.string().trim().max(100).optional().nullable(),
  child_department_1: z.string().trim().max(100).optional().nullable(),
  job_title: z.string().trim().max(255).optional().nullable(),
  team_id: z.number().int().min(1, 'Đội thi đua từ 1 đến 8').max(8, 'Đội thi đua từ 1 đến 8'),
  role: z.string().trim().max(20).optional().default('member')
});


export const updatePersonnelSchema = z.object({
  employee_code: z.string().trim()
    .min(2, 'Mã cán bộ phải từ 2 ký tự trở lên')
    .max(20, 'Mã cán bộ không được quá 20 ký tự')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Mã cán bộ chỉ chứa chữ cái, số, gạch ngang hoặc gạch dưới')
    .optional(),
  email: z.string().trim().email('Email không hợp lệ').optional(),
  full_name: z.string().trim()
    .min(2, 'Họ và tên phải từ 2 ký tự trở lên')
    .max(150, 'Họ và tên không quá 150 ký tự')
    .optional(),
  nickname: z.string().trim().max(100, 'Bút danh không quá 100 ký tự').optional().nullable(),
  gender: z.string().trim().max(10).optional().nullable(),
  branch: z.string().trim().max(100).optional().nullable(),
  parent_department: z.string().trim().max(100).optional().nullable(),
  child_department_1: z.string().trim().max(100).optional().nullable(),
  job_title: z.string().trim().max(255).optional().nullable(),
  team_id: z.number().int().min(1, 'Đội thi đua từ 1 đến 8').max(8, 'Đội thi đua từ 1 đến 8').optional(),
  role: z.string().trim().max(20).optional()
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
