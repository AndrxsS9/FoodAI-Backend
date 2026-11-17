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

/*
 * Solo se simula el cliente de Gemini. Identidad, matching,
 * precios COP, conveniencia y armado del plan usan la lógica real.
 * Nunca se realizan solicitudes reales a Gemini.
 */
vi.mock('../src/services/gemini/gemini.client', () => ({
  geminiClient: {
    interactions: {
      create: vi.fn(),
    },
  },
}));

import app from '../src/app';
import { geminiClient } from '../src/services/gemini/gemini.client';
import { prepareIngredientName } from '../src/utils/ingredientIdentity';
import { singularizeIngredientName } from '../src/utils/ingredientPlural';
import {
  UNKNOWN_INGREDIENT_CONSUMPTION_COST,
  UNKNOWN_INGREDIENT_ESTIMATED_COST,
  estimateIngredientCost,
  estimateMissingIngredientsCost,
  findPriceRule,
  ingredientPriceCatalog,
} from '../src/services/pricing/ingredientPrice.service';
import {
  ingredientNamesMatch,
  matchRecipeWithPantry,
} from '../src/services/recipes/pantryMatcher.service';
import type { RecipeIngredient } from '../src/schemas/recipe.schema';
import {
  setupTestSupabaseJwks,
  signTestSupabaseJwt,
  teardownTestSupabaseJwks,
} from './helpers/testAuth';

const mockedCreate = vi.mocked(geminiClient.interactions.create);

function ingredient(name: string): RecipeIngredient {
  return { name, quantity: 1, unit: 'unidad' };
}

function purchase(name: string): number {
  return estimateIngredientCost(ingredient(name));
}

function consumption(name: string): number {
  return estimateIngredientCost(ingredient(name), {
    mode: 'consumption',
  });
}

/*
 * [nombre en inglés, nombre en español, identidad canónica esperada]
 */
const equivalentPairs: Array<[string, string, string]> = [
  ['onion', 'cebolla', 'cebolla'],
  ['red onion', 'cebolla roja', 'cebolla'],
  ['white onion', 'cebolla blanca', 'cebolla'],
  ['green onion', 'cebolla larga', 'cebolla larga'],
  ['scallion', 'cebolla junca', 'cebolla larga'],
  ['tomato', 'tomate', 'tomate'],
  ['egg', 'huevo', 'huevo'],
  ['garlic', 'ajo', 'ajo'],
  ['oil', 'aceite', 'aceite'],
  ['vegetable oil', 'aceite vegetal', 'aceite'],
  ['sunflower oil', 'aceite de girasol', 'aceite'],
  ['salt', 'sal', 'sal'],
  ['sea salt', 'sal marina', 'sal'],
  ['carrot', 'zanahoria', 'zanahoria'],
  ['black pepper', 'pimienta', 'pimienta'],
  ['bell pepper', 'pimenton', 'pimenton'],
  ['red bell pepper', 'pimiento rojo', 'pimenton'],
  ['green bell pepper', 'pimiento verde', 'pimenton'],
  ['cheese', 'queso', 'queso'],
  ['mozzarella cheese', 'queso mozzarella', 'queso'],
  ['beef', 'carne', 'carne'],
  ['ground beef', 'carne molida', 'carne'],
  ['flour', 'harina', 'harina'],
  ['wheat flour', 'harina de trigo', 'harina'],
  ['avocado', 'aguacate', 'aguacate'],
  ['hass avocado', 'aguacate hass', 'aguacate'],
  ['plantain', 'platano', 'platano'],
  ['ripe plantain', 'platano maduro', 'platano'],
  ['corn', 'maiz', 'maiz'],
  ['pea', 'arveja', 'arveja'],
  ['pumpkin', 'auyama', 'auyama'],
  ['water', 'agua', 'agua'],
  ['lime', 'limon', 'limon'],
  ['passion fruit', 'maracuya', 'maracuya'],
  ['beet', 'remolacha', 'remolacha'],
  ['butter', 'mantequilla', 'mantequilla'],
  ['sugar', 'azucar', 'azucar'],
  ['pork', 'cerdo', 'cerdo'],
  ['tuna', 'atun', 'atun'],
  ['bacon', 'tocineta', 'tocineta'],
  ['lettuce', 'lechuga', 'lechuga'],
  ['spinach', 'espinaca', 'espinaca'],
  ['cucumber', 'pepino', 'pepino'],
  ['mushroom', 'champinon', 'champinon'],
  ['lentil', 'lenteja', 'lenteja'],
  ['chickpea', 'garbanzo', 'garbanzo'],
  ['cumin', 'comino', 'comino'],
  ['cinnamon', 'canela', 'canela'],
  ['vinegar', 'vinagre', 'vinagre'],
];

