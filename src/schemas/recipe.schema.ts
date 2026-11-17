import { z } from 'zod';

import { ingredientSchema } from './ingredient.schema';
import { DEFAULT_LOCALE, localeSchema, type SupportedLocale } from './locale.schema';

export const MAX_PANTRY_ITEMS = 100;
export const MAX_INGREDIENT_NAME_LENGTH = 100;
export const MAX_INGREDIENT_QUANTITY = 1_000_000;
export const MAX_BUDGET_COP = 100_000_000;

export const pantryIngredientInputSchema = ingredientSchema.extend({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre del ingrediente no puede estar vacío.')
    .max(
      MAX_INGREDIENT_NAME_LENGTH,
      `El nombre del ingrediente no puede exceder ${MAX_INGREDIENT_NAME_LENGTH} caracteres.`,
    ),
  quantity: z
    .number()
    .positive()
    .max(MAX_INGREDIENT_QUANTITY)
    .nullable(),
});

export const recipeRecommendationRequestSchema = z.object({
  pantry: z
    .array(pantryIngredientInputSchema)
    .min(1, 'Debes tener al menos un ingrediente en la despensa.')
    .max(
      MAX_PANTRY_ITEMS,
      `La despensa no puede superar ${MAX_PANTRY_ITEMS} ingredientes por solicitud.`,
    ),

  budget: z
    .number()
    .nonnegative('El presupuesto no puede ser negativo.')
    .max(MAX_BUDGET_COP, 'El presupuesto excede el límite permitido.'),

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

  locale: localeSchema,
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

export const stepDurationSchema = z.object({
  stepIndex: z.number().int().nonnegative(),

  minutes: z.number().int().positive().optional(),

  action: z.string().min(1).optional(),
});

export const generatedRecipeSchema = z.object({
  name: z.string().min(1),

  description: z.string().min(1),

  totalMinutes: z.number().int().positive(),

  prepMinutes: z.number().int().nonnegative().optional(),

  cookMinutes: z.number().int().nonnegative().optional(),

  stepDurations: z.array(stepDurationSchema).optional(),

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

export type StepDuration =
  z.infer<typeof stepDurationSchema>;

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

export function getGeneratedRecipesJsonSchema(
  locale: SupportedLocale = DEFAULT_LOCALE,
) {
  const isEn = locale === 'en';

  return {
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
              description: isEn
                ? 'Short and clear name of the recipe in English.'
                : 'Nombre corto y claro de la receta en español.',
            },

            description: {
              type: 'string',
              description: isEn
                ? 'Brief description of the preparation.'
                : 'Descripción breve de la preparación.',
            },

            totalMinutes: {
              type: 'number',
              description: isEn
                ? 'Total estimated preparation time in minutes.'
                : 'Tiempo total estimado de preparación en minutos.',
            },

            prepMinutes: {
              type: 'number',
              description: isEn
                ? 'Estimated preparation time for ingredients in minutes (optional).'
                : 'Tiempo estimado de preparación previa de ingredientes en minutos (opcional).',
            },

            cookMinutes: {
              type: 'number',
              description: isEn
                ? 'Estimated active or passive cooking time in minutes (optional).'
                : 'Tiempo estimado de cocción activa o pasiva en minutos (opcional).',
            },

            stepDurations: {
              type: 'array',
              description: isEn
                ? 'Optional duration estimate per step for actions such as boiling, frying, sautéing, baking.'
                : 'Estimación opcional de duración por paso para acciones como hervir, freír, sofreír, hornear.',
              items: {
                type: 'object',
                properties: {
                  stepIndex: {
                    type: 'number',
                    description: isEn
                      ? '0-based index of the corresponding step in the steps array.'
                      : 'Índice base 0 del paso correspondiente en el arreglo steps.',
                  },
                  minutes: {
                    type: 'number',
                    description: isEn
                      ? 'Estimated duration in minutes for this step.'
                      : 'Duración estimada en minutos de este paso.',
                  },
                  action: {
                    type: 'string',
                    description: isEn
                      ? 'Main action (e.g. boil, sauté, brown, bake, rest).'
                      : 'Acción principal (ej. hervir, sofreír, dorar, hornear, reposar).',
                  },
                },
                required: ['stepIndex'],
                additionalProperties: false,
              },
            },

            ingredients: {
              type: 'array',
              minItems: 1,

              items: {
                type: 'object',

                properties: {
                  name: {
                    type: 'string',
                    description: isEn
                      ? 'Common name of the ingredient in English.'
                      : 'Nombre común del ingrediente en español.',
                  },

                  quantity: {
                    type: ['number', 'null'],
                    description: isEn
                      ? 'Required quantity. Null if it cannot be reasonably determined.'
                      : 'Cantidad necesaria. Null si no puede determinarse razonablemente.',
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

              description: isEn
                ? 'Concrete, ordered steps to prepare the recipe.'
                : 'Pasos concretos y ordenados para preparar la receta.',
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
}

export const generatedRecipesJsonSchema =
  getGeneratedRecipesJsonSchema(DEFAULT_LOCALE);
