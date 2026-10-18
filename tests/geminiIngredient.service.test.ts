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

  it('1. respuesta JSON válida -> IngredientAnalysis correcto y estructura de llamada verificada', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(validAnalysisPayload),
    } as any);

    const promise = analyzeIngredientsFromImage(sampleInput);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result).toEqual(validAnalysisPayload);
    expect(mockedCreate).toHaveBeenCalledTimes(1);

    const callArg = mockedCreate.mock.calls[0][0];
    expect(callArg.model).toBe('gemini-3.8-flash');
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

  it('2. output_text vacío -> lanza EMPTY_GEMINI_RESPONSE (502)', async () => {
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

  it('3. JSON inválido -> lanza INVALID_GEMINI_JSON (502)', async () => {
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

  it('4. schema inválido -> lanza INVALID_GEMINI_RESPONSE (502)', async () => {
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

  it('5. 429 seguido de éxito -> reintenta con backoff y responde correctamente', async () => {
    mockedCreate
      .mockRejectedValueOnce({ status: 429, message: 'Quota exceeded' })
      .mockResolvedValueOnce({
        output_text: JSON.stringify(validAnalysisPayload),
      } as any);

    const promise = analyzeIngredientsFromImage(sampleInput);

    // Avanza el timer del primer backoff (250 ms)
    await vi.advanceTimersByTimeAsync(300);
    const result = await promise;

    expect(result).toEqual(validAnalysisPayload);
    expect(mockedCreate).toHaveBeenCalledTimes(2);
  });

  it('6. 503 seguido de éxito -> reintenta con backoff y responde correctamente', async () => {
    mockedCreate
      .mockRejectedValueOnce({ statusCode: 503, message: 'Temporarily overloaded' })
      .mockResolvedValueOnce({
        output_text: JSON.stringify(validAnalysisPayload),
      } as any);

    const promise = analyzeIngredientsFromImage(sampleInput);

    await vi.advanceTimersByTimeAsync(300);
    const result = await promise;

    expect(result).toEqual(validAnalysisPayload);
    expect(mockedCreate).toHaveBeenCalledTimes(2);
  });

  it('7. 429 persistente -> propaga GEMINI_RATE_LIMIT (429) tras agotar reintentos', async () => {
    mockedCreate.mockRejectedValue({ status: 429 });

    const promise = analyzeIngredientsFromImage(sampleInput);
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 429 &&
        err.code === 'GEMINI_RATE_LIMIT'
      );
    });

    // 250ms primer backoff + 500ms segundo backoff
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(3);
  });

  it('8. 503 persistente -> propaga GEMINI_UNAVAILABLE (503) tras agotar reintentos', async () => {
    mockedCreate.mockRejectedValue({ status: 503 });

    const promise = analyzeIngredientsFromImage(sampleInput);
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

  it('9. error genérico -> lanza IMAGE_ANALYSIS_FAILED (502) de inmediato sin reintentar', async () => {
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

  it('10. timeout -> lanza GEMINI_TIMEOUT (504) tras expirar GEMINI_TIMEOUT_MS', async () => {
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

    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS + 50);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('11. JSON inválido NO provoca reintento de la llamada a Gemini', async () => {
    mockedCreate.mockResolvedValueOnce({
      output_text: '<xml>not json</xml>',
    } as any);

    const promise = analyzeIngredientsFromImage(sampleInput);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('12. schema inválido NO provoca reintento de la llamada a Gemini', async () => {
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

  it('13. número máximo de llamadas se limita estrictamente a 3 intentos', async () => {
    mockedCreate.mockRejectedValue({ statusCode: 429 });

    const promise = analyzeIngredientsFromImage(sampleInput);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(2000);
    await assertion;

    expect(mockedCreate).toHaveBeenCalledTimes(3);
  });
});
