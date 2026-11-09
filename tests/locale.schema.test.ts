import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  localeSchema,
} from '../src/schemas/locale.schema';
import { ingredientAnalysisQuerySchema } from '../src/schemas/ingredient.schema';
import { mealPlanRequestSchema } from '../src/schemas/mealPlan.schema';
import { recipeRecommendationRequestSchema } from '../src/schemas/recipe.schema';

describe('locale.schema - Shared Strict Locale Schema', () => {
  it('define los idiomas soportados exactamente como es y en', () => {
    expect(SUPPORTED_LOCALES).toEqual(['es', 'en']);
  });

  it('establece el idioma por defecto como es', () => {
    expect(DEFAULT_LOCALE).toBe('es');
  });

  it('asigna es por defecto cuando el valor es undefined', () => {
    expect(localeSchema.parse(undefined)).toBe('es');
  });

  it('acepta el idioma explícito es', () => {
    expect(localeSchema.parse('es')).toBe('es');
  });

  it('acepta el idioma explícito en', () => {
    expect(localeSchema.parse('en')).toBe('en');
  });

  it('rechaza idiomas no soportados como fr con ZodError', () => {
    const result = localeSchema.safeParse('fr');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
    }
  });

  it('rechaza tipos inválidos (números, booleanos, null, objetos)', () => {
    expect(localeSchema.safeParse(123).success).toBe(false);
    expect(localeSchema.safeParse(true).success).toBe(false);
    expect(localeSchema.safeParse(null).success).toBe(false);
    expect(localeSchema.safeParse({}).success).toBe(false);
    expect(localeSchema.safeParse([]).success).toBe(false);
    expect(localeSchema.safeParse('').success).toBe(false);
  });
});

describe('recipeRecommendationRequestSchema - Integración con locale', () => {
  const baseRequest = {
    pantry: [
      {
        name: 'arroz',
        quantity: 500,
        unit: 'g' as const,
        needsReview: false,
      },
    ],
    budget: 20000,
    servings: 2,
    maxMinutes: 45,
  };

  it('asigna locale=es por defecto cuando se omite en el payload', () => {
    const parsed = recipeRecommendationRequestSchema.parse(baseRequest);
    expect(parsed.locale).toBe('es');
  });

  it('acepta explícitamente locale=es', () => {
    const parsed = recipeRecommendationRequestSchema.parse({
      ...baseRequest,
      locale: 'es',
    });
    expect(parsed.locale).toBe('es');
  });

  it('acepta explícitamente locale=en', () => {
    const parsed = recipeRecommendationRequestSchema.parse({
      ...baseRequest,
      locale: 'en',
    });
    expect(parsed.locale).toBe('en');
  });

  it('rechaza un locale no soportado como fr', () => {
    const result = recipeRecommendationRequestSchema.safeParse({
      ...baseRequest,
      locale: 'fr',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('locale'));
      expect(issue).toBeDefined();
    }
  });

  it('rechaza tipos inválidos para locale', () => {
    const result = recipeRecommendationRequestSchema.safeParse({
      ...baseRequest,
      locale: 123,
    });
    expect(result.success).toBe(false);
  });
});

describe('mealPlanRequestSchema - Integración con locale', () => {
  const baseRequest = {
    pantry: [
      {
        name: 'arroz',
        quantity: 500,
        unit: 'g' as const,
        needsReview: false,
      },
    ],
    budget: 25000,
    servings: 2,
    maxMinutes: 45,
  };

  it('asigna locale=es por defecto cuando se omite en el payload', () => {
    const parsed = mealPlanRequestSchema.parse(baseRequest);
    expect(parsed.locale).toBe('es');
  });

  it('acepta explícitamente locale=es', () => {
    const parsed = mealPlanRequestSchema.parse({
      ...baseRequest,
      locale: 'es',
    });
    expect(parsed.locale).toBe('es');
  });

  it('acepta explícitamente locale=en', () => {
    const parsed = mealPlanRequestSchema.parse({
      ...baseRequest,
      locale: 'en',
    });
    expect(parsed.locale).toBe('en');
  });

  it('rechaza un locale no soportado como fr', () => {
    const result = mealPlanRequestSchema.safeParse({
      ...baseRequest,
      locale: 'fr',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('locale'));
      expect(issue).toBeDefined();
    }
  });

  it('rechaza tipos inválidos para locale', () => {
    const result = mealPlanRequestSchema.safeParse({
      ...baseRequest,
      locale: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('ingredientAnalysisQuerySchema - Integración con locale de query', () => {
  it('asigna locale=es por defecto cuando req.query está vacío', () => {
    const parsed = ingredientAnalysisQuerySchema.parse({});
    expect(parsed.locale).toBe('es');
  });

  it('acepta explícitamente ?locale=es', () => {
    const parsed = ingredientAnalysisQuerySchema.parse({ locale: 'es' });
    expect(parsed.locale).toBe('es');
  });

  it('acepta explícitamente ?locale=en', () => {
    const parsed = ingredientAnalysisQuerySchema.parse({ locale: 'en' });
    expect(parsed.locale).toBe('en');
  });

  it('rechaza un locale no soportado como ?locale=fr', () => {
    const result = ingredientAnalysisQuerySchema.safeParse({ locale: 'fr' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('locale'));
      expect(issue).toBeDefined();
    }
  });

  it('rechaza query params vacíos como ?locale=', () => {
    const result = ingredientAnalysisQuerySchema.safeParse({ locale: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza parámetros duplicados (arrays) como ?locale=en&locale=es', () => {
    const result = ingredientAnalysisQuerySchema.safeParse({
      locale: ['en', 'es'],
    });
    expect(result.success).toBe(false);
  });
});
