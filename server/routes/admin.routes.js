import express from 'express';
import { 
  adminLogin, getAdminStats, getAdminBooks, updateAdminBookStatus, 
  adminBonusExp, getAuditLogs, getAdminAnalytics, getAdminLedger, 
  getAdminUsersDirectory, advanceAdminRound,
  getAdminContentSettings, updateAdminContentSetting, resetAdminContentSetting,
  adminWipeData
} from '../controllers/index.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';
import { validateBody, adminLoginSchema, updateBookStatusSchema, adminBonusExpSchema } from '../middlewares/validator.js';

const router = express.Router();

// Public Admin Auth
router.post('/auth/login', validateBody(adminLoginSchema), adminLogin);

// Protected Moderator & Admin Routes
router.use(authenticate);

// Realtime Analytics & KPIs
router.get('/analytics/overview', authorizeRoles('moderator', 'admin'), getAdminAnalytics);
router.get('/ledger', authorizeRoles('moderator', 'admin'), getAdminLedger);
router.get('/users', authorizeRoles('moderator', 'admin'), getAdminUsersDirectory);
router.post('/rounds/advance', authorizeRoles('admin'), advanceAdminRound);

// Custom UI Content & Rules Settings
router.get('/content-settings', authorizeRoles('moderator', 'admin'), getAdminContentSettings);
router.put('/content-settings', authorizeRoles('admin'), updateAdminContentSetting);
router.post('/content-settings/reset', authorizeRoles('admin'), resetAdminContentSetting);

// Core Admin Stats & Moderation
router.get('/stats', authorizeRoles('moderator', 'admin'), getAdminStats);
router.get('/books', authorizeRoles('moderator', 'admin'), getAdminBooks);
router.patch('/books/:id/status', authorizeRoles('moderator', 'admin'), validateBody(updateBookStatusSchema), updateAdminBookStatus);
router.post('/growth/bonus', authorizeRoles('admin'), validateBody(adminBonusExpSchema), adminBonusExp);
router.get('/audit-logs', authorizeRoles('admin'), getAuditLogs);

// System Management & Danger Zone
router.post('/system/wipe-data', authorizeRoles('admin'), adminWipeData);

export default router;
