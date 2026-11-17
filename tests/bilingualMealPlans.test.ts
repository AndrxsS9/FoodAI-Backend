import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

/*
 * Solo se simula el cliente de Gemini. El resto del pipeline
 * (prompt, validación, matching con la despensa, precios COP,
 * conveniencia y armado del plan) se ejecuta con la lógica real.
 * Nunca se realizan solicitudes reales a Gemini.
 */
vi.mock('../src/services/gemini/gemini.client', () => ({
  geminiClient: {
    interactions: {
      create: vi.fn(),
    },
  },
}));

import app from '../src/app';
import { geminiClient } from '../src/services/gemini/gemini.client';
import { getGeneratedRecipesJsonSchema } from '../src/schemas/recipe.schema';
import {
  setupTestSupabaseJwks,
  signTestSupabaseJwt,
  teardownTestSupabaseJwks,
} from './helpers/testAuth';

const mockedCreate = vi.mocked(geminiClient.interactions.create);

type MockRecipe = {
  name: string;
  description: string;
  totalMinutes: number;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  steps: string[];
};

function mockGeminiRecipes(recipes: MockRecipe[]) {
  mockedCreate.mockResolvedValueOnce({
    output_text: JSON.stringify({ recipes }),
  } as any);
}

/*
 * Despensa en español (caso típico del escáner) usada en ambos idiomas.
 * Solo contiene alimentos con identidad bilingüe ya soportada
 * (arroz <-> rice, pollo <-> chicken).
 */
const spanishPantry = [
  { name: 'arroz', quantity: 1000, unit: 'g', needsReview: false },
  { name: 'pollo', quantity: 1000, unit: 'g', needsReview: false },
];

/*
 * Mismo plan conceptual en ambos idiomas:
 * - Receta A: todo disponible.
 * - Receta B: falta papa + leche.
 * - Receta C: falta papa (compra repetida que debe contarse una sola vez).
 */
const spanishRecipes: MockRecipe[] = [
  {
    name: 'Puré de papa',
    description: 'Puré cremoso y sencillo.',
    totalMinutes: 30,
    ingredients: [
      { name: 'papa', quantity: 4, unit: 'unidad' },
      { name: 'leche', quantity: 200, unit: 'ml' },
    ],
    steps: ['Cocinar las papas.', 'Triturar con la leche.'],
  },
  {
    name: 'Arroz con pollo',
    description: 'Clásico casero.',
    totalMinutes: 35,
    ingredients: [
      { name: 'arroz', quantity: 200, unit: 'g' },
      { name: 'pollo', quantity: 300, unit: 'g' },
    ],
    steps: ['Dorar el pollo.', 'Cocinar el arroz con el pollo.'],
  },
  {
    name: 'Sopa de pollo y papa',
    description: 'Sopa reconfortante.',
    totalMinutes: 40,
    ingredients: [
      { name: 'pollo', quantity: 300, unit: 'g' },
      { name: 'papa', quantity: 3, unit: 'unidad' },
    ],
    steps: ['Hervir el pollo.', 'Agregar las papas.'],
  },
];

const englishRecipes: MockRecipe[] = [
  {
    name: 'Mashed potatoes',
    description: 'Simple creamy mash.',
    totalMinutes: 30,
    ingredients: [
      { name: 'potatoes', quantity: 4, unit: 'unidad' },
      { name: 'milk', quantity: 200, unit: 'ml' },
    ],
    steps: ['Boil the potatoes.', 'Mash with the milk.'],
  },
  {
    name: 'Chicken and rice',
    description: 'Homestyle classic.',
    totalMinutes: 35,
    ingredients: [
      { name: 'rice', quantity: 200, unit: 'g' },
      { name: 'chicken', quantity: 300, unit: 'g' },
    ],
    steps: ['Brown the chicken.', 'Cook the rice with the chicken.'],
  },
  {
    name: 'Chicken and potato soup',
    description: 'Comforting soup.',
    totalMinutes: 40,
    ingredients: [
      { name: 'chicken', quantity: 300, unit: 'g' },
      { name: 'potato', quantity: 3, unit: 'unidad' },
    ],
    steps: ['Boil the chicken.', 'Add the potatoes.'],
  },
];

const baseRequest = {
  pantry: spanishPantry,
  budget: 20000,
  servings: 2,
};

