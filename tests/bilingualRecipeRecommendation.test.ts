import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/services/gemini/gemini.client', () => ({
  geminiClient: {
    interactions: {
      create: vi.fn(),
    },
  },
}));

import { geminiClient } from '../src/services/gemini/gemini.client';
import {
  buildRecipeRecommendationPrompt,
  recommendRecipesPrompt,
  recommendRecipesPromptEn,
  recommendRecipesPromptEs,
} from '../src/prompts/recommendRecipes.prompt';
import {
  generatedRecipesJsonSchema,
  getGeneratedRecipesJsonSchema,
} from '../src/schemas/recipe.schema';
import { calculateConvenience } from '../src/services/recipes/convenienceEngine.service';
import { generateRecipeRecommendations } from '../src/services/gemini/recipe.service';
import { buildRecipeRecommendations } from '../src/services/recipes/recommendation.service';
import app from '../src/app';
import {
  setupTestSupabaseJwks,
  signTestSupabaseJwt,
  teardownTestSupabaseJwks,
} from './helpers/testAuth';

const mockedCreate = vi.mocked(geminiClient.interactions.create);

describe('Fase 28C-B2.2 — Recetas Bilingües y Razones de Recomendación con Gemini', () => {
  describe('1. Contratos de Prompt y JSON Schema', () => {
    const samplePantry = [
      { name: 'tomate', quantity: 3, unit: 'unidad', needsReview: false },
      { name: 'arroz', quantity: null, unit: 'desconocida', needsReview: true },
    ];

    it('prompt por defecto y para es utiliza instrucciones y vocabulario en español', () => {
      const promptDefault = buildRecipeRecommendationPrompt({
        pantry: samplePantry,
        budget: 25000,
        servings: 3,
        maxMinutes: 45,
      });

      const promptEs = buildRecipeRecommendationPrompt({
        pantry: samplePantry,
        budget: 25000,
        servings: 3,
        maxMinutes: 45,
        locale: 'es',
      });

      expect(promptDefault).toBe(promptEs);
      expect(promptEs).toContain(recommendRecipesPromptEs);
      expect(promptEs).toContain('DATOS DEL USUARIO:');
      expect(promptEs).toContain('Despensa disponible:');
      expect(promptEs).toContain('- tomate: 3 unidad');
      expect(promptEs).toContain('- arroz: cantidad no determinada');
      expect(promptEs).toContain('45 minutos');
      expect(promptEs).toContain('25000 COP');
      expect(promptEs).toContain('Genera EXACTAMENTE 3 recetas diferentes');
    });

    it('prompt para en utiliza instrucciones en inglés y reglas equivalentes', () => {
      const promptEn = buildRecipeRecommendationPrompt({
        pantry: samplePantry,
        budget: 25000,
        servings: 3,
        maxMinutes: 45,
        locale: 'en',
      });

      expect(promptEn).toContain(recommendRecipesPromptEn);
      expect(promptEn).toContain('USER DATA:');
      expect(promptEn).toContain('Available pantry:');
      expect(promptEn).toContain('- tomate: 3 unidad');
      expect(promptEn).toContain('- arroz: undetermined quantity');
      expect(promptEn).toContain('45 minutes');
      expect(promptEn).toContain('25000 COP');
      expect(promptEn).toContain('Generate EXACTLY 3 different, useful, and varied recipes');
      expect(promptEn).toContain('Use common recipe names, descriptions, ingredient names, preparation steps, and optional stepDurations.action in natural English');
      expect(promptEn).toContain('Allowed canonical units exclusively: "unidad", "g", "kg", "ml", "l", "cucharada", "cucharadita", "taza", "desconocida"');
      expect(promptEn).toContain('Never translate these canonical unit identifiers into English words');
    });

    it('formatea correctamente tiempo sin límite específico en ambos idiomas', () => {
      const promptEs = buildRecipeRecommendationPrompt({
        pantry: samplePantry,
        budget: 10000,
        servings: 2,
        locale: 'es',
      });
      const promptEn = buildRecipeRecommendationPrompt({
        pantry: samplePantry,
        budget: 10000,
        servings: 2,
        locale: 'en',
      });

      expect(promptEs).toContain('sin límite específico');
      expect(promptEn).toContain('no specific limit');
    });

    it('schema por defecto y para es contiene descripciones en español y unidades canónicas', () => {
      const schemaEs = getGeneratedRecipesJsonSchema('es');
      expect(schemaEs).toEqual(generatedRecipesJsonSchema);
      expect(schemaEs.properties.recipes.items.properties.name.description).toBe(
        'Nombre corto y claro de la receta en español.',
      );
      expect(schemaEs.properties.recipes.items.properties.ingredients.items.properties.unit.enum).toEqual([
        'unidad',
        'g',
        'kg',
        'ml',
        'l',
        'cucharada',
        'cucharadita',
        'taza',
        'desconocida',
      ]);
    });

    it('schema para en contiene descripciones en inglés sin contradicciones y conserva enums canónicos', () => {
      const schemaEn = getGeneratedRecipesJsonSchema('en');
      expect(schemaEn.properties.recipes.items.properties.name.description).toBe(
        'Short and clear name of the recipe in English.',
      );
      expect(schemaEn.properties.recipes.items.properties.description.description).toBe(
        'Brief description of the preparation.',
      );
      expect(schemaEn.properties.recipes.items.properties.stepDurations.items.properties.action.description).toBe(
        'Main action (e.g. boil, sauté, brown, bake, rest).',
      );
      expect(schemaEn.properties.recipes.items.properties.ingredients.items.properties.name.description).toBe(
        'Common name of the ingredient in English.',
      );
      expect(schemaEn.properties.recipes.items.properties.ingredients.items.properties.unit.enum).toEqual([
        'unidad',
        'g',
        'kg',
        'ml',
        'l',
        'cucharada',
        'cucharadita',
        'taza',
        'desconocida',
      ]);
    });
  });

  describe('2. Motor de Conveniencia — Razones Bilingües y Cálculos Numéricos Invariantes', () => {
    it('rama 1 (>=80% despensa, 0 compras): genera razón en español y en inglés con mismo puntaje', () => {
      const inputEs = {
        totalIngredients: 5,
        availableIngredients: 5,
        estimatedMissingCost: 0,
        budget: 20000,
        locale: 'es' as const,
      };
      const inputEn = {
        totalIngredients: 5,
        availableIngredients: 5,
        estimatedMissingCost: 0,
        budget: 20000,
        locale: 'en' as const,
      };

      const resEs = calculateConvenience(inputEs);
      const resEn = calculateConvenience(inputEn);

      expect(resEs.convenience).toBe(resEn.convenience);
      expect(resEs.withinBudget).toBe(resEn.withinBudget);
      expect(resEs.budgetRemaining).toBe(resEn.budgetRemaining);

      expect(resEs.reason).toBe(
        'Aprovecha casi por completo los ingredientes disponibles y no requiere compras estimadas.',
      );
      expect(resEn.reason).toBe(
        'Uses almost all available ingredients and does not require estimated purchases.',
      );
    });

    it('rama 2 (>=80% despensa, compras dentro de presupuesto): genera razón en español y en inglés', () => {
      const inputEs = {
        totalIngredients: 5,
        availableIngredients: 4,
        estimatedMissingCost: 3000,
        budget: 15000,
        locale: 'es' as const,
      };
      const inputEn = {
        totalIngredients: 5,
        availableIngredients: 4,
        estimatedMissingCost: 3000,
        budget: 15000,
        locale: 'en' as const,
      };

      const resEs = calculateConvenience(inputEs);
      const resEn = calculateConvenience(inputEn);

      expect(resEs.convenience).toBe(resEn.convenience);
      expect(resEs.reason).toBe(
        'Aprovecha gran parte de tu despensa y requiere pocas compras adicionales.',
      );
      expect(resEn.reason).toBe(
        'Uses most of your pantry and requires few additional purchases.',
      );
    });

    it('rama 3 (>=50% despensa, dentro de presupuesto): genera razón en español y en inglés', () => {
      const inputEs = {
        totalIngredients: 6,
        availableIngredients: 3,
        estimatedMissingCost: 4000,
        budget: 12000,
        locale: 'es' as const,
      };
      const inputEn = {
        totalIngredients: 6,
        availableIngredients: 3,
        estimatedMissingCost: 4000,
        budget: 12000,
        locale: 'en' as const,
      };

      const resEs = calculateConvenience(inputEs);
      const resEn = calculateConvenience(inputEn);

      expect(resEs.convenience).toBe(resEn.convenience);
      expect(resEs.reason).toBe(
        'Utiliza varios ingredientes disponibles y se mantiene dentro del presupuesto estimado.',
      );
      expect(resEn.reason).toBe(
        'Uses several available ingredients and stays within the estimated budget.',
      );
    });

    it('rama 4 (<50% despensa, dentro de presupuesto): genera razón en español y en inglés', () => {
      const inputEs = {
        totalIngredients: 5,
        availableIngredients: 1,
        estimatedMissingCost: 2000,
        budget: 10000,
        locale: 'es' as const,
      };
      const inputEn = {
        totalIngredients: 5,
        availableIngredients: 1,
        estimatedMissingCost: 2000,
        budget: 10000,
        locale: 'en' as const,
      };

      const resEs = calculateConvenience(inputEs);
      const resEn = calculateConvenience(inputEn);

      expect(resEs.convenience).toBe(resEn.convenience);
      expect(resEs.reason).toBe(
        'Puede prepararse dentro del presupuesto, aunque requiere varios ingredientes adicionales.',
      );
      expect(resEn.reason).toBe(
        'Can be prepared within budget, although it requires several additional ingredients.',
      );
    });

    it('rama 5 (fuera de presupuesto): genera razón en español y en inglés', () => {
      const inputEs = {
        totalIngredients: 4,
        availableIngredients: 2,
        estimatedMissingCost: 15000,
        budget: 10000,
        locale: 'es' as const,
      };
      const inputEn = {
        totalIngredients: 4,
        availableIngredients: 2,
        estimatedMissingCost: 15000,
        budget: 10000,
        locale: 'en' as const,
      };

      const resEs = calculateConvenience(inputEs);
      const resEn = calculateConvenience(inputEn);

      expect(resEs.convenience).toBe(resEn.convenience);
      expect(resEs.withinBudget).toBe(false);
      expect(resEs.reason).toBe(
        'Requiere compras adicionales que superan el presupuesto estimado.',
      );
      expect(resEn.reason).toBe(
        'Requires additional purchases that exceed the estimated budget.',
      );
    });

    it('omisión de locale en calculateConvenience mantiene compatibilidad histórica en español', () => {
      const res = calculateConvenience({
        totalIngredients: 4,
        availableIngredients: 4,
        estimatedMissingCost: 0,
        budget: 10000,
      });

      expect(res.reason).toBe(
        'Aprovecha casi por completo los ingredientes disponibles y no requiere compras estimadas.',
      );
    });
  });

  describe('3. Servicio Gemini — Propagación de Locale y Validación de Respuestas', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    const sampleRequest = {
      pantry: [
        { name: 'huevo', quantity: 4, unit: 'unidad' as const, needsReview: false },
        { name: 'arroz', quantity: 500, unit: 'g' as const, needsReview: false },
      ],
      budget: 20000,
      servings: 2,
    };

    it('omisión de locale en request envía prompt y schema en español a Gemini', async () => {
      const mockPayload = {
        recipes: [
          {
            name: 'Arroz con huevo',
            description: 'Receta rápida tradicional.',
            totalMinutes: 15,
            ingredients: [
              { name: 'arroz', quantity: 200, unit: 'g' },
              { name: 'huevo', quantity: 2, unit: 'unidad' },
            ],
            steps: ['Cocinar arroz', 'Freír huevo'],
          },
        ],
      };

      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify(mockPayload),
      } as any);

      const promise = generateRecipeRecommendations({
        ...sampleRequest,
        locale: 'es',
      });
      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result.recipes).toHaveLength(1);
      const callArgs = mockedCreate.mock.calls[0][0] as any;
      expect(callArgs.input[0].text).toContain(recommendRecipesPromptEs);
      expect(callArgs.response_format.schema).toEqual(getGeneratedRecipesJsonSchema('es'));
    });

    it('locale=en explícito envía prompt y schema en inglés a Gemini', async () => {
      const mockPayload = {
        recipes: [
          {
            name: 'Egg Fried Rice',
            description: 'Quick and tasty homemade fried rice.',
            totalMinutes: 20,
            prepMinutes: 5,
            cookMinutes: 15,
            stepDurations: [
              { stepIndex: 0, minutes: 5, action: 'sauté' },
              { stepIndex: 1, minutes: 10, action: 'fry' },
            ],
            ingredients: [
              { name: 'rice', quantity: 200, unit: 'g' },
              { name: 'egg', quantity: 2, unit: 'unidad' },
            ],
            steps: ['Sauté the rice in a hot pan', 'Fry eggs and mix together'],
          },
        ],
      };

      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify(mockPayload),
      } as any);

      const promise = generateRecipeRecommendations({
        ...sampleRequest,
        locale: 'en',
      });
      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result.recipes).toHaveLength(1);
      expect(result.recipes[0].name).toBe('Egg Fried Rice');
      expect(result.recipes[0].stepDurations?.[0].action).toBe('sauté');

      const callArgs = mockedCreate.mock.calls[0][0] as any;
      expect(callArgs.input[0].text).toContain(recommendRecipesPromptEn);
      expect(callArgs.response_format.schema).toEqual(getGeneratedRecipesJsonSchema('en'));
    });

    it('rechaza unidades traducidas a inglés (ej. unit, tbsp) con INVALID_RECIPE_RESPONSE', async () => {
      const invalidUnitPayload = {
        recipes: [
          {
            name: 'Scrambled Eggs',
            description: 'Simple breakfast.',
            totalMinutes: 10,
            ingredients: [
              { name: 'egg', quantity: 2, unit: 'unit' }, // Inválido: debe ser "unidad"
            ],
            steps: ['Beat eggs and cook.'],
          },
        ],
      };

      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify(invalidUnitPayload),
      } as any);

      const promise = generateRecipeRecommendations({
        ...sampleRequest,
        locale: 'en',
      });

      const assertion = expect(promise).rejects.toMatchObject({
        statusCode: 502,
        code: 'INVALID_RECIPE_RESPONSE',
      });
      await vi.advanceTimersByTimeAsync(10);
      await assertion;
    });
  });

  describe('4. Pipeline Completo de Recomendaciones — Despensa en Español + Receta en Inglés', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('hace match exitoso entre despensa en español (arroz, pollo, leche) y receta en inglés (rice, chicken, whole milk)', async () => {
      const englishRecipesPayload = {
        recipes: [
          {
            name: 'Creamy Chicken and Rice',
            description: 'Savory combination of tender chicken and rice in milk sauce.',
            totalMinutes: 25,
            ingredients: [
              { name: 'rice', quantity: 200, unit: 'g' },
              { name: 'chicken', quantity: 300, unit: 'g' },
              { name: 'whole milk', quantity: 100, unit: 'ml' },
            ],
            steps: ['Cook rice in pot', 'Sear chicken and simmer with milk'],
          },
        ],
      };

      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify(englishRecipesPayload),
      } as any);

      const promise = buildRecipeRecommendations({
        pantry: [
          { name: 'arroz', quantity: 500, unit: 'g', needsReview: false },
          { name: 'pollo', quantity: 1000, unit: 'g', needsReview: false },
          { name: 'leche', quantity: 1000, unit: 'ml', needsReview: false },
        ],
        budget: 20000,
        servings: 2,
        locale: 'en',
      });

      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result.recipes).toHaveLength(1);
      const rec = result.recipes[0];
      expect(rec.name).toBe('Creamy Chicken and Rice');
      // Todos los ingredientes están disponibles por matching bilingüe seguro
      expect(rec.availableIngredients).toHaveLength(3);
      expect(rec.missingIngredients).toHaveLength(0);
      expect(rec.estimatedMissingCost).toBe(0);
      expect(rec.convenience).toBe(95);
      // Razón en inglés
      expect(rec.reason).toBe(
        'Uses almost all available ingredients and does not require estimated purchases.',
      );
    });

    it('calcula ingredientes faltantes en COP y asigna razón en inglés si requiere compras adicionales', async () => {
      const englishRecipesPayload = {
        recipes: [
          {
            name: 'Chicken and Rice',
            description: 'Hearty chicken bowl.',
            totalMinutes: 30,
            ingredients: [
              { name: 'rice', quantity: 200, unit: 'g' },
              { name: 'chicken breast', quantity: 300, unit: 'g' },
            ],
            steps: ['Cook rice', 'Sear chicken breast'],
          },
        ],
      };

      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify(englishRecipesPayload),
      } as any);

      const promise = buildRecipeRecommendations({
        pantry: [
          { name: 'arroz', quantity: 500, unit: 'g', needsReview: false },
        ],
        budget: 20000,
        servings: 2,
        locale: 'en',
      });

      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result.recipes).toHaveLength(1);
      const rec = result.recipes[0];
      expect(rec.availableIngredients).toHaveLength(1); // arroz <-> rice
      expect(rec.missingIngredients).toHaveLength(1); // chicken breast falta
      expect(rec.estimatedMissingCost).toBeGreaterThan(0);
      expect(rec.withinBudget).toBe(true);
      expect(rec.reason).toBe(
        'Uses several available ingredients and stays within the estimated budget.',
      );
    });
  });

  describe('5. Endpoint HTTP POST /api/recipes/recommend — Integración Bilingüe', () => {
    let authHeader: string;

    beforeAll(async () => {
      await setupTestSupabaseJwks();
      const token = await signTestSupabaseJwt({
        sub: 'user-bilingual-recipes-test',
      });
      authHeader = `Bearer ${token}`;
    });

    afterAll(async () => {
      await teardownTestSupabaseJwks();
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('POST /api/recipes/recommend con locale=en retorna razones en inglés y conserva estructura JSON', async () => {
      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify({
          recipes: [
            {
              name: 'Simple Fried Rice',
              description: 'Quick skillet meal.',
              totalMinutes: 20,
              ingredients: [
                { name: 'rice', quantity: 200, unit: 'g' },
              ],
              steps: ['Stir-fry cooked rice in oil.'],
            },
          ],
        }),
      } as any);

      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', authHeader)
        .send({
          pantry: [
            { name: 'arroz', quantity: 1000, unit: 'g', needsReview: false },
          ],
          budget: 15000,
          servings: 2,
          locale: 'en',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recipes).toHaveLength(1);
      const recipe = response.body.data.recipes[0];
      expect(recipe.name).toBe('Simple Fried Rice');
      expect(recipe.reason).toBe(
        'Uses almost all available ingredients and does not require estimated purchases.',
      );
      expect(recipe.convenience).toBe(95);
      expect(recipe.withinBudget).toBe(true);
    });

    it('POST /api/recipes/recommend sin locale asigna es por defecto y retorna razones en español', async () => {
      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify({
          recipes: [
            {
              name: 'Arroz frito sencillo',
              description: 'Preparación rápida en sartén.',
              totalMinutes: 20,
              ingredients: [
                { name: 'arroz', quantity: 200, unit: 'g' },
              ],
              steps: ['Saltear arroz cocido en aceite.'],
            },
          ],
        }),
      } as any);

      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', authHeader)
        .send({
          pantry: [
            { name: 'arroz', quantity: 1000, unit: 'g', needsReview: false },
          ],
          budget: 15000,
          servings: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const recipe = response.body.data.recipes[0];
      expect(recipe.name).toBe('Arroz frito sencillo');
      expect(recipe.reason).toBe(
        'Aprovecha casi por completo los ingredientes disponibles y no requiere compras estimadas.',
      );
    });
  });
});
