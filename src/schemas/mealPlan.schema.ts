import { z } from 'zod';

import { ingredientSchema } from './ingredient.schema';

import {
  recommendedRecipeSchema,
} from './recipe.schema';

export const mealPlanRequestSchema = z.object({
  pantry: z
    .array(ingredientSchema)
    .min(
      1,
      'Debes tener al menos un ingrediente en la despensa.',
    ),

  budget: z
    .number()
    .nonnegative(
      'El presupuesto no puede ser negativo.',
    ),

  servings: z
    .number()
    .int()
    .min(1)
    .max(12),

  maxMinutes: z
    .number()
    .int()
    .positive()
    .max(240)
    .optional(),
});

export const mealPlanDaySchema = z.object({
  day: z
    .number()
    .int()
    .min(1)
    .max(3),

  recipe: recommendedRecipeSchema,
});

export const mealPlanResponseSchema = z.object({
  days: z
    .array(mealPlanDaySchema)
    .length(3),

  totalEstimatedMissingCost: z
    .number()
    .nonnegative(),

  budgetRemaining: z.number(),

  withinBudget: z.boolean(),
});

export type MealPlanRequest =
  z.infer<typeof mealPlanRequestSchema>;

export type MealPlanDay =
  z.infer<typeof mealPlanDaySchema>;

export type MealPlanResponse =
  z.infer<typeof mealPlanResponseSchema>;