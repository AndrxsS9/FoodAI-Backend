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

import {
  setupTestSupabaseJwks,
  signTestSupabaseJwt,
  teardownTestSupabaseJwks,
} from './helpers/testAuth';

vi.mock('../src/services/gemini/recipe.service', () => ({
  generateRecipeRecommendations: vi.fn(),
}));

vi.mock('../src/services/gemini/ingredient.service', () => ({
  analyzeIngredientsFromImage: vi.fn(),
}));

import app from '../src/app';
import { generateRecipeRecommendations } from '../src/services/gemini/recipe.service';
import { analyzeIngredientsFromImage } from '../src/services/gemini/ingredient.service';

const mockedGenerateRecipes = vi.mocked(generateRecipeRecommendations);
const mockedAnalyzeIngredients = vi.mocked(analyzeIngredientsFromImage);

const candidateRecipes = [
  {
    name: 'Arroz con huevo',
    description: 'Receta básica y económica en español.',
    totalMinutes: 20,
    ingredients: [
      { name: 'arroz', quantity: 200, unit: 'g' as const },
      { name: 'huevo', quantity: 2, unit: 'unidad' as const },
    ],
    steps: ['Cocinar el arroz.', 'Freír los huevos.'],
  },
  {
    name: 'Tomates rellenos',
    description: 'Tomates frescos rellenos de arroz en español.',
    totalMinutes: 25,
    ingredients: [
      { name: 'tomate', quantity: 2, unit: 'unidad' as const },
      { name: 'arroz', quantity: 150, unit: 'g' as const },
    ],
    steps: ['Vaciar tomates.', 'Rellenar con arroz.'],
  },
  {
    name: 'Tortilla de tomate',
    description: 'Tortilla clásica con tomates frescos en español.',
    totalMinutes: 15,
    ingredients: [
      { name: 'huevo', quantity: 3, unit: 'unidad' as const },
      { name: 'tomate', quantity: 1, unit: 'unidad' as const },
    ],
    steps: ['Batir huevos con tomate picado.', 'Cocinar en sartén.'],
  },
];

const basePantry = [
  { name: 'arroz', quantity: 500, unit: 'g' as const, needsReview: false },
  { name: 'huevo', quantity: 6, unit: 'unidad' as const, needsReview: false },
  { name: 'tomate', quantity: 4, unit: 'unidad' as const, needsReview: false },
];

let userCounter = 0;
async function createAuthHeader(): Promise<string> {
  userCounter += 1;
  const token = await signTestSupabaseJwt({
    sub: `user-locale-contracts-${userCounter}-${Date.now()}`,
  });
  return `Bearer ${token}`;
}

