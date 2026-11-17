import { z } from 'zod';

import { DEFAULT_LOCALE, localeSchema, type SupportedLocale } from './locale.schema';

export const ingredientSchema = z.object({
  name: z.string().min(1),

  quantity: z
    .number()
    .positive()
    .nullable(),

  unit: z.enum([
    'unidad',
    'g',
    'kg',
    'ml',
    'l',
    'desconocida',
  ]),

  needsReview: z.boolean(),
});

export const ingredientAnalysisSchema = z.object({
  ingredients: z.array(ingredientSchema),
});

export const ingredientAnalysisQuerySchema = z.object({
  locale: localeSchema,
});

export type Ingredient = z.infer<typeof ingredientSchema>;

export type IngredientAnalysis = z.infer<
  typeof ingredientAnalysisSchema
>;

export type IngredientAnalysisQuery = z.infer<
  typeof ingredientAnalysisQuerySchema
>;

export function getIngredientAnalysisJsonSchema(
  locale: SupportedLocale = DEFAULT_LOCALE,
) {
  const isEn = locale === 'en';

  return {
    type: 'object',
    properties: {
      ingredients: {
        type: 'array',
        description: isEn
          ? 'List of visible food items identified in the image.'
          : 'Lista de alimentos visibles identificados en la imagen.',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: isEn
                ? 'Common name of the food item in English.'
                : 'Nombre común del alimento en español.',
            },
            quantity: {
              type: ['number', 'null'],
              description: isEn
                ? 'Estimated visible quantity. Null when it cannot be determined.'
                : 'Cantidad visible estimada. Null cuando no pueda determinarse.',
            },
            unit: {
              type: 'string',
              enum: [
                'unidad',
                'g',
                'kg',
                'ml',
                'l',
                'desconocida',
              ],
            },
            needsReview: {
              type: 'boolean',
              description: isEn
                ? 'True when identification or quantity requires user confirmation.'
                : 'True cuando la identificación o cantidad requiere confirmación del usuario.',
            },
          },
          required: [
            'name',
            'quantity',
            'unit',
            'needsReview',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['ingredients'],
    additionalProperties: false,
  };
}

export const ingredientAnalysisJsonSchema =
  getIngredientAnalysisJsonSchema(DEFAULT_LOCALE);