/*
 * Mensajes históricos en español: deben conservarse exactamente.
 */
const ES_INSUFFICIENT =
  'No se generaron suficientes recetas para construir un plan de tres días.';
const esInsufficientWithinTime = (maxMinutes: number, count: number) =>
  `No se generaron suficientes recetas que cumplan con el tiempo máximo de ${maxMinutes} minutos para construir un plan de tres días (${count} de 3 requeridas). Te sugerimos aumentar el tiempo límite disponible o ajustar los ingredientes de la despensa.`;

const EN_INSUFFICIENT =
  'Not enough recipes were generated to build a three-day plan.';
const enInsufficientWithinTime = (maxMinutes: number, count: number) =>
  `Not enough recipes were generated within the maximum time of ${maxMinutes} minutes to build a three-day plan (${count} of 3 required). Try increasing the available time limit or adjusting your pantry ingredients.`;

let userCounter = 0;
async function createAuthHeader(): Promise<string> {
  userCounter += 1;
  const token = await signTestSupabaseJwt({
    sub: `user-bilingual-meal-plans-${userCounter}`,
  });
  return `Bearer ${token}`;
}

async function postMealPlan(body: Record<string, unknown>) {
  return request(app)
    .post('/api/meal-plans/generate')
    .set('Authorization', await createAuthHeader())
    .send(body);
}

function getGeminiCallArgs(callIndex = 0) {
  return mockedCreate.mock.calls[callIndex][0] as any;
}

