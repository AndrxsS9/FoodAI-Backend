import express from 'express';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import app, { JSON_BODY_LIMIT } from '../src/app';
import {
  createCorsMiddleware,
  DEFAULT_DEV_WEB_ORIGINS,
  resolveAllowedWebOrigins,
} from '../src/config/cors';
import { parseEnv } from '../src/config/env';
import { createAiConcurrencyGuard } from '../src/middlewares/aiConcurrency.middleware';
import {
  createAiRateLimit,
  createAiUserRateLimit,
} from '../src/middlewares/aiRateLimit.middleware';
import { requireSupabaseAuth } from '../src/middlewares/auth.middleware';
import { errorMiddleware } from '../src/middlewares/error.middleware';
import { MAX_IMAGE_FILE_SIZE_BYTES } from '../src/middlewares/upload.middleware';
import { mealPlanRequestSchema } from '../src/schemas/mealPlan.schema';
import {
  MAX_INGREDIENT_NAME_LENGTH,
  MAX_PANTRY_ITEMS,
  recipeRecommendationRequestSchema,
} from '../src/schemas/recipe.schema';
import {
  formatSafeErrorForLog,
  redactSensitiveText,
} from '../src/utils/safeLogger';
import {
  setupTestSupabaseJwks,
  signTestSupabaseJwt,
  teardownTestSupabaseJwks,
} from './helpers/testAuth';

