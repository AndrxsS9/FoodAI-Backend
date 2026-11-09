import { describe, expect, it } from 'vitest';
import {
  estimateIngredientCost,
  estimateMissingIngredientsCost,
  findPriceRule,
  UNKNOWN_INGREDIENT_CONSUMPTION_COST,
  UNKNOWN_INGREDIENT_ESTIMATED_COST,
} from '../src/services/pricing/ingredientPrice.service';
import {
  isRecipeIngredientAvailable,
  matchRecipeWithPantry,
} from '../src/services/recipes/pantryMatcher.service';
import type { GeneratedRecipe, RecipeIngredient } from '../src/schemas/recipe.schema';
import type { Ingredient } from '../src/schemas/ingredient.schema';

describe('Bilingual Pricing and Matching Integrity (Phase 28C-B1.3)', () => {
  describe('Requirement 1 & 2: Same food in Spanish and English resolves to same price rule & COP price', () => {
    it('milk and leche resolve to the same price rule and price', () => {
      const ruleEs = findPriceRule('leche');
      const ruleEn = findPriceRule('milk');
      const ruleEnCompound = findPriceRule('whole milk');

      expect(ruleEs).toBeDefined();
      expect(ruleEn).toBeDefined();
      expect(ruleEnCompound).toBeDefined();
      expect(ruleEs?.id).toBe('leche');
      expect(ruleEn?.id).toBe('leche');
      expect(ruleEnCompound?.id).toBe('leche');
      expect(ruleEs?.estimatedPurchasePrice).toBe(4500);
      expect(ruleEn?.estimatedPurchasePrice).toBe(4500);
      expect(ruleEs?.estimatedConsumptionPrice).toBe(1500);
      expect(ruleEn?.estimatedConsumptionPrice).toBe(1500);
    });

    it('rice and arroz resolve to the same price rule and price', () => {
      const ruleEs = findPriceRule('arroz');
      const ruleEn = findPriceRule('rice');
      const ruleEnCompound = findPriceRule('white rice');

      expect(ruleEs).toBeDefined();
      expect(ruleEn).toBeDefined();
      expect(ruleEs?.id).toBe('arroz');
      expect(ruleEn?.id).toBe('arroz');
      expect(ruleEnCompound?.id).toBe('arroz');
      expect(ruleEn?.estimatedPurchasePrice).toBe(3500);
      expect(ruleEn?.estimatedConsumptionPrice).toBe(1200);
    });

    it('chicken and pollo resolve to the same price rule and price', () => {
      const ruleEs = findPriceRule('pollo');
      const ruleEn = findPriceRule('chicken');
      const ruleEnBreast = findPriceRule('chicken breast');
      const ruleEnThigh = findPriceRule('chicken thigh');

      expect(ruleEs).toBeDefined();
      expect(ruleEn).toBeDefined();
      expect(ruleEs?.id).toBe('pollo');
      expect(ruleEn?.id).toBe('pollo');
      expect(ruleEnBreast?.id).toBe('pollo');
      expect(ruleEnThigh?.id).toBe('pollo');
      expect(ruleEn?.estimatedPurchasePrice).toBe(9000);
      expect(ruleEn?.estimatedConsumptionPrice).toBe(6000);
    });

    it('potato and papa resolve to the same price rule and price', () => {
      const ruleEs = findPriceRule('papa');
      const ruleEn = findPriceRule('potato');
      const ruleEnPlural = findPriceRule('potatoes');

      expect(ruleEs).toBeDefined();
      expect(ruleEn).toBeDefined();
      expect(ruleEnPlural).toBeDefined();
      expect(ruleEs?.id).toBe('papa');
      expect(ruleEn?.id).toBe('papa');
      expect(ruleEnPlural?.id).toBe('papa');
      expect(ruleEn?.estimatedPurchasePrice).toBe(2500);
      expect(ruleEn?.estimatedConsumptionPrice).toBe(1500);
    });

    it('apple and manzana resolve to the same price rule and price', () => {
      const ruleEs = findPriceRule('manzana');
      const ruleEn = findPriceRule('apple');
      const ruleEnPlural = findPriceRule('apples');

      expect(ruleEs).toBeDefined();
      expect(ruleEn).toBeDefined();
      expect(ruleEnPlural).toBeDefined();
      expect(ruleEs?.id).toBe('manzana');
      expect(ruleEn?.id).toBe('manzana');
      expect(ruleEnPlural?.id).toBe('manzana');
      expect(ruleEn?.estimatedPurchasePrice).toBe(3000);
      expect(ruleEn?.estimatedConsumptionPrice).toBe(1500);
    });

    it('soy sauce and salsa de soya resolve to the same price rule and price', () => {
      const ruleEs = findPriceRule('salsa de soya');
      const ruleEn = findPriceRule('soy sauce');

      expect(ruleEs).toBeDefined();
      expect(ruleEn).toBeDefined();
      expect(ruleEs?.id).toBe('salsa_soya');
      expect(ruleEn?.id).toBe('salsa_soya');
      expect(ruleEn?.estimatedPurchasePrice).toBe(3000);
      expect(ruleEn?.estimatedConsumptionPrice).toBe(600);
    });

    it('tomato sauce and salsa de tomate resolve to the same price rule and price', () => {
      const ruleEs = findPriceRule('salsa de tomate');
      const ruleEn = findPriceRule('tomato sauce');

      expect(ruleEs).toBeDefined();
      expect(ruleEn).toBeDefined();
      expect(ruleEs?.id).toBe('salsa_tomate');
      expect(ruleEn?.id).toBe('salsa_tomate');
      expect(ruleEn?.estimatedPurchasePrice).toBe(3500);
      expect(ruleEn?.estimatedConsumptionPrice).toBe(800);
    });

    it('ketchup resolves to salsa_tomate as explicitly justified by catalog semantics', () => {
      const ruleKetchup = findPriceRule('ketchup');
      const ruleCatsup = findPriceRule('catsup');

      expect(ruleKetchup).toBeDefined();
      expect(ruleCatsup).toBeDefined();
      expect(ruleKetchup?.id).toBe('salsa_tomate');
      expect(ruleCatsup?.id).toBe('salsa_tomate');
      expect(ruleKetchup?.estimatedPurchasePrice).toBe(3500);
    });
  });

  describe('Requirement 3, 4 & 5: Collision prevention, distinct food protection and conservative fallbacks', () => {
    it('prevents milk != almond milk pricing collision', () => {
      const dairyRule = findPriceRule('milk');
      const almondRule = findPriceRule('almond milk');
      const lecheAlmendraRule = findPriceRule('leche de almendras');

      expect(dairyRule?.id).toBe('leche');
      expect(almondRule).toBeUndefined();
      expect(lecheAlmendraRule).toBeUndefined();

      const almondIngredient: RecipeIngredient = {
        name: 'almond milk',
        quantity: 200,
        unit: 'ml',
      };
      expect(estimateIngredientCost(almondIngredient, { mode: 'purchase' })).toBe(
        UNKNOWN_INGREDIENT_ESTIMATED_COST,
      );
      expect(estimateIngredientCost(almondIngredient, { mode: 'consumption' })).toBe(
        UNKNOWN_INGREDIENT_CONSUMPTION_COST,
      );
    });

    it('prevents potato != sweet potato pricing collision', () => {
      const potatoRule = findPriceRule('potato');
      const sweetPotatoRule = findPriceRule('sweet potato');
      const batataRule = findPriceRule('batata');

      expect(potatoRule?.id).toBe('papa');
      expect(sweetPotatoRule).toBeUndefined();
      expect(batataRule).toBeUndefined();

      const sweetPotatoIngredient: RecipeIngredient = {
        name: 'sweet potato',
        quantity: 300,
        unit: 'g',
      };
      expect(estimateIngredientCost(sweetPotatoIngredient, { mode: 'purchase' })).toBe(
        UNKNOWN_INGREDIENT_ESTIMATED_COST,
      );
      expect(estimateIngredientCost(sweetPotatoIngredient, { mode: 'consumption' })).toBe(
        UNKNOWN_INGREDIENT_CONSUMPTION_COST,
      );
    });

    it('prevents potato != papa criolla pricing collision', () => {
      const regularPotatoRule = findPriceRule('potato');
      const criollaRule = findPriceRule('papa criolla');
      const criollaPluralRule = findPriceRule('papas criollas');

      expect(regularPotatoRule?.id).toBe('papa');
      expect(criollaRule?.id).toBe('papa_criolla');
      expect(criollaPluralRule?.id).toBe('papa_criolla');
      expect(regularPotatoRule?.estimatedPurchasePrice).toBe(2500);
      expect(criollaRule?.estimatedPurchasePrice).toBe(3000);
      expect(regularPotatoRule?.estimatedPurchasePrice).not.toBe(
        criollaRule?.estimatedPurchasePrice,
      );
    });

    it('prevents apple != pineapple pricing collision', () => {
      const appleRule = findPriceRule('apple');
      const pineappleRule = findPriceRule('pineapple');
      const pinaRule = findPriceRule('piña');

      expect(appleRule?.id).toBe('manzana');
      expect(pineappleRule).toBeUndefined();
      expect(pinaRule).toBeUndefined();

      const pineappleIngredient: RecipeIngredient = {
        name: 'pineapple',
        quantity: 1,
        unit: 'unidad',
      };
      expect(estimateIngredientCost(pineappleIngredient, { mode: 'purchase' })).toBe(
        UNKNOWN_INGREDIENT_ESTIMATED_COST,
      );
      expect(estimateIngredientCost(pineappleIngredient, { mode: 'consumption' })).toBe(
        UNKNOWN_INGREDIENT_CONSUMPTION_COST,
      );
    });

    it('prevents soy sauce != tomato sauce pricing collision', () => {
      const soyRule = findPriceRule('soy sauce');
      const tomatoRule = findPriceRule('tomato sauce');

      expect(soyRule?.id).toBe('salsa_soya');
      expect(tomatoRule?.id).toBe('salsa_tomate');
      expect(soyRule?.id).not.toBe(tomatoRule?.id);
      expect(soyRule?.estimatedPurchasePrice).toBe(3000);
      expect(tomatoRule?.estimatedPurchasePrice).toBe(3500);
    });

    it('uses conservative fallback for arbitrary uncataloged ingredients', () => {
      const uncataloged = ['dragon fruit', 'pitahaya roja', 'matcha en polvo', 'semillas de chia'];

      for (const name of uncataloged) {
        expect(findPriceRule(name)).toBeUndefined();
        expect(
          estimateIngredientCost({ name, quantity: 100, unit: 'g' }, { mode: 'purchase' }),
        ).toBe(5000);
        expect(
          estimateIngredientCost({ name, quantity: 100, unit: 'g' }, { mode: 'consumption' }),
        ).toBe(2000);
      }
    });
  });

  describe('Requirement 6 & 8: Bilingual cost estimation and formula preservation', () => {
    it('calculates estimateMissingIngredientsCost with mixed Spanish and English list', () => {
      const missingList: RecipeIngredient[] = [
        { name: 'chicken', quantity: 500, unit: 'g' }, // pollo: 9000 purchase / 6000 consumption
        { name: 'rice', quantity: 200, unit: 'g' }, // arroz: 3500 purchase / 1200 consumption
        { name: 'leche', quantity: 500, unit: 'ml' }, // leche: 4500 purchase / 1500 consumption
        { name: 'almond milk', quantity: 200, unit: 'ml' }, // fallback: 5000 purchase / 2000 consumption
      ];

      const purchaseTotal = estimateMissingIngredientsCost(missingList, { mode: 'purchase' });
      // 9000 + 3500 + 4500 + 5000 = 22000
      expect(purchaseTotal).toBe(22000);

      const consumptionTotal = estimateMissingIngredientsCost(missingList, { mode: 'consumption' });
      // 6000 + 1200 + 1500 + 2000 = 10700
      expect(consumptionTotal).toBe(10700);
    });

    it('defaults to purchase mode when no options are passed', () => {
      const items: RecipeIngredient[] = [
        { name: 'apple', quantity: 2, unit: 'unidad' }, // manzana: 3000
        { name: 'potato', quantity: 1, unit: 'kg' }, // papa: 2500
      ];

      expect(estimateMissingIngredientsCost(items)).toBe(5500);
    });
  });

  describe('Requirement 7 & 8: Bilingual pantry matching availability and quantities', () => {
    const mockPantrySpanish: Ingredient[] = [
      {
        id: '1',
        name: 'pollo',
        quantity: 1000,
        unit: 'g',
        category: 'protein',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: '2',
        name: 'arroz blanco',
        quantity: 2,
        unit: 'kg',
        category: 'grain_pasta',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: '3',
        name: 'leche entera',
        quantity: 1000,
        unit: 'ml',
        category: 'dairy',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];

    it('matches English recipe against Spanish pantry when quantities are sufficient', () => {
      const englishRecipe: GeneratedRecipe = {
        name: 'Chicken Rice Bowl',
        description: 'Tasty bilingual meal',
        cookingTimeMinutes: 30,
        servings: 2,
        difficulty: 'facil',
        ingredients: [
          { name: 'chicken', quantity: 400, unit: 'g' },
          { name: 'rice', quantity: 300, unit: 'g' },
          { name: 'milk', quantity: 200, unit: 'ml' },
        ],
        instructions: ['Cook chicken', 'Cook rice', 'Mix'],
      };

      const result = matchRecipeWithPantry(englishRecipe, mockPantrySpanish);

      expect(result.availableIngredients).toHaveLength(3);
      expect(result.missingIngredients).toHaveLength(0);
      expect(estimateMissingIngredientsCost(result.missingIngredients)).toBe(0);
    });

    it('marks English ingredient missing when Spanish pantry quantity is insufficient', () => {
      const englishRecipe: GeneratedRecipe = {
        name: 'Mega Chicken Feast',
        description: 'Lots of chicken',
        cookingTimeMinutes: 45,
        servings: 6,
        difficulty: 'media',
        ingredients: [
          { name: 'chicken', quantity: 2000, unit: 'g' }, // Pantry only has 1000g
          { name: 'rice', quantity: 300, unit: 'g' },
        ],
        instructions: ['Roast chicken'],
      };

      const result = matchRecipeWithPantry(englishRecipe, mockPantrySpanish);

      expect(result.availableIngredients).toHaveLength(1);
      expect(result.availableIngredients[0].name).toBe('rice');
      expect(result.missingIngredients).toHaveLength(1);
      expect(result.missingIngredients[0].name).toBe('chicken');
      expect(estimateMissingIngredientsCost(result.missingIngredients)).toBe(9000);
    });

    it('matches Spanish recipe against English pantry', () => {
      const mockPantryEnglish: Ingredient[] = [
        {
          id: '1',
          name: 'potato',
          quantity: 2,
          unit: 'kg',
          category: 'produce',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        {
          id: '2',
          name: 'apple',
          quantity: 4,
          unit: 'unidad',
          category: 'fruit',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ];

      const spanishRecipe: GeneratedRecipe = {
        name: 'Puré de papa con manzana',
        description: 'Deliciosa guarnición',
        cookingTimeMinutes: 20,
        servings: 2,
        difficulty: 'facil',
        ingredients: [
          { name: 'papa', quantity: 500, unit: 'g' },
          { name: 'manzanas', quantity: 2, unit: 'unidad' },
        ],
        instructions: ['Cocinar papas y manzanas'],
      };

      const result = matchRecipeWithPantry(spanishRecipe, mockPantryEnglish);

      expect(result.availableIngredients).toHaveLength(2);
      expect(result.missingIngredients).toHaveLength(0);
    });

    it('preserves collision protection in pantry matching so distinct foods are marked missing', () => {
      const pantryWithCollisions: Ingredient[] = [
        {
          id: '1',
          name: 'milk',
          quantity: 2000,
          unit: 'ml',
          category: 'dairy',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        {
          id: '2',
          name: 'potato',
          quantity: 5,
          unit: 'kg',
          category: 'produce',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        {
          id: '3',
          name: 'apple',
          quantity: 10,
          unit: 'unidad',
          category: 'fruit',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        {
          id: '4',
          name: 'tomato sauce',
          quantity: 500,
          unit: 'g',
          category: 'condiment',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ];

      const recipeWithDistinctFoods: GeneratedRecipe = {
        name: 'Exotic Vegan Dish',
        description: 'Specific distinct ingredients',
        cookingTimeMinutes: 25,
        servings: 2,
        difficulty: 'facil',
        ingredients: [
          { name: 'almond milk', quantity: 200, unit: 'ml' }, // Must NOT match milk
          { name: 'sweet potato', quantity: 500, unit: 'g' }, // Must NOT match potato
          { name: 'pineapple', quantity: 1, unit: 'unidad' }, // Must NOT match apple
          { name: 'soy sauce', quantity: 30, unit: 'ml' }, // Must NOT match tomato sauce
        ],
        instructions: ['Prepare exotic dish'],
      };

      const result = matchRecipeWithPantry(recipeWithDistinctFoods, pantryWithCollisions);

      expect(result.availableIngredients).toHaveLength(0);
      expect(result.missingIngredients).toHaveLength(4);

      // All 4 distinct foods are missing, cost calculated conservatively:
      // almond milk (5000) + sweet potato (5000) + pineapple (5000) + soy sauce (3000) = 18000
      expect(estimateMissingIngredientsCost(result.missingIngredients)).toBe(18000);
    });

    it('isRecipeIngredientAvailable single-check works correctly across languages', () => {
      const pantry: Ingredient[] = [
        {
          id: 'p1',
          name: 'pollo',
          quantity: 1,
          unit: 'kg',
          category: 'protein',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ];

      expect(
        isRecipeIngredientAvailable({ name: 'chicken', quantity: 500, unit: 'g' }, pantry),
      ).toBe(true);

      expect(
        isRecipeIngredientAvailable({ name: 'chicken', quantity: 1500, unit: 'g' }, pantry),
      ).toBe(false);

      expect(
        isRecipeIngredientAvailable({ name: 'fish', quantity: 200, unit: 'g' }, pantry),
      ).toBe(false);
    });
  });
});
