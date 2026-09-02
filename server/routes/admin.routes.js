import express from 'express';
import { adminLogin, getAdminStats, getAdminBooks, updateAdminBookStatus, adminBonusExp, getAuditLogs } from '../controllers/index.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';
import { validateBody, adminLoginSchema, updateBookStatusSchema, adminBonusExpSchema } from '../middlewares/validator.js';

const router = express.Router();

// Public Admin Auth
router.post('/auth/login', validateBody(adminLoginSchema), adminLogin);

// Protected Moderator & Admin Routes
router.use(authenticate);

router.get('/stats', authorizeRoles('moderator', 'admin'), getAdminStats);
router.get('/books', authorizeRoles('moderator', 'admin'), getAdminBooks);
router.patch('/books/:id/status', authorizeRoles('moderator', 'admin'), validateBody(updateBookStatusSchema), updateAdminBookStatus);
router.post('/growth/bonus', authorizeRoles('admin'), validateBody(adminBonusExpSchema), adminBonusExp);
router.get('/audit-logs', authorizeRoles('admin'), getAuditLogs);

export default router;
