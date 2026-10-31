import express from 'express';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('../src/services/gemini/ingredient.service', () => ({
  analyzeIngredientsFromImage: vi.fn(),
}));

vi.mock('../src/services/gemini/recipe.service', () => ({
  generateRecipeRecommendations: vi.fn(),
}));

import app from '../src/app';
import { env } from '../src/config/env';
import {
  createSupabaseAuthMiddleware,
  extractBearerToken,
  requireSupabaseAuth,
} from '../src/middlewares/auth.middleware';
import { errorMiddleware } from '../src/middlewares/error.middleware';
import { createSupabaseJwtVerifier } from '../src/services/auth/supabaseJwt.service';
import { analyzeIngredientsFromImage } from '../src/services/gemini/ingredient.service';
import { generateRecipeRecommendations } from '../src/services/gemini/recipe.service';
import {
  buildUnsignedAlgNoneJwt,
  DEFAULT_TEST_USER_ID,
  setupTestSupabaseJwks,
  signHs256SupabaseJwt,
  signTestSupabaseJwt,
  signUntrustedSupabaseJwt,
  teardownTestSupabaseJwks,
} from './helpers/testAuth';

const mockedAnalyzeIngredients = vi.mocked(analyzeIngredientsFromImage);
const mockedGenerateRecipes = vi.mocked(generateRecipeRecommendations);

const validRecipePayload = {
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
  maxMinutes: 40,
};

const sampleGeneratedThreeRecipes = {
  recipes: [
    {
      name: 'Arroz con huevo',
      description: 'Receta 1',
      totalMinutes: 15,
      ingredients: [{ name: 'arroz', quantity: 200, unit: 'g' as const }],
      steps: ['Cocinar arroz.'],
    },
    {
      name: 'Huevos revueltos',
      description: 'Receta 2',
      totalMinutes: 10,
      ingredients: [{ name: 'huevo', quantity: 2, unit: 'unidad' as const }],
      steps: ['Batir y cocinar.'],
    },
    {
      name: 'Tortilla de arroz',
      description: 'Receta 3',
      totalMinutes: 20,
      ingredients: [
        { name: 'arroz', quantity: 150, unit: 'g' as const },
        { name: 'huevo', quantity: 2, unit: 'unidad' as const },
      ],
      steps: ['Mezclar y dorar.'],
    },
  ],
};

