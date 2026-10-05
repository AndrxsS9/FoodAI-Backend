import {
  NextFunction,
  Request,
  Response,
} from 'express';

import { analyzeIngredientsFromImage } from '../services/gemini/ingredient.service';

import { AppError } from '../utils/errors';
import { sendSuccess } from '../utils/apiResponse';

export async function analyzeIngredients(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.file) {
      throw new AppError(
        'Debes enviar una imagen.',
        400,
        'IMAGE_REQUIRED',
      );
    }

    const result = await analyzeIngredientsFromImage({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}