describe('Fase 28C-B2.4 — Alias bilingües de alimentos y paridad de precios', () => {
  describe('1. Canonicalización inglés/español', () => {
    it.each(equivalentPairs)(
      '"%s" y "%s" comparten la identidad canónica "%s"',
      (english, spanish, canonical) => {
        expect(prepareIngredientName(english)).toBe(canonical);
        expect(prepareIngredientName(spanish)).toBe(canonical);
      },
    );

    it('es insensible a mayúsculas, espacios y guiones en nombres en inglés', () => {
      expect(prepareIngredientName('  Onion ')).toBe('cebolla');
      expect(prepareIngredientName('GREEN ONIONS')).toBe('cebolla larga');
      expect(prepareIngredientName('All-Purpose Flour')).toBe('harina');
      expect(prepareIngredientName('Black Pepper')).toBe('pimienta');
    });
  });

  describe('2. Plurales y singulares en inglés', () => {
    it.each([
      ['onions', 'onion', 'cebolla'],
      ['red onions', 'red onion', 'cebolla'],
      ['green onions', 'green onion', 'cebolla larga'],
      ['scallions', 'scallion', 'cebolla larga'],
      ['spring onions', 'spring onion', 'cebolla larga'],
      ['tomatoes', 'tomato', 'tomate'],
      ['roma tomatoes', 'roma tomato', 'tomate'],
      ['eggs', 'egg', 'huevo'],
      ['large eggs', 'large egg', 'huevo'],
      ['garlic cloves', 'garlic clove', 'ajo'],
      ['carrots', 'carrot', 'zanahoria'],
      ['bell peppers', 'bell pepper', 'pimenton'],
      ['avocados', 'avocado', 'aguacate'],
      ['plantains', 'plantain', 'platano'],
      ['peas', 'pea', 'arveja'],
      ['green peas', 'green pea', 'arveja'],
      ['limes', 'lime', 'limon'],
      ['beets', 'beet', 'remolacha'],
      ['cucumbers', 'cucumber', 'pepino'],
      ['mushrooms', 'mushroom', 'champinon'],
      ['lentils', 'lentil', 'lenteja'],
      ['chickpeas', 'chickpea', 'garbanzo'],
    ])(
      '"%s" se singulariza a "%s" y comparte identidad "%s"',
      (plural, singular, canonical) => {
        expect(singularizeIngredientName(plural)).toBe(singular);
        expect(prepareIngredientName(plural)).toBe(canonical);
        expect(prepareIngredientName(singular)).toBe(canonical);
      },
    );

    it('plurales españoles e ingleses equivalentes convergen en la misma identidad', () => {
      expect(prepareIngredientName('onions')).toBe(
        prepareIngredientName('cebollas'),
      );
      expect(prepareIngredientName('tomatoes')).toBe(
        prepareIngredientName('tomates'),
      );
      expect(prepareIngredientName('eggs')).toBe(
        prepareIngredientName('huevos'),
      );
      expect(prepareIngredientName('carrots')).toBe(
        prepareIngredientName('zanahorias'),
      );
      expect(prepareIngredientName('green onions')).toBe(
        prepareIngredientName('cebollas largas'),
      );
    });
  });

  describe('3. Matching de despensa en ambas direcciones', () => {
    it.each(equivalentPairs)(
      'receta "%s" ↔ despensa "%s" coinciden en ambas direcciones',
      (english, spanish) => {
        expect(ingredientNamesMatch(english, spanish)).toBe(true);
        expect(ingredientNamesMatch(spanish, english)).toBe(true);
      },
    );

    it('receta en inglés contra despensa en español respeta la comparación de cantidades', () => {
      const result = matchRecipeWithPantry(
        {
          name: 'Tomato omelette',
          description: 'Test.',
          totalMinutes: 15,
          ingredients: [
            { name: 'onion', quantity: 2, unit: 'unidad' },
            { name: 'tomatoes', quantity: 3, unit: 'unidad' },
            { name: 'eggs', quantity: 4, unit: 'unidad' },
            { name: 'garlic cloves', quantity: 2, unit: 'unidad' },
          ],
          steps: ['Cook.'],
        },
        [
          { name: 'cebolla', quantity: 3, unit: 'unidad', needsReview: false },
          { name: 'tomates', quantity: 2, unit: 'unidad', needsReview: false },
          { name: 'huevos', quantity: 6, unit: 'unidad', needsReview: false },
          { name: 'ajo', quantity: 5, unit: 'unidad', needsReview: false },
        ],
      );

      expect(result.availableIngredients.map((i) => i.name)).toEqual([
        'onion',
        'eggs',
        'garlic cloves',
      ]);
      // Hay tomate en la despensa, pero no alcanza (2 < 3).
      expect(result.missingIngredients.map((i) => i.name)).toEqual([
        'tomatoes',
      ]);
    });

    it('receta en español contra despensa en inglés respeta la comparación de cantidades', () => {
      const result = matchRecipeWithPantry(
        {
          name: 'Zanahorias salteadas',
          description: 'Prueba.',
          totalMinutes: 15,
          ingredients: [
            { name: 'cebolla', quantity: 1, unit: 'unidad' },
            { name: 'zanahorias', quantity: 2, unit: 'unidad' },
            { name: 'aceite', quantity: 30, unit: 'ml' },
            { name: 'sal', quantity: 5, unit: 'g' },
          ],
          steps: ['Saltear.'],
        },
        [
          { name: 'onions', quantity: 2, unit: 'unidad', needsReview: false },
          { name: 'carrots', quantity: 1, unit: 'unidad', needsReview: false },
          { name: 'vegetable oil', quantity: 500, unit: 'ml', needsReview: false },
          { name: 'salt', quantity: 500, unit: 'g', needsReview: false },
        ],
      );

      expect(result.availableIngredients.map((i) => i.name)).toEqual([
        'cebolla',
        'aceite',
        'sal',
      ]);
      expect(result.missingIngredients.map((i) => i.name)).toEqual([
        'zanahorias',
      ]);
    });
  });

  describe('4 y 5. Paridad de precios de compra y consumo', () => {
    it.each(equivalentPairs)(
      '"%s" y "%s" usan la misma regla del catálogo con precios idénticos',
      (english, spanish) => {
        const englishRule = findPriceRule(english);
        const spanishRule = findPriceRule(spanish);

        expect(spanishRule).toBeDefined();
        expect(englishRule?.id).toBe(spanishRule?.id);
        expect(purchase(english)).toBe(purchase(spanish));
        expect(consumption(english)).toBe(consumption(spanish));
      },
    );

    it('fija los precios COP de los ocho alimentos prioritarios', () => {
      const expected: Array<[string, string, number, number]> = [
        ['onion', 'cebolla', 1500, 750],
        ['green onion', 'cebolla_larga', 2000, 600],
        ['tomato', 'tomate', 1500, 750],
        ['egg', 'huevo', 800, 800],
        ['garlic', 'ajo', 1000, 300],
        ['oil', 'aceite', 7000, 500],
        ['salt', 'sal', 1500, 100],
        ['carrot', 'zanahoria', 1500, 750],
      ];

      for (const [name, ruleId, purchasePrice, consumptionPrice] of expected) {
        expect(findPriceRule(name)?.id).toBe(ruleId);
        expect(purchase(name)).toBe(purchasePrice);
        expect(consumption(name)).toBe(consumptionPrice);
      }
    });

    it('una lista en inglés y su equivalente en español suman el mismo costo', () => {
      const english = ['onions', 'tomatoes', 'eggs', 'garlic', 'oil', 'salt', 'carrots', 'green onions'].map(ingredient);
      const spanish = ['cebollas', 'tomates', 'huevos', 'ajo', 'aceite', 'sal', 'zanahorias', 'cebolla larga'].map(ingredient);

      expect(estimateMissingIngredientsCost(english)).toBe(16800);
      expect(estimateMissingIngredientsCost(spanish)).toBe(16800);
      expect(
        estimateMissingIngredientsCost(english, { mode: 'consumption' }),
      ).toBe(
        estimateMissingIngredientsCost(spanish, { mode: 'consumption' }),
      );
    });
  });

  describe('8. Distinciones de alimentos que deben preservarse', () => {
    const distinctPairs: Array<[string, string]> = [
      ['onion', 'green onion'],
      ['onions', 'green onions'],
      ['onion', 'onion powder'],
      ['garlic', 'garlic powder'],
      ['egg', 'eggplant'],
      ['tomato', 'tomato sauce'],
      ['tomato', 'tomato paste'],
      ['tomato', 'tomato puree'],
      ['tomato sauce', 'tomato paste'],
      ['milk', 'almond milk'],
      ['potato', 'sweet potato'],
      ['potato', 'papa criolla'],
      ['black pepper', 'bell pepper'],
      ['cebolla', 'green onion'],
      ['onion', 'cebolla larga'],
      ['huevo', 'eggplant'],
      ['tomate', 'tomato paste'],
    ];

    it.each(distinctPairs)(
      '"%s" y "%s" conservan identidades distintas y no coinciden en despensa',
      (a, b) => {
        expect(prepareIngredientName(a)).not.toBe(prepareIngredientName(b));
        expect(ingredientNamesMatch(a, b)).toBe(false);
        expect(ingredientNamesMatch(b, a)).toBe(false);
      },
    );

    it.each([
      ['green onion', 'cebolla_larga', 'cebolla'],
      ['tomato sauce', 'salsa_tomate', 'tomate'],
      ['sweet potato', undefined, 'papa'],
      ['almond milk', undefined, 'leche'],
      ['papa criolla', 'papa_criolla', 'papa'],
    ])(
      '"%s" no usa la regla de precio del alimento base',
      (name, expectedRule, baseRule) => {
        expect(findPriceRule(name)?.id).toBe(expectedRule);
        expect(findPriceRule(name)?.id).not.toBe(baseRule);
      },
    );

    it('mantiene el comportamiento existente de productos de tomate', () => {
      expect(prepareIngredientName('tomato sauce')).toBe('salsa de tomate');
      expect(prepareIngredientName('tomato paste')).toBe('pasta de tomate');
      expect(prepareIngredientName('tomato puree')).toBe('pure de tomate');
      expect(findPriceRule('tomato sauce')?.id).toBe('salsa_tomate');
      expect(findPriceRule('ketchup')?.id).toBe('salsa_tomate');
      expect(findPriceRule('tomato paste')).toBeUndefined();
      expect(findPriceRule('tomato puree')).toBeUndefined();
    });
  });

  describe('9. "pepper" ambiguo', () => {
    it('no asigna "pepper" genérico a pimienta ni a pimentón', () => {
      expect(prepareIngredientName('pepper')).toBe('pepper');
      expect(prepareIngredientName('peppers')).toBe('peppers');
      expect(findPriceRule('pepper')).toBeUndefined();
      expect(purchase('pepper')).toBe(UNKNOWN_INGREDIENT_ESTIMATED_COST);
      expect(consumption('pepper')).toBe(
        UNKNOWN_INGREDIENT_CONSUMPTION_COST,
      );

      for (const other of [
        'pimienta',
        'pimenton',
        'black pepper',
        'bell pepper',
      ]) {
        expect(ingredientNamesMatch('pepper', other)).toBe(false);
        expect(ingredientNamesMatch(other, 'pepper')).toBe(false);
      }
    });

    it('resuelve formas con contexto: black pepper → pimienta, bell pepper → pimentón', () => {
      expect(findPriceRule('black pepper')?.id).toBe('pimienta');
      expect(findPriceRule('ground black pepper')?.id).toBe('pimienta');
      expect(findPriceRule('bell pepper')?.id).toBe('pimenton');
      expect(findPriceRule('red bell peppers')?.id).toBe('pimenton');
      expect(ingredientNamesMatch('black pepper', 'pimienta')).toBe(true);
      expect(ingredientNamesMatch('bell pepper', 'pimiento')).toBe(true);
      expect(ingredientNamesMatch('black pepper', 'pimenton')).toBe(false);
      expect(ingredientNamesMatch('bell pepper', 'pimienta')).toBe(false);
    });
  });

  describe('10. Ingredientes desconocidos conservan el fallback', () => {
    it.each([
      'dragon fruit',
      'onion powder',
      'garlic powder',
      'eggplant',
      'pepper',
      'kale',
    ])('"%s" usa los valores fallback de compra y consumo', (name) => {
      expect(findPriceRule(name)).toBeUndefined();
      expect(purchase(name)).toBe(5000);
      expect(consumption(name)).toBe(2000);
    });

    it('las constantes fallback no cambian', () => {
      expect(UNKNOWN_INGREDIENT_ESTIMATED_COST).toBe(5000);
      expect(UNKNOWN_INGREDIENT_CONSUMPTION_COST).toBe(2000);
    });
  });

  describe('11. Comportamiento español sin cambios', () => {
    it('el catálogo conserva sus 78 entradas, alias y precios', () => {
      expect(ingredientPriceCatalog).toHaveLength(78);

      const totals = ingredientPriceCatalog.reduce(
        (acc, rule) => ({
          purchase: acc.purchase + rule.estimatedPurchasePrice,
          consumption: acc.consumption + rule.estimatedConsumptionPrice,
          aliases: acc.aliases + rule.aliases.length,
        }),
        { purchase: 0, consumption: 0, aliases: 0 },
      );

      expect(totals).toEqual({
        purchase: 252800,
        consumption: 115750,
        aliases: 292,
      });
    });

    it('las identidades españolas existentes no cambian', () => {
      expect(prepareIngredientName('cebollas')).toBe('cebolla');
      expect(prepareIngredientName('cebolla larga')).toBe('cebolla larga');
      expect(prepareIngredientName('tomates')).toBe('tomate');
      expect(prepareIngredientName('huevos')).toBe('huevo');
      expect(prepareIngredientName('dientes de ajo')).toBe('diente de ajo');
      expect(prepareIngredientName('pimienta negra')).toBe('pimienta negra');
      expect(prepareIngredientName('pimientos')).toBe('pimenton');
      expect(prepareIngredientName('ajo en polvo')).toBe('ajo en polvo');
    });

    it('las coincidencias y distinciones españolas existentes no cambian', () => {
      expect(ingredientNamesMatch('cebolla', 'cebolla larga')).toBe(false);
      expect(ingredientNamesMatch('tomate', 'salsa de tomate')).toBe(false);
      expect(ingredientNamesMatch('papa', 'papa criolla')).toBe(false);
      expect(ingredientNamesMatch('sal', 'salsa de soya')).toBe(false);
      expect(ingredientNamesMatch('diente de ajo', 'ajo')).toBe(true);
      expect(ingredientNamesMatch('pimienta negra', 'pimienta')).toBe(true);
      expect(findPriceRule('dientes de ajo')?.id).toBe('ajo');
      expect(findPriceRule('pimienta negra')?.id).toBe('pimienta');
    });
  });

  describe('12. Sin mutación de entradas', () => {
    it('matching y estimación de precios no mutan receta, despensa ni ingredientes', () => {
      const recipe = {
        name: 'Rice with onion',
        description: 'Test.',
        totalMinutes: 10,
        ingredients: [
          { name: 'Onions', quantity: 2, unit: 'unidad' as const },
          { name: 'Rice', quantity: 200, unit: 'g' as const },
        ],
        steps: ['Cook.'],
      };
      const pantry = [
        { name: 'Cebollas', quantity: 1, unit: 'unidad' as const, needsReview: false },
        { name: 'arroz', quantity: 500, unit: 'g' as const, needsReview: false },
      ];
      const recipeSnapshot = structuredClone(recipe);
      const pantrySnapshot = structuredClone(pantry);

      const deepFreeze = <T>(value: T): T => {
        Object.values(value as object).forEach((child) => {
          if (child && typeof child === 'object') deepFreeze(child);
        });
        return Object.freeze(value);
      };
      deepFreeze(recipe);
      deepFreeze(pantry);

      const result = matchRecipeWithPantry(recipe, pantry);
      estimateMissingIngredientsCost(result.missingIngredients);
      estimateMissingIngredientsCost(recipe.ingredients, {
        mode: 'consumption',
      });

      expect(recipe).toEqual(recipeSnapshot);
      expect(pantry).toEqual(pantrySnapshot);
      expect(result.missingIngredients).toEqual([
        { name: 'Onions', quantity: 2, unit: 'unidad' },
      ]);
    });
  });

  describe('6 y 7. Integración: planes de tres días con Gemini simulado', () => {
    let userCounter = 0;

    beforeAll(async () => {
      await setupTestSupabaseJwks();
    });

    afterAll(async () => {
      await teardownTestSupabaseJwks();
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    async function postMealPlan(
      recipes: unknown[],
      body: Record<string, unknown>,
    ) {
      mockedCreate.mockResolvedValueOnce({
        output_text: JSON.stringify({ recipes }),
      } as any);

      userCounter += 1;
      const token = await signTestSupabaseJwt({
        sub: `user-bilingual-food-aliases-${userCounter}`,
      });

      return request(app)
        .post('/api/meal-plans/generate')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    }

    const spanishPantry = [
      { name: 'arroz', quantity: 1000, unit: 'g', needsReview: false },
      { name: 'huevos', quantity: 12, unit: 'unidad', needsReview: false },
    ];

    const spanishRecipes = [
      {
        name: 'Arroz con huevo y cebolla',
        description: 'Sencillo.',
        totalMinutes: 20,
        ingredients: [
          { name: 'arroz', quantity: 200, unit: 'g' },
          { name: 'huevos', quantity: 2, unit: 'unidad' },
          { name: 'cebolla', quantity: 1, unit: 'unidad' },
        ],
        steps: ['Cocinar.'],
      },
      {
        name: 'Sopa de tomate',
        description: 'Casera.',
        totalMinutes: 30,
        ingredients: [
          { name: 'tomates', quantity: 3, unit: 'unidad' },
          { name: 'cebollas', quantity: 1, unit: 'unidad' },
          { name: 'ajo', quantity: 2, unit: 'unidad' },
        ],
        steps: ['Cocinar.'],
      },
      {
        name: 'Zanahorias salteadas',
        description: 'Rápido.',
        totalMinutes: 15,
        ingredients: [
          { name: 'zanahorias', quantity: 3, unit: 'unidad' },
          { name: 'aceite', quantity: 1, unit: 'cucharada' },
          { name: 'sal', quantity: 1, unit: 'cucharadita' },
        ],
        steps: ['Saltear.'],
      },
    ];

    const englishRecipes = [
      {
        name: 'Rice with egg and onion',
        description: 'Simple.',
        totalMinutes: 20,
        ingredients: [
          { name: 'rice', quantity: 200, unit: 'g' },
          { name: 'eggs', quantity: 2, unit: 'unidad' },
          { name: 'onion', quantity: 1, unit: 'unidad' },
        ],
        steps: ['Cook.'],
      },
      {
        name: 'Tomato soup',
        description: 'Homemade.',
        totalMinutes: 30,
        ingredients: [
          { name: 'tomatoes', quantity: 3, unit: 'unidad' },
          { name: 'onions', quantity: 1, unit: 'unidad' },
          { name: 'garlic', quantity: 2, unit: 'unidad' },
        ],
        steps: ['Cook.'],
      },
      {
        name: 'Sauteed carrots',
        description: 'Quick.',
        totalMinutes: 15,
        ingredients: [
          { name: 'carrots', quantity: 3, unit: 'unidad' },
          { name: 'vegetable oil', quantity: 1, unit: 'cucharada' },
          { name: 'salt', quantity: 1, unit: 'cucharadita' },
        ],
        steps: ['Saute.'],
      },
    ];

    it('el mismo plan en es y en produce costos, presupuesto y conveniencia idénticos, contando cebolla/onion una sola vez', async () => {
      const esResponse = await postMealPlan(spanishRecipes, {
        pantry: spanishPantry,
        budget: 20000,
        servings: 2,
        locale: 'es',
      });
      const enResponse = await postMealPlan(englishRecipes, {
        pantry: spanishPantry,
        budget: 20000,
        servings: 2,
        locale: 'en',
      });

      expect(esResponse.status).toBe(200);
      expect(enResponse.status).toBe(200);
      expect(mockedCreate).toHaveBeenCalledTimes(2);

      const es = esResponse.body.data;
      const en = enResponse.body.data;

      /*
       * cebolla 1500 (una sola vez aunque la pidan dos recetas)
       * + tomate 1500 + ajo 1000 + zanahoria 1500
       * + aceite 7000 + sal 1500 = 14000 COP.
       */
      expect(es.totalEstimatedMissingCost).toBe(14000);
      expect(en.totalEstimatedMissingCost).toBe(14000);
      expect(es.budgetRemaining).toBe(6000);
      expect(en.budgetRemaining).toBe(6000);
      expect(es.withinBudget).toBe(true);
      expect(en.withinBudget).toBe(true);

      const numericView = (data: any) =>
        data.days.map((d: any) => ({
          day: d.day,
          estimatedMissingCost: d.recipe.estimatedMissingCost,
          budgetRemaining: d.recipe.budgetRemaining,
          withinBudget: d.recipe.withinBudget,
          convenience: d.recipe.convenience,
          available: d.recipe.availableIngredients.length,
          missing: d.recipe.missingIngredients.length,
        }));

      expect(numericView(en)).toEqual(numericView(es));
      expect(en.days.map((d: any) => d.day)).toEqual([1, 2, 3]);

      // huevos/eggs y arroz/rice se toman de la despensa española.
      const enDayWithEggs = en.days.find(
        (d: any) => d.recipe.name === 'Rice with egg and onion',
      );
      expect(
        enDayWithEggs.recipe.availableIngredients.map((i: any) => i.name),
      ).toEqual(['rice', 'eggs']);
    });

    it('cuenta una sola vez onion / cebollas / red onion en un plan mixto, pero separa green onions y onion powder', async () => {
      const response = await postMealPlan(
        [
          {
            name: 'Recipe 1',
            description: 'Test.',
            totalMinutes: 10,
            ingredients: [
              { name: 'rice', quantity: 100, unit: 'g' },
              { name: 'onion', quantity: 1, unit: 'unidad' },
            ],
            steps: ['Cook.'],
          },
          {
            name: 'Recipe 2',
            description: 'Test.',
            totalMinutes: 10,
            ingredients: [
              { name: 'rice', quantity: 100, unit: 'g' },
              { name: 'cebollas', quantity: 1, unit: 'unidad' },
              { name: 'green onions', quantity: 2, unit: 'unidad' },
            ],
            steps: ['Cook.'],
          },
          {
            name: 'Recipe 3',
            description: 'Test.',
            totalMinutes: 10,
            ingredients: [
              { name: 'rice', quantity: 100, unit: 'g' },
              { name: 'red onion', quantity: 1, unit: 'unidad' },
              { name: 'onion powder', quantity: 1, unit: 'cucharadita' },
            ],
            steps: ['Cook.'],
          },
        ],
        {
          pantry: spanishPantry,
          budget: 20000,
          servings: 2,
          locale: 'en',
        },
      );

      expect(response.status).toBe(200);

      // cebolla 1500 (una vez) + cebolla larga 2000 + onion powder fallback 5000.
      expect(response.body.data.totalEstimatedMissingCost).toBe(8500);
      expect(response.body.data.budgetRemaining).toBe(11500);
    });

    it('mantiene como compras distintas garlic/garlic powder, egg/eggplant y tomato/tomato sauce/tomato paste', async () => {
      const response = await postMealPlan(
        [
          {
            name: 'Recipe 1',
            description: 'Test.',
            totalMinutes: 10,
            ingredients: [
              { name: 'rice', quantity: 100, unit: 'g' },
              { name: 'garlic', quantity: 1, unit: 'unidad' },
              { name: 'egg', quantity: 1, unit: 'unidad' },
            ],
            steps: ['Cook.'],
          },
          {
            name: 'Recipe 2',
            description: 'Test.',
            totalMinutes: 10,
            ingredients: [
              { name: 'rice', quantity: 100, unit: 'g' },
              { name: 'garlic powder', quantity: 1, unit: 'cucharadita' },
              { name: 'eggplant', quantity: 1, unit: 'unidad' },
            ],
            steps: ['Cook.'],
          },
          {
            name: 'Recipe 3',
            description: 'Test.',
            totalMinutes: 10,
            ingredients: [
              { name: 'rice', quantity: 100, unit: 'g' },
              { name: 'tomato', quantity: 1, unit: 'unidad' },
              { name: 'tomato sauce', quantity: 100, unit: 'g' },
              { name: 'tomato paste', quantity: 50, unit: 'g' },
            ],
            steps: ['Cook.'],
          },
        ],
        {
          pantry: [
            { name: 'arroz', quantity: 1000, unit: 'g', needsReview: false },
          ],
          budget: 30000,
          servings: 2,
          locale: 'en',
        },
      );

      expect(response.status).toBe(200);

      /*
       * garlic 1000 + egg 800 + garlic powder 5000 + eggplant 5000
       * + tomato 1500 + tomato sauce 3500 + tomato paste 5000 = 21800.
       */
      expect(response.body.data.totalEstimatedMissingCost).toBe(21800);
      expect(response.body.data.budgetRemaining).toBe(8200);
      expect(response.body.data.withinBudget).toBe(true);
    });

    it('no llama a Gemini cuando la solicitud no supera la validación HTTP', async () => {
      userCounter += 1;
      const token = await signTestSupabaseJwt({
        sub: `user-bilingual-food-aliases-${userCounter}`,
      });

      const response = await request(app)
        .post('/api/meal-plans/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ pantry: [], budget: 20000, servings: 2, locale: 'en' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockedCreate).not.toHaveBeenCalled();
    });
  });
});
