import request from 'supertest';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock(
  '../src/services/recipes/recommendation.service',
  () => ({
    buildRecipeRecommendations: vi.fn(),
  }),
);

import app from '../src/app';

import {
  buildRecipeRecommendations,
} from '../src/services/recipes/recommendation.service';

const mockedBuildRecipeRecommendations =
  vi.mocked(buildRecipeRecommendations);

const validRequest = {
  pantry: [
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
    {
      name: 'tomate',
      quantity: 4,
      unit: 'unidad' as const,
      needsReview: false,
    },
  ],
  budget: 20000,
  servings: 2,
  maxMinutes: 45,
};

describe('POST /api/meal-plans/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe rechazar una solicitud sin ingredientes en la despensa', async () => {
    const response = await request(app)
      .post('/api/meal-plans/generate')
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
      mockedBuildRecipeRecommendations,
    ).not.toHaveBeenCalled();
  });

  it('debe generar un plan de tres días', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValue({
      recipes: [
        {
          name: 'Arroz con huevo',
          description: 'Receta sencilla.',
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
          ],
          steps: [
            'Cocinar el arroz.',
            'Preparar los huevos.',
          ],
          availableIngredients: [
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
          ],
          missingIngredients: [],
          estimatedMissingCost: 0,
          budgetRemaining: 20000,
          withinBudget: true,
          convenience: 95,
          reason: 'Aprovecha la despensa.',
        },
        {
          name: 'Arroz con tomate',
          description: 'Receta sencilla.',
          totalMinutes: 25,
          ingredients: [
            {
              name: 'arroz',
              quantity: 200,
              unit: 'g',
            },
            {
              name: 'tomate',
              quantity: 2,
              unit: 'unidad',
            },
          ],
          steps: [
            'Cocinar el arroz.',
            'Agregar tomate.',
          ],
          availableIngredients: [
            {
              name: 'arroz',
              quantity: 200,
              unit: 'g',
            },
            {
              name: 'tomate',
              quantity: 2,
              unit: 'unidad',
            },
          ],
          missingIngredients: [],
          estimatedMissingCost: 0,
          budgetRemaining: 20000,
          withinBudget: true,
          convenience: 95,
          reason: 'Aprovecha la despensa.',
        },
        {
          name: 'Huevos con tomate',
          description: 'Receta sencilla.',
          totalMinutes: 15,
          ingredients: [
            {
              name: 'huevo',
              quantity: 2,
              unit: 'unidad',
            },
            {
              name: 'tomate',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: [
            'Preparar los huevos.',
            'Agregar tomate.',
          ],
          availableIngredients: [
            {
              name: 'huevo',
              quantity: 2,
              unit: 'unidad',
            },
            {
              name: 'tomate',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          missingIngredients: [],
          estimatedMissingCost: 0,
          budgetRemaining: 20000,
          withinBudget: true,
          convenience: 95,
          reason: 'Aprovecha la despensa.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send(validRequest);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(
      response.body.data.days,
    ).toHaveLength(3);

    expect(
      response.body.data.days[0].day,
    ).toBe(1);

    expect(
      response.body.data.days[1].day,
    ).toBe(2);

    expect(
      response.body.data.days[2].day,
    ).toBe(3);

    expect(
      response.body.data.totalEstimatedMissingCost,
    ).toBe(0);

    expect(
      response.body.data.budgetRemaining,
    ).toBe(20000);

    expect(
      response.body.data.withinBudget,
    ).toBe(true);
  });

  it('debe contar una sola vez ingredientes faltantes repetidos', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValue({
      recipes: [
        {
          name: 'Receta 1',
          description: 'Primera receta.',
          totalMinutes: 20,
          ingredients: [
            {
              name: 'cebolla',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'cebolla',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 1500,
          budgetRemaining: 18500,
          withinBudget: true,
          convenience: 60,
          reason: 'Requiere una compra.',
        },
        {
          name: 'Receta 2',
          description: 'Segunda receta.',
          totalMinutes: 25,
          ingredients: [
            {
              name: 'cebolla',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'cebolla',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 1500,
          budgetRemaining: 18500,
          withinBudget: true,
          convenience: 60,
          reason: 'Requiere una compra.',
        },
        {
          name: 'Receta 3',
          description: 'Tercera receta.',
          totalMinutes: 30,
          ingredients: [
            {
              name: 'tomate',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'tomate',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 1500,
          budgetRemaining: 18500,
          withinBudget: true,
          convenience: 60,
          reason: 'Requiere una compra.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send(validRequest);

    expect(response.status).toBe(200);

    /*
     * cebolla = 1500
     * tomate  = 1500
     *
     * Aunque cebolla aparece en dos recetas,
     * debe contarse una sola vez.
     */
    expect(
      response.body.data.totalEstimatedMissingCost,
    ).toBe(3000);

    expect(
      response.body.data.budgetRemaining,
    ).toBe(17000);
  });

  it('debe elegir la combinación de menor costo cuando ninguna cabe en el presupuesto', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValue({
      recipes: [
        {
          name: 'Receta con ajo',
          description: 'Primera receta.',
          totalMinutes: 10,
          ingredients: [
            {
              name: 'ajo',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'ajo',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 1000,
          budgetRemaining: -1000,
          withinBudget: false,
          convenience: 0,
          reason: 'Requiere una compra.',
        },
        {
          name: 'Receta con tomate',
          description: 'Segunda receta.',
          totalMinutes: 10,
          ingredients: [
            {
              name: 'tomate',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'tomate',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 1500,
          budgetRemaining: -1500,
          withinBudget: false,
          convenience: 50,
          reason: 'Requiere una compra.',
        },
        {
          name: 'Receta con papa',
          description: 'Tercera receta.',
          totalMinutes: 10,
          ingredients: [
            {
              name: 'papa',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'papa',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 2500,
          budgetRemaining: -2500,
          withinBudget: false,
          convenience: 50,
          reason: 'Requiere una compra.',
        },
        {
          name: 'Receta con carne',
          description: 'Cuarta receta.',
          totalMinutes: 10,
          ingredients: [
            {
              name: 'carne',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'carne',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 12000,
          budgetRemaining: -12000,
          withinBudget: false,
          convenience: 100,
          reason: 'Requiere una compra.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send({
        ...validRequest,
        budget: 0,
      });

    expect(response.status).toBe(200);

    expect(
      response.body.data.totalEstimatedMissingCost,
    ).toBe(5000);

    expect(
      response.body.data.budgetRemaining,
    ).toBe(-5000);

    expect(
      response.body.data.withinBudget,
    ).toBe(false);

    expect(
      response.body.data.days.map(
        (day: { recipe: { name: string } }) =>
          day.recipe.name,
      ),
    ).not.toContain('Receta con carne');
  });

  it('debe priorizar mayor conveniencia cuando varias combinaciones caben en el presupuesto', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValue({
      recipes: [
        {
          name: 'Receta con ajo',
          description: 'Receta económica.',
          totalMinutes: 20,
          ingredients: [
            {
              name: 'ajo',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'ajo',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 1000,
          budgetRemaining: 19000,
          withinBudget: true,
          convenience: 90,
          reason: 'Buena conveniencia.',
        },
        {
          name: 'Receta con tomate',
          description: 'Receta económica.',
          totalMinutes: 20,
          ingredients: [
            {
              name: 'tomate',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'tomate',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 1500,
          budgetRemaining: 18500,
          withinBudget: true,
          convenience: 80,
          reason: 'Buena conveniencia.',
        },
        {
          name: 'Receta con papa',
          description: 'Receta económica.',
          totalMinutes: 20,
          ingredients: [
            {
              name: 'papa',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'papa',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 2500,
          budgetRemaining: 17500,
          withinBudget: true,
          convenience: 70,
          reason: 'Conveniencia media.',
        },
        {
          name: 'Receta con carne',
          description: 'Receta más costosa.',
          totalMinutes: 20,
          ingredients: [
            {
              name: 'carne',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'carne',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 12000,
          budgetRemaining: 8000,
          withinBudget: true,
          convenience: 95,
          reason: 'Alta conveniencia.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send(validRequest);

    expect(response.status).toBe(200);

    expect(
      response.body.data.withinBudget,
    ).toBe(true);

    expect(
      response.body.data.days.map(
        (day: { recipe: { name: string } }) =>
          day.recipe.name,
      ),
    ).toEqual(
      expect.arrayContaining([
        'Receta con ajo',
        'Receta con tomate',
        'Receta con carne',
      ]),
    );

    expect(
      response.body.data.totalEstimatedMissingCost,
    ).toBe(14500);

    expect(
      response.body.data.budgetRemaining,
    ).toBe(5500);
  });

  it('debe usar menor costo como desempate cuando la conveniencia es igual', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValue({
      recipes: [
        {
          name: 'Receta con ajo',
          description: 'Primera receta.',
          totalMinutes: 20,
          ingredients: [
            {
              name: 'ajo',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'ajo',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 1000,
          budgetRemaining: 19000,
          withinBudget: true,
          convenience: 80,
          reason: 'Conveniencia similar.',
        },
        {
          name: 'Receta con tomate',
          description: 'Segunda receta.',
          totalMinutes: 20,
          ingredients: [
            {
              name: 'tomate',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'tomate',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 1500,
          budgetRemaining: 18500,
          withinBudget: true,
          convenience: 80,
          reason: 'Conveniencia similar.',
        },
        {
          name: 'Receta con papa',
          description: 'Tercera receta.',
          totalMinutes: 20,
          ingredients: [
            {
              name: 'papa',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'papa',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 2500,
          budgetRemaining: 17500,
          withinBudget: true,
          convenience: 80,
          reason: 'Conveniencia similar.',
        },
        {
          name: 'Receta con carne',
          description: 'Cuarta receta.',
          totalMinutes: 20,
          ingredients: [
            {
              name: 'carne',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            {
              name: 'carne',
              quantity: 1,
              unit: 'unidad',
            },
          ],
          estimatedMissingCost: 12000,
          budgetRemaining: 8000,
          withinBudget: true,
          convenience: 80,
          reason: 'Conveniencia similar.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send(validRequest);

    expect(response.status).toBe(200);

    expect(
      response.body.data.totalEstimatedMissingCost,
    ).toBe(5000);

    expect(
      response.body.data.budgetRemaining,
    ).toBe(15000);

    expect(
      response.body.data.days.map(
        (day: { recipe: { name: string } }) =>
          day.recipe.name,
      ),
    ).toEqual(
      expect.arrayContaining([
        'Receta con ajo',
        'Receta con tomate',
        'Receta con papa',
      ]),
    );

    expect(
      response.body.data.days.map(
        (day: { recipe: { name: string } }) =>
          day.recipe.name,
      ),
    ).not.toContain('Receta con carne');
  });

  it('debe fallar si no existen suficientes recetas para tres días', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValue({
      recipes: [
        {
          name: 'Receta única',
          description: 'Una receta.',
          totalMinutes: 20,
          ingredients: [
            {
              name: 'arroz',
              quantity: 100,
              unit: 'g',
            },
          ],
          steps: ['Preparar.'],
          availableIngredients: [
            {
              name: 'arroz',
              quantity: 100,
              unit: 'g',
            },
          ],
          missingIngredients: [],
          estimatedMissingCost: 0,
          budgetRemaining: 20000,
          withinBudget: true,
          convenience: 95,
          reason: 'Aprovecha la despensa.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send({
        pantry: validRequest.pantry,
        budget: validRequest.budget,
        servings: validRequest.servings,
      });

    expect(response.status).toBe(502);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INSUFFICIENT_RECIPES_FOR_PLAN',
        message:
          'No se generaron suficientes recetas para construir un plan de tres días.',
      },
    });
  });

  it('debe deduplicar costo de compra cuando una receta requiere "papa" y otra "patata"', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValue({
      recipes: [
        {
          name: 'Puré de papa',
          description: 'Receta 1.',
          totalMinutes: 20,
          ingredients: [
            { name: 'papa', quantity: 2, unit: 'unidad' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'papa', quantity: 2, unit: 'unidad' },
          ],
          estimatedMissingCost: 2500,
          budgetRemaining: 17500,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
        {
          name: 'Tortilla con patata',
          description: 'Receta 2.',
          totalMinutes: 25,
          ingredients: [
            { name: 'patata', quantity: 2, unit: 'unidad' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'patata', quantity: 2, unit: 'unidad' },
          ],
          estimatedMissingCost: 2500,
          budgetRemaining: 17500,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
        {
          name: 'Arroz blanco',
          description: 'Receta 3.',
          totalMinutes: 20,
          ingredients: [
            { name: 'arroz', quantity: 200, unit: 'g' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'arroz', quantity: 200, unit: 'g' },
          ],
          estimatedMissingCost: 3500,
          budgetRemaining: 16500,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send(validRequest);

    expect(response.status).toBe(200);
    // papa (2500) y patata (alias de papa) se deduplican a una sola compra: 2500 + arroz (3500) = 6000
    expect(response.body.data.totalEstimatedMissingCost).toBe(6000);
    expect(response.body.data.budgetRemaining).toBe(14000);
    expect(response.body.data.withinBudget).toBe(true);
  });

  it('debe deduplicar costo de compra cuando una receta requiere "papa" y otra "patatas"', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValue({
      recipes: [
        {
          name: 'Puré de papa',
          description: 'Receta 1.',
          totalMinutes: 20,
          ingredients: [
            { name: 'papa', quantity: 2, unit: 'unidad' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'papa', quantity: 2, unit: 'unidad' },
          ],
          estimatedMissingCost: 2500,
          budgetRemaining: 17500,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
        {
          name: 'Papas al horno',
          description: 'Receta 2.',
          totalMinutes: 25,
          ingredients: [
            { name: 'patatas', quantity: 3, unit: 'unidad' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'patatas', quantity: 3, unit: 'unidad' },
          ],
          estimatedMissingCost: 2500,
          budgetRemaining: 17500,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
        {
          name: 'Arroz blanco',
          description: 'Receta 3.',
          totalMinutes: 20,
          ingredients: [
            { name: 'arroz', quantity: 200, unit: 'g' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'arroz', quantity: 200, unit: 'g' },
          ],
          estimatedMissingCost: 3500,
          budgetRemaining: 16500,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send(validRequest);

    expect(response.status).toBe(200);
    // papa (2500) y patatas (plural + alias de papa) se deduplican: 2500 + arroz (3500) = 6000
    expect(response.body.data.totalEstimatedMissingCost).toBe(6000);
    expect(response.body.data.budgetRemaining).toBe(14000);
  });

  it('debe deduplicar costo de compra con frases/aliases: "cebolla larga" y "cebollas de rama"', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValue({
      recipes: [
        {
          name: 'Sopa con cebolla larga',
          description: 'Receta 1.',
          totalMinutes: 20,
          ingredients: [
            { name: 'cebolla larga', quantity: 1, unit: 'unidad' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'cebolla larga', quantity: 1, unit: 'unidad' },
          ],
          estimatedMissingCost: 2000,
          budgetRemaining: 18000,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
        {
          name: 'Guiso con cebollas de rama',
          description: 'Receta 2.',
          totalMinutes: 25,
          ingredients: [
            { name: 'cebollas de rama', quantity: 2, unit: 'unidad' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'cebollas de rama', quantity: 2, unit: 'unidad' },
          ],
          estimatedMissingCost: 2000,
          budgetRemaining: 18000,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
        {
          name: 'Huevos revueltos',
          description: 'Receta 3.',
          totalMinutes: 10,
          ingredients: [
            { name: 'huevo', quantity: 2, unit: 'unidad' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'huevo', quantity: 2, unit: 'unidad' },
          ],
          estimatedMissingCost: 800,
          budgetRemaining: 19200,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send(validRequest);

    expect(response.status).toBe(200);
    // cebolla larga (2000) y cebollas de rama (2000) se deduplican: 2000 + huevo (800) = 2800
    expect(response.body.data.totalEstimatedMissingCost).toBe(2800);
    expect(response.body.data.budgetRemaining).toBe(17200);
  });

  it('no debe mutar el objeto de solicitud ni la despensa enviada', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValue({
      recipes: [
        {
          name: 'Receta 1',
          description: 'Desc 1',
          totalMinutes: 20,
          ingredients: [
            { name: 'papa', quantity: 2, unit: 'unidad' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'patatas', quantity: 2, unit: 'unidad' },
          ],
          estimatedMissingCost: 2500,
          budgetRemaining: 17500,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
        {
          name: 'Receta 2',
          description: 'Desc 2',
          totalMinutes: 20,
          ingredients: [
            { name: 'papa', quantity: 2, unit: 'unidad' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'papa', quantity: 2, unit: 'unidad' },
          ],
          estimatedMissingCost: 2500,
          budgetRemaining: 17500,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
        {
          name: 'Receta 3',
          description: 'Desc 3',
          totalMinutes: 20,
          ingredients: [
            { name: 'arroz', quantity: 200, unit: 'g' },
          ],
          steps: ['Preparar.'],
          availableIngredients: [],
          missingIngredients: [
            { name: 'arroz', quantity: 200, unit: 'g' },
          ],
          estimatedMissingCost: 3500,
          budgetRemaining: 16500,
          withinBudget: true,
          convenience: 85,
          reason: 'Buena opción.',
        },
      ],
    });

    const requestPayload = structuredClone(validRequest);
    const expectedCopy = structuredClone(validRequest);

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send(requestPayload);

    expect(response.status).toBe(200);
    expect(requestPayload).toEqual(expectedCopy);
  });

  it('debe preservar metadatos de tiempo enriquecidos (prepMinutes, cookMinutes, stepDurations) en cada receta del plan', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValue({
      recipes: [
        {
          name: 'Día 1 - Pollo con papas',
          description: 'Receta completa día 1',
          totalMinutes: 35,
          prepMinutes: 10,
          cookMinutes: 25,
          stepDurations: [
            { stepIndex: 0, minutes: 10, action: 'preparar' },
            { stepIndex: 1, minutes: 25, action: 'hornear' },
          ],
          ingredients: [{ name: 'pollo', quantity: 300, unit: 'g' }],
          steps: ['Preparar el pollo.', 'Hornear por 25 minutos.'],
          availableIngredients: [{ name: 'pollo', quantity: 300, unit: 'g' }],
          missingIngredients: [],
          estimatedMissingCost: 0,
          budgetRemaining: 20000,
          withinBudget: true,
          convenience: 95,
          reason: 'Aprovecha la despensa.',
        },
        {
          name: 'Día 2 - Arroz con huevo',
          description: 'Receta rápida día 2',
          totalMinutes: 20,
          prepMinutes: 5,
          cookMinutes: 15,
          stepDurations: [
            { stepIndex: 0, minutes: 5, action: 'medir' },
            { stepIndex: 1, minutes: 15, action: 'cocer' },
          ],
          ingredients: [{ name: 'arroz', quantity: 200, unit: 'g' }],
          steps: ['Medir el arroz.', 'Cocer en agua 15 minutos.'],
          availableIngredients: [{ name: 'arroz', quantity: 200, unit: 'g' }],
          missingIngredients: [],
          estimatedMissingCost: 0,
          budgetRemaining: 20000,
          withinBudget: true,
          convenience: 95,
          reason: 'Aprovecha la despensa.',
        },
        {
          name: 'Día 3 - Ensalada fresca con aguacate',
          description: 'Receta fresca día 3',
          totalMinutes: 10,
          prepMinutes: 10,
          cookMinutes: 0,
          stepDurations: [
            { stepIndex: 0, minutes: 10, action: 'picar y mezclar' },
          ],
          ingredients: [{ name: 'aguacate', quantity: 1, unit: 'unidad' }],
          steps: ['Picar y mezclar.'],
          availableIngredients: [{ name: 'aguacate', quantity: 1, unit: 'unidad' }],
          missingIngredients: [],
          estimatedMissingCost: 0,
          budgetRemaining: 20000,
          withinBudget: true,
          convenience: 95,
          reason: 'Aprovecha la despensa.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send(validRequest);

    expect(response.status).toBe(200);
    expect(response.body.data.days).toHaveLength(3);

    const day1Recipe = response.body.data.days[0].recipe;
    expect(day1Recipe.prepMinutes).toBe(10);
    expect(day1Recipe.cookMinutes).toBe(25);
    expect(day1Recipe.stepDurations).toHaveLength(2);
    expect(day1Recipe.stepDurations[1].action).toBe('hornear');

    const day3Recipe = response.body.data.days[2].recipe;
    expect(day3Recipe.prepMinutes).toBe(10);
    expect(day3Recipe.cookMinutes).toBe(0);
    expect(day3Recipe.stepDurations[0].action).toBe('picar y mezclar');
  });

  it('cuando 1 de las 3 recetas excede maxMinutes (quedan 2), responde 502 con INSUFFICIENT_RECIPES_FOR_PLAN y mensaje claro y accionable', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValueOnce({
      recipes: [
        {
          name: 'Arroz con huevo',
          description: 'Rápido',
          totalMinutes: 15,
          ingredients: [{ name: 'arroz', quantity: 200, unit: 'g' }],
          steps: ['Cocinar arroz y freír huevo.'],
          availableIngredients: [],
          missingIngredients: [],
          estimatedMissingCost: 0,
          budgetRemaining: 20000,
          withinBudget: true,
          convenience: 95,
          reason: 'Aprovecha despensa.',
        },
        {
          name: 'Huevos pericos',
          description: 'Rápido 2',
          totalMinutes: 10,
          ingredients: [{ name: 'huevo', quantity: 2, unit: 'unidad' }],
          steps: ['Batir y sofreír.'],
          availableIngredients: [],
          missingIngredients: [],
          estimatedMissingCost: 0,
          budgetRemaining: 20000,
          withinBudget: true,
          convenience: 90,
          reason: 'Fácil.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send({
        ...validRequest,
        maxMinutes: 20,
      });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INSUFFICIENT_RECIPES_FOR_PLAN',
        message:
          'No se generaron suficientes recetas que cumplan con el tiempo máximo de 20 minutos para construir un plan de tres días (2 de 3 requeridas). Te sugerimos aumentar el tiempo límite disponible o ajustar los ingredientes de la despensa.',
      },
    });
  });

  it('cuando 2 de las 3 recetas exceden maxMinutes (queda 1), responde 502 con INSUFFICIENT_RECIPES_FOR_PLAN y mensaje claro y accionable', async () => {
    mockedBuildRecipeRecommendations.mockResolvedValueOnce({
      recipes: [
        {
          name: 'Arepa con huevo',
          description: 'Desayuno rápido',
          totalMinutes: 15,
          ingredients: [{ name: 'huevo', quantity: 1, unit: 'unidad' }],
          steps: ['Preparar arepa y rellenar con huevo.'],
          availableIngredients: [],
          missingIngredients: [],
          estimatedMissingCost: 0,
          budgetRemaining: 20000,
          withinBudget: true,
          convenience: 90,
          reason: 'Rápido.',
        },
      ],
    });

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send({
        ...validRequest,
        maxMinutes: 15,
      });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INSUFFICIENT_RECIPES_FOR_PLAN',
        message:
          'No se generaron suficientes recetas que cumplan con el tiempo máximo de 15 minutos para construir un plan de tres días (1 de 3 requeridas). Te sugerimos aumentar el tiempo límite disponible o ajustar los ingredientes de la despensa.',
      },
    });
  });

  it('cuando las 3 recetas exceden maxMinutes (0 válidas), responde predeciblemente 502 con INSUFFICIENT_RECIPES_FOR_PLAN y mensaje claro', async () => {
    const { AppError } = await import('../src/utils/errors');
    mockedBuildRecipeRecommendations.mockRejectedValueOnce(
      new AppError(
        'Las recetas generadas exceden el tiempo máximo solicitado de 15 minutos.',
        502,
        'RECIPE_TIME_LIMIT_EXCEEDED',
      ),
    );

    const response = await request(app)
      .post('/api/meal-plans/generate')
      .send({
        ...validRequest,
        maxMinutes: 15,
      });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INSUFFICIENT_RECIPES_FOR_PLAN',
        message:
          'No se generaron suficientes recetas que cumplan con el tiempo máximo de 15 minutos para construir un plan de tres días (0 de 3 requeridas). Te sugerimos aumentar el tiempo límite disponible o ajustar los ingredientes de la despensa.',
      },
    });
  });
});
