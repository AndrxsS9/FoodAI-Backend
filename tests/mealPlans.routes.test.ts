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
    expect(response.body.data.budgetRemaining).toBe(-5000);
    expect(response.body.data.withinBudget).toBe(false);
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
      .send(validRequest);

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
});