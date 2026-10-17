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

    it('4. Acepta budget igual a cero', () => {
      const request = {
        pantry: [buildValidPantryIngredient()],
        budget: 0,
        servings: 2,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
    });

    it('5. Rechaza servings = 0', () => {
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

    it('7. Rechaza servings decimal', () => {
      const request = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 2.5,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('8. maxMinutes es opcional', () => {
      const request = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 4,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxMinutes).toBeUndefined();
      }
    });

    it('9. Rechaza maxMinutes = 0', () => {
      const request = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 4,
        maxMinutes: 0,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('10. Rechaza maxMinutes > 240', () => {
      const request = {
        pantry: [buildValidPantryIngredient()],
        budget: 20000,
        servings: 4,
        maxMinutes: 241,
      };

      const result =
        recipeRecommendationRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });
  });

  describe('recipeIngredientSchema', () => {
    const validUnits: Array<RecipeIngredient['unit']> = [
      'unidad',
      'g',
      'kg',
      'ml',
      'l',
      'cucharada',
      'cucharadita',
      'taza',
      'desconocida',
    ];

    it.each(validUnits)(
      '11. Acepta la unidad válida soportada: "%s"',
      (unit) => {
        const ingredient = buildValidRecipeIngredient({ unit });

        const result =
          recipeIngredientSchema.safeParse(ingredient);

        expect(result.success).toBe(true);
      },
    );

    it('12. Rechaza una unidad no soportada', () => {
      const ingredient = {
        name: 'arroz',
        quantity: 200,
        unit: 'litros',
      };

      const result =
        recipeIngredientSchema.safeParse(ingredient);

      expect(result.success).toBe(false);
    });

    it('13. Acepta quantity = null', () => {
      const ingredient = buildValidRecipeIngredient({
        quantity: null,
      });

      const result =
        recipeIngredientSchema.safeParse(ingredient);

      expect(result.success).toBe(true);
    });

    it('14. Rechaza quantity = 0', () => {
      const ingredient = buildValidRecipeIngredient({
        quantity: 0,
      });

      const result =
        recipeIngredientSchema.safeParse(ingredient);

      expect(result.success).toBe(false);
    });

    it('15. Rechaza quantity negativa', () => {
      const ingredient = buildValidRecipeIngredient({
        quantity: -5,
      });

      const result =
        recipeIngredientSchema.safeParse(ingredient);

      expect(result.success).toBe(false);
    });
  });

  describe('generatedRecipeSchema', () => {
    it('16. Acepta una receta generada válida', () => {
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
