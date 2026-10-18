import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/gemini/gemini.client', () => ({
  geminiClient: {
    interactions: {
      create: vi.fn(),
    },
  },
}));

import { geminiClient } from '../src/services/gemini/gemini.client';
import { GEMINI_TIMEOUT_MS } from '../src/services/gemini/geminiTimeout';
import { generateRecipeRecommendations } from '../src/services/gemini/recipe.service';
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
  maxMinutes: 30,
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

  it('1. respuesta JSON válida -> GeneratedRecipes correcto y estructura de llamada verificada', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(validRecipesPayload),
    } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result).toEqual(validRecipesPayload);
    expect(mockedCreate).toHaveBeenCalledTimes(1);

    const callArg = mockedCreate.mock.calls[0][0];
    expect(callArg.model).toBe('gemini-3.8-flash');
    expect(callArg.input).toHaveLength(1);
    expect(callArg.input[0].type).toBe('text');
    expect(callArg.input[0].text).toContain('arroz');
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

  it('5. 429 seguido de éxito -> retry correcto con backoff y devuelve recetas', async () => {
    mockedCreate
      .mockRejectedValueOnce({ status: 429, message: 'Rate limit' })
      .mockResolvedValueOnce({
        output_text: JSON.stringify(validRecipesPayload),
      } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);

    // Primer backoff (250 ms)
    await vi.advanceTimersByTimeAsync(300);
    const result = await promise;

    expect(result).toEqual(validRecipesPayload);
    expect(mockedCreate).toHaveBeenCalledTimes(2);
  });

  it('6. 503 seguido de éxito -> retry correcto con backoff y devuelve recetas', async () => {
    mockedCreate
      .mockRejectedValueOnce({ statusCode: 503, message: 'Server busy' })
      .mockResolvedValueOnce({
        output_text: JSON.stringify(validRecipesPayload),
      } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);

    await vi.advanceTimersByTimeAsync(300);
    const result = await promise;

    expect(result).toEqual(validRecipesPayload);
    expect(mockedCreate).toHaveBeenCalledTimes(2);
  });

  it('7. 429 persistente -> propaga GEMINI_RATE_LIMIT (429) tras 3 intentos', async () => {
    mockedCreate.mockRejectedValue({ status: 429 });

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 429 &&
        err.code === 'GEMINI_RATE_LIMIT'
      );
    });

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(3);
  });

  it('8. 503 persistente -> propaga GEMINI_UNAVAILABLE (503) tras 3 intentos', async () => {
    mockedCreate.mockRejectedValue({ statusCode: 503 });

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 503 &&
        err.code === 'GEMINI_UNAVAILABLE'
      );
    });

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(3);
  });

  it('9. error genérico -> lanza RECIPE_GENERATION_FAILED (502) de inmediato sin retry', async () => {
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

  it('10. timeout -> lanza GEMINI_TIMEOUT (504) tras expirar GEMINI_TIMEOUT_MS', async () => {
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

    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS + 50);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('11. JSON inválido NO provoca retry de la llamada a Gemini', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: '{"recetas": incompleto',
    } as any);

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('12. schema inválido NO provoca retry de la llamada a Gemini', async () => {
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

  it('13. máximo de intentos se limita estrictamente a 3 llamadas', async () => {
    mockedCreate.mockRejectedValue({ status: 503 });

    const promise = generateRecipeRecommendations(sampleRecommendationRequest);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(2000);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(3);
  });
});
