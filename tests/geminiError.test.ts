import { describe, expect, it } from 'vitest';

import {
  classifyGeminiError,
  getGeminiErrorStatus,
} from '../src/services/gemini/geminiError';

describe('geminiError', () => {
  describe('getGeminiErrorStatus', () => {
    it('extrae status numérico de un error con propiedad status', () => {
      expect(getGeminiErrorStatus({ status: 429 })).toBe(429);
      expect(getGeminiErrorStatus({ status: 503 })).toBe(503);
    });

    it('extrae statusCode numérico de un error con propiedad statusCode', () => {
      expect(getGeminiErrorStatus({ statusCode: 429 })).toBe(429);
      expect(getGeminiErrorStatus({ statusCode: 503 })).toBe(503);
    });

    it('prioriza status sobre statusCode cuando ambos están presentes', () => {
      expect(getGeminiErrorStatus({ status: 503, statusCode: 429 })).toBe(503);
      expect(getGeminiErrorStatus({ status: 429, statusCode: 503 })).toBe(429);
    });

    it('retorna undefined para errores con status no numérico', () => {
      expect(getGeminiErrorStatus({ status: '429' })).toBeUndefined();
      expect(getGeminiErrorStatus({ statusCode: null })).toBeUndefined();
    });

    it('retorna undefined para un Error normal sin status', () => {
      expect(getGeminiErrorStatus(new Error('Normal error'))).toBeUndefined();
    });

    it('retorna undefined para valores nulos o primitivos', () => {
      expect(getGeminiErrorStatus(null)).toBeUndefined();
      expect(getGeminiErrorStatus(undefined)).toBeUndefined();
      expect(getGeminiErrorStatus('error string')).toBeUndefined();
      expect(getGeminiErrorStatus(429)).toBeUndefined();
      expect(getGeminiErrorStatus(true)).toBeUndefined();
    });

    it('retorna undefined para objetos vacíos', () => {
      expect(getGeminiErrorStatus({})).toBeUndefined();
    });
  });

  describe('classifyGeminiError', () => {
    it('clasifica status 429 como rate_limit', () => {
      expect(classifyGeminiError({ status: 429 })).toBe('rate_limit');
    });

    it('clasifica statusCode 429 como rate_limit', () => {
      expect(classifyGeminiError({ statusCode: 429 })).toBe('rate_limit');
    });

    it('clasifica status 503 como unavailable', () => {
      expect(classifyGeminiError({ status: 503 })).toBe('unavailable');
    });

    it('clasifica statusCode 503 como unavailable', () => {
      expect(classifyGeminiError({ statusCode: 503 })).toBe('unavailable');
    });

    it('respeta la prioridad de status cuando ambos están presentes', () => {
      expect(classifyGeminiError({ status: 429, statusCode: 503 })).toBe(
        'rate_limit',
      );
      expect(classifyGeminiError({ status: 503, statusCode: 429 })).toBe(
        'unavailable',
      );
    });

    it('clasifica códigos de estado diferentes a 429 y 503 como unknown', () => {
      expect(classifyGeminiError({ status: 400 })).toBe('unknown');
      expect(classifyGeminiError({ status: 401 })).toBe('unknown');
      expect(classifyGeminiError({ status: 403 })).toBe('unknown');
      expect(classifyGeminiError({ status: 404 })).toBe('unknown');
      expect(classifyGeminiError({ status: 500 })).toBe('unknown');
      expect(classifyGeminiError({ status: 502 })).toBe('unknown');
    });

    it('clasifica Error estándar como unknown', () => {
      expect(classifyGeminiError(new Error('Conexión perdida'))).toBe('unknown');
    });

    it('clasifica valores no objetos como unknown de forma segura', () => {
      expect(classifyGeminiError(null)).toBe('unknown');
      expect(classifyGeminiError(undefined)).toBe('unknown');
      expect(classifyGeminiError('error')).toBe('unknown');
      expect(classifyGeminiError(123)).toBe('unknown');
      expect(classifyGeminiError(false)).toBe('unknown');
    });

    it('clasifica un objeto vacío como unknown', () => {
      expect(classifyGeminiError({})).toBe('unknown');
    });
  });
});
