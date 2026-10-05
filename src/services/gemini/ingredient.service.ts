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

    const parsedResponse: unknown = JSON.parse(
      interaction.output_text,
    );

    const validation =
      ingredientAnalysisSchema.safeParse(parsedResponse);

    if (!validation.success) {
      console.error(
        'Respuesta inválida de Gemini:',
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
    if (error instanceof AppError) {
      throw error;
    }

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