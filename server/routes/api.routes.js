import express from 'express';
import { contributeBook, getQuotes, getGrowth, claimDew, getDewStatus, likeQuote, unlikeQuote, harvestFruit } from '../controllers/index.js';
import { validateBody, contributeBookSchema, likeQuoteSchema, claimDewSchema, harvestFruitSchema } from '../middlewares/validator.js';
import { idempotencyMiddleware } from '../middlewares/idempotency.js';

const router = express.Router();

// Public Community Tree Endpoints
router.get('/growth', getGrowth);
router.get('/quotes', getQuotes);
router.get('/dew/status', getDewStatus);

// Mutation Endpoints with Idempotency Protection
router.post('/books/contribute', idempotencyMiddleware, validateBody(contributeBookSchema), contributeBook);
router.post('/quotes/:id/like', idempotencyMiddleware, validateBody(likeQuoteSchema), likeQuote);
router.post('/quotes/:id/unlike', unlikeQuote);
router.post('/dew/claim', idempotencyMiddleware, validateBody(claimDewSchema), claimDew);
router.post('/fruits/harvest', idempotencyMiddleware, validateBody(harvestFruitSchema), harvestFruit);

export default router;
