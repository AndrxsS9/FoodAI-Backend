import { describe, expect, it, vi } from 'vitest';

import { executeWithGeminiRetry } from '../src/services/gemini/geminiRetry';

describe('geminiRetry', () => {
  it('1. éxito en primer intento sin reintentos ni espera', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const operation = vi.fn().mockResolvedValue({ data: 'ok' });

    const result = await executeWithGeminiRetry(operation, {
      sleep: sleepMock,
    });

    expect(result).toEqual({ data: 'ok' });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('2. 429 -> retry -> éxito en segundo intento', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const rateLimitError = { status: 429, message: 'Too Many Requests' };
    const operation = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce('recuperado');

    const result = await executeWithGeminiRetry(operation, {
      sleep: sleepMock,
    });

    expect(result).toBe('recuperado');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledWith(250);
  });

  it('3. 503 -> retry -> éxito en segundo intento', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const unavailableError = { status: 503, message: 'Service Unavailable' };
    const operation = vi
      .fn()
      .mockRejectedValueOnce(unavailableError)
      .mockResolvedValueOnce('servicio restablecido');

    const result = await executeWithGeminiRetry(operation, {
      sleep: sleepMock,
    });

    expect(result).toBe('servicio restablecido');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledWith(250);
  });

  it('4. 429 -> 429 -> éxito en tercer intento', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce('éxito tras dos reintentos');

    const result = await executeWithGeminiRetry(operation, {
      sleep: sleepMock,
    });

    expect(result).toBe('éxito tras dos reintentos');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleepMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenNthCalledWith(1, 250);
    expect(sleepMock).toHaveBeenNthCalledWith(2, 500);
  });

  it('5. respeta el máximo de 3 intentos totales por defecto', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const operation = vi.fn().mockRejectedValue({ status: 429 });

    await expect(
      executeWithGeminiRetry(operation, { sleep: sleepMock }),
    ).rejects.toEqual({ status: 429 });

    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleepMock).toHaveBeenCalledTimes(2);
  });

  it('6. 429 persistente -> propaga error original después de 3 intentos', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const customError = new Error('Rate limit persistente');
    (customError as unknown as { status: number }).status = 429;

    const operation = vi.fn().mockRejectedValue(customError);

    await expect(
      executeWithGeminiRetry(operation, { sleep: sleepMock }),
    ).rejects.toThrow('Rate limit persistente');

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('7. 503 persistente -> propaga error original después de 3 intentos', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const customError = new Error('Saturación persistente');
    (customError as unknown as { statusCode: number }).statusCode = 503;

    const operation = vi.fn().mockRejectedValue(customError);

    await expect(
      executeWithGeminiRetry(operation, { sleep: sleepMock }),
    ).rejects.toThrow('Saturación persistente');

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('8. error genérico (sin status retryable) -> NO reintenta', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const genericError = new Error('Generic DB failure');
    const operation = vi.fn().mockRejectedValue(genericError);

    await expect(
      executeWithGeminiRetry(operation, { sleep: sleepMock }),
    ).rejects.toThrow('Generic DB failure');

    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('9. status 400 (Bad Request) -> NO reintenta', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const badRequestError = { status: 400, message: 'Bad Request' };
    const operation = vi.fn().mockRejectedValue(badRequestError);

    await expect(
      executeWithGeminiRetry(operation, { sleep: sleepMock }),
    ).rejects.toEqual(badRequestError);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('10. status 401 (Unauthorized) -> NO reintenta', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const unauthorizedError = { statusCode: 401, message: 'Invalid API Key' };
    const operation = vi.fn().mockRejectedValue(unauthorizedError);

    await expect(
      executeWithGeminiRetry(operation, { sleep: sleepMock }),
    ).rejects.toEqual(unauthorizedError);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('11. aplica los delays de backoff exponencial determinista configurados', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const recordedDelays: number[] = [];
    sleepMock.mockImplementation((delayMs: number) => {
      recordedDelays.push(delayMs);
      return Promise.resolve();
    });

    const operation = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 503 });

    await expect(
      executeWithGeminiRetry(operation, {
        baseDelayMs: 200,
        maxDelayMs: 1000,
        maxAttempts: 3,
        sleep: sleepMock,
      }),
    ).rejects.toEqual({ status: 503 });

    expect(recordedDelays).toEqual([200, 400]);
  });

  it('12. la operación es invocada exactamente el número correcto de veces', async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce('resultado');

    await executeWithGeminiRetry(operation, {
      maxAttempts: 5,
      sleep: sleepMock,
    });

    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledTimes(1);
  });

  it('13. el valor de retorno final se conserva íntegro', async () => {
    const complexPayload = {
      recipes: [{ name: 'Arroz', ingredients: ['arroz', 'agua'] }],
      meta: { count: 1 },
    };

    const operation = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce(complexPayload);

    const result = await executeWithGeminiRetry(operation, {
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    expect(result).toBe(complexPayload);
  });

  it('14. el objeto de error final exacto se conserva al fallar todos los intentos', async () => {
    const exactError = new TypeError('Error específico de red');
    (exactError as unknown as { status: number }).status = 503;

    const operation = vi.fn().mockRejectedValue(exactError);

    await expect(
      executeWithGeminiRetry(operation, {
        sleep: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toBe(exactError);
  });
});
