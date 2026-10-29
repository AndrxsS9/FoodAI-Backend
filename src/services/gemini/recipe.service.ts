import { classifyGeminiError } from './geminiError';
import { executeGeminiRequest } from './geminiRequest';
import {
  GEMINI_RECIPE_TIMEOUT_MS,
} from './geminiTimeout';
import { geminiClient } from './gemini.client';

import {
  generatedRecipesJsonSchema,
  generatedRecipesSchema,
  type GeneratedRecipe,
  type GeneratedRecipes,
  type RecipeRecommendationRequest,
} from '../../schemas/recipe.schema';

import { buildRecipeRecommendationPrompt } from '../../prompts/recommendRecipes.prompt';

import { AppError } from '../../utils/errors';

export function sanitizeRecipeTimings(recipe: GeneratedRecipe): GeneratedRecipe {
  let { totalMinutes, prepMinutes, cookMinutes, stepDurations } = recipe;

  if (typeof prepMinutes === 'number' && typeof cookMinutes === 'number') {
    if (prepMinutes + cookMinutes > totalMinutes) {
      totalMinutes = prepMinutes + cookMinutes;
    }
  } else if (typeof prepMinutes === 'number' && prepMinutes > totalMinutes) {
    totalMinutes = prepMinutes;
  } else if (typeof cookMinutes === 'number' && cookMinutes > totalMinutes) {
    totalMinutes = cookMinutes;
  }

  let sanitizedStepDurations = stepDurations;
  if (Array.isArray(stepDurations)) {
    sanitizedStepDurations = stepDurations.filter(
      (sd) => sd.stepIndex >= 0 && sd.stepIndex < recipe.steps.length,
    );
  }

  return {
    ...recipe,
    totalMinutes,
    ...(prepMinutes !== undefined ? { prepMinutes } : {}),
    ...(cookMinutes !== undefined ? { cookMinutes } : {}),
    ...(sanitizedStepDurations !== undefined ? { stepDurations: sanitizedStepDurations } : {}),
  };
}

export async function generateRecipeRecommendations(
  input: RecipeRecommendationRequest,
): Promise<GeneratedRecipes> {
  const prompt = buildRecipeRecommendationPrompt({
    pantry: input.pantry,
    budget: input.budget,
    servings: input.servings,
    maxMinutes: input.maxMinutes,
  });

  try {
    const interaction = await executeGeminiRequest(
      () =>
        geminiClient.interactions.create({
          model: 'gemini-3.5-flash-lite',

          input: [
            {
              type: 'text',
              text: prompt,
            },
          ],

          generation_config: {
            thinking_level: 'minimal',
          },

          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: generatedRecipesJsonSchema,
          },
        }),
      {
        timeoutMs: GEMINI_RECIPE_TIMEOUT_MS,
        maxAttempts: 1,
      },
    );

    if (!interaction.output_text) {
      throw new AppError(
        'Gemini no devolvió recetas.',
        502,
        'EMPTY_RECIPE_RESPONSE',
      );
    }

    let parsedResponse: unknown;

    try {
      parsedResponse = JSON.parse(
        interaction.output_text,
      );
    } catch {
      throw new AppError(
        'Gemini devolvió recetas en un formato JSON inválido.',
        502,
        'INVALID_RECIPE_JSON',
      );
    }

    const validation =
      generatedRecipesSchema.safeParse(
        parsedResponse,
      );

    if (!validation.success) {
      console.error(
        '❌ Respuesta de recetas inválida:',
        validation.error,
      );

      throw new AppError(
        'Las recetas generadas no tienen el formato esperado.',
        502,
        'INVALID_RECIPE_RESPONSE',
      );
    }

    const sanitizedRecipes = validation.data.recipes.map(sanitizeRecipeTimings);

    return {
      recipes: sanitizedRecipes,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const errorKind = classifyGeminiError(error);

    if (errorKind === 'rate_limit') {
      console.warn(
        '⚠️ Gemini alcanzó el límite de solicitudes al generar recetas.',
      );

      throw new AppError(
        'Se alcanzó temporalmente el límite de generación de recetas. Intenta nuevamente más tarde.',
        429,
        'GEMINI_RATE_LIMIT',
      );
    }

    if (errorKind === 'unavailable') {
      console.warn(
        '⚠️ Gemini no está disponible temporalmente para generar recetas.',
      );

      throw new AppError(
        'El servicio de generación de recetas está temporalmente ocupado. Intenta nuevamente más tarde.',
        503,
        'GEMINI_UNAVAILABLE',
      );
    }

    if (errorKind === 'timeout') {
      console.warn(
        '⚠️ Gemini tardó demasiado en responder al generar recetas.',
      );

      throw new AppError(
        'El servicio de generación de recetas tardó demasiado en responder. Intenta nuevamente.',
        504,
        'GEMINI_TIMEOUT',
      );
    }

    console.error(
      '❌ Error generando recetas con Gemini:',
      error,
    );

    throw new AppError(
      'No fue posible generar las recetas.',
      502,
      'RECIPE_GENERATION_FAILED',
    );
  }
}
