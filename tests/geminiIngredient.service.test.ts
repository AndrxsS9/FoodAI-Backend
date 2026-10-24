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
  GEMINI_INGREDIENT_TIMEOUT_MS,
  GEMINI_TIMEOUT_MS,
} from '../src/services/gemini/geminiTimeout';
import { analyzeIngredientsFromImage } from '../src/services/gemini/ingredient.service';
import { AppError } from '../src/utils/errors';

const mockedCreate = vi.mocked(geminiClient.interactions.create);

const validAnalysisPayload = {
  ingredients: [
    {
      name: 'tomate',
      quantity: 3,
      unit: 'unidad',
      needsReview: false,
    },
    {
      name: 'arroz',
      quantity: null,
      unit: 'desconocida',
      needsReview: true,
    },
  ],
};

const sampleInput = {
  buffer: Buffer.from('fake-image-bytes'),
  mimeType: 'image/jpeg',
};

describe('geminiIngredient.service (analyzeIngredientsFromImage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1. respuesta JSON válida -> IngredientAnalysis correcto, modelo gemini-3.5-flash-lite, thinking_level: minimal y estructura de llamada verificada', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(validAnalysisPayload),
    } as any);

    const promise = analyzeIngredientsFromImage(sampleInput);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result).toEqual(validAnalysisPayload);
    expect(mockedCreate).toHaveBeenCalledTimes(1);

    const callArg = mockedCreate.mock.calls[0][0] as any;
    expect(callArg.model).toBe('gemini-3.5-flash-lite');
    expect(callArg.generation_config).toEqual({
      thinking_level: 'minimal',
    });
    expect(callArg.input).toHaveLength(2);
    expect(callArg.input[0]).toEqual({
      type: 'image',
      data: sampleInput.buffer.toString('base64'),
      mime_type: 'image/jpeg',
    });
    expect(callArg.input[1]).toEqual({
      type: 'text',
      text: expect.any(String),
    });
    expect(callArg.response_format).toEqual({
      type: 'text',
      mime_type: 'application/json',
      schema: expect.any(Object),
    });
  });

  it('2. preserva quantity: null, unit: desconocida y needsReview: true/false correctamente', async () => {
    const payloadWithNulls = {
      ingredients: [
        {
          name: 'harina',
          quantity: null,
          unit: 'desconocida',
          needsReview: true,
        },
        {
          name: 'huevo',
          quantity: 6,
          unit: 'unidad',
          needsReview: false,
        },
      ],
    };

    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(payloadWithNulls),
    } as any);

    const promise = analyzeIngredientsFromImage({
      buffer: Buffer.from('png-bytes'),
      mimeType: 'image/png',
    });
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result).toEqual(payloadWithNulls);
    expect(result.ingredients[0].quantity).toBeNull();
    expect(result.ingredients[0].needsReview).toBe(true);
    expect(result.ingredients[1].quantity).toBe(6);
    expect(result.ingredients[1].needsReview).toBe(false);
  });

  it('3. output_text vacío -> lanza EMPTY_GEMINI_RESPONSE (502)', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: '',
    } as any);

    const promise = analyzeIngredientsFromImage(sampleInput);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 502 &&
        err.code === 'EMPTY_GEMINI_RESPONSE'
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('4. JSON inválido -> lanza INVALID_GEMINI_JSON (502)', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: '{esto no es un json valido',
    } as any);

    const promise = analyzeIngredientsFromImage(sampleInput);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 502 &&
        err.code === 'INVALID_GEMINI_JSON'
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('5. schema inválido -> lanza INVALID_GEMINI_RESPONSE (502)', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify({ notIngredients: 123 }),
    } as any);

    const promise = analyzeIngredientsFromImage(sampleInput);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 502 &&
        err.code === 'INVALID_GEMINI_RESPONSE'
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('6. error 429 -> lanza GEMINI_RATE_LIMIT (429) de inmediato en un solo intento sin reintentos', async () => {
    mockedCreate.mockRejectedValueOnce({ status: 429, message: 'Quota exceeded' });

    const promise = analyzeIngredientsFromImage(sampleInput);
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

  it('7. error 503 -> lanza GEMINI_UNAVAILABLE (503) de inmediato en un solo intento sin reintentos', async () => {
    mockedCreate.mockRejectedValueOnce({ statusCode: 503, message: 'Temporarily overloaded' });

    const promise = analyzeIngredientsFromImage(sampleInput);
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

  it('8. error genérico -> lanza IMAGE_ANALYSIS_FAILED (502) de inmediato sin retry', async () => {
    mockedCreate.mockRejectedValueOnce(new Error('Fallo inesperado de red'));

    const promise = analyzeIngredientsFromImage(sampleInput);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 502 &&
        err.code === 'IMAGE_ANALYSIS_FAILED'
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('9. no expira al alcanzar el timeout por defecto (20s), sigue esperando hasta GEMINI_INGREDIENT_TIMEOUT_MS (45s)', async () => {
    mockedCreate.mockImplementationOnce(() => new Promise(() => {}));

    let settled = false;
    analyzeIngredientsFromImage(sampleInput).catch(() => {
      settled = true;
    });

    // Avanzamos 20s (GEMINI_TIMEOUT_MS)
    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS);
    expect(settled).toBe(false);

    // Avanzamos hasta 44s
    await vi.advanceTimersByTimeAsync(24_000);
    expect(settled).toBe(false);
  });

  it('10. timeout específico de ingredientes -> lanza GEMINI_TIMEOUT (504) tras expirar GEMINI_INGREDIENT_TIMEOUT_MS (45s)', async () => {
    mockedCreate.mockImplementationOnce(() => new Promise(() => {}));

    const promise = analyzeIngredientsFromImage(sampleInput);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 504 &&
        err.code === 'GEMINI_TIMEOUT' &&
        err.message.includes('tardó demasiado en responder')
      );
    });

    await vi.advanceTimersByTimeAsync(GEMINI_INGREDIENT_TIMEOUT_MS + 50);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('11. JSON inválido NO provoca retry de la llamada a Gemini', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: '<xml>not json</xml>',
    } as any);

    const promise = analyzeIngredientsFromImage(sampleInput);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('12. schema inválido NO provoca retry de la llamada a Gemini', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify({
        ingredients: [
          {
            name: '',
            quantity: -5,
            unit: 'unidad',
            needsReview: 'no-boolean',
          },
        ],
      }),
    } as any);

    const promise = analyzeIngredientsFromImage(sampleInput);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('13. número de llamadas a Gemini se limita estrictamente a 1 solo intento para análisis de imagen', async () => {
    mockedCreate.mockRejectedValue({ statusCode: 429 });

    const promise = analyzeIngredientsFromImage(sampleInput);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(2000);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });
});
