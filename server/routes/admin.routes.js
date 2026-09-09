import express from 'express';
import { 
  adminLogin, getAdminStats, getAdminBooks, updateAdminBookStatus, 
  scoreAdminBookCredibility, batchScoreAdminBooks,
  getAdminCredibilityQueueStatus, triggerAdminCredibilityScan,
  adminBonusExp, getAuditLogs, getAdminAnalytics, getAdminLedger, 
  getAdminUsersDirectory, advanceAdminRound,
  getAdminContentSettings, updateAdminContentSetting, resetAdminContentSetting,
  adminWipeData, getAdminDeepDiveAnalytics,
  getAdminTeamsAllDaysExport, getAdminUsersAllDaysExport,
  getAdminAccounts, getAdminAccountStats, getAdminAccountById,
  createAdminAccount, updateAdminAccount, deleteAdminAccount,
  createAdminPersonnel, getAdminPersonnelDetail, updateAdminPersonnel, deleteAdminPersonnel
} from '../controllers/index.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';
import { 
  validateBody, adminLoginSchema, updateBookStatusSchema, adminBonusExpSchema,
  createAdminAccountSchema, updateAdminAccountSchema,
  createPersonnelSchema, updatePersonnelSchema
} from '../middlewares/validator.js';

const router = express.Router();

// Public Admin Auth
router.post('/auth/login', validateBody(adminLoginSchema), adminLogin);

// Protected Moderator & Admin Routes
router.use(authenticate);

// Admin Accounts Management (RBAC: Superadmin Only)
router.get('/accounts/stats', authorizeRoles('admin'), getAdminAccountStats);
router.get('/accounts', authorizeRoles('admin'), getAdminAccounts);
router.get('/accounts/:id', authorizeRoles('admin'), getAdminAccountById);
router.post('/accounts', authorizeRoles('admin'), validateBody(createAdminAccountSchema), createAdminAccount);
router.put('/accounts/:id', authorizeRoles('admin'), validateBody(updateAdminAccountSchema), updateAdminAccount);
router.delete('/accounts/:id', authorizeRoles('admin'), deleteAdminAccount);

// Personnel Directory & CRUD Management (288 Nhân Sự)
router.get('/users/all-days', authorizeRoles('moderator', 'admin'), getAdminUsersAllDaysExport);
router.get('/users', authorizeRoles('moderator', 'admin'), getAdminUsersDirectory);
router.get('/users/:id', authorizeRoles('moderator', 'admin'), getAdminPersonnelDetail);
router.post('/users', authorizeRoles('admin'), validateBody(createPersonnelSchema), createAdminPersonnel);
router.put('/users/:id', authorizeRoles('admin'), validateBody(updatePersonnelSchema), updateAdminPersonnel);
router.delete('/users/:id', authorizeRoles('admin'), deleteAdminPersonnel);

// Realtime Analytics & KPIs
router.get('/analytics/teams/all-days', authorizeRoles('moderator', 'admin'), getAdminTeamsAllDaysExport);
router.get('/analytics/overview', authorizeRoles('moderator', 'admin'), getAdminAnalytics);
router.get('/analytics/deep-dive', authorizeRoles('moderator', 'admin'), getAdminDeepDiveAnalytics);
router.get('/ledger', authorizeRoles('moderator', 'admin'), getAdminLedger);
router.post('/rounds/advance', authorizeRoles('admin'), advanceAdminRound);


// Custom UI Content & Rules Settings
router.get('/content-settings', authorizeRoles('moderator', 'admin'), getAdminContentSettings);
router.put('/content-settings', authorizeRoles('admin'), updateAdminContentSetting);
router.post('/content-settings/reset', authorizeRoles('admin'), resetAdminContentSetting);

// Core Admin Stats & Moderation
router.get('/stats', authorizeRoles('moderator', 'admin'), getAdminStats);
router.get('/books', authorizeRoles('moderator', 'admin'), getAdminBooks);
router.patch('/books/:id/status', authorizeRoles('moderator', 'admin'), validateBody(updateBookStatusSchema), updateAdminBookStatus);
router.post('/books/:id/score-credibility', authorizeRoles('moderator', 'admin'), scoreAdminBookCredibility);
router.post('/books/score-batch', authorizeRoles('admin'), batchScoreAdminBooks);
router.get('/credibility/queue-status', authorizeRoles('moderator', 'admin'), getAdminCredibilityQueueStatus);
router.post('/credibility/trigger-scan', authorizeRoles('admin'), triggerAdminCredibilityScan);
router.post('/growth/bonus', authorizeRoles('admin'), validateBody(adminBonusExpSchema), adminBonusExp);
router.get('/audit-logs', authorizeRoles('admin'), getAuditLogs);

// System Management & Danger Zone
router.post('/system/wipe-data', authorizeRoles('admin'), adminWipeData);

export default router;