describe('Fase 28C-B1.1 — Contratos de Locale en la API', () => {
  beforeAll(async () => {
    await setupTestSupabaseJwks();
  });

  afterAll(async () => {
    await teardownTestSupabaseJwks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGenerateRecipes.mockResolvedValue({
      recipes: candidateRecipes,
    });
    mockedAnalyzeIngredients.mockResolvedValue({
      ingredients: [
        {
          name: 'tomate',
          quantity: 3,
          unit: 'unidad',
          needsReview: false,
        },
      ],
    });
  });

  describe('1. Missing locale defaults to es', () => {
    it('POST /api/recipes/recommend asigna es por defecto si se omite locale', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', authHeader)
        .send({
          pantry: basePantry,
          budget: 20000,
          servings: 2,
        });

      expect(response.status).toBe(200);
      expect(mockedGenerateRecipes).toHaveBeenCalledTimes(1);
      const passedInput = mockedGenerateRecipes.mock.calls[0][0];
      expect(passedInput.locale).toBe('es');
    });

    it('POST /api/meal-plans/generate asigna es por defecto si se omite locale', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/meal-plans/generate')
        .set('Authorization', authHeader)
        .send({
          pantry: basePantry,
          budget: 20000,
          servings: 2,
        });

      expect(response.status).toBe(200);
      expect(mockedGenerateRecipes).toHaveBeenCalledTimes(1);
      const passedInput = mockedGenerateRecipes.mock.calls[0][0];
      expect(passedInput.locale).toBe('es');
    });

    it('POST /api/ingredients/analyze asigna es por defecto si se omite el query param locale', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/ingredients/analyze')
        .set('Authorization', authHeader)
        .attach('image', Buffer.from('fake-image-bytes'), {
          filename: 'pantry.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(200);
      expect(mockedAnalyzeIngredients).toHaveBeenCalledTimes(1);
      expect(mockedAnalyzeIngredients.mock.calls[0][0].locale).toBe('es');
    });
  });

  describe('2. Explicit locale=es is accepted', () => {
    it('POST /api/recipes/recommend acepta explícitamente locale=es', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', authHeader)
        .send({
          pantry: basePantry,
          budget: 20000,
          servings: 2,
          locale: 'es',
        });

      expect(response.status).toBe(200);
      expect(mockedGenerateRecipes.mock.calls[0][0].locale).toBe('es');
    });

    it('POST /api/ingredients/analyze acepta explícitamente ?locale=es', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/ingredients/analyze?locale=es')
        .set('Authorization', authHeader)
        .attach('image', Buffer.from('fake-image-bytes'), {
          filename: 'pantry.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(200);
      expect(mockedAnalyzeIngredients).toHaveBeenCalledTimes(1);
      expect(mockedAnalyzeIngredients.mock.calls[0][0].locale).toBe('es');
    });
  });

  describe('3. Explicit locale=en is accepted', () => {
    it('POST /api/recipes/recommend acepta explícitamente locale=en', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', authHeader)
        .send({
          pantry: basePantry,
          budget: 20000,
          servings: 2,
          locale: 'en',
        });

      expect(response.status).toBe(200);
      expect(mockedGenerateRecipes.mock.calls[0][0].locale).toBe('en');
    });

    it('POST /api/meal-plans/generate acepta explícitamente locale=en', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/meal-plans/generate')
        .set('Authorization', authHeader)
        .send({
          pantry: basePantry,
          budget: 20000,
          servings: 2,
          locale: 'en',
        });

      expect(response.status).toBe(200);
      expect(mockedGenerateRecipes.mock.calls[0][0].locale).toBe('en');
    });

    it('POST /api/ingredients/analyze acepta explícitamente ?locale=en', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/ingredients/analyze?locale=en')
        .set('Authorization', authHeader)
        .attach('image', Buffer.from('fake-image-bytes'), {
          filename: 'pantry.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(200);
      expect(mockedAnalyzeIngredients).toHaveBeenCalledTimes(1);
      expect(mockedAnalyzeIngredients.mock.calls[0][0].locale).toBe('en');
    });
  });

  describe('4. Unsupported locale=fr is rejected', () => {
    it('POST /api/recipes/recommend rechaza locale=fr con 400 VALIDATION_ERROR', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', authHeader)
        .send({
          pantry: basePantry,
          budget: 20000,
          servings: 2,
          locale: 'fr',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
      const localeDetail = response.body.error.details.find(
        (d: { field: string }) => d.field === 'locale',
      );
      expect(localeDetail).toBeDefined();
      expect(mockedGenerateRecipes).not.toHaveBeenCalled();
    });

    it('POST /api/meal-plans/generate rechaza locale=fr con 400 VALIDATION_ERROR', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/meal-plans/generate')
        .set('Authorization', authHeader)
        .send({
          pantry: basePantry,
          budget: 20000,
          servings: 2,
          locale: 'fr',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
      expect(mockedGenerateRecipes).not.toHaveBeenCalled();
    });

    it('POST /api/ingredients/analyze rechaza ?locale=fr con 400 VALIDATION_ERROR', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/ingredients/analyze?locale=fr')
        .set('Authorization', authHeader)
        .attach('image', Buffer.from('fake-image-bytes'), {
          filename: 'pantry.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
      const localeDetail = response.body.error.details.find(
        (d: { field: string }) => d.field === 'locale',
      );
      expect(localeDetail).toBeDefined();
      expect(mockedAnalyzeIngredients).not.toHaveBeenCalled();
    });
  });

  describe('5. Invalid locale types are rejected', () => {
    it('POST /api/recipes/recommend rechaza locale con tipo inválido (número o null)', async () => {
      const auth1 = await createAuthHeader();
      const resNum = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', auth1)
        .send({ pantry: basePantry, budget: 20000, servings: 2, locale: 123 });
      expect(resNum.status).toBe(400);
      expect(resNum.body.error.code).toBe('VALIDATION_ERROR');

      const auth2 = await createAuthHeader();
      const resNull = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', auth2)
        .send({ pantry: basePantry, budget: 20000, servings: 2, locale: null });
      expect(resNull.status).toBe(400);
      expect(resNull.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/ingredients/analyze rechaza query ?locale= vacío o array duplicado', async () => {
      const auth1 = await createAuthHeader();
      const resEmpty = await request(app)
        .post('/api/ingredients/analyze?locale=')
        .set('Authorization', auth1)
        .attach('image', Buffer.from('fake-image-bytes'), {
          filename: 'pantry.jpg',
          contentType: 'image/jpeg',
        });
      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

      const auth2 = await createAuthHeader();
      const resMulti = await request(app)
        .post('/api/ingredients/analyze?locale=en&locale=es')
        .set('Authorization', auth2)
        .attach('image', Buffer.from('fake-image-bytes'), {
          filename: 'pantry.jpg',
          contentType: 'image/jpeg',
        });
      expect(resMulti.status).toBe(400);
      expect(resMulti.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('6. Existing JSON API request fields still work', () => {
    it('conserva todos los campos existentes de recipes/recommend (pantry, budget, servings, maxMinutes)', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', authHeader)
        .send({
          pantry: [
            {
              name: 'arroz',
              quantity: 200,
              unit: 'g',
              needsReview: false,
            },
          ],
          budget: 15000,
          servings: 3,
          maxMinutes: 30,
        });

      expect(response.status).toBe(200);
      expect(mockedGenerateRecipes).toHaveBeenCalledWith(
        expect.objectContaining({
          budget: 15000,
          servings: 3,
          maxMinutes: 30,
          locale: 'es',
        }),
      );
    });

    it('conserva todos los campos existentes de meal-plans/generate', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/meal-plans/generate')
        .set('Authorization', authHeader)
        .send({
          pantry: basePantry,
          budget: 25000,
          servings: 4,
          maxMinutes: 60,
        });

      expect(response.status).toBe(200);
      expect(mockedGenerateRecipes).toHaveBeenCalledWith(
        expect.objectContaining({
          budget: 25000,
          servings: 4,
          maxMinutes: 60,
          locale: 'es',
        }),
      );
    });
  });

  describe('7. Scanner multipart locale validation works', () => {
    it('valida query param antes de llamar al servicio de análisis', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/ingredients/analyze?locale=invalid_locale')
        .set('Authorization', authHeader)
        .attach('image', Buffer.from('fake-image-bytes'), {
          filename: 'pantry.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockedAnalyzeIngredients).not.toHaveBeenCalled();
    });

    it('retorna IMAGE_REQUIRED cuando no se envía imagen pero el locale es válido o por defecto', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/ingredients/analyze?locale=en')
        .set('Authorization', authHeader);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'IMAGE_REQUIRED',
          message: 'Debes enviar una imagen.',
        },
      });
      expect(mockedAnalyzeIngredients).not.toHaveBeenCalled();
    });
  });

  describe('8. Existing Bearer authentication is preserved', () => {
    it('rechaza solicitudes sin Authorization header con 401 AUTH_TOKEN_REQUIRED', async () => {
      const response = await request(app)
        .post('/api/recipes/recommend')
        .send({ pantry: basePantry, budget: 20000, servings: 2 });
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_REQUIRED');
    });

    it('rechaza tokens con formato inválido con 401 INVALID_AUTH_TOKEN', async () => {
      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', 'Bearer token_invalido')
        .send({ pantry: basePantry, budget: 20000, servings: 2 });
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_AUTH_TOKEN');
    });
  });

  describe('9. Existing API response structures remain unchanged', () => {
    it('mantiene estructura de respuesta en /api/recipes/recommend ({ success, data: { recipes } })', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', authHeader)
        .send({
          pantry: basePantry,
          budget: 20000,
          servings: 2,
          locale: 'en',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.recipes');
      expect(Array.isArray(response.body.data.recipes)).toBe(true);
      const recipe = response.body.data.recipes[0];
      expect(recipe).toHaveProperty('name');
      expect(recipe).toHaveProperty('description');
      expect(recipe).toHaveProperty('totalMinutes');
      expect(recipe).toHaveProperty('convenience');
      expect(recipe).toHaveProperty('withinBudget');
    });

    it('mantiene estructura de respuesta en /api/meal-plans/generate ({ success, data: { days, totalEstimatedMissingCost, ... } })', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/meal-plans/generate')
        .set('Authorization', authHeader)
        .send({
          pantry: basePantry,
          budget: 20000,
          servings: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.days');
      expect(response.body.data.days).toHaveLength(3);
      expect(response.body).toHaveProperty('data.totalEstimatedMissingCost');
      expect(response.body).toHaveProperty('data.budgetRemaining');
      expect(response.body).toHaveProperty('data.withinBudget');
    });

    it('mantiene estructura de respuesta en /api/ingredients/analyze ({ success, data: { ingredients } })', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/ingredients/analyze?locale=es')
        .set('Authorization', authHeader)
        .attach('image', Buffer.from('fake-image-bytes'), {
          filename: 'pantry.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.ingredients');
      expect(Array.isArray(response.body.data.ingredients)).toBe(true);
    });
  });

  describe('10. Existing Spanish behavior is preserved', () => {
    it('no infiere idioma desde header Accept-Language y preserva respuesta en español', async () => {
      const authHeader = await createAuthHeader();
      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', authHeader)
        .set('Accept-Language', 'en-US,en;q=0.9')
        .send({
          pantry: basePantry,
          budget: 20000,
          servings: 2,
        });

      expect(response.status).toBe(200);
      expect(mockedGenerateRecipes.mock.calls[0][0].locale).toBe('es');
      const names = response.body.data.recipes.map((r: { name: string }) => r.name);
      expect(names).toContain('Arroz con huevo');
      expect(names).toContain('Tortilla de tomate');
      expect(response.body.data.recipes[0].description).toContain('en español');
    });
  });
});
