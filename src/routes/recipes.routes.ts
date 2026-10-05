import { Router } from 'express';

import {
  recommendRecipes,
} from '../controllers/recipes.controller';

const router = Router();

router.post(
  '/recommend',
  recommendRecipes,
);

export default router;