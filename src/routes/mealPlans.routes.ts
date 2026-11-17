import { Router } from 'express';

import {
  generateMealPlan,
} from '../controllers/mealPlans.controller';
import { aiConcurrencyGuard } from '../middlewares/aiConcurrency.middleware';
import { aiUserRateLimit } from '../middlewares/aiRateLimit.middleware';
import { requireSupabaseAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post(
  '/generate',
  requireSupabaseAuth,
  aiUserRateLimit,
  aiConcurrencyGuard,
  generateMealPlan,
);

export default router;
