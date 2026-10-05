import request from 'supertest';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AppError } from '../src/utils/errors';

vi.mock(
  '../src/services/gemini/recipe.service',
  () => ({
    generateRecipeRecommendations: vi.fn(),
  }),
);

import app from '../src/app';

import {
  generateRecipeRecommendations,
} from '../src/services/gemini/recipe.service';

const mockedGenerateRecipes =
  vi.mocked(generateRecipeRecommendations);

const validRequest = {
  pantry: [
    {
      name: 'tomate',
      quantity: 4,
      unit: 'unidad' as const,
      needsReview: false,
    },
    {
      name: 'arroz',
      quantity: 500,
      unit: 'g' as const,
      needsReview: false,
    },
    {
      name: 'huevo',
      quantity: 6,
      unit: 'unidad' as const,
      needsReview: false,
    },
  ],

  budget: 20000,
  servings: 2,
  maxMinutes: 45,
};

describe('POST /api/recipes/recommend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe rechazar una solicitud sin ingredientes en la despensa', async () => {
    const response = await request(app)
      .post('/api/recipes/recommend')
      .send({
        pantry: [],
        budget: 20000,
        servings: 2,
      });

    expect(response.status).toBe(400);

    expect(response.body.success).toBe(false);

    expect(response.body.error.code).toBe(
      'VALIDATION_ERROR',
    );

    expect(
      mockedGenerateRecipes,
    ).not.toHaveBeenCalled();
  });

  it('debe construir y ordenar las recomendaciones usando lógica de FoodAI', async () => {
    /*
     * Gemini devuelve deliberadamente primero
     * la receta menos conveniente.
     *
     * FoodAI debe reordenarlas.
     */
    mockedGenerateRecipes.mockResolvedValue({
      recipes: [
        {
          name: 'Pasta con tomate y queso',
          description:
            'Pasta sencilla con tomate y queso.',

          totalMinutes: 30,

          ingredients: [
            {
              name: 'pasta',
              quantity: 200,
              unit: 'g',
            },
            {
              name: 'tomate',
              quantity: 2,
              unit: 'unidad',
            },
            {
              name: 'queso',
              quantity: 100,
              unit: 'g',
            },
          ],

          steps: [
            'Cocinar la pasta.',
            'Preparar el tomate.',
            'Mezclar con el queso.',
          ],
        },

        {
          name: 'Arroz con huevo y tomate',
          description:
            'Arroz acompañado de huevo y tomate.',

          totalMinutes: 20,

          ingredients: [
            {
              name: 'arroz',
              quantity: 200,
              unit: 'g',
            },
            {
              name: 'huevo',
              quantity: 2,
              unit: 'unidad',
            },
            {
              name: 'tomate',
              quantity: 2,
              unit: 'unidad',
            },
          ],

          steps: [
            'Cocinar el arroz.',
            'Preparar los huevos.',
            'Servir con tomate.',
          ],
        },
      ],
    });

    const response = await request(app)
      .post('/api/recipes/recommend')
      .send(validRequest);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    const recipes =
      response.body.data.recipes;

    expect(recipes).toHaveLength(2);

    /*
     * FoodAI debe poner primero esta receta
     * aunque Gemini la haya enviado segunda.
     */
    expect(recipes[0].name).toBe(
      'Arroz con huevo y tomate',
    );

    expect(
      recipes[0].availableIngredients,
    ).toHaveLength(3);

    expect(
      recipes[0].missingIngredients,
    ).toHaveLength(0);

    expect(
      recipes[0].estimatedMissingCost,
    ).toBe(0);

    expect(
      recipes[0].budgetRemaining,
    ).toBe(20000);

    expect(
      recipes[0].withinBudget,
    ).toBe(true);

    expect(
      recipes[0].convenience,
    ).toBe(95);

    /*
     * Segunda receta:
     *
     * tomate -> disponible
     * pasta   -> faltante: 3500
     * queso   -> faltante: 6500
     *
     * total faltante = 10000
     */
    expect(recipes[1].name).toBe(
      'Pasta con tomate y queso',
    );

    expect(
      recipes[1].availableIngredients,
    ).toHaveLength(1);

    expect(
      recipes[1].missingIngredients,
    ).toHaveLength(2);

    expect(
      recipes[1].estimatedMissingCost,
    ).toBe(10000);

    expect(
      recipes[1].budgetRemaining,
    ).toBe(10000);

    expect(
      recipes[1].withinBudget,
    ).toBe(true);

    expect(
      recipes[1].convenience,
    ).toBe(38);

    expect(
      mockedGenerateRecipes,
    ).toHaveBeenCalledTimes(1);
  });

  it('debe indicar cuando una receta supera el presupuesto', async () => {
    mockedGenerateRecipes.mockResolvedValue({
      recipes: [
        {
          name: 'Carne con queso',
          description:
            'Preparación de carne con queso.',

          totalMinutes: 35,

          ingredients: [
            {
              name: 'carne',
              quantity: 300,
              unit: 'g',
            },
            {
              name: 'queso',
              quantity: 100,
              unit: 'g',
            },
          ],

          steps: [
            'Cocinar la carne.',
            'Agregar el queso.',
          ],
        },
      ],
    });

    const response = await request(app)
      .post('/api/recipes/recommend')
      .send({
        ...validRequest,
        budget: 5000,
      });

    expect(response.status).toBe(200);

    const recipe =
      response.body.data.recipes[0];

    /*
     * carne: 12000
     * queso: 6500
     * total: 18500
     */
    expect(
      recipe.estimatedMissingCost,
    ).toBe(18500);

    expect(
      recipe.withinBudget,
    ).toBe(false);

    expect(
      recipe.budgetRemaining,
    ).toBe(-13500);

    expect(recipe.convenience).toBe(0);
  });

  it('debe manejar el límite de solicitudes de Gemini', async () => {
    mockedGenerateRecipes.mockRejectedValue(
      new AppError(
        'Se alcanzó temporalmente el límite de generación de recetas. Intenta nuevamente más tarde.',
        429,
        'GEMINI_RATE_LIMIT',
      ),
    );

    const response = await request(app)
      .post('/api/recipes/recommend')
      .send(validRequest);

    expect(response.status).toBe(429);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'GEMINI_RATE_LIMIT',
        message:
          'Se alcanzó temporalmente el límite de generación de recetas. Intenta nuevamente más tarde.',
      },
    });
  });

  it('debe manejar cuando Gemini no está disponible', async () => {
    mockedGenerateRecipes.mockRejectedValue(
      new AppError(
        'El servicio de generación de recetas está temporalmente ocupado. Intenta nuevamente más tarde.',
        503,
        'GEMINI_UNAVAILABLE',
      ),
    );

    const response = await request(app)
      .post('/api/recipes/recommend')
      .send(validRequest);

    expect(response.status).toBe(503);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'GEMINI_UNAVAILABLE',
        message:
          'El servicio de generación de recetas está temporalmente ocupado. Intenta nuevamente más tarde.',
      },
    });
  });
});