import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/services/gemini/gemini.client', () => ({
  geminiClient: {
    interactions: {
      create: vi.fn(),
    },
  },
}));

import { geminiClient } from '../src/services/gemini/gemini.client';
import {
  buildDetectIngredientsPrompt,
  detectIngredientsPrompt,
  detectIngredientsPromptEn,
  detectIngredientsPromptEs,
} from '../src/prompts/detectIngredients.prompt';
import {
  getIngredientAnalysisJsonSchema,
  ingredientAnalysisJsonSchema,
  ingredientAnalysisSchema,
} from '../src/schemas/ingredient.schema';
import { analyzeIngredientsFromImage } from '../src/services/gemini/ingredient.service';
import app from '../src/app';
import {
  setupTestSupabaseJwks,
  signTestSupabaseJwt,
  teardownTestSupabaseJwks,
} from './helpers/testAuth';

const mockedCreate = vi.mocked(geminiClient.interactions.create);

describe('Fase 28C-B2.1 — Detección Bilingüe de Ingredientes con Gemini', () => {
  describe('1. Contratos de Schema y Prompts de Detección', () => {
    it('el schema por defecto y para es utiliza descripciones en español sin contradicciones', () => {
      const schemaEs = getIngredientAnalysisJsonSchema('es');
      expect(schemaEs).toEqual(ingredientAnalysisJsonSchema);
      expect(schemaEs.properties.ingredients.description).toBe(
        'Lista de alimentos visibles identificados en la imagen.',
      );
      expect(schemaEs.properties.ingredients.items.properties.name.description).toContain('español');
      expect(schemaEs.properties.ingredients.items.properties.unit.enum).toEqual([
        'unidad',
        'g',
        'kg',
        'ml',
        'l',
        'desconocida',
      ]);
    });

    it('el schema para en utiliza descripciones en inglés y no contradice el idioma solicitado', () => {
      const schemaEn = getIngredientAnalysisJsonSchema('en');
      expect(schemaEn.properties.ingredients.description).toContain('visible food items');
      expect(schemaEn.properties.ingredients.items.properties.name.description).toBe(
        'Common name of the food item in English.',
      );
      expect(schemaEn.properties.ingredients.items.properties.name.description).not.toContain('español');
      // Conserva las unidades canónicas invariantes
      expect(schemaEn.properties.ingredients.items.properties.unit.enum).toEqual([
        'unidad',
        'g',
        'kg',
        'ml',
        'l',
        'desconocida',
      ]);
    });

    it('el prompt por defecto y para es contiene reglas culinarias en español y vocabulario local', () => {
      const promptDefault = buildDetectIngredientsPrompt();
      const promptEs = buildDetectIngredientsPrompt('es');
      expect(promptDefault).toBe(detectIngredientsPromptEs);
      expect(promptEs).toBe(detectIngredientsPrompt);
      expect(promptEs).toContain('nombres comunes en español');
      expect(promptEs).toContain('tomate, huevo, arroz, cebolla, papa, aguacate');
      expect(promptEs).toContain('unidad');
      expect(promptEs).toContain('desconocida');
    });

    it('el prompt para en contiene reglas en inglés y mantiene unidades canónicas estrictas', () => {
      const promptEn = buildDetectIngredientsPrompt('en');
      expect(promptEn).toBe(detectIngredientsPromptEn);
      expect(promptEn).toContain('Use common food names in English');
      expect(promptEn).toContain('tomato, egg, rice, onion, potato, avocado');
      expect(promptEn).toContain('Allowed canonical units exclusively: "unidad", "g", "kg", "ml", "l", "desconocida"');
      expect(promptEn).toContain('Never translate these unit identifiers');
      expect(promptEn).toContain('"name": "Egg"');
      expect(promptEn).toContain('"unit": "unidad"');
    });
  });

  describe('2. Gemini Ingredient Service — Propagación de Locale e Invocación', () => {
    const fakeBuffer = Buffer.from('image-test-bytes');
    const fakeMime = 'image/jpeg';

    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('omisión de locale usa es por defecto y envía prompt y schema en español', async () => {
      const geminiPayload = {
        ingredients: [
          {
            name: 'tomate',
            quantity: 2,
            unit: 'unidad',
            needsReview: false,
          },
        ],
      };

      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify(geminiPayload),
      } as any);

      const promise = analyzeIngredientsFromImage({
        buffer: fakeBuffer,
        mimeType: fakeMime,
      });
      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result).toEqual(geminiPayload);
      expect(mockedCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockedCreate.mock.calls[0][0] as any;
      expect(callArgs.input[1].text).toBe(detectIngredientsPromptEs);
      expect(callArgs.response_format.schema).toEqual(getIngredientAnalysisJsonSchema('es'));
    });

    it('locale=es explícito envía prompt y schema en español', async () => {
      const geminiPayload = {
        ingredients: [
          {
            name: 'cebolla cabezona',
            quantity: 1,
            unit: 'unidad',
            needsReview: false,
          },
        ],
      };

      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify(geminiPayload),
      } as any);

      const promise = analyzeIngredientsFromImage({
        buffer: fakeBuffer,
        mimeType: fakeMime,
        locale: 'es',
      });
      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result).toEqual(geminiPayload);
      const callArgs = mockedCreate.mock.calls[0][0] as any;
      expect(callArgs.input[1].text).toBe(detectIngredientsPromptEs);
      expect(callArgs.response_format.schema).toEqual(getIngredientAnalysisJsonSchema('es'));
    });

    it('locale=en explícito envía prompt y schema en inglés a Gemini', async () => {
      const geminiPayload = {
        ingredients: [
          {
            name: 'tomato',
            quantity: 3,
            unit: 'unidad',
            needsReview: false,
          },
          {
            name: 'whole milk',
            quantity: 1,
            unit: 'l',
            needsReview: false,
          },
        ],
      };

      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify(geminiPayload),
      } as any);

      const promise = analyzeIngredientsFromImage({
        buffer: fakeBuffer,
        mimeType: fakeMime,
        locale: 'en',
      });
      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result).toEqual(geminiPayload);
      const callArgs = mockedCreate.mock.calls[0][0] as any;
      expect(callArgs.input[1].text).toBe(detectIngredientsPromptEn);
      expect(callArgs.response_format.schema).toEqual(getIngredientAnalysisJsonSchema('en'));
      expect(callArgs.response_format.schema.properties.ingredients.items.properties.name.description).toBe(
        'Common name of the food item in English.',
      );
    });

    it('valida que las unidades en inglés sigan siendo las canónicas (unidad, g, kg, ml, l, desconocida)', async () => {
      const geminiEnglishPayload = {
        ingredients: [
          {
            name: 'avocado',
            quantity: 2,
            unit: 'unidad',
            needsReview: false,
          },
          {
            name: 'rice',
            quantity: null,
            unit: 'desconocida',
            needsReview: true,
          },
          {
            name: 'chicken breast',
            quantity: 500,
            unit: 'g',
            needsReview: false,
          },
        ],
      };

      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify(geminiEnglishPayload),
      } as any);

      const promise = analyzeIngredientsFromImage({
        buffer: fakeBuffer,
        mimeType: fakeMime,
        locale: 'en',
      });
      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result.ingredients).toHaveLength(3);
      expect(result.ingredients[0].unit).toBe('unidad');
      expect(result.ingredients[1].unit).toBe('desconocida');
      expect(result.ingredients[2].unit).toBe('g');
    });

    it('rechaza con INVALID_GEMINI_RESPONSE si Gemini intenta traducir unidades a inglés (ej. unit, pieces)', async () => {
      const invalidUnitPayload = {
        ingredients: [
          {
            name: 'apple',
            quantity: 2,
            unit: 'unit', // No permitido, debe ser "unidad"
            needsReview: false,
          },
        ],
      };

      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify(invalidUnitPayload),
      } as any);

      const promise = analyzeIngredientsFromImage({
        buffer: fakeBuffer,
        mimeType: fakeMime,
        locale: 'en',
      });
      const assertion = expect(promise).rejects.toMatchObject({
        statusCode: 502,
        code: 'INVALID_GEMINI_RESPONSE',
      });
      await vi.advanceTimersByTimeAsync(10);
      await assertion;
    });

    it('preserva el comportamiento de needsReview: true y quantity: null para ingredientes en inglés', async () => {
      const uncertainPayload = {
        ingredients: [
          {
            name: 'white powder',
            quantity: null,
            unit: 'desconocida',
            needsReview: true,
          },
        ],
      };

      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify(uncertainPayload),
      } as any);

      const promise = analyzeIngredientsFromImage({
        buffer: fakeBuffer,
        mimeType: fakeMime,
        locale: 'en',
      });
      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result.ingredients[0].quantity).toBeNull();
      expect(result.ingredients[0].unit).toBe('desconocida');
      expect(result.ingredients[0].needsReview).toBe(true);
    });
  });

  describe('3. Endpoint HTTP POST /api/ingredients/analyze — Validación, Auth, Multipart y Propagación', () => {
    let authHeader: string;

    beforeAll(async () => {
      await setupTestSupabaseJwks();
      const token = await signTestSupabaseJwt({
        sub: 'user-bilingual-scanner-test',
      });
      authHeader = `Bearer ${token}`;
    });

    afterAll(async () => {
      await teardownTestSupabaseJwks();
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('sin parámetro locale: procesa la imagen y delega locale=es a Gemini', async () => {
      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify({
          ingredients: [
            {
              name: 'papa pastusa',
              quantity: 4,
              unit: 'unidad',
              needsReview: false,
            },
          ],
        }),
      } as any);

      const response = await request(app)
        .post('/api/ingredients/analyze')
        .set('Authorization', authHeader)
        .attach('image', Buffer.from('fake-jpeg-data'), {
          filename: 'despensa.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          ingredients: [
            {
              name: 'papa pastusa',
              quantity: 4,
              unit: 'unidad',
              needsReview: false,
            },
          ],
        },
      });

      expect(mockedCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockedCreate.mock.calls[0][0] as any;
      expect(callArgs.input[1].text).toBe(detectIngredientsPromptEs);
    });

    it('con ?locale=es explícito: delega locale=es a Gemini', async () => {
      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify({
          ingredients: [
            {
              name: 'zanahoria',
              quantity: 2,
              unit: 'unidad',
              needsReview: false,
            },
          ],
        }),
      } as any);

      const response = await request(app)
        .post('/api/ingredients/analyze?locale=es')
        .set('Authorization', authHeader)
        .attach('image', Buffer.from('fake-png-data'), {
          filename: 'verduras.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.ingredients[0].name).toBe('zanahoria');

      expect(mockedCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockedCreate.mock.calls[0][0] as any;
      expect(callArgs.input[1].text).toBe(detectIngredientsPromptEs);
    });

    it('con ?locale=en explícito: delega prompt y schema en inglés y retorna nombres en inglés', async () => {
      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify({
          ingredients: [
            {
              name: 'carrot',
              quantity: 2,
              unit: 'unidad',
              needsReview: false,
            },
          ],
        }),
      } as any);

      const response = await request(app)
        .post('/api/ingredients/analyze?locale=en')
        .set('Authorization', authHeader)
        .attach('image', Buffer.from('fake-webp-data'), {
          filename: 'vegetables.webp',
          contentType: 'image/webp',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          ingredients: [
            {
              name: 'carrot',
              quantity: 2,
              unit: 'unidad',
              needsReview: false,
            },
          ],
        },
      });

      expect(mockedCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockedCreate.mock.calls[0][0] as any;
      expect(callArgs.input[1].text).toBe(detectIngredientsPromptEn);
      expect(callArgs.response_format.schema).toEqual(getIngredientAnalysisJsonSchema('en'));
    });

    it('preserva autenticación Bearer: rechaza llamadas sin Authorization con 401', async () => {
      const response = await request(app)
        .post('/api/ingredients/analyze?locale=en')
        .attach('image', Buffer.from('fake-image-bytes'), {
          filename: 'pantry.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_REQUIRED');
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('preserva autenticación Bearer: rechaza token inválido con 401', async () => {
      const response = await request(app)
        .post('/api/ingredients/analyze?locale=en')
        .set('Authorization', 'Bearer invalid-token')
        .attach('image', Buffer.from('fake-image-bytes'), {
          filename: 'pantry.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_AUTH_TOKEN');
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('preserva validación multipart: retorna 400 IMAGE_REQUIRED si no se envía archivo', async () => {
      const response = await request(app)
        .post('/api/ingredients/analyze?locale=en')
        .set('Authorization', authHeader);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('IMAGE_REQUIRED');
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('preserva validación multipart: retorna 400 INVALID_IMAGE_CONTENT si el buffer está vacío', async () => {
      const response = await request(app)
        .post('/api/ingredients/analyze?locale=en')
        .set('Authorization', authHeader)
        .attach('image', Buffer.alloc(0), {
          filename: 'empty.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_IMAGE_CONTENT');
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('preserva validación multipart: retorna 400 INVALID_IMAGE_FORMAT para extensiones/mimes no permitidos', async () => {
      const response = await request(app)
        .post('/api/ingredients/analyze?locale=en')
        .set('Authorization', authHeader)
        .attach('image', Buffer.from('fake-pdf'), {
          filename: 'document.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_IMAGE_FORMAT');
      expect(mockedCreate).not.toHaveBeenCalled();
    });
  });
});
