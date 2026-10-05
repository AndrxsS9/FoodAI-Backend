import { z } from 'zod';

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

export type Ingredient = z.infer<typeof ingredientSchema>;

export type IngredientAnalysis = z.infer<
  typeof ingredientAnalysisSchema
>;
export const ingredientAnalysisJsonSchema = {
  type: 'object',
  properties: {
    ingredients: {
      type: 'array',
      description:
        'Lista de alimentos visibles identificados en la imagen.',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'Nombre común del alimento en español.',
          },
          quantity: {
            type: ['number', 'null'],
            description:
              'Cantidad visible estimada. Null cuando no pueda determinarse.',
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
            description:
              'True cuando la identificación o cantidad requiere confirmación del usuario.',
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