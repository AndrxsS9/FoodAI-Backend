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
  type StepDuration,
} from '../../schemas/recipe.schema';

import { buildRecipeRecommendationPrompt } from '../../prompts/recommendRecipes.prompt';

import { AppError } from '../../utils/errors';

export function sanitizeRecipeTimings(
  recipe: GeneratedRecipe,
  maxMinutes?: number,
): GeneratedRecipe {
  let totalMinutes = recipe.totalMinutes;
  const { prepMinutes, cookMinutes, stepDurations } = recipe;

  // 1. Validar y filtrar stepDurations:
  // - Índices válidos dentro del arreglo steps (0 <= stepIndex < steps.length)
  // - Duración coherente individual (entero positivo <= totalMinutes y <= maxMinutes si está definido)
  // - Duración coherente acumulada (suma de pasos <= totalMinutes y <= maxMinutes si está definido)
  let sanitizedStepDurations: StepDuration[] | undefined = undefined;
  if (Array.isArray(stepDurations)) {
    const validDurations = stepDurations.filter((sd) => {
      if (sd.stepIndex < 0 || sd.stepIndex >= recipe.steps.length) {
        return false;
      }
      if (typeof sd.minutes === 'number') {
        if (
          sd.minutes <= 0 ||
          !Number.isInteger(sd.minutes) ||
          sd.minutes > totalMinutes
        ) {
          return false;
        }
        if (typeof maxMinutes === 'number' && sd.minutes > maxMinutes) {
          return false;
        }
      }
      return true;
    });

    const sumStepMinutes = validDurations.reduce(
      (acc, sd) => acc + (typeof sd.minutes === 'number' ? sd.minutes : 0),
      0,
    );

    const isSumCoherent =
      sumStepMinutes <= totalMinutes &&
      (typeof maxMinutes !== 'number' || sumStepMinutes <= maxMinutes);

    if (isSumCoherent && validDurations.length > 0) {
      sanitizedStepDurations = validDurations;
    }
  }

  // 2. Validar prepMinutes y cookMinutes como enteros no negativos
  const hasValidPrep =
    typeof prepMinutes === 'number' &&
    Number.isInteger(prepMinutes) &&
    prepMinutes >= 0;

  const hasValidCook =
    typeof cookMinutes === 'number' &&
    Number.isInteger(cookMinutes) &&
    cookMinutes >= 0;

  let finalPrep = hasValidPrep ? prepMinutes : undefined;
  let finalCook = hasValidCook ? cookMinutes : undefined;

  // 3. Manejo seguro de consistencia temporal:
  // Si ambos están definidos y su suma supera totalMinutes:
  if (finalPrep !== undefined && finalCook !== undefined) {
    const combinedMinutes = finalPrep + finalCook;

    if (combinedMinutes > totalMinutes) {
      if (typeof maxMinutes === 'number' && combinedMinutes > maxMinutes) {
        // Inconsistencia: la suma de tiempos opcionales superaría maxMinutes solicitado por el usuario.
        // No fabricamos tiempos artificialmente menores (no acortamos prep ni cook).
        // Manejamos la metadata opcional inconsistente omitiéndola de forma segura,
        // preservando totalMinutes original de la receta.
        finalPrep = undefined;
        finalCook = undefined;
      } else {
        // Si no se solicitó maxMinutes o la suma no supera maxMinutes,
        // sincronizamos totalMinutes con el tiempo real combinado de preparación y cocción.
        totalMinutes = combinedMinutes;
      }
    }
  } else if (finalPrep !== undefined && finalPrep > totalMinutes) {
    if (typeof maxMinutes === 'number' && finalPrep > maxMinutes) {
      finalPrep = undefined;
    } else {
      totalMinutes = finalPrep;
    }
  } else if (finalCook !== undefined && finalCook > totalMinutes) {
    if (typeof maxMinutes === 'number' && finalCook > maxMinutes) {
      finalCook = undefined;
    } else {
      totalMinutes = finalCook;
    }
  }

  const cleanedRecipe = { ...recipe };
  delete cleanedRecipe.prepMinutes;
  delete cleanedRecipe.cookMinutes;
  delete cleanedRecipe.stepDurations;

  return {
    ...cleanedRecipe,
    totalMinutes,
    ...(finalPrep !== undefined ? { prepMinutes: finalPrep } : {}),
    ...(finalCook !== undefined ? { cookMinutes: finalCook } : {}),
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

    const sanitizedRecipes = validation.data.recipes.map((r) =>
      sanitizeRecipeTimings(r, input.maxMinutes),
    );

    // Validación estricta de maxMinutes:
    // Nunca retornar silenciosamente recetas que excedan el límite solicitado por el usuario.
    let filteredRecipes = sanitizedRecipes;
    if (typeof input.maxMinutes === 'number') {
      filteredRecipes = sanitizedRecipes.filter(
        (recipe) => recipe.totalMinutes <= input.maxMinutes!,
      );

      if (filteredRecipes.length === 0) {
        console.warn(
          `⚠️ Ninguna de las recetas generadas por Gemini cumple con maxMinutes (${input.maxMinutes}).`,
        );

        throw new AppError(
          `Las recetas generadas exceden el tiempo máximo solicitado de ${input.maxMinutes} minutos.`,
          502,
          'RECIPE_TIME_LIMIT_EXCEEDED',
        );
      }
    }

    return {
      recipes: filteredRecipes,
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