describe('Deployment Hardening, Rate Limiting, Proxy Safety & Secret Redaction', () => {
  let validAuthHeader = '';

  beforeAll(async () => {
    await setupTestSupabaseJwks();
    const token = await signTestSupabaseJwt({
      sub: 'user-hardening-suite',
    });
    validAuthHeader = `Bearer ${token}`;
  });

  afterAll(async () => {
    await teardownTestSupabaseJwks();
  });

  describe('1. Configuración acotada de Trust Proxy y Rate Limiting (IP + Usuario)', () => {
    it('nunca configura trust proxy en true de forma incondicional', () => {
      const trustProxySetting = app.get('trust proxy');
      expect(trustProxySetting).not.toBe(true);
      expect(trustProxySetting === false || typeof trustProxySetting === 'number').toBe(
        true,
      );
    });

    it('con trust proxy = 1 (topología real de Render), impide evadir el rate limit falsificando X-Forwarded-For desde el cliente', async () => {
      const renderSimApp = express();
      renderSimApp.set('trust proxy', 1);

      const ipLimiter = createAiRateLimit({
        windowMs: 10_000,
        limit: 2,
      });

      renderSimApp.post('/ai-test', ipLimiter, (req, res) => {
        res.json({ success: true, resolvedIp: req.ip });
      });

      // El cliente falsifica el primer IP de X-Forwarded-For en cada petición,
      // pero el proxy inverso de Render añade al final la IP real del cliente (198.51.100.42).
      // Con trust proxy = 1 (1 salto), Express toma 198.51.100.42 e ignora los IPs falsificados a la izquierda.
      const res1 = await request(renderSimApp)
        .post('/ai-test')
        .set('X-Forwarded-For', '203.0.113.1, 198.51.100.42');
      expect(res1.status).toBe(200);
      expect(res1.body.resolvedIp).toBe('198.51.100.42');

      const res2 = await request(renderSimApp)
        .post('/ai-test')
        .set('X-Forwarded-For', '203.0.113.99, 198.51.100.42');
      expect(res2.status).toBe(200);
      expect(res2.body.resolvedIp).toBe('198.51.100.42');

      const res3 = await request(renderSimApp)
        .post('/ai-test')
        .set('X-Forwarded-For', '192.0.2.250, 198.51.100.42');
      expect(res3.status).toBe(429);
      expect(res3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('limita por usuario autenticado (sub) aunque cambie de dirección IP, sin afectar a otros usuarios', async () => {
      const userRateApp = express();
      userRateApp.set('trust proxy', 1);

      const userLimiter = createAiUserRateLimit({
        windowMs: 10_000,
        limit: 2,
      });

      userRateApp.post(
        '/ai-user-limited',
        requireSupabaseAuth,
        userLimiter,
        (req, res) => {
          res.json({ success: true, userId: req.user?.id });
        },
      );
      userRateApp.use(errorMiddleware);

      const tokenUserA = await signTestSupabaseJwt({ sub: 'user-a-quota' });
      const tokenUserB = await signTestSupabaseJwt({ sub: 'user-b-quota' });

      // Usuario A consume sus 2 solicitudes desde IPs distintas
      const a1 = await request(userRateApp)
        .post('/ai-user-limited')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .set('X-Forwarded-For', '198.51.100.10');
      expect(a1.status).toBe(200);

      const a2 = await request(userRateApp)
        .post('/ai-user-limited')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .set('X-Forwarded-For', '198.51.100.20');
      expect(a2.status).toBe(200);

      // Tercera solicitud del Usuario A desde una tercera IP -> bloqueada con 429
      const a3 = await request(userRateApp)
        .post('/ai-user-limited')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .set('X-Forwarded-For', '198.51.100.30');
      expect(a3.status).toBe(429);
      expect(a3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');

      // Usuario B no se ve afectado
      const b1 = await request(userRateApp)
        .post('/ai-user-limited')
        .set('Authorization', `Bearer ${tokenUserB}`)
        .set('X-Forwarded-For', '198.51.100.30');
      expect(b1.status).toBe(200);
    });
  });

  describe('2. Política CORS segura para web y compatible con APK Android', () => {
    it('permite solicitudes sin Origin (APK Android / health check) y bloquea orígenes web no autorizados en producción', async () => {
      const prodCorsApp = express();
      prodCorsApp.use(
        createCorsMiddleware({
          nodeEnv: 'production',
          allowedOrigins: ['https://app.foodai.co'],
        }),
      );
      prodCorsApp.get('/health', (_req, res) => {
        res.json({ success: true });
      });
      prodCorsApp.post('/protected', requireSupabaseAuth, (_req, res) => {
        res.json({ success: true });
      });
      prodCorsApp.use(errorMiddleware);

      // 1. Sin Origin (APK nativo Android) -> permitido por CORS
      const apkHealth = await request(prodCorsApp).get('/health');
      expect(apkHealth.status).toBe(200);

      // 2. Origen HTTPS explícitamente autorizado -> permitido por CORS
      const allowedWeb = await request(prodCorsApp)
        .get('/health')
        .set('Origin', 'https://app.foodai.co');
      expect(allowedWeb.status).toBe(200);
      expect(allowedWeb.headers['access-control-allow-origin']).toBe(
        'https://app.foodai.co',
      );

      // 3. CORS NO se trata como autenticación: origen web permitido sin JWT sigue recibiendo 401
      const allowedWebNoJwt = await request(prodCorsApp)
        .post('/protected')
        .set('Origin', 'https://app.foodai.co');
      expect(allowedWebNoJwt.status).toBe(401);
      expect(allowedWebNoJwt.body.error.code).toBe('AUTH_TOKEN_REQUIRED');

      // 4. Origen web no autorizado -> rechazado con 403 CORS_ORIGIN_NOT_ALLOWED
      const evilWeb = await request(prodCorsApp)
        .get('/health')
        .set('Origin', 'https://sitio-malicioso.example');
      expect(evilWeb.status).toBe(403);
      expect(evilWeb.body.error.code).toBe('CORS_ORIGIN_NOT_ALLOWED');
      expect(evilWeb.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('en producción sin CORS_ALLOWED_ORIGINS no habilita orígenes localhost de desarrollo', () => {
      const prodOrigins = resolveAllowedWebOrigins({
        nodeEnv: 'production',
        allowedOrigins: [],
      });
      expect(prodOrigins.size).toBe(0);

      const devOrigins = resolveAllowedWebOrigins({
        nodeEnv: 'development',
        allowedOrigins: [],
      });
      expect(devOrigins.has(DEFAULT_DEV_WEB_ORIGINS[0])).toBe(true);
    });
  });

  describe('3. Protección contra solicitudes sobredimensionadas, cargas vacías y ráfagas concurrentes', () => {
    it('limita cuerpos JSON a 100kb y responde 413 PAYLOAD_TOO_LARGE ante payloads excesivos', async () => {
      expect(JSON_BODY_LIMIT).toBe('100kb');

      const hugeString = 'a'.repeat(120 * 1024);
      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', validAuthHeader)
        .send({
          pantry: [
            {
              name: hugeString,
              quantity: 1,
              unit: 'unidad',
              needsReview: false,
            },
          ],
          budget: 10000,
          servings: 2,
        });

      expect(response.status).toBe(413);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'El tamaño de la solicitud excede el límite permitido.',
        },
      });
    });

    it('responde 400 INVALID_JSON ante cuerpos JSON malformados', async () => {
      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', validAuthHeader)
        .set('Content-Type', 'application/json')
        .send('{"pantry": [malformado');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_JSON');
    });

    it('rechaza imágenes vacías (0 bytes) con 400 INVALID_IMAGE_CONTENT e imágenes > 8 MB con 413 IMAGE_TOO_LARGE', async () => {
      const emptyImageRes = await request(app)
        .post('/api/ingredients/analyze')
        .set('Authorization', validAuthHeader)
        .attach('image', Buffer.alloc(0), {
          filename: 'vacia.png',
          contentType: 'image/png',
        });

      expect(emptyImageRes.status).toBe(400);
      expect(emptyImageRes.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_IMAGE_CONTENT',
          message: 'El archivo de imagen está vacío.',
        },
      });

      const oversizedBuffer = Buffer.alloc(MAX_IMAGE_FILE_SIZE_BYTES + 1024, 1);
      const oversizedRes = await request(app)
        .post('/api/ingredients/analyze')
        .set('Authorization', validAuthHeader)
        .attach('image', oversizedBuffer, {
          filename: 'gigante.jpg',
          contentType: 'image/jpeg',
        });

      expect(oversizedRes.status).toBe(413);
      expect(oversizedRes.body).toEqual({
        success: false,
        error: {
          code: 'IMAGE_TOO_LARGE',
          message: 'La imagen supera el tamaño máximo permitido de 8 MB.',
        },
      });
    });

    it('acota la cantidad máxima de ingredientes y longitud de nombre en esquemas de recetas y planes', () => {
      const tooManyItems = Array.from({ length: MAX_PANTRY_ITEMS + 1 }, (_, i) => ({
        name: `ingrediente-${i}`,
        quantity: 1,
        unit: 'unidad' as const,
        needsReview: false,
      }));

      expect(
        recipeRecommendationRequestSchema.safeParse({
          pantry: tooManyItems,
          budget: 20000,
          servings: 2,
        }).success,
      ).toBe(false);

      expect(
        mealPlanRequestSchema.safeParse({
          pantry: [
            {
              name: 'x'.repeat(MAX_INGREDIENT_NAME_LENGTH + 1),
              quantity: 1,
              unit: 'unidad',
              needsReview: false,
            },
          ],
          budget: 20000,
          servings: 2,
        }).success,
      ).toBe(false);
    });

    it('limita solicitudes concurrentes en vuelo hacia IA con 503 AI_SERVER_BUSY y libera cupos al finalizar', async () => {
      const guard = createAiConcurrencyGuard(1);
      const concurrencyApp = express();

      let releaseFirstRequest: (() => void) | null = null;

      concurrencyApp.get('/slow-ai', guard, async (_req, res) => {
        await new Promise<void>((resolve) => {
          releaseFirstRequest = resolve;
        });
        res.json({ success: true });
      });
      concurrencyApp.use(errorMiddleware);

      const server = concurrencyApp.listen(0);
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      try {
        const firstPromise = fetch(`http://127.0.0.1:${port}/slow-ai`);

        // Esperar a que la primera petición entre al controlador y ocupe el cupo
        await vi.waitFor(() => {
          expect(guard.getActiveCount()).toBe(1);
          expect(releaseFirstRequest).not.toBeNull();
        });

        const secondResponse = await fetch(`http://127.0.0.1:${port}/slow-ai`);
        const secondBody = (await secondResponse.json()) as {
          success: boolean;
          error: { code: string };
        };

        expect(secondResponse.status).toBe(503);
        expect(secondBody.error.code).toBe('AI_SERVER_BUSY');

        releaseFirstRequest!();
        const firstResponse = await firstPromise;
        expect(firstResponse.status).toBe(200);

        await vi.waitFor(() => {
          expect(guard.getActiveCount()).toBe(0);
        });
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });

  describe('4. Validación estricta de variables de entorno (parseEnv) y manejo seguro de secretos/logs', () => {
    it('valida reglas de seguridad para NODE_ENV=production en parseEnv', () => {
      const validProd = parseEnv({
        NODE_ENV: 'production',
        PORT: '10000',
        GEMINI_API_KEY: 'clave-privada-gemini-produccion',
        SUPABASE_URL: 'https://prod-foodai-ref.supabase.co',
        CORS_ALLOWED_ORIGINS: 'https://foodai.co',
      });

      expect(validProd.success).toBe(true);
      if (validProd.success) {
        expect(validProd.data.TRUST_PROXY_HOPS).toBe(1);
        expect(validProd.data.CORS_ALLOWED_ORIGINS).toEqual(['https://foodai.co']);
        expect(validProd.data.SUPABASE_JWT_AUDIENCE).toBe('authenticated');
      }

      // Rechaza trust proxy = "true" o "*"
      expect(
        parseEnv({
          NODE_ENV: 'production',
          GEMINI_API_KEY: 'key',
          SUPABASE_URL: 'https://prod-foodai-ref.supabase.co',
          TRUST_PROXY_HOPS: 'true',
        }).success,
      ).toBe(false);

      // Rechaza SUPABASE_URL sin HTTPS o con placeholder en producción
      expect(
        parseEnv({
          NODE_ENV: 'production',
          GEMINI_API_KEY: 'key',
          SUPABASE_URL: 'http://prod-foodai-ref.supabase.co',
        }).success,
      ).toBe(false);

      expect(
        parseEnv({
          NODE_ENV: 'production',
          GEMINI_API_KEY: 'key',
          SUPABASE_URL: 'https://tu-proyecto.supabase.co',
        }).success,
      ).toBe(false);

      // Rechaza comodín * u orígenes HTTP inseguros en CORS de producción
      expect(
        parseEnv({
          NODE_ENV: 'production',
          GEMINI_API_KEY: 'key',
          SUPABASE_URL: 'https://prod-foodai-ref.supabase.co',
          CORS_ALLOWED_ORIGINS: '*',
        }).success,
      ).toBe(false);

      expect(
        parseEnv({
          NODE_ENV: 'production',
          GEMINI_API_KEY: 'key',
          SUPABASE_URL: 'https://prod-foodai-ref.supabase.co',
          CORS_ALLOWED_ORIGINS: 'http://localhost:8081',
        }).success,
      ).toBe(false);
    });

    it('redacta tokens Bearer, JWTs, claves Gemini (AIza...), claves Supabase y secretos de entorno en logs', () => {
      const fakeGoogleKey = ['AIza', 'SyTestRedactionPattern0000000000001'].join(
        '',
      );
      const fakeJwt = [
        'eyJhbGciOiJFUzI1NiJ9',
        'eyJzdWIiOiIxMjM0NTYifQ',
        'firmaPrueba987',
      ].join('.');
      const fakeSupabaseSecret = ['sb_secret', '987654321abcdefTEST'].join('_');

      const rawMessage = `Fallo HTTP con Authorization: Bearer ${fakeJwt} hacia https://generativelanguage.googleapis.com/v1beta?key=${fakeGoogleKey} y ${fakeSupabaseSecret}`;
      const sanitized = redactSensitiveText(rawMessage, ['mi-secreto-custom-123']);

      expect(sanitized).not.toContain(fakeGoogleKey);
      expect(sanitized).not.toContain(fakeJwt);
      expect(sanitized).not.toContain(fakeSupabaseSecret);
      expect(sanitized).toContain('Bearer [REDACTED]');
      expect(sanitized).toContain('key=[REDACTED]');
      expect(sanitized).toContain('[REDACTED_SUPABASE_KEY]');

      const errWithSecrets = new Error(
        `Error interno con token ${fakeJwt} y apiKey ${fakeGoogleKey}`,
      );
      const safeLog = formatSafeErrorForLog(errWithSecrets, {
        includeStack: false,
      });

      expect(JSON.stringify(safeLog)).not.toContain(fakeJwt);
      expect(JSON.stringify(safeLog)).not.toContain(fakeGoogleKey);
      expect(safeLog.stack).toBeUndefined();
    });

    it('errorMiddleware nunca filtra claves ni mensajes sensibles al cliente ni a console.error en errores 500', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fakeGoogleKey = ['AIza', 'SyTestRedactionPattern0000000000002'].join(
        '',
      );
      const fakeJwt = [
        'eyJhbGciOiJFUzI1NiJ9',
        'eyJzdWIiOiIxIn0',
        'sigTest',
      ].join('.');

      try {
        const leakTestApp = express();
        leakTestApp.get('/boom', () => {
          throw new Error(
            `Fallo crítico con key=${fakeGoogleKey} y Bearer ${fakeJwt}`,
          );
        });
        leakTestApp.use(errorMiddleware);

        const response = await request(leakTestApp).get('/boom');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Ocurrió un error interno en el servidor.',
          },
        });

        const loggedPayload = JSON.stringify(errorSpy.mock.calls);
        expect(loggedPayload).not.toContain(fakeGoogleKey);
        expect(loggedPayload).not.toContain('eyJhbGciOiJFUzI1NiJ9');
      } finally {
        errorSpy.mockRestore();
      }
    });
  });
});
