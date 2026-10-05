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
    const interaction = await geminiClient.interactions.create({
      model: 'gemini-3.8-flash',

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

      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: ingredientAnalysisJsonSchema,
      },
    });

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

    /*
     * Los errores del SDK de Gemini pueden contener
     * status o statusCode.
     */
    const geminiError = error as {
      status?: number;
      statusCode?: number;
    };

    const status =
      geminiError.status ??
      geminiError.statusCode;

    /*
     * Límite de solicitudes / cuota agotada.
     */
    if (status === 429) {
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
    if (status === 503) {
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