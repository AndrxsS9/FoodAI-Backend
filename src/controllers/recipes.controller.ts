import {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  recipeRecommendationRequestSchema,
} from '../schemas/recipe.schema';

import {
  buildRecipeRecommendations,
} from '../services/recipes/recommendation.service';

import {
  sendSuccess,
} from '../utils/apiResponse';

export async function recommendRecipes(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input =
      recipeRecommendationRequestSchema.parse(
        req.body,
      );

    const result =
      await buildRecipeRecommendations(
        input,
      );

    return sendSuccess(
      res,
      result,
    );
  } catch (error) {
    next(error);
  }
}