describe('Supabase JWT Authentication & Protected AI Endpoints', () => {
  beforeAll(async () => {
    await setupTestSupabaseJwks();
  });

  afterAll(async () => {
    await teardownTestSupabaseJwks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Endpoint público GET /api/health', () => {
    it('permanece accesible públicamente sin JWT y oculta X-Powered-By', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
      expect(response.body.data.service).toBe('FoodAI Backend');
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('2. Rechazo de solicitudes sin JWT (401 AUTH_TOKEN_REQUIRED)', () => {
    it('POST /api/ingredients/analyze sin Authorization retorna 401 antes de procesar imagen ni invocar Gemini', async () => {
      const response = await request(app)
        .post('/api/ingredients/analyze')
        .attach('image', Buffer.from('imagen-falsa'), {
          filename: 'foto.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'AUTH_TOKEN_REQUIRED',
          message: 'Se requiere autenticación mediante Bearer token.',
        },
      });
      expect(mockedAnalyzeIngredients).not.toHaveBeenCalled();
    });

    it('POST /api/recipes/recommend sin Authorization retorna 401 y no invoca Gemini', async () => {
      const response = await request(app)
        .post('/api/recipes/recommend')
        .send(validRecipePayload);

      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'AUTH_TOKEN_REQUIRED',
          message: 'Se requiere autenticación mediante Bearer token.',
        },
      });
      expect(mockedGenerateRecipes).not.toHaveBeenCalled();
    });

    it('POST /api/meal-plans/generate sin Authorization retorna 401 y no invoca Gemini', async () => {
      const response = await request(app)
        .post('/api/meal-plans/generate')
        .send(validRecipePayload);

      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
      expect(response.body.error.code).toBe('AUTH_TOKEN_REQUIRED');
      expect(mockedGenerateRecipes).not.toHaveBeenCalled();
    });

    it('ignora tokens enviados por query params (?access_token=...) y retorna 401', async () => {
      const validToken = await signTestSupabaseJwt({
        sub: 'user-query-token-attempt',
      });

      const response = await request(app)
        .post(`/api/recipes/recommend?access_token=${encodeURIComponent(validToken)}`)
        .send(validRecipePayload);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_REQUIRED');
      expect(mockedGenerateRecipes).not.toHaveBeenCalled();
    });
  });

  describe('3. Rechazo de JWT inválidos, manipulados o mal configurados (401 INVALID_AUTH_TOKEN)', () => {
    it('rechaza encabezados Authorization con esquema distinto a Bearer o formato no-JWT', async () => {
      expect(extractBearerToken(undefined)).toEqual({ status: 'missing' });
      expect(extractBearerToken('Bearer   ')).toEqual({ status: 'missing' });
      expect(extractBearerToken('Basic dXNlcjpwYXNz')).toEqual({
        status: 'malformed',
      });
      expect(extractBearerToken('Bearer token-invalido')).toEqual({
        status: 'malformed',
      });
      expect(extractBearerToken('Bearer a.b.c extra')).toEqual({
        status: 'malformed',
      });

      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', 'Bearer token-sin-formato-jwt')
        .send(validRecipePayload);

      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
      expect(response.body.error.code).toBe('INVALID_AUTH_TOKEN');
      expect(mockedGenerateRecipes).not.toHaveBeenCalled();
    });

    it('rechaza JWT firmado con una clave privada no confiable (firma criptográfica inválida)', async () => {
      const forgedToken = await signUntrustedSupabaseJwt();

      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', `Bearer ${forgedToken}`)
        .send(validRecipePayload);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_AUTH_TOKEN');
      expect(mockedGenerateRecipes).not.toHaveBeenCalled();
    });

    it('rechaza JWT cuyo payload fue adulterado después de ser firmado (nunca confía en claims decodificados sin verificar)', async () => {
      const validToken = await signTestSupabaseJwt({
        sub: 'usuario-legitimo',
      });
      const [headerPart, , signaturePart] = validToken.split('.');
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          sub: 'admin-suplantado',
          role: 'authenticated',
          iss: `${env.SUPABASE_URL}/auth/v1`,
          aud: env.SUPABASE_JWT_AUDIENCE,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
      const tamperedToken = `${headerPart}.${tamperedPayload}.${signaturePart}`;

      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .send(validRecipePayload);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_AUTH_TOKEN');
      expect(mockedGenerateRecipes).not.toHaveBeenCalled();
    });

    it('rechaza JWT con kid inexistente en el JWKS de Supabase', async () => {
      const unknownKidToken = await signTestSupabaseJwt({
        kid: 'kid-desconocido-999',
      });

      const response = await request(app)
        .post('/api/meal-plans/generate')
        .set('Authorization', `Bearer ${unknownKidToken}`)
        .send(validRecipePayload);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_AUTH_TOKEN');
    });

    it('rechaza JWT con issuer (iss) distinto al proyecto Supabase configurado', async () => {
      const wrongIssuerToken = await signTestSupabaseJwt({
        iss: 'https://otro-proyecto-ajeno.supabase.co/auth/v1',
      });

      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', `Bearer ${wrongIssuerToken}`)
        .send(validRecipePayload);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_AUTH_TOKEN');
    });

    it('rechaza JWT con audience (aud) inválido', async () => {
      const wrongAudToken = await signTestSupabaseJwt({
        aud: 'public-anon-client',
      });

      const response = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', `Bearer ${wrongAudToken}`)
        .send(validRecipePayload);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_AUTH_TOKEN');
    });

    it('rechaza tokens con role="anon" o role="service_role" o sin sub de usuario', async () => {
      const anonToken = await signTestSupabaseJwt({ role: 'anon' });
      const serviceRoleToken = await signTestSupabaseJwt({
        role: 'service_role',
      });
      const missingSubToken = await signTestSupabaseJwt({ omitSub: true });

      for (const badToken of [anonToken, serviceRoleToken, missingSubToken]) {
        const response = await request(app)
          .post('/api/recipes/recommend')
          .set('Authorization', `Bearer ${badToken}`)
          .send(validRecipePayload);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('INVALID_AUTH_TOKEN');
      }
    });

    it('rechaza ataques alg="none" y tokens HS256 cuando SUPABASE_JWT_SECRET no está habilitado', async () => {
      const algNoneToken = buildUnsignedAlgNoneJwt();
      const hs256Token = await signHs256SupabaseJwt(
        'secreto-simetrico-de-prueba-con-mas-de-32-chars',
      );

      for (const token of [algNoneToken, hs256Token]) {
        const response = await request(app)
          .post('/api/recipes/recommend')
          .set('Authorization', `Bearer ${token}`)
          .send(validRecipePayload);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('INVALID_AUTH_TOKEN');
      }
    });

    it('soporta verificación HS256 explícita únicamente cuando el verificador tiene SUPABASE_JWT_SECRET configurado', async () => {
      const explicitSecret =
        'supabase-legacy-hs256-secret-with-at-least-32-bytes!';
      const verifier = createSupabaseJwtVerifier({
        supabaseUrl: env.SUPABASE_URL,
        supabaseJwtAudience: env.SUPABASE_JWT_AUDIENCE,
        supabaseJwtSecret: explicitSecret,
      });

      const validHs256 = await signHs256SupabaseJwt(explicitSecret, {
        sub: 'user-hs256-supported',
      });
      const user = await verifier.verifyAccessToken(validHs256);

      expect(user.id).toBe('user-hs256-supported');
      expect(user.role).toBe('authenticated');

      const wrongHs256 = await signHs256SupabaseJwt(
        'otro-secreto-distinto-con-longitud-suficiente-1234',
      );
      await expect(verifier.verifyAccessToken(wrongHs256)).rejects.toMatchObject(
        {
          statusCode: 401,
          code: 'INVALID_AUTH_TOKEN',
        },
      );
    });
  });

  describe('4. Rechazo de JWT expirados (401 AUTH_TOKEN_EXPIRED)', () => {
    it('retorna 401 AUTH_TOKEN_EXPIRED en los tres endpoints protegidos cuando exp ya venció', async () => {
      const expiredToken = await signTestSupabaseJwt({
        expiresInSeconds: -120,
      });

      const resAnalyze = await request(app)
        .post('/api/ingredients/analyze')
        .set('Authorization', `Bearer ${expiredToken}`)
        .attach('image', Buffer.from('imagen-falsa'), {
          filename: 'nevera.jpg',
          contentType: 'image/jpeg',
        });

      const resRecipes = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send(validRecipePayload);

      const resMealPlans = await request(app)
        .post('/api/meal-plans/generate')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send(validRecipePayload);

      for (const res of [resAnalyze, resRecipes, resMealPlans]) {
        expect(res.status).toBe(401);
        expect(res.headers['www-authenticate']).toBe('Bearer');
        expect(res.body).toEqual({
          success: false,
          error: {
            code: 'AUTH_TOKEN_EXPIRED',
            message: 'La sesión ha expirado. Inicia sesión nuevamente.',
          },
        });
      }

      expect(mockedAnalyzeIngredients).not.toHaveBeenCalled();
      expect(mockedGenerateRecipes).not.toHaveBeenCalled();
    });
  });

  describe('5. Usuario autenticado válido alcanza las rutas protegidas y preserva identidad del servidor', () => {
    it('permite acceso con JWT ES256 válido a los 3 endpoints de IA manteniendo contratos de respuesta intactos', async () => {
      const validToken = await signTestSupabaseJwt({
        sub: 'a3b8f042-7c1d-4d6e-9f1a-8899aabbccdd',
      });
      const authHeader = `Bearer ${validToken}`;

      mockedAnalyzeIngredients.mockResolvedValueOnce({
        ingredients: [
          {
            name: 'tomate',
            quantity: 3,
            unit: 'unidad',
            needsReview: false,
          },
        ],
      });

      mockedGenerateRecipes.mockResolvedValue(sampleGeneratedThreeRecipes);

      const analyzeRes = await request(app)
        .post('/api/ingredients/analyze')
        .set('Authorization', authHeader)
        .attach('image', Buffer.from('bytes-imagen-valida'), {
          filename: 'despensa.webp',
          contentType: 'image/webp',
        });

      expect(analyzeRes.status).toBe(200);
      expect(analyzeRes.body.success).toBe(true);
      expect(analyzeRes.body.data.ingredients).toHaveLength(1);

      const recipesRes = await request(app)
        .post('/api/recipes/recommend')
        .set('Authorization', authHeader)
        .send(validRecipePayload);

      expect(recipesRes.status).toBe(200);
      expect(recipesRes.body.success).toBe(true);
      expect(recipesRes.body.data.recipes).toHaveLength(3);

      const mealPlanRes = await request(app)
        .post('/api/meal-plans/generate')
        .set('Authorization', authHeader)
        .send(validRecipePayload);

      expect(mealPlanRes.status).toBe(200);
      expect(mealPlanRes.body.success).toBe(true);
      expect(mealPlanRes.body.data.days).toHaveLength(3);
    });

    it('asigna req.user.id exclusivamente desde el claim sub verificado e ignora cualquier userId enviado por el cliente', async () => {
      const probeApp = express();
      probeApp.use(express.json());
      probeApp.post('/protected-identity', requireSupabaseAuth, (req, res) => {
        res.json({
          verifiedUserId: req.user?.id,
          verifiedRole: req.user?.role,
          bodyUserId: req.body?.userId,
          headerUserId: req.headers['x-user-id'],
        });
      });
      probeApp.use(errorMiddleware);

      const validToken = await signTestSupabaseJwt({
        sub: DEFAULT_TEST_USER_ID,
      });

      const response = await request(probeApp)
        .post('/protected-identity')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-User-Id', 'spoofed-header-user-999')
        .send({ userId: 'spoofed-body-user-999' });

      expect(response.status).toBe(200);
      expect(response.body.verifiedUserId).toBe(DEFAULT_TEST_USER_ID);
      expect(response.body.verifiedRole).toBe('authenticated');
      expect(response.body.verifiedUserId).not.toBe(response.body.bodyUserId);
      expect(response.body.verifiedUserId).not.toBe(response.body.headerUserId);
    });

    it('propaga 503 AUTH_VERIFICATION_UNAVAILABLE sin exponer detalles internos si la verificación JWKS no está disponible', async () => {
      const failingAuth = createSupabaseAuthMiddleware(async () => {
        const { AppError } = await import('../src/utils/errors');
        throw new AppError(
          'No fue posible verificar la sesión en este momento. Intenta nuevamente.',
          503,
          'AUTH_VERIFICATION_UNAVAILABLE',
        );
      });

      const probeApp = express();
      probeApp.post('/probe', failingAuth, (_req, res) => {
        res.json({ ok: true });
      });
      probeApp.use(errorMiddleware);

      const validToken = await signTestSupabaseJwt();
      const response = await request(probeApp)
        .post('/probe')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(503);
      expect(response.headers['www-authenticate']).toBeUndefined();
      expect(response.body.error.code).toBe('AUTH_VERIFICATION_UNAVAILABLE');
    });
  });
});
