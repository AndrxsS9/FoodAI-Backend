import { Router } from 'express';

import {
  generateMealPlan,
} from '../controllers/mealPlans.controller';

const router = Router();

router.post(
  '/generate',
  generateMealPlan,
);

export default router;