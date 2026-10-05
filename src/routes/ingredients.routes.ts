import { Router } from 'express';

import { analyzeIngredients } from '../controllers/ingredients.controller';

import { imageUpload } from '../middlewares/upload.middleware';

const router = Router();

router.post(
  '/analyze',
  imageUpload.single('image'),
  analyzeIngredients,
);

export default router;