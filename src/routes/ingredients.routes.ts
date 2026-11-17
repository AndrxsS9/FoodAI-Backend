import { Router } from 'express';

import { analyzeIngredients } from '../controllers/ingredients.controller';
import { aiConcurrencyGuard } from '../middlewares/aiConcurrency.middleware';
import { aiUserRateLimit } from '../middlewares/aiRateLimit.middleware';
import { requireSupabaseAuth } from '../middlewares/auth.middleware';
import { imageUpload } from '../middlewares/upload.middleware';

const router = Router();

router.post(
  '/analyze',
  requireSupabaseAuth,
  aiUserRateLimit,
  aiConcurrencyGuard,
  imageUpload.single('image'),
  analyzeIngredients,
);

export default router;
