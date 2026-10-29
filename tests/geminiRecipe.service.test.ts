import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/gemini/gemini.client', () => ({
  geminiClient: {
    interactions: {
      create: vi.fn(),
    },
  },
}));

import { geminiClient } from '../src/services/gemini/gemini.client';
import {
  GEMINI_RECIPE_TIMEOUT_MS,
  GEMINI_TIMEOUT_MS,
} from '../src/services/gemini/geminiTimeout';
import {
  generateRecipeRecommendations,
  sanitizeRecipeTimings,
} from '../src/services/gemini/recipe.service';
import { AppError } from '../src/utils/errors';

const mockedCreate = vi.mocked(geminiClient.interactions.create);

const validRecipesPayload = {
  recipes: [
    {
      name: 'Arroz con huevo',
      description: 'Plato clásico, rápido y nutritivo.',
      totalMinutes: 20,
      ingredients: [
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'huevo', quantity: 2, unit: 'unidad' },
      ],
      steps: [
        'Cocer el arroz en agua con sal.',
        'Freír los huevos y servir sobre el arroz.',
      ],
    },
    {
      name: 'Huevos pericos con arroz',
      description: 'Huevos revueltos con tomate y cebolla acompañados de arroz.',
      totalMinutes: 15,
      ingredients: [
        { name: 'arroz', quantity: 150, unit: 'g' },
        { name: 'huevo', quantity: 2, unit: 'unidad' },
        { name: 'tomate', quantity: 1, unit: 'unidad' },
      ],
      steps: [
        'Picar el tomate finamente.',
        'Batir los huevos y sofreírlos con el tomate.',
        'Servir caliente junto al arroz.',
      ],
    },
    {
      name: 'Arroz frito con vegetales y huevo',
      description: 'Arroz salteado con huevo y tomate picado.',
      totalMinutes: 25,
      ingredients: [
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'huevo', quantity: 2, unit: 'unidad' },
        { name: 'tomate', quantity: 2, unit: 'unidad' },
      ],
      steps: [
        'Preparar el arroz previamente.',
        'Saltear los tomates picados.',
        'Incorporar el huevo revuelto y mezclar con el arroz.',
      ],
    },
  ],
};

const sampleRecommendationRequest = {
  pantry: [
    {
      name: 'arroz',
      quantity: 500,
      unit: 'g' as const,
      needsReview: false,
    },
    {
      name: 'huevo',
      quantity: 4,
      unit: 'unidad' as const,
      needsReview: false,
    },
  ],
  budget: 20000,
  servings: 2,
};

