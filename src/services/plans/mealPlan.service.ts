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

import {
  DEFAULT_LOCALE,
  type SupportedLocale,
} from '../../schemas/locale.schema';

import { AppError } from '../../utils/errors';
import { prepareIngredientName } from '../../utils/ingredientIdentity';

/*
 * Mensajes de error visibles para el usuario.
 *
 * Los textos en español se conservan exactamente
 * como estaban históricamente. Los códigos y
 * estados HTTP no dependen del idioma.
 */
const mealPlanMessages = {
  es: {
    notAvailable:
      'No existen suficientes combinaciones para crear el plan de comidas.',
    insufficientRecipes:
      'No se generaron suficientes recetas para construir un plan de tres días.',
    insufficientRecipesWithinTime: (
      maxMinutes: number | undefined,
      count: number,
    ) =>
      `No se generaron suficientes recetas que cumplan con el tiempo máximo de ${maxMinutes} minutos para construir un plan de tres días (${count} de 3 requeridas). Te sugerimos aumentar el tiempo límite disponible o ajustar los ingredientes de la despensa.`,
    invalidResult:
      'No fue posible construir el plan de comidas.',
  },
  en: {
    notAvailable:
      'There are not enough combinations to create the meal plan.',
    insufficientRecipes:
      'Not enough recipes were generated to build a three-day plan.',
    insufficientRecipesWithinTime: (
      maxMinutes: number | undefined,
      count: number,
    ) =>
      `Not enough recipes were generated within the maximum time of ${maxMinutes} minutes to build a three-day plan (${count} of 3 required). Try increasing the available time limit or adjusting your pantry ingredients.`,
    invalidResult:
      'The meal plan could not be built.',
  },
} as const;

interface RecipeCombination {
  recipes: RecommendedRecipe[];
  totalEstimatedMissingCost: number;
  totalConvenience: number;
  totalMinutes: number;
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
    const ingredientIdentity =
      prepareIngredientName(
        ingredient.name,
      );

    if (
      !uniqueIngredients.has(
        ingredientIdentity,
      )
    ) {
      uniqueIngredients.set(
        ingredientIdentity,
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
  locale: SupportedLocale = DEFAULT_LOCALE,
): RecipeCombination {
  if (combinations.length === 0) {
    throw new AppError(
      mealPlanMessages[locale].notAvailable,
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
  const messages =
    mealPlanMessages[
      input.locale ?? DEFAULT_LOCALE
    ];

  /*
   * Reutilizamos el motor de recomendaciones
   * que FoodAI ya tiene.
   */
  let recommendationResult;
  try {
    recommendationResult =
      await buildRecipeRecommendations({
        pantry: input.pantry,
        budget: input.budget,
        servings: input.servings,
        maxMinutes: input.maxMinutes,
        locale: input.locale,
      });
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === 'RECIPE_TIME_LIMIT_EXCEEDED'
    ) {
      throw new AppError(
        messages.insufficientRecipesWithinTime(
          input.maxMinutes,
          0,
        ),
        502,
        'INSUFFICIENT_RECIPES_FOR_PLAN',
      );
    }

    throw error;
  }

  if (
    recommendationResult.recipes.length <
    3
  ) {
    if (typeof input.maxMinutes === 'number') {
      throw new AppError(
        messages.insufficientRecipesWithinTime(
          input.maxMinutes,
          recommendationResult.recipes.length,
        ),
        502,
        'INSUFFICIENT_RECIPES_FOR_PLAN',
      );
    }

    throw new AppError(
      messages.insufficientRecipes,
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
      input.locale,
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
      messages.invalidResult,
      500,
      'INVALID_MEAL_PLAN_RESULT',
    );
  }

  return validation.data;
}