import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  classifyGeminiError,
  getGeminiErrorStatus,
} from '../src/services/gemini/geminiError';
import {
  executeWithGeminiTimeout,
  GEMINI_RECIPE_TIMEOUT_MS,
  GEMINI_TIMEOUT_MS,
  GeminiTimeoutError,
} from '../src/services/gemini/geminiTimeout';

describe('geminiTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1. operación rápida retorna éxito antes de alcanzar el timeout', async () => {
    const operation = vi.fn().mockResolvedValue('resultado rápido');

    const resultPromise = executeWithGeminiTimeout(operation);
    await vi.advanceTimersByTimeAsync(100);
    const result = await resultPromise;

    expect(result).toBe('resultado rápido');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('2. operación que tarda demasiado lanza GeminiTimeoutError al expirar GEMINI_TIMEOUT_MS', async () => {
    const neverResolvingOperation = () =>
      new Promise<string>(() => {
        // Operación colgada que nunca resuelve
      });

    const timeoutPromise = executeWithGeminiTimeout(neverResolvingOperation);

    const assertionPromise = expect(timeoutPromise).rejects.toThrow(
      GeminiTimeoutError,
    );

    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS + 10);
    await assertionPromise;
  });

  it('3. respeta un custom timeout menor o mayor al por defecto', async () => {
    const hangingOperation = () => new Promise<string>(() => {});

    const timeoutPromise = executeWithGeminiTimeout(hangingOperation, 5000);

    const assertionPromise = expect(timeoutPromise).rejects.toThrow(
      'La solicitud a Gemini excedió el tiempo límite de 5000ms.',
    );

    await vi.advanceTimersByTimeAsync(4999);
    // Aún no debe haber fallado antes de los 5000ms
    await vi.advanceTimersByTimeAsync(10);
    await assertionPromise;
  });

  it('4. error original ocurrido antes del timeout se conserva intacto', async () => {
    const originalError = new Error('Error interno previo al timeout');
    const failingOperation = vi.fn().mockRejectedValue(originalError);

    const resultPromise = executeWithGeminiTimeout(failingOperation, 10000);

    await expect(resultPromise).rejects.toBe(originalError);
  });

  it('5. timeout no se clasifica como 429 ni tiene status 429', () => {
    const timeoutError = new GeminiTimeoutError('Excedido');
    expect(getGeminiErrorStatus(timeoutError)).toBeUndefined();
    expect(classifyGeminiError(timeoutError)).not.toBe('rate_limit');
  });

  it('6. timeout no se clasifica como 503 ni tiene status 503', () => {
    const timeoutError = new GeminiTimeoutError('Excedido');
    expect(getGeminiErrorStatus(timeoutError)).toBeUndefined();
    expect(classifyGeminiError(timeoutError)).not.toBe('unavailable');
  });

  it('7. classifyGeminiError clasifica GeminiTimeoutError como timeout', () => {
    const timeoutError = new GeminiTimeoutError();
    expect(classifyGeminiError(timeoutError)).toBe('timeout');

    // También soporta objeto con name GeminiTimeoutError
    const duckTyped = { name: 'GeminiTimeoutError', message: 'timeout' };
    expect(classifyGeminiError(duckTyped)).toBe('timeout');
  });

  it('8. timers se limpian correctamente al finalizar exitosamente la operación', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const fastOperation = vi.fn().mockResolvedValue('ok');

    const result = await executeWithGeminiTimeout(fastOperation, 10000);

    expect(result).toBe('ok');
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('9. timers se limpian correctamente al fallar la operación antes del timeout', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const failingOperation = vi.fn().mockRejectedValue(new Error('Fallo rápido'));

    await expect(
      executeWithGeminiTimeout(failingOperation, 10000),
    ).rejects.toThrow('Fallo rápido');

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('10. operación se ejecuta exactamente una vez', async () => {
    const operation = vi.fn().mockResolvedValue({ id: 1 });

    const resultPromise = executeWithGeminiTimeout(operation);
    await vi.advanceTimersByTimeAsync(50);
    const result = await resultPromise;

    expect(result).toEqual({ id: 1 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('11. respeta GEMINI_RECIPE_TIMEOUT_MS (60000ms) sin expirar a los 20s y lanzando timeout a los 60s', async () => {
    expect(GEMINI_RECIPE_TIMEOUT_MS).toBe(60_000);

    const hangingOperation = () => new Promise<string>(() => {});
    const timeoutPromise = executeWithGeminiTimeout(
      hangingOperation,
      GEMINI_RECIPE_TIMEOUT_MS,
    );

    const assertionPromise = expect(timeoutPromise).rejects.toThrow(
      'La solicitud a Gemini excedió el tiempo límite de 60000ms.',
    );

    // No debe expirar al límite general (20s)
    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS);
    // No debe expirar a los 59s
    await vi.advanceTimersByTimeAsync(39_000);
    // Debe expirar exactamente al rebasar 60s
    await vi.advanceTimersByTimeAsync(1_050);
    await assertionPromise;
  });
});