describe('Fase 28C-B2.3 — Planes de comidas bilingües', () => {
  beforeAll(async () => {
    await setupTestSupabaseJwks();
  });

  afterAll(async () => {
    await teardownTestSupabaseJwks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Locale por defecto y explícito', () => {
    it('sin locale usa español y produce exactamente la misma respuesta que locale=es', async () => {
      mockGeminiRecipes(spanishRecipes);
      const defaultResponse = await postMealPlan(baseRequest);

      mockGeminiRecipes(spanishRecipes);
      const esResponse = await postMealPlan({
        ...baseRequest,
        locale: 'es',
      });

      expect(defaultResponse.status).toBe(200);
      expect(esResponse.status).toBe(200);
      expect(defaultResponse.body).toEqual(esResponse.body);

      expect(mockedCreate).toHaveBeenCalledTimes(2);

      const defaultPrompt = getGeminiCallArgs(0).input[0].text;
      const esPrompt = getGeminiCallArgs(1).input[0].text;
      expect(defaultPrompt).toBe(esPrompt);
      expect(defaultPrompt).toContain('DATOS DEL USUARIO:');
      expect(getGeminiCallArgs(0).response_format.schema).toEqual(
        getGeneratedRecipesJsonSchema('es'),
      );
    });

    it('locale=es devuelve recetas y razones en español', async () => {
      mockGeminiRecipes(spanishRecipes);
      const response = await postMealPlan({
        ...baseRequest,
        locale: 'es',
      });

      expect(response.status).toBe(200);
      const days = response.body.data.days;

      expect(days.map((d: any) => d.recipe.name)).toEqual([
        'Arroz con pollo',
        'Sopa de pollo y papa',
        'Puré de papa',
      ]);
      expect(days.map((d: any) => d.recipe.reason)).toEqual([
        'Aprovecha casi por completo los ingredientes disponibles y no requiere compras estimadas.',
        'Utiliza varios ingredientes disponibles y se mantiene dentro del presupuesto estimado.',
        'Puede prepararse dentro del presupuesto, aunque requiere varios ingredientes adicionales.',
      ]);
    });

    it('locale=en envía prompt y schema en inglés y devuelve recetas y razones en inglés', async () => {
      mockGeminiRecipes(englishRecipes);
      const response = await postMealPlan({
        ...baseRequest,
        locale: 'en',
      });

      expect(response.status).toBe(200);
      expect(mockedCreate).toHaveBeenCalledTimes(1);

      const callArgs = getGeminiCallArgs();
      expect(callArgs.input[0].text).toContain('USER DATA:');
      expect(callArgs.input[0].text).not.toContain('DATOS DEL USUARIO:');
      expect(callArgs.response_format.schema).toEqual(
        getGeneratedRecipesJsonSchema('en'),
      );

      const days = response.body.data.days;
      expect(days.map((d: any) => d.recipe.name)).toEqual([
        'Chicken and rice',
        'Chicken and potato soup',
        'Mashed potatoes',
      ]);
      expect(days[0].recipe.steps).toEqual([
        'Brown the chicken.',
        'Cook the rice with the chicken.',
      ]);
      expect(days.map((d: any) => d.recipe.reason)).toEqual([
        'Uses almost all available ingredients and does not require estimated purchases.',
        'Uses several available ingredients and stays within the estimated budget.',
        'Can be prepared within budget, although it requires several additional ingredients.',
      ]);
    });
  });

  describe('2. Contrato de respuesta de tres días', () => {
    it('mantiene exactamente 3 días numerados 1, 2, 3 y los mismos nombres de campos en ambos idiomas', async () => {
      mockGeminiRecipes(spanishRecipes);
      const esResponse = await postMealPlan({
        ...baseRequest,
        locale: 'es',
      });

      mockGeminiRecipes(englishRecipes);
      const enResponse = await postMealPlan({
        ...baseRequest,
        locale: 'en',
      });

      for (const response of [esResponse, enResponse]) {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Object.keys(response.body).sort()).toEqual([
          'data',
          'success',
        ]);
        expect(Object.keys(response.body.data).sort()).toEqual([
          'budgetRemaining',
          'days',
          'totalEstimatedMissingCost',
          'withinBudget',
        ]);

        const days = response.body.data.days;
        expect(days).toHaveLength(3);
        expect(days.map((d: any) => d.day)).toEqual([1, 2, 3]);

        for (const day of days) {
          expect(typeof day.day).toBe('number');
          expect(Object.keys(day).sort()).toEqual(['day', 'recipe']);
        }
      }

      const esRecipeKeys = esResponse.body.data.days.map((d: any) =>
        Object.keys(d.recipe).sort(),
      );
      const enRecipeKeys = enResponse.body.data.days.map((d: any) =>
        Object.keys(d.recipe).sort(),
      );
      expect(enRecipeKeys).toEqual(esRecipeKeys);
      expect(esRecipeKeys[0]).toEqual(
        [
          'availableIngredients',
          'budgetRemaining',
          'convenience',
          'description',
          'estimatedMissingCost',
          'ingredients',
          'missingIngredients',
          'name',
          'reason',
          'steps',
          'totalMinutes',
          'withinBudget',
        ].sort(),
      );

      // Las unidades son enums internos: no se traducen.
      const enUnits = enResponse.body.data.days.flatMap((d: any) =>
        d.recipe.ingredients.map((i: any) => i.unit),
      );
      expect(new Set(enUnits)).toEqual(new Set(['g', 'unidad', 'ml']));
    });
  });

  describe('3. Totales numéricos equivalentes entre idiomas', () => {
    it('el mismo plan en es y en produce costos COP, presupuesto restante y conveniencia idénticos', async () => {
      mockGeminiRecipes(spanishRecipes);
      const esResponse = await postMealPlan({
        ...baseRequest,
        locale: 'es',
      });

      mockGeminiRecipes(englishRecipes);
      const enResponse = await postMealPlan({
        ...baseRequest,
        locale: 'en',
      });

      expect(esResponse.status).toBe(200);
      expect(enResponse.status).toBe(200);

      const es = esResponse.body.data;
      const en = enResponse.body.data;

      /*
       * papa (2500) se compra una sola vez aunque la pidan dos recetas,
       * más leche (4500): 7000 COP en ambos idiomas.
       */
      expect(es.totalEstimatedMissingCost).toBe(7000);
      expect(en.totalEstimatedMissingCost).toBe(7000);
      expect(es.budgetRemaining).toBe(13000);
      expect(en.budgetRemaining).toBe(13000);
      expect(es.withinBudget).toBe(true);
      expect(en.withinBudget).toBe(true);

      const numericView = (data: any) =>
        data.days.map((d: any) => ({
          day: d.day,
          totalMinutes: d.recipe.totalMinutes,
          estimatedMissingCost: d.recipe.estimatedMissingCost,
          budgetRemaining: d.recipe.budgetRemaining,
          withinBudget: d.recipe.withinBudget,
          convenience: d.recipe.convenience,
          availableCount: d.recipe.availableIngredients.length,
          missingCount: d.recipe.missingIngredients.length,
        }));

      expect(numericView(en)).toEqual(numericView(es));
    });
  });

  describe('4. Identidad bilingüe segura y compras faltantes duplicadas', () => {
    it('cuenta una sola vez papa / potato / potatoes, pero no fusiona sweet potato con potato', async () => {
      mockGeminiRecipes([
        {
          name: 'Roasted potatoes',
          description: 'Recipe 1.',
          totalMinutes: 20,
          ingredients: [
            { name: 'rice', quantity: 100, unit: 'g' },
            { name: 'potatoes', quantity: 3, unit: 'unidad' },
          ],
          steps: ['Cook.'],
        },
        {
          name: 'Potato rice bowl',
          description: 'Recipe 2.',
          totalMinutes: 20,
          ingredients: [
            { name: 'rice', quantity: 100, unit: 'g' },
            { name: 'papa', quantity: 2, unit: 'unidad' },
          ],
          steps: ['Cook.'],
        },
        {
          name: 'Sweet potato rice',
          description: 'Recipe 3.',
          totalMinutes: 20,
          ingredients: [
            { name: 'rice', quantity: 100, unit: 'g' },
            { name: 'sweet potato', quantity: 2, unit: 'unidad' },
          ],
          steps: ['Cook.'],
        },
      ]);

      const response = await postMealPlan({
        ...baseRequest,
        locale: 'en',
      });

      expect(response.status).toBe(200);
      const data = response.body.data;

      const costByName = Object.fromEntries(
        data.days.map((d: any) => [
          d.recipe.name,
          d.recipe.estimatedMissingCost,
        ]),
      );
      expect(costByName['Roasted potatoes']).toBe(2500);
      expect(costByName['Potato rice bowl']).toBe(2500);
      expect(costByName['Sweet potato rice']).toBe(5000);

      // potatoes + papa = una compra (2500); sweet potato es otra (5000).
      expect(data.totalEstimatedMissingCost).toBe(7500);
      expect(data.budgetRemaining).toBe(12500);
    });

    it('cuenta una sola vez salsa de tomate / tomato sauce, pero mantiene tomato paste como compra distinta', async () => {
      mockGeminiRecipes([
        {
          name: 'Rice with tomato sauce',
          description: 'Recipe 1.',
          totalMinutes: 20,
          ingredients: [
            { name: 'rice', quantity: 100, unit: 'g' },
            { name: 'tomato sauce', quantity: 100, unit: 'g' },
          ],
          steps: ['Cook.'],
        },
        {
          name: 'Arroz con salsa de tomate',
          description: 'Receta 2.',
          totalMinutes: 20,
          ingredients: [
            { name: 'arroz', quantity: 100, unit: 'g' },
            { name: 'salsa de tomate', quantity: 100, unit: 'g' },
          ],
          steps: ['Cocinar.'],
        },
        {
          name: 'Chicken in tomato paste',
          description: 'Recipe 3.',
          totalMinutes: 20,
          ingredients: [
            { name: 'chicken', quantity: 200, unit: 'g' },
            { name: 'tomato paste', quantity: 50, unit: 'g' },
          ],
          steps: ['Cook.'],
        },
      ]);

      const response = await postMealPlan({
        ...baseRequest,
        locale: 'en',
      });

      expect(response.status).toBe(200);
      const data = response.body.data;

      // salsa de tomate (3500, una sola vez) + pasta de tomate (5000).
      expect(data.totalEstimatedMissingCost).toBe(8500);
      expect(data.budgetRemaining).toBe(11500);
      expect(data.withinBudget).toBe(true);
    });

    it('calcula presupuesto restante negativo y withinBudget=false igual en inglés cuando el plan excede el presupuesto', async () => {
      mockGeminiRecipes(englishRecipes);
      const response = await postMealPlan({
        ...baseRequest,
        budget: 5000,
        locale: 'en',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.totalEstimatedMissingCost).toBe(7000);
      expect(response.body.data.budgetRemaining).toBe(-2000);
      expect(response.body.data.withinBudget).toBe(false);
      expect(response.body.data.days.map((d: any) => d.day)).toEqual([
        1, 2, 3,
      ]);
    });
  });

  describe('5. Errores de recetas insuficientes y maxMinutes', () => {
    const twoRecipesOnly = englishRecipes.slice(0, 2);

    it('locale=en sin maxMinutes: menos de 3 recetas devuelve 502 INSUFFICIENT_RECIPES_FOR_PLAN en inglés', async () => {
      mockGeminiRecipes(twoRecipesOnly);
      const response = await postMealPlan({
        ...baseRequest,
        locale: 'en',
      });

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INSUFFICIENT_RECIPES_FOR_PLAN',
          message: EN_INSUFFICIENT,
        },
      });
    });

    it('locale=en con maxMinutes: recetas filtradas por tiempo (2 de 3) devuelve mensaje en inglés', async () => {
      // Solo las dos primeras (30 y 35 min) cumplen maxMinutes=35.
      mockGeminiRecipes(englishRecipes);
      const response = await postMealPlan({
        ...baseRequest,
        maxMinutes: 35,
        locale: 'en',
      });

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INSUFFICIENT_RECIPES_FOR_PLAN',
          message: enInsufficientWithinTime(35, 2),
        },
      });
    });

    it('locale=en con maxMinutes: ninguna receta cumple el tiempo (0 de 3) devuelve mensaje en inglés', async () => {
      mockGeminiRecipes(englishRecipes);
      const response = await postMealPlan({
        ...baseRequest,
        maxMinutes: 10,
        locale: 'en',
      });

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INSUFFICIENT_RECIPES_FOR_PLAN',
          message: enInsufficientWithinTime(10, 0),
        },
      });
    });

    it('sin locale conserva exactamente los mensajes históricos en español con el mismo código y estado', async () => {
      mockGeminiRecipes(spanishRecipes.slice(0, 2));
      const insufficient = await postMealPlan(baseRequest);

      mockGeminiRecipes(spanishRecipes);
      const partial = await postMealPlan({
        ...baseRequest,
        maxMinutes: 35,
      });

      mockGeminiRecipes(spanishRecipes);
      const none = await postMealPlan({
        ...baseRequest,
        maxMinutes: 10,
      });

      expect(insufficient.status).toBe(502);
      expect(insufficient.body.error).toEqual({
        code: 'INSUFFICIENT_RECIPES_FOR_PLAN',
        message: ES_INSUFFICIENT,
      });

      expect(partial.status).toBe(502);
      expect(partial.body.error).toEqual({
        code: 'INSUFFICIENT_RECIPES_FOR_PLAN',
        message: esInsufficientWithinTime(35, 2),
      });

      expect(none.status).toBe(502);
      expect(none.body.error).toEqual({
        code: 'INSUFFICIENT_RECIPES_FOR_PLAN',
        message: esInsufficientWithinTime(10, 0),
      });
    });

    it('conserva código y estado de errores de Gemini no relacionados con el plan (429 GEMINI_RATE_LIMIT) en inglés', async () => {
      mockedCreate.mockRejectedValueOnce(
        Object.assign(new Error('quota exceeded'), { status: 429 }),
      );

      const response = await postMealPlan({
        ...baseRequest,
        locale: 'en',
      });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GEMINI_RATE_LIMIT');
      expect(mockedCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('6. Autenticación Supabase, validación HTTP y llamadas a Gemini', () => {
    it('rechaza locale=en sin token Supabase con 401 sin llamar a Gemini', async () => {
      const response = await request(app)
        .post('/api/meal-plans/generate')
        .send({ ...baseRequest, locale: 'en' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_REQUIRED');
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('rechaza locale no soportado y despensa vacía con 400 VALIDATION_ERROR sin llamar a Gemini', async () => {
      const unsupported = await postMealPlan({
        ...baseRequest,
        locale: 'fr',
      });

      const emptyPantry = await postMealPlan({
        ...baseRequest,
        pantry: [],
        locale: 'en',
      });

      for (const response of [unsupported, emptyPantry]) {
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }

      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('hace exactamente una llamada a Gemini por plan sin cambiar modelo ni configuración', async () => {
      mockGeminiRecipes(englishRecipes);
      const response = await postMealPlan({
        ...baseRequest,
        locale: 'en',
      });

      expect(response.status).toBe(200);
      expect(mockedCreate).toHaveBeenCalledTimes(1);

      const callArgs = getGeminiCallArgs();
      expect(callArgs.model).toBe('gemini-3.5-flash-lite');
      expect(callArgs.generation_config).toEqual({
        thinking_level: 'minimal',
      });
      expect(callArgs.response_format.mime_type).toBe(
        'application/json',
      );
    });
  });
});
