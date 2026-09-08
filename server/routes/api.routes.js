import express from 'express';
import { 
  contributeBook, getDailyQuoteStatus, getQuotes, getGrowth, recordVisit, claimDew, 
  getDewStatus, likeQuote, unlikeQuote, harvestFruit,
  getTeams, getTeamById, getTeamMembers,
  getUsers, lookupUser, suggestUsers, getUserById,
  getCurrentRound, getAllRounds, getPublicContentSettings
} from '../controllers/index.js';
import { validateBody, contributeBookSchema, likeQuoteSchema, claimDewSchema, harvestFruitSchema } from '../middlewares/validator.js';
import { idempotencyMiddleware } from '../middlewares/idempotency.js';
import { GroqPoolService } from '../services/groqPool.service.js';

const router = express.Router();

// Public Community Tree Endpoints
router.get('/growth', getGrowth);
router.post('/growth/visit', recordVisit);
router.get('/quotes', getQuotes);
router.get('/books/daily-status', getDailyQuoteStatus);
router.get('/dew/status', getDewStatus);
router.get('/content/settings', getPublicContentSettings);

// Teams & 8 Trees Endpoints
router.get('/teams', getTeams);
router.get('/teams/:id', getTeamById);
router.get('/teams/:id/members', getTeamMembers);

// 15 Fixed Rounds Schedule & Standings
router.get('/rounds/current', getCurrentRound);
router.get('/rounds', getAllRounds);

// Users & Members Endpoints (288 BGD/TDV/CLB)
router.get('/users', getUsers);
router.get('/users/suggest', suggestUsers);
router.get('/users/lookup', lookupUser);
router.get('/users/:id', getUserById);

// Mutation Endpoints with Idempotency Protection
router.post('/books/contribute', idempotencyMiddleware, validateBody(contributeBookSchema), contributeBook);
router.post('/quotes/:id/like', idempotencyMiddleware, validateBody(likeQuoteSchema), likeQuote);
router.post('/quotes/:id/unlike', unlikeQuote);
router.post('/dew/claim', idempotencyMiddleware, validateBody(claimDewSchema), claimDew);
router.post('/fruits/harvest', idempotencyMiddleware, validateBody(harvestFruitSchema), harvestFruit);

// Groq Model Pool Intelligent Gateway
router.get('/groq/status', (req, res) => {
  res.json({
    success: true,
    data: GroqPoolService.getPoolStatus()
  });
});

router.post('/groq/chat', async (req, res, next) => {
  try {
    const {
      apiKey,
      messages,
      temperature,
      maxTokens,
      timeoutMs,
      responseFormat,
      requireJson
    } = req.body;

    const result = await GroqPoolService.callChatCompletion({
      apiKey,
      messages,
      temperature,
      maxTokens,
      timeoutMs,
      responseFormat,
      requireJson
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;

