import { z } from 'zod';

import { ingredientSchema } from './ingredient.schema';

export const recipeRecommendationRequestSchema = z.object({
  pantry: z
    .array(ingredientSchema)
    .min(1, 'Debes tener al menos un ingrediente en la despensa.'),

  budget: z
    .number()
    .nonnegative('El presupuesto no puede ser negativo.'),

  servings: z
    .number()
    .int()
    .min(1)
    .max(12),

  maxMinutes: z
    .number()
    .int()
    .positive()
    .max(240)
    .optional(),
});

export const recipeIngredientSchema = z.object({
  name: z.string().min(1),

  quantity: z.number().positive().nullable(),

  unit: z.enum([
    'unidad',
    'g',
    'kg',
    'ml',
    'l',
    'cucharada',
    'cucharadita',
    'taza',
    'desconocida',
  ]),
});

export const generatedRecipeSchema = z.object({
  name: z.string().min(1),

  description: z.string().min(1),

  totalMinutes: z.number().int().positive(),

  ingredients: z
    .array(recipeIngredientSchema)
    .min(1),

  steps: z
    .array(z.string().min(1))
    .min(1),
});

export const generatedRecipesSchema = z.object({
  recipes: z
    .array(generatedRecipeSchema)
    .min(1)
    .max(5),
});

export const recommendedRecipeSchema =
  generatedRecipeSchema.extend({
    availableIngredients: z.array(
      recipeIngredientSchema,
    ),

    missingIngredients: z.array(
      recipeIngredientSchema,
    ),

    estimatedMissingCost: z
      .number()
      .nonnegative(),

    budgetRemaining: z.number(),

    withinBudget: z.boolean(),

    convenience: z
      .number()
      .min(0)
      .max(100),

    reason: z.string().min(1),
  });

export const recipeRecommendationResponseSchema =
  z.object({
    recipes: z.array(recommendedRecipeSchema),
  });

export type RecipeRecommendationRequest =
  z.infer<
    typeof recipeRecommendationRequestSchema
  >;

export type RecipeIngredient =
  z.infer<typeof recipeIngredientSchema>;

export type GeneratedRecipe =
  z.infer<typeof generatedRecipeSchema>;

export type GeneratedRecipes =
  z.infer<typeof generatedRecipesSchema>;

export type RecommendedRecipe =
  z.infer<typeof recommendedRecipeSchema>;

export type RecipeRecommendationResponse =
  z.infer<
    typeof recipeRecommendationResponseSchema
  >;

export const generatedRecipesJsonSchema = {
  type: 'object',

  properties: {
    recipes: {
      type: 'array',
      minItems: 1,
      maxItems: 5,

      items: {
        type: 'object',

        properties: {
          name: {
            type: 'string',
            description:
              'Nombre corto y claro de la receta en español.',
          },

          description: {
            type: 'string',
            description:
              'Descripción breve de la preparación.',
          },

          totalMinutes: {
            type: 'number',
            description:
              'Tiempo total estimado de preparación en minutos.',
          },

          ingredients: {
            type: 'array',
            minItems: 1,

            items: {
              type: 'object',

              properties: {
                name: {
                  type: 'string',
                  description:
                    'Nombre común del ingrediente en español.',
                },

                quantity: {
                  type: ['number', 'null'],
                  description:
                    'Cantidad necesaria. Null si no puede determinarse razonablemente.',
                },

                unit: {
                  type: 'string',

                  enum: [
                    'unidad',
                    'g',
                    'kg',
                    'ml',
                    'l',
                    'cucharada',
                    'cucharadita',
                    'taza',
                    'desconocida',
                  ],
                },
              },

              required: [
                'name',
                'quantity',
                'unit',
              ],

              additionalProperties: false,
            },
          },

          steps: {
            type: 'array',
            minItems: 1,

            items: {
              type: 'string',
            },

            description:
              'Pasos concretos y ordenados para preparar la receta.',
          },
        },

        required: [
          'name',
          'description',
          'totalMinutes',
          'ingredients',
          'steps',
        ],

        additionalProperties: false,
      },
    },
  },

  required: ['recipes'],

  additionalProperties: false,
};