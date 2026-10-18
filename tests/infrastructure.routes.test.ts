import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import app from '../src/app';
import { errorMiddleware } from '../src/middlewares/error.middleware';
import { AppError } from '../src/utils/errors';

describe('HTTP Infrastructure and Routes', () => {
  describe('GET /api/health', () => {
    it('1. retorna código 200 y success === true', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('2. data.status es "ok" y data.service es "FoodAI Backend"', async () => {
      const response = await request(app).get('/api/health');

      expect(response.body.data.status).toBe('ok');
      expect(response.body.data.service).toBe('FoodAI Backend');
    });

    it('3. timestamp existe y corresponde a una fecha ISO parseable', async () => {
      const response = await request(app).get('/api/health');

      const { timestamp } = response.body.data;
      expect(timestamp).toBeDefined();
      expect(typeof timestamp).toBe('string');
      expect(Number.isNaN(Date.parse(timestamp))).toBe(false);
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('404 Route Not Found', () => {
    it('4. ruta inexistente retorna código 404 con ROUTE_NOT_FOUND y success === false', async () => {
      const response = await request(app).get('/api/ruta-inexistente-123');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
      expect(response.body.error.message).toContain('/api/ruta-inexistente-123');
    });

    it('5. método HTTP no soportado sobre ruta existente cae en el contrato 404', async () => {
      const postHealth = await request(app).post('/api/health');
      expect(postHealth.status).toBe(404);
      expect(postHealth.body.success).toBe(false);
      expect(postHealth.body.error.code).toBe('ROUTE_NOT_FOUND');

      const getAnalyze = await request(app).get('/api/ingredients/analyze');
      expect(getAnalyze.status).toBe(404);
      expect(getAnalyze.body.success).toBe(false);
      expect(getAnalyze.body.error.code).toBe('ROUTE_NOT_FOUND');
    });
  });

  describe('Validación de JSON en endpoints existentes', () => {
    it('6. POST /api/recipes/recommend con payload inválido retorna 400 y VALIDATION_ERROR', async () => {
      const response = await request(app)
        .post('/api/recipes/recommend')
        .send({ pantry: [] }); // array vacío no cumple min(1)

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });

    it('7. POST /api/meal-plans/generate con payload inválido retorna 400 y VALIDATION_ERROR', async () => {
      const response = await request(app)
        .post('/api/meal-plans/generate')
        .send({}); // payload vacío sin campos obligatorios

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });
  });

  describe('Carga de archivos en /api/ingredients/analyze', () => {
    it('8. solicitud sin imagen retorna 400 con IMAGE_REQUIRED', async () => {
      const response = await request(app)
        .post('/api/ingredients/analyze');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('IMAGE_REQUIRED');
      expect(response.body.error.message).toBe('Debes enviar una imagen.');
    });

    it('9. solicitud con formato de imagen no permitido retorna 400 con INVALID_IMAGE_FORMAT', async () => {
      const invalidFileBuffer = Buffer.from('contenido no valido como imagen');

      const response = await request(app)
        .post('/api/ingredients/analyze')
        .attach('image', invalidFileBuffer, {
          filename: 'documento.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_IMAGE_FORMAT');
      expect(response.body.error.message).toContain('Formato de imagen no permitido');
    });
  });

  describe('errorMiddleware en aislamiento', () => {
    it('10. maneja instancias de AppError con código y status personalizados', async () => {
      const testApp = express();
      testApp.get('/error-app', () => {
        throw new AppError('Acceso denegado', 403, 'FORBIDDEN');
      });
      testApp.use(errorMiddleware);

      const response = await request(testApp).get('/error-app');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Acceso denegado',
        },
      });
    });

    it('11. maneja errores genéricos no controlados con 500 e INTERNAL_ERROR', async () => {
      const testApp = express();
      testApp.get('/error-generic', () => {
        throw new Error('Fallo inesperado del sistema');
      });
      testApp.use(errorMiddleware);

      const response = await request(testApp).get('/error-generic');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Ocurrió un error interno en el servidor.',
        },
      });
    });

    it('12. maneja errores de Zod con 400, VALIDATION_ERROR y lista de detalles', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/zod-test', (req) => {
        const schema = z.object({
          email: z.string().email(),
          age: z.number().positive(),
        });
        schema.parse(req.body);
      });
      testApp.use(errorMiddleware);

      const response = await request(testApp)
        .post('/zod-test')
        .send({ email: 'no-es-email', age: -10 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toHaveLength(2);
      expect(response.body.error.details[0].field).toBe('email');
      expect(response.body.error.details[1].field).toBe('age');
    });
  });
});
