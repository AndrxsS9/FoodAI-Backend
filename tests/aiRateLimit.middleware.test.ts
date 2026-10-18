import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import app from '../src/app';
import {
  createAiRateLimit,
  DEFAULT_AI_RATE_LIMIT_MAX,
  DEFAULT_AI_RATE_LIMIT_MESSAGE,
  DEFAULT_AI_RATE_LIMIT_WINDOW_MS,
} from '../src/middlewares/aiRateLimit.middleware';

describe('aiRateLimit.middleware', () => {
  it('1. exporta constantes por defecto válidas y coherentes', () => {
    expect(DEFAULT_AI_RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(DEFAULT_AI_RATE_LIMIT_MAX).toBe(30);
    expect(DEFAULT_AI_RATE_LIMIT_MESSAGE).toContain('límite de solicitudes');
  });

  it('2. las solicitudes por debajo del límite pasan exitosamente', async () => {
    const testApp = express();
    const limiter = createAiRateLimit({ windowMs: 10000, limit: 3 });

    testApp.get('/test', limiter, (_req, res) => {
      res.json({ success: true, data: 'ok' });
    });

    const response = await request(testApp).get('/test');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: 'ok' });
  });

  it('3. superar el límite retorna 429 con RATE_LIMIT_EXCEEDED y success === false', async () => {
    const testApp = express();
    const limiter = createAiRateLimit({
      windowMs: 10000,
      limit: 2,
      message: 'Límite alcanzado para prueba.',
    });

    testApp.get('/test', limiter, (_req, res) => {
      res.json({ success: true, data: 'ok' });
    });

    // Solicitud 1: pasa
    const res1 = await request(testApp).get('/test');
    expect(res1.status).toBe(200);

    // Solicitud 2: pasa
    const res2 = await request(testApp).get('/test');
    expect(res2.status).toBe(200);

    // Solicitud 3: bloqueada por rate limit
    const res3 = await request(testApp).get('/test');
    expect(res3.status).toBe(429);
    expect(res3.body).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Límite alcanzado para prueba.',
      },
    });
  });

  it('4. incluye headers estándar de RateLimit (ratelimit-limit, ratelimit-remaining)', async () => {
    const testApp = express();
    const limiter = createAiRateLimit({ windowMs: 10000, limit: 5 });

    testApp.get('/test', limiter, (_req, res) => {
      res.json({ success: true });
    });

    const response = await request(testApp).get('/test');

    expect(response.status).toBe(200);
    // express-rate-limit estándar incluye headers en minúsculas en HTTP/supertest
    expect(response.headers['ratelimit-limit']).toBeDefined();
    expect(response.headers['ratelimit-remaining']).toBeDefined();
    expect(Number(response.headers['ratelimit-remaining'])).toBe(4);
  });

  it('5. permite configurar límites deterministas para pruebas personalizadas', async () => {
    const testApp = express();
    const singleLimit = createAiRateLimit({ windowMs: 5000, limit: 1 });

    testApp.get('/single', singleLimit, (_req, res) => {
      res.json({ success: true });
    });

    const res1 = await request(testApp).get('/single');
    expect(res1.status).toBe(200);

    const res2 = await request(testApp).get('/single');
    expect(res2.status).toBe(429);
    expect(res2.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('6. GET /api/health no está protegido por el rate limiter de endpoints costosos', async () => {
    // Realizamos múltiples peticiones consecutivas al endpoint real de health
    for (let i = 0; i < 5; i++) {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
    }
  });

  it('7. no altera las respuestas normales antes de alcanzar el límite', async () => {
    const response = await request(app)
      .post('/api/recipes/recommend')
      .send({ invalidField: true });

    // Valida que el pipeline de rutas sigue funcionando (error 400 de Zod, no 429)
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
