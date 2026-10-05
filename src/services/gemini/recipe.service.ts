import { geminiClient } from './gemini.client';

import {
  generatedRecipesJsonSchema,
  generatedRecipesSchema,
  type GeneratedRecipes,
  type RecipeRecommendationRequest,
} from '../../schemas/recipe.schema';

import { buildRecipeRecommendationPrompt } from '../../prompts/recommendRecipes.prompt';

import { AppError } from '../../utils/errors';

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
    const interaction =
      await geminiClient.interactions.create({
        model: 'gemini-3.8-flash',

        input: [
          {
            type: 'text',
            text: prompt,
          },
        ],

        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: generatedRecipesJsonSchema,
        },
      });

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

    return validation.data;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const geminiError = error as {
      status?: number;
      statusCode?: number;
    };

    const status =
      geminiError.status ??
      geminiError.statusCode;

    if (status === 429) {
      console.warn(
        '⚠️ Gemini alcanzó el límite de solicitudes al generar recetas.',
      );

      throw new AppError(
        'Se alcanzó temporalmente el límite de generación de recetas. Intenta nuevamente más tarde.',
        429,
        'GEMINI_RATE_LIMIT',
      );
    }

    if (status === 503) {
      console.warn(
        '⚠️ Gemini no está disponible temporalmente para generar recetas.',
      );

      throw new AppError(
        'El servicio de generación de recetas está temporalmente ocupado. Intenta nuevamente más tarde.',
        503,
        'GEMINI_UNAVAILABLE',
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