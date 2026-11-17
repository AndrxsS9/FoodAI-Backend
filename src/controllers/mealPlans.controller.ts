import {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  mealPlanRequestSchema,
} from '../schemas/mealPlan.schema';

import {
  buildMealPlan,
} from '../services/plans/mealPlan.service';

import {
  sendSuccess,
} from '../utils/apiResponse';

export async function generateMealPlan(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input =
      mealPlanRequestSchema.parse(
        req.body,
      );

    const result =
      await buildMealPlan(
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