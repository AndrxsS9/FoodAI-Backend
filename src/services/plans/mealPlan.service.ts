import type {
  RecipeIngredient,
  RecommendedRecipe,
} from '../../schemas/recipe.schema';

import {
  mealPlanResponseSchema,
  type MealPlanRequest,
  type MealPlanResponse,
} from '../../schemas/mealPlan.schema';

import {
  buildRecipeRecommendations,
} from '../recipes/recommendation.service';

import {
  estimateMissingIngredientsCost,
} from '../pricing/ingredientPrice.service';

import { AppError } from '../../utils/errors';

interface RecipeCombination {
  recipes: RecommendedRecipe[];
  totalEstimatedMissingCost: number;
  totalConvenience: number;
  totalMinutes: number;
}

function normalizeIngredientName(
  name: string,
): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/*
 * Si varias recetas requieren el mismo ingrediente
 * faltante, lo contamos una sola vez en el costo
 * estimado de compra del plan.
 *
 * Ejemplo:
 *
 * Día 1 necesita cebolla
 * Día 2 necesita cebolla
 *
 * Para el MVP asumimos una sola compra de cebolla.
 */
function getUniqueMissingIngredients(
  recipes: RecommendedRecipe[],
): RecipeIngredient[] {
  const ingredients =
    recipes.flatMap(
      (recipe) =>
        recipe.missingIngredients,
    );

  const uniqueIngredients =
    new Map<string, RecipeIngredient>();

  for (const ingredient of ingredients) {
    const normalizedName =
      normalizeIngredientName(
        ingredient.name,
      );

    if (
      !uniqueIngredients.has(
        normalizedName,
      )
    ) {
      uniqueIngredients.set(
        normalizedName,
        ingredient,
      );
    }
  }

  return Array.from(
    uniqueIngredients.values(),
  );
}

function calculateCombination(
  recipes: RecommendedRecipe[],
): RecipeCombination {
  const uniqueMissingIngredients =
    getUniqueMissingIngredients(recipes);

  const totalEstimatedMissingCost =
    estimateMissingIngredientsCost(
      uniqueMissingIngredients,
    );

  const totalConvenience =
    recipes.reduce(
      (total, recipe) =>
        total + recipe.convenience,
      0,
    );

  const totalMinutes =
    recipes.reduce(
      (total, recipe) =>
        total + recipe.totalMinutes,
      0,
    );

  return {
    recipes,
    totalEstimatedMissingCost,
    totalConvenience,
    totalMinutes,
  };
}

/*
 * Como Gemini devuelve como máximo 5 recetas,
 * probar todas las combinaciones posibles de 3
 * es sencillo y barato.
 *
 * Con 5 recetas solo existen 10 combinaciones.
 */
function generateCombinations(
  recipes: RecommendedRecipe[],
): RecipeCombination[] {
  const combinations: RecipeCombination[] =
    [];

  for (
    let first = 0;
    first < recipes.length - 2;
    first += 1
  ) {
    for (
      let second = first + 1;
      second < recipes.length - 1;
      second += 1
    ) {
      for (
        let third = second + 1;
        third < recipes.length;
        third += 1
      ) {
        combinations.push(
          calculateCombination([
            recipes[first],
            recipes[second],
            recipes[third],
          ]),
        );
      }
    }
  }

  return combinations;
}

function selectBestCombination(
  combinations: RecipeCombination[],
  budget: number,
): RecipeCombination {
  if (combinations.length === 0) {
    throw new AppError(
      'No existen suficientes combinaciones para crear el plan de comidas.',
      502,
      'MEAL_PLAN_NOT_AVAILABLE',
    );
  }

  /*
   * Primero intentamos encontrar planes
   * completamente dentro del presupuesto.
   */
  const withinBudget =
    combinations.filter(
      (combination) =>
        combination.totalEstimatedMissingCost <=
        budget,
    );

  const candidates =
    withinBudget.length > 0
      ? withinBudget
      : combinations;

  if (withinBudget.length === 0) {
    candidates.sort((a, b) => {
      if (
        a.totalEstimatedMissingCost !==
        b.totalEstimatedMissingCost
      ) {
        return (
          a.totalEstimatedMissingCost -
          b.totalEstimatedMissingCost
        );
      }

      if (
        b.totalConvenience !==
        a.totalConvenience
      ) {
        return (
          b.totalConvenience -
          a.totalConvenience
        );
      }

      return (
        a.totalMinutes -
        b.totalMinutes
      );
    });

    return candidates[0];
  }

  candidates.sort((a, b) => {
    /*
     * 1. Mayor conveniencia acumulada.
     */
    if (
      b.totalConvenience !==
      a.totalConvenience
    ) {
      return (
        b.totalConvenience -
        a.totalConvenience
      );
    }

    /*
     * 2. Menor costo estimado.
     */
    if (
      a.totalEstimatedMissingCost !==
      b.totalEstimatedMissingCost
    ) {
      return (
        a.totalEstimatedMissingCost -
        b.totalEstimatedMissingCost
      );
    }

    /*
     * 3. Menor tiempo total.
     */
    return (
      a.totalMinutes -
      b.totalMinutes
    );
  });

  return candidates[0];
}

export async function buildMealPlan(
  input: MealPlanRequest,
): Promise<MealPlanResponse> {
  /*
   * Reutilizamos el motor de recomendaciones
   * que FoodAI ya tiene.
   */
  const recommendationResult =
    await buildRecipeRecommendations({
      pantry: input.pantry,
      budget: input.budget,
      servings: input.servings,
      maxMinutes: input.maxMinutes,
    });

  if (
    recommendationResult.recipes.length <
    3
  ) {
    throw new AppError(
      'No se generaron suficientes recetas para construir un plan de tres días.',
      502,
      'INSUFFICIENT_RECIPES_FOR_PLAN',
    );
  }

  const combinations =
    generateCombinations(
      recommendationResult.recipes,
    );

  const bestCombination =
    selectBestCombination(
      combinations,
      input.budget,
    );

  const totalEstimatedMissingCost =
    bestCombination.totalEstimatedMissingCost;

  const result = {
    days: bestCombination.recipes.map(
      (recipe, index) => ({
        day: index + 1,
        recipe,
      }),
    ),

    totalEstimatedMissingCost,

    budgetRemaining:
      input.budget -
      totalEstimatedMissingCost,

    withinBudget:
      totalEstimatedMissingCost <=
      input.budget,
  };

  const validation =
    mealPlanResponseSchema.safeParse(
      result,
    );

  if (!validation.success) {
    console.error(
      '❌ Error construyendo el plan de comidas:',
      validation.error,
    );

    throw new AppError(
      'No fue posible construir el plan de comidas.',
      500,
      'INVALID_MEAL_PLAN_RESULT',
    );
  }

  return validation.data;
}