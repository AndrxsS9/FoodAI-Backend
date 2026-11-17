import {
  NextFunction,
  Request,
  Response,
} from 'express';

import { analyzeIngredientsFromImage } from '../services/gemini/ingredient.service';
import { ingredientAnalysisQuerySchema } from '../schemas/ingredient.schema';

import { AppError } from '../utils/errors';
import { sendSuccess } from '../utils/apiResponse';

export async function analyzeIngredients(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { locale } = ingredientAnalysisQuerySchema.parse(req.query);

    if (!req.file) {
      throw new AppError(
        'Debes enviar una imagen.',
        400,
        'IMAGE_REQUIRED',
      );
    }

    if (req.file.buffer.length === 0) {
      throw new AppError(
        'El archivo de imagen está vacío.',
        400,
        'INVALID_IMAGE_CONTENT',
      );
    }

    const result = await analyzeIngredientsFromImage({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      locale,
    });

    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
