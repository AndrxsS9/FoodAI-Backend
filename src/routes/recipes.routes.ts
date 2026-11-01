import { Router } from 'express';

import {
  recommendRecipes,
} from '../controllers/recipes.controller';
import { aiConcurrencyGuard } from '../middlewares/aiConcurrency.middleware';
import { aiUserRateLimit } from '../middlewares/aiRateLimit.middleware';
import { requireSupabaseAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post(
  '/recommend',
  requireSupabaseAuth,
  aiUserRateLimit,
  aiConcurrencyGuard,
  recommendRecipes,
);

export default router;