describe('geminiRecipe.service (generateRecipeRecommendations)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1. respuesta JSON válida -> GeneratedRecipes correcto, modelo gemini-3.5-flash-lite, thinking_level: minimal y schema verificado', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(validRecipesPayload),
    } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result).toEqual(validRecipesPayload);
    expect(mockedCreate).toHaveBeenCalledTimes(1);

    const callArg = mockedCreate.mock.calls[0][0] as any;
    expect(callArg.model).toBe('gemini-3.5-flash-lite');
    expect(callArg.generation_config).toEqual({
      thinking_level: 'minimal',
    });
    expect(callArg.input).toHaveLength(1);
    expect(callArg.input[0].type).toBe('text');
    expect(callArg.input[0].text).toContain('arroz');
    expect(callArg.input[0].text).toContain('EXACTAMENTE 3 recetas');
    expect(callArg.response_format).toEqual({
      type: 'text',
      mime_type: 'application/json',
      schema: expect.any(Object),
    });
  });

  it('2. output_text vacío -> lanza EMPTY_RECIPE_RESPONSE (502)', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: '',
    } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 502 &&
        err.code === 'EMPTY_RECIPE_RESPONSE'
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('3. JSON inválido -> lanza INVALID_RECIPE_JSON (502)', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: 'esto definitivamente no es json',
    } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 502 &&
        err.code === 'INVALID_RECIPE_JSON'
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('4. schema inválido -> lanza INVALID_RECIPE_RESPONSE (502)', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify({ recipes: [] }), // min(1) requerido
    } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 502 &&
        err.code === 'INVALID_RECIPE_RESPONSE'
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('5. error 429 -> lanza GEMINI_RATE_LIMIT (429) de inmediato en un solo intento sin reintentos', async () => {
    mockedCreate.mockRejectedValueOnce({ status: 429, message: 'Rate limit' });

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 429 &&
        err.code === 'GEMINI_RATE_LIMIT'
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('6. error 503 -> lanza GEMINI_UNAVAILABLE (503) de inmediato en un solo intento sin reintentos', async () => {
    mockedCreate.mockRejectedValueOnce({ statusCode: 503, message: 'Server busy' });

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 503 &&
        err.code === 'GEMINI_UNAVAILABLE'
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('7. error genérico -> lanza RECIPE_GENERATION_FAILED (502) de inmediato sin retry', async () => {
    mockedCreate.mockRejectedValueOnce(new Error('Conexión cerrada abruptamente'));

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 502 &&
        err.code === 'RECIPE_GENERATION_FAILED'
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('8. no expira al alcanzar el timeout por defecto (20s), sigue esperando hasta GEMINI_RECIPE_TIMEOUT_MS', async () => {
    mockedCreate.mockImplementationOnce(() => new Promise(() => {}));

    let settled = false;
    generateRecipeRecommendations(sampleRecommendationRequest).catch(() => {
      settled = true;
    });

    // Avanzamos 20s (GEMINI_TIMEOUT_MS)
    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS);
    expect(settled).toBe(false);

    // Avanzamos hasta 59s
    await vi.advanceTimersByTimeAsync(39_000);
    expect(settled).toBe(false);
  });

  it('9. timeout específico de recetas -> lanza GEMINI_TIMEOUT (504) tras expirar GEMINI_RECIPE_TIMEOUT_MS (60s)', async () => {
    mockedCreate.mockImplementationOnce(() => new Promise(() => {}));

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 504 &&
        err.code === 'GEMINI_TIMEOUT' &&
        err.message.includes('tardó demasiado en responder')
      );
    });

    await vi.advanceTimersByTimeAsync(GEMINI_RECIPE_TIMEOUT_MS + 50);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('10. JSON inválido NO provoca retry de la llamada a Gemini', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: '{"recetas": incompleto',
    } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('11. schema inválido NO provoca retry de la llamada a Gemini', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify({
        recipes: [
          {
            name: 'Receta sin pasos ni ingredientes',
            description: 'Incompleto',
            totalMinutes: -1,
            ingredients: [],
            steps: [],
          },
        ],
      }),
    } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('12. número de llamadas a Gemini se limita estrictamente a 1 solo intento para recetas', async () => {
    mockedCreate.mockRejectedValue({ status: 503 });

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('13. parsea y preserva campos opcionales prepMinutes, cookMinutes y stepDurations cuando Gemini los devuelve', async () => {
    const payloadWithTimings = {
      recipes: [
        {
          name: 'Sancocho rápido',
          description: 'Sopa tradicional colombiana',
          totalMinutes: 45,
          prepMinutes: 15,
          cookMinutes: 30,
          stepDurations: [
            { stepIndex: 0, minutes: 15, action: 'pelar y picar' },
            { stepIndex: 1, minutes: 30, action: 'hervir a fuego medio' },
          ],
          ingredients: [
            { name: 'pollo', quantity: 500, unit: 'g' },
            { name: 'papa', quantity: 2, unit: 'unidad' },
          ],
          steps: [
            'Pelar la papa y trocear el pollo.',
            'Hervir todo en olla grande durante 30 minutos.',
          ],
        },
      ],
    };

    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(payloadWithTimings),
    } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result.recipes[0].prepMinutes).toBe(15);
    expect(result.recipes[0].cookMinutes).toBe(30);
    expect(result.recipes[0].stepDurations).toHaveLength(2);
    expect(result.recipes[0].stepDurations?.[0].action).toBe('pelar y picar');
  });

  it('14. asegura consistencia de tiempos si la suma de prepMinutes y cookMinutes supera totalMinutes', async () => {
    const inconsistentPayload = {
      recipes: [
        {
          name: 'Arroz con pollo',
          description: 'Receta casera',
          totalMinutes: 20, // menor que 10 + 25 = 35
          prepMinutes: 10,
          cookMinutes: 25,
          ingredients: [
            { name: 'arroz', quantity: 200, unit: 'g' },
          ],
          steps: ['Preparar y cocinar.'],
        },
      ],
    };

    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(inconsistentPayload),
    } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    // Se ajusta totalMinutes al menos a la suma de prep + cook (35)
    expect(result.recipes[0].totalMinutes).toBe(35);
    expect(result.recipes[0].prepMinutes).toBe(10);
    expect(result.recipes[0].cookMinutes).toBe(25);
  });

  it('15. filtra stepDurations con índices fuera de rango de steps', async () => {
    const payloadWithInvalidStepIndex = {
      recipes: [
        {
          name: 'Huevo frito',
          description: 'Rápido',
          totalMinutes: 5,
          ingredients: [
            { name: 'huevo', quantity: 1, unit: 'unidad' },
          ],
          steps: ['Calentar aceite y freír el huevo.'],
          stepDurations: [
            { stepIndex: 0, minutes: 4, action: 'freír' },
            { stepIndex: 99, minutes: 10, action: 'inexistente' },
          ],
        },
      ],
    };

    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(payloadWithInvalidStepIndex),
    } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result.recipes[0].stepDurations).toHaveLength(1);
    expect(result.recipes[0].stepDurations?.[0].stepIndex).toBe(0);
  });

  it('16. sanitizeRecipeTimings: si prepMinutes + cookMinutes supera maxMinutes, omite metadata opcional sin inflar totalMinutes ni fabricar tiempos menores', () => {
    const rawRecipe = {
      name: 'Sopa rápida',
      description: 'Sopa casera',
      totalMinutes: 20,
      prepMinutes: 15,
      cookMinutes: 15,
      ingredients: [{ name: 'agua', quantity: 500, unit: 'ml' as const }],
      steps: ['Hervir agua y servir.'],
    };

    const sanitized = sanitizeRecipeTimings(rawRecipe, 20);

    expect(sanitized.totalMinutes).toBe(20);
    expect(sanitized.prepMinutes).toBeUndefined();
    expect(sanitized.cookMinutes).toBeUndefined();
  });

  it('17. sanitizeRecipeTimings: valida coherencia de stepDurations descartando duraciones individuales excesivas o suma incoherente', () => {
    const recipeWithExcessiveSteps = {
      name: 'Guiso de carne',
      description: 'Guiso tradicional',
      totalMinutes: 30,
      ingredients: [{ name: 'carne', quantity: 200, unit: 'g' as const }],
      steps: ['Picar carne.', 'Cocinar a fuego lento.'],
      stepDurations: [
        { stepIndex: 0, minutes: 10, action: 'picar' },
        { stepIndex: 1, minutes: 50, action: 'cocinar' },
      ],
    };

    const sanitized = sanitizeRecipeTimings(recipeWithExcessiveSteps, 30);
    expect(sanitized.stepDurations).toHaveLength(1);
    expect(sanitized.stepDurations?.[0].stepIndex).toBe(0);

    const recipeWithIncoherentSum = {
      name: 'Salteado',
      description: 'Salteado rápido',
      totalMinutes: 20,
      ingredients: [{ name: 'zanahoria', quantity: 1, unit: 'unidad' as const }],
      steps: ['Paso 1', 'Paso 2'],
      stepDurations: [
        { stepIndex: 0, minutes: 12, action: 'cortar' },
        { stepIndex: 1, minutes: 15, action: 'saltear' },
      ],
    };
    const sanitizedSum = sanitizeRecipeTimings(recipeWithIncoherentSum, 20);
    expect(sanitizedSum.stepDurations).toBeUndefined();
  });

  it('18. generateRecipeRecommendations con maxMinutes: filtra recetas que excedan el límite solicitado', async () => {
    const mixedPayload = {
      recipes: [
        {
          name: 'Ensalada rápida',
          description: 'Receta dentro del límite',
          totalMinutes: 20,
          ingredients: [{ name: 'tomate', quantity: 1, unit: 'unidad' }],
          steps: ['Picar y servir.'],
        },
        {
          name: 'Frijoles con garra',
          description: 'Receta que excede el límite',
          totalMinutes: 60,
          ingredients: [{ name: 'frijol', quantity: 300, unit: 'g' }],
          steps: ['Remojar y cocinar por horas.'],
        },
      ],
    };

    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(mixedPayload),
    } as any);

    const promise = generateRecipeRecommendations({
      ...sampleRecommendationRequest,
      maxMinutes: 30,
    });
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0].name).toBe('Ensalada rápida');
    expect(result.recipes[0].totalMinutes).toBe(20);
  });

  it('19. generateRecipeRecommendations con maxMinutes: lanza RECIPE_TIME_LIMIT_EXCEEDED (502) si ninguna receta cumple maxMinutes', async () => {
    const overTimePayload = {
      recipes: [
        {
          name: 'Sancocho trifásico',
          description: 'Cocción lenta',
          totalMinutes: 90,
          ingredients: [{ name: 'pollo', quantity: 500, unit: 'g' }],
          steps: ['Hervir todo por largo tiempo.'],
        },
      ],
    };

    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(overTimePayload),
    } as any);

    const promise = generateRecipeRecommendations({
      ...sampleRecommendationRequest,
      maxMinutes: 30,
    });
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 502 &&
        err.code === 'RECIPE_TIME_LIMIT_EXCEEDED'
      );
    });
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it('20. generateRecipeRecommendations con maxMinutes e inconsistencia en Gemini: omite metadata inconsistente y conserva receta dentro del límite', async () => {
    const payloadWithInconsistentTimings = {
      recipes: [
        {
          name: 'Omelette de espinaca',
          description: 'Rápido y saludable',
          totalMinutes: 20,
          prepMinutes: 15,
          cookMinutes: 15,
          ingredients: [
            { name: 'huevo', quantity: 2, unit: 'unidad' },
            { name: 'espinaca', quantity: 50, unit: 'g' },
          ],
          steps: ['Batir huevos.', 'Cocinar en sartén 5 minutos.'],
        },
      ],
    };

    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(payloadWithInconsistentTimings),
    } as any);

    const promise = generateRecipeRecommendations({
      ...sampleRecommendationRequest,
      maxMinutes: 20,
    });
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0].name).toBe('Omelette de espinaca');
    expect(result.recipes[0].totalMinutes).toBe(20);
    expect(result.recipes[0].prepMinutes).toBeUndefined();
    expect(result.recipes[0].cookMinutes).toBeUndefined();
  });
});
