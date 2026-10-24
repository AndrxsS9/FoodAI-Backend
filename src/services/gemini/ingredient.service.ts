import { classifyGeminiError } from './geminiError';
import { executeGeminiRequest } from './geminiRequest';
import { GEMINI_INGREDIENT_TIMEOUT_MS } from './geminiTimeout';
import { geminiClient } from './gemini.client';

import {
  ingredientAnalysisJsonSchema,
  ingredientAnalysisSchema,
  type IngredientAnalysis,
} from '../../schemas/ingredient.schema';

import { detectIngredientsPrompt } from '../../prompts/detectIngredients.prompt';

import { AppError } from '../../utils/errors';

interface AnalyzeImageInput {
  buffer: Buffer;
  mimeType: string;
}

export async function analyzeIngredientsFromImage({
  buffer,
  mimeType,
}: AnalyzeImageInput): Promise<IngredientAnalysis> {
  const base64Image = buffer.toString('base64');

  try {
    const interaction = await executeGeminiRequest(
      () =>
        geminiClient.interactions.create({
          model: 'gemini-3.5-flash-lite',

          input: [
            {
              type: 'image',
              data: base64Image,
              mime_type: mimeType,
            },
            {
              type: 'text',
              text: detectIngredientsPrompt,
            },
          ],

          generation_config: {
            thinking_level: 'minimal',
          },

          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: ingredientAnalysisJsonSchema,
          },
        }),
      {
        timeoutMs: GEMINI_INGREDIENT_TIMEOUT_MS,
        maxAttempts: 1,
      },
    );

    if (!interaction.output_text) {
      throw new AppError(
        'Gemini no devolvió una respuesta.',
        502,
        'EMPTY_GEMINI_RESPONSE',
      );
    }

    let parsedResponse: unknown;

    try {
      parsedResponse = JSON.parse(interaction.output_text);
    } catch {
      throw new AppError(
        'Gemini devolvió una respuesta que no es JSON válido.',
        502,
        'INVALID_GEMINI_JSON',
      );
    }

    const validation =
      ingredientAnalysisSchema.safeParse(parsedResponse);

    if (!validation.success) {
      console.error(
        '❌ Respuesta inválida de Gemini:',
        validation.error,
      );

      throw new AppError(
        'La respuesta de análisis no tiene el formato esperado.',
        502,
        'INVALID_GEMINI_RESPONSE',
      );
    }

    return validation.data;
  } catch (error) {
    /*
     * Si el error ya fue creado por nuestra aplicación,
     * simplemente lo propagamos.
     */
    if (error instanceof AppError) {
      throw error;
    }

    const errorKind = classifyGeminiError(error);

    /*
     * Límite de solicitudes / cuota agotada.
     */
    if (errorKind === 'rate_limit') {
      console.warn(
        '⚠️ Gemini alcanzó el límite de solicitudes.',
      );

      throw new AppError(
        'Se alcanzó temporalmente el límite de solicitudes de análisis. Intenta nuevamente más tarde.',
        429,
        'GEMINI_RATE_LIMIT',
      );
    }

    /*
     * Gemini temporalmente saturado o no disponible.
     */
    if (errorKind === 'unavailable') {
      console.warn(
        '⚠️ Gemini está temporalmente no disponible.',
      );

      throw new AppError(
        'El servicio de análisis está temporalmente ocupado. Intenta nuevamente más tarde.',
        503,
        'GEMINI_UNAVAILABLE',
      );
    }

    /*
     * Solicitud excedió el tiempo límite.
     */
    if (errorKind === 'timeout') {
      console.warn(
        '⚠️ Gemini tardó demasiado en responder al analizar la imagen.',
      );

      throw new AppError(
        'El servicio de análisis tardó demasiado en responder. Intenta nuevamente.',
        504,
        'GEMINI_TIMEOUT',
      );
    }

    /*
     * Cualquier otro error inesperado.
     */
    console.error(
      '❌ Error analizando imagen con Gemini:',
      error,
    );

    throw new AppError(
      'No fue posible analizar la imagen.',
      502,
      'IMAGE_ANALYSIS_FAILED',
    );
  }
}