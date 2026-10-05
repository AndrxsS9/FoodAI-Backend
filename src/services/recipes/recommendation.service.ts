import {
  recipeRecommendationResponseSchema,
  type RecipeRecommendationRequest,
  type RecipeRecommendationResponse,
  type RecommendedRecipe,
} from '../../schemas/recipe.schema';

import { generateRecipeRecommendations } from '../gemini/recipe.service';

import { matchRecipeWithPantry } from './pantryMatcher.service';

import { estimateMissingIngredientsCost } from '../pricing/ingredientPrice.service';

import { calculateConvenience } from './convenienceEngine.service';

import { AppError } from '../../utils/errors';

export async function buildRecipeRecommendations(
  input: RecipeRecommendationRequest,
): Promise<RecipeRecommendationResponse> {
  /*
   * 1. Gemini genera únicamente las recetas candidatas.
   */
  const generatedRecipes =
    await generateRecipeRecommendations(input);

  /*
   * 2. FoodAI analiza cada receta con lógica propia.
   */
  const recommendedRecipes: RecommendedRecipe[] =
    generatedRecipes.recipes.map((recipe) => {
      /*
       * Determinamos qué ingredientes ya están
       * disponibles y cuáles faltan.
       */
      const {
        availableIngredients,
        missingIngredients,
      } = matchRecipeWithPantry(
        recipe,
        input.pantry,
      );

      /*
       * Estimamos cuánto costaría comprar
       * únicamente los ingredientes faltantes.
       */
      const estimatedMissingCost =
        estimateMissingIngredientsCost(
          missingIngredients,
        );

      /*
       * FoodAI calcula la conveniencia.
       * Gemini no participa en este cálculo.
       */
      const {
        convenience,
        withinBudget,
        budgetRemaining,
        reason,
      } = calculateConvenience({
        totalIngredients:
          recipe.ingredients.length,

        availableIngredients:
          availableIngredients.length,

        estimatedMissingCost,

        budget: input.budget,
      });

      return {
        ...recipe,

        availableIngredients,

        missingIngredients,

        estimatedMissingCost,

        budgetRemaining,

        withinBudget,

        convenience,

        reason,
      };
    });

  /*
   * 3. Ordenamos las recomendaciones.
   *
   * Primero:
   * - mayor conveniencia
   *
   * En empate:
   * - menor costo faltante
   *
   * Luego:
   * - menor tiempo de preparación
   */
  recommendedRecipes.sort((a, b) => {
    if (b.convenience !== a.convenience) {
      return b.convenience - a.convenience;
    }

    if (
      a.estimatedMissingCost !==
      b.estimatedMissingCost
    ) {
      return (
        a.estimatedMissingCost -
        b.estimatedMissingCost
      );
    }

    return a.totalMinutes - b.totalMinutes;
  });

  const result = {
    recipes: recommendedRecipes,
  };

  /*
   * 4. Validación final.
   *
   * Aunque toda la lógica es interna,
   * validamos la respuesta antes de entregarla
   * al controller.
   */
  const validation =
    recipeRecommendationResponseSchema.safeParse(
      result,
    );

  if (!validation.success) {
    console.error(
      '❌ Error construyendo recomendaciones:',
      validation.error,
    );

    throw new AppError(
      'No fue posible construir las recomendaciones de recetas.',
      500,
      'INVALID_RECOMMENDATION_RESULT',
    );
  }

  return validation.data;
}