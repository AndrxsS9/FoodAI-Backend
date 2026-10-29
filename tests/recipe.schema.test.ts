import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  generatedRecipeSchema,
  generatedRecipesSchema,
  recipeIngredientSchema,
  recipeRecommendationRequestSchema,
  recipeRecommendationResponseSchema,
  recommendedRecipeSchema,
  stepDurationSchema,
  type GeneratedRecipe,
  type RecipeIngredient,
  type RecommendedRecipe,
} from '../src/schemas/recipe.schema';

import type {
  Ingredient,
} from '../src/schemas/ingredient.schema';

function buildValidPantryIngredient(
  overrides?: Partial<Ingredient>,
): Ingredient {
  return {
    name: 'arroz',
    quantity: 500,
    unit: 'g',
    needsReview: false,
    ...overrides,
  };
}

function buildValidRecipeIngredient(
  overrides?: Partial<RecipeIngredient>,
): RecipeIngredient {
  return {
    name: 'arroz',
    quantity: 200,
    unit: 'g',
    ...overrides,
  };
}

function buildValidGeneratedRecipe(
  overrides?: Partial<GeneratedRecipe>,
): GeneratedRecipe {
  return {
    name: 'Arroz con huevo',
    description: 'Receta casera fácil y nutritiva',
    totalMinutes: 20,
    ingredients: [buildValidRecipeIngredient()],
    steps: [
      'Paso 1: Cocinar el arroz',
      'Paso 2: Freír el huevo',
    ],
    ...overrides,
  };
}

function buildValidRecommendedRecipe(
  overrides?: Partial<RecommendedRecipe>,
): RecommendedRecipe {
  return {
    ...buildValidGeneratedRecipe(),
    availableIngredients: [buildValidRecipeIngredient()],
    missingIngredients: [],
    estimatedMissingCost: 0,
    budgetRemaining: 15000,
    withinBudget: true,
    convenience: 95,
    reason:
      'Aprovecha casi por completo los ingredientes disponibles y no requiere compras estimadas.',
    ...overrides,
  };
}

describe('recipe.schema - Pruebas unitarias de schemas de recetas', () => {
  describe('recipeRecommendationRequestSchema', () => {
    it('1. Acepta una solicitud válida con todos sus campos', () => {
      const validRequest = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 2,
        maxMinutes: 60,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(validRequest);

      expect(result.success).toBe(true);
    });

    it('2. Rechaza pantry vacío', () => {
      const request = {
        pantry: [],
        budget: 20000,
        servings: 2,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('3. Rechaza budget negativo', () => {
      const request = {
        pantry: [buildValidPantryIngredient()],
        budget: -100,
        servings: 2,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('4. Acepta budget = 0', () => {
      const request = {
        pantry: [buildValidPantryIngredient()],
        budget: 0,
        servings: 2,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
    });

    it('5. Rechaza servings < 1', () => {
      const request = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 0,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('6. Rechaza servings > 12', () => {
      const request = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 13,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('7. Acepta servings dentro del rango (1 a 12)', () => {
      const min = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 1,
      };
      const max = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 12,
      };

      expect(
        recipeRecommendationRequestSchema.safeParse(min).success,
      ).toBe(true);
      expect(
        recipeRecommendationRequestSchema.safeParse(max).success,
      ).toBe(true);
    });

    it('8. Acepta maxMinutes positivo y dentro de 240', () => {
      const request = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 2,
        maxMinutes: 120,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
    });

    it('9. Rechaza maxMinutes <= 0 o > 240', () => {
      const zero = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 2,
        maxMinutes: 0,
      };
      const overMax = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 2,
        maxMinutes: 241,
      };

      expect(
        recipeRecommendationRequestSchema.safeParse(zero).success,
      ).toBe(false);
      expect(
        recipeRecommendationRequestSchema.safeParse(overMax).success,
      ).toBe(false);
    });
  });

  describe('recipeIngredientSchema', () => {
    it('10. Acepta un ingrediente de receta válido', () => {
      const ingredient = buildValidRecipeIngredient();

      const result = recipeIngredientSchema.safeParse(ingredient);

      expect(result.success).toBe(true);
    });

    it('11. Rechaza name vacío', () => {
      const ingredient = buildValidRecipeIngredient({ name: '' });

      const result = recipeIngredientSchema.safeParse(ingredient);

      expect(result.success).toBe(false);
    });

    it('12. Acepta quantity null cuando no puede determinarse', () => {
      const ingredient = buildValidRecipeIngredient({
        quantity: null,
        unit: 'desconocida',
      });

      const result = recipeIngredientSchema.safeParse(ingredient);

      expect(result.success).toBe(true);
    });

    it('13. Rechaza quantity negativa o cero', () => {
      const zero = buildValidRecipeIngredient({ quantity: 0 });
      const negative = buildValidRecipeIngredient({ quantity: -5 });

      expect(recipeIngredientSchema.safeParse(zero).success).toBe(
        false,
      );
      expect(
        recipeIngredientSchema.safeParse(negative).success,
      ).toBe(false);
    });

    it('14. Acepta todas las unidades válidas del enum', () => {
      const units = [
        'unidad',
        'g',
        'kg',
        'ml',
        'l',
        'cucharada',
        'cucharadita',
        'taza',
        'desconocida',
      ] as const;

      for (const unit of units) {
        const ingredient = buildValidRecipeIngredient({ unit });
        const result = recipeIngredientSchema.safeParse(ingredient);
        expect(result.success).toBe(true);
      }
    });

    it('15. Rechaza unidades no permitidas', () => {
      const ingredient = {
        name: 'arroz',
        quantity: 200,
        unit: 'libras',
      };

      const result = recipeIngredientSchema.safeParse(ingredient);

      expect(result.success).toBe(false);
    });
  });

  describe('generatedRecipeSchema', () => {
    it('16. Acepta una receta generada completa y válida', () => {
      const recipe = buildValidGeneratedRecipe();

      const result = generatedRecipeSchema.safeParse(recipe);

      expect(result.success).toBe(true);
    });

    it('17. Rechaza name vacío', () => {
      const recipe = buildValidGeneratedRecipe({ name: '' });

      const result = generatedRecipeSchema.safeParse(recipe);

      expect(result.success).toBe(false);
    });

    it('18. Rechaza description vacía', () => {
      const recipe = buildValidGeneratedRecipe({
        description: '',
      });

      const result = generatedRecipeSchema.safeParse(recipe);

      expect(result.success).toBe(false);
    });

    it('19. Rechaza totalMinutes <= 0', () => {
      const zero = buildValidGeneratedRecipe({
        totalMinutes: 0,
      });
      const negative = buildValidGeneratedRecipe({
        totalMinutes: -10,
      });

      expect(
        generatedRecipeSchema.safeParse(zero).success,
      ).toBe(false);
      expect(
        generatedRecipeSchema.safeParse(negative).success,
      ).toBe(false);
    });

    it('20. Rechaza arreglo de ingredients vacío', () => {
      const recipe = buildValidGeneratedRecipe({
        ingredients: [],
      });

      const result = generatedRecipeSchema.safeParse(recipe);

      expect(result.success).toBe(false);
    });

    it('21. Rechaza arreglo de steps vacío', () => {
      const recipe = buildValidGeneratedRecipe({ steps: [] });

      const result = generatedRecipeSchema.safeParse(recipe);

      expect(result.success).toBe(false);
    });
  });

  describe('Enriquecimiento de tiempos de preparación, cocción y pasos (prepMinutes, cookMinutes, stepDurations)', () => {
    it('acepta receta legacy sin campos de tiempo opcionales (retrocompatibilidad)', () => {
      const legacyRecipe: GeneratedRecipe = {
        name: 'Arroz simple',
        description: 'Receta básica',
        totalMinutes: 20,
        ingredients: [buildValidRecipeIngredient()],
        steps: ['Cocinar arroz.'],
      };

      const result = generatedRecipeSchema.safeParse(legacyRecipe);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prepMinutes).toBeUndefined();
        expect(result.data.cookMinutes).toBeUndefined();
        expect(result.data.stepDurations).toBeUndefined();
      }
    });

    it('acepta receta con prepMinutes y cookMinutes enteros válidos', () => {
      const recipe = buildValidGeneratedRecipe({
        prepMinutes: 10,
        cookMinutes: 15,
        totalMinutes: 25,
      });

      const result = generatedRecipeSchema.safeParse(recipe);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prepMinutes).toBe(10);
        expect(result.data.cookMinutes).toBe(15);
      }
    });

    it('acepta prepMinutes = 0 y cookMinutes = 0 (ej. ensaladas o preparaciones frías)', () => {
      const recipe = buildValidGeneratedRecipe({
        prepMinutes: 5,
        cookMinutes: 0,
        totalMinutes: 5,
      });

      const result = generatedRecipeSchema.safeParse(recipe);
      expect(result.success).toBe(true);
    });

    it('rechaza prepMinutes negativo o cookMinutes negativo', () => {
      const negativePrep = buildValidGeneratedRecipe({
        prepMinutes: -5,
      });
      const negativeCook = buildValidGeneratedRecipe({
        cookMinutes: -10,
      });

      expect(generatedRecipeSchema.safeParse(negativePrep).success).toBe(false);
      expect(generatedRecipeSchema.safeParse(negativeCook).success).toBe(false);
    });

    it('rechaza prepMinutes o cookMinutes no enteros', () => {
      const floatPrep = {
        ...buildValidGeneratedRecipe(),
        prepMinutes: 5.5,
      };

      expect(generatedRecipeSchema.safeParse(floatPrep).success).toBe(false);
    });

    it('acepta stepDurations con metadata estructurada por paso', () => {
      const recipe = buildValidGeneratedRecipe({
        steps: [
          'Picar cebolla y tomate',
          'Sofreír los aliños a fuego medio',
          'Hervir con agua y servir',
        ],
        stepDurations: [
          { stepIndex: 0, minutes: 5, action: 'picar' },
          { stepIndex: 1, minutes: 7, action: 'sofreír' },
          { stepIndex: 2, minutes: 10, action: 'hervir' },
        ],
      });

      const result = generatedRecipeSchema.safeParse(recipe);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stepDurations).toHaveLength(3);
        expect(result.data.stepDurations?.[1].action).toBe('sofreír');
      }
    });

    it('valida stepDurationSchema individualmente', () => {
      const valid = stepDurationSchema.safeParse({
        stepIndex: 0,
        minutes: 10,
        action: 'hornear',
      });
      expect(valid.success).toBe(true);

      const invalidIndex = stepDurationSchema.safeParse({
        stepIndex: -1,
        minutes: 10,
      });
      expect(invalidIndex.success).toBe(false);

      const invalidMinutes = stepDurationSchema.safeParse({
        stepIndex: 0,
        minutes: 0,
      });
      expect(invalidMinutes.success).toBe(false);
    });

    it('recommendedRecipeSchema propaga y preserva prepMinutes, cookMinutes y stepDurations', () => {
      const recommended = buildValidRecommendedRecipe({
        prepMinutes: 10,
        cookMinutes: 20,
        totalMinutes: 30,
        stepDurations: [
          { stepIndex: 0, minutes: 10, action: 'preparar' },
          { stepIndex: 1, minutes: 20, action: 'cocinar' },
        ],
      });

      const result = recommendedRecipeSchema.safeParse(recommended);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prepMinutes).toBe(10);
        expect(result.data.cookMinutes).toBe(20);
        expect(result.data.stepDurations).toHaveLength(2);
      }
    });
  });

  describe('generatedRecipesSchema', () => {
    it('22. Acepta entre 1 y 5 recetas válidas', () => {
      const oneRecipe = {
        recipes: [buildValidGeneratedRecipe()],
      };
      const fiveRecipes = {
        recipes: [
          buildValidGeneratedRecipe({ name: 'R1' }),
          buildValidGeneratedRecipe({ name: 'R2' }),
          buildValidGeneratedRecipe({ name: 'R3' }),
          buildValidGeneratedRecipe({ name: 'R4' }),
          buildValidGeneratedRecipe({ name: 'R5' }),
        ],
      };

      expect(
        generatedRecipesSchema.safeParse(oneRecipe).success,
      ).toBe(true);
      expect(
        generatedRecipesSchema.safeParse(fiveRecipes).success,
      ).toBe(true);
    });

    it('23. Rechaza 0 recetas candidatas', () => {
      const result = generatedRecipesSchema.safeParse({
        recipes: [],
      });

      expect(result.success).toBe(false);
    });

    it('24. Rechaza más de 5 recetas candidatas', () => {
      const sixRecipes = {
        recipes: [
          buildValidGeneratedRecipe({ name: 'R1' }),
          buildValidGeneratedRecipe({ name: 'R2' }),
          buildValidGeneratedRecipe({ name: 'R3' }),
          buildValidGeneratedRecipe({ name: 'R4' }),
          buildValidGeneratedRecipe({ name: 'R5' }),
          buildValidGeneratedRecipe({ name: 'R6' }),
        ],
      };

      const result =
        generatedRecipesSchema.safeParse(sixRecipes);

      expect(result.success).toBe(false);
    });
  });

  describe('recommendedRecipeSchema', () => {
    it('25. Acepta una recomendación completa y válida', () => {
      const recommended = buildValidRecommendedRecipe();

      const result =
        recommendedRecipeSchema.safeParse(recommended);

      expect(result.success).toBe(true);
    });

    it('26. Acepta budgetRemaining negativo cuando supera el presupuesto', () => {
      const recommended = buildValidRecommendedRecipe({
        budgetRemaining: -5000,
        withinBudget: false,
        reason:
          'Requiere compras adicionales que superan el presupuesto estimado.',
      });

      const result =
        recommendedRecipeSchema.safeParse(recommended);

      expect(result.success).toBe(true);
    });

    it('27. Rechaza estimatedMissingCost negativo', () => {
      const recommended = buildValidRecommendedRecipe({
        estimatedMissingCost: -100,
      });

      const result =
        recommendedRecipeSchema.safeParse(recommended);

      expect(result.success).toBe(false);
    });

    it('28. Rechaza convenience negativa', () => {
      const recommended = buildValidRecommendedRecipe({
        convenience: -1,
      });

      const result =
        recommendedRecipeSchema.safeParse(recommended);

      expect(result.success).toBe(false);
    });

    it('29. Rechaza convenience > 100 pero acepta convenience = 100', () => {
      const atMax = buildValidRecommendedRecipe({
        convenience: 100,
      });
      const overMax = buildValidRecommendedRecipe({
        convenience: 101,
      });

      expect(
        recommendedRecipeSchema.safeParse(atMax).success,
      ).toBe(true);
      expect(
        recommendedRecipeSchema.safeParse(overMax).success,
      ).toBe(false);
    });

    it('30. Rechaza reason vacío', () => {
      const recommended = buildValidRecommendedRecipe({
        reason: '',
      });

      const result =
        recommendedRecipeSchema.safeParse(recommended);

      expect(result.success).toBe(false);
    });
  });

  describe('recipeRecommendationResponseSchema e inmutabilidad', () => {
    it('31. Acepta un arreglo válido de recomendaciones', () => {
      const response = {
        recipes: [
          buildValidRecommendedRecipe({ name: 'R1' }),
          buildValidRecommendedRecipe({ name: 'R2' }),
        ],
      };

      const result =
        recipeRecommendationResponseSchema.safeParse(response);

      expect(result.success).toBe(true);
    });

    it('32. safeParse no muta el objeto original utilizado', () => {
      const original = buildValidRecommendedRecipe();
      const clone = structuredClone(original);

      recommendedRecipeSchema.safeParse(original);

      expect(original).toEqual(clone);
    });
  });
});
