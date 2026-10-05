import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../src/utils/errors';

vi.mock(
  '../src/services/gemini/ingredient.service',
  () => ({
    analyzeIngredientsFromImage: vi.fn(),
  }),
);

import app from '../src/app';

import { analyzeIngredientsFromImage } from '../src/services/gemini/ingredient.service';

const mockedAnalyzeIngredients =
  vi.mocked(analyzeIngredientsFromImage);

describe('POST /api/ingredients/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe retornar IMAGE_REQUIRED si no se envía una imagen', async () => {
    const response = await request(app)
      .post('/api/ingredients/analyze');

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'IMAGE_REQUIRED',
        message: 'Debes enviar una imagen.',
      },
    });

    expect(mockedAnalyzeIngredients).not.toHaveBeenCalled();
  });

  it('debe rechazar formatos de imagen no permitidos', async () => {
    const response = await request(app)
      .post('/api/ingredients/analyze')
      .attach(
        'image',
        Buffer.from('archivo-falso'),
        {
          filename: 'archivo.txt',
          contentType: 'text/plain',
        },
      );

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_IMAGE_FORMAT',
        message:
          'Formato de imagen no permitido. Usa JPG, PNG o WEBP.',
      },
    });

    expect(mockedAnalyzeIngredients).not.toHaveBeenCalled();
  });

  it('debe retornar los ingredientes detectados', async () => {
    mockedAnalyzeIngredients.mockResolvedValue({
      ingredients: [
        {
          name: 'tomate',
          quantity: 4,
          unit: 'unidad',
          needsReview: false,
        },
        {
          name: 'leche',
          quantity: null,
          unit: 'desconocida',
          needsReview: true,
        },
      ],
    });

    const response = await request(app)
      .post('/api/ingredients/analyze')
      .attach(
        'image',
        Buffer.from('imagen-falsa'),
        {
          filename: 'nevera.webp',
          contentType: 'image/webp',
        },
      );

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        ingredients: [
          {
            name: 'tomate',
            quantity: 4,
            unit: 'unidad',
            needsReview: false,
          },
          {
            name: 'leche',
            quantity: null,
            unit: 'desconocida',
            needsReview: true,
          },
        ],
      },
    });

    expect(mockedAnalyzeIngredients).toHaveBeenCalledTimes(1);
  });

  it('debe manejar el límite de solicitudes de Gemini', async () => {
    mockedAnalyzeIngredients.mockRejectedValue(
      new AppError(
        'Se alcanzó temporalmente el límite de solicitudes de análisis. Intenta nuevamente más tarde.',
        429,
        'GEMINI_RATE_LIMIT',
      ),
    );

    const response = await request(app)
      .post('/api/ingredients/analyze')
      .attach(
        'image',
        Buffer.from('imagen-falsa'),
        {
          filename: 'nevera.webp',
          contentType: 'image/webp',
        },
      );

    expect(response.status).toBe(429);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'GEMINI_RATE_LIMIT',
        message:
          'Se alcanzó temporalmente el límite de solicitudes de análisis. Intenta nuevamente más tarde.',
      },
    });
  });

  it('debe manejar cuando Gemini no está disponible', async () => {
    mockedAnalyzeIngredients.mockRejectedValue(
      new AppError(
        'El servicio de análisis está temporalmente ocupado. Intenta nuevamente más tarde.',
        503,
        'GEMINI_UNAVAILABLE',
      ),
    );

    const response = await request(app)
      .post('/api/ingredients/analyze')
      .attach(
        'image',
        Buffer.from('imagen-falsa'),
        {
          filename: 'nevera.webp',
          contentType: 'image/webp',
        },
      );

    expect(response.status).toBe(503);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'GEMINI_UNAVAILABLE',
        message:
          'El servicio de análisis está temporalmente ocupado. Intenta nuevamente más tarde.',
      },
    });
  });
});