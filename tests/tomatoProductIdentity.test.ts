import { describe, expect, it } from 'vitest';

import {
  estimateIngredientCost,
  findPriceRule,
  UNKNOWN_INGREDIENT_CONSUMPTION_COST,
  UNKNOWN_INGREDIENT_ESTIMATED_COST,
} from '../src/services/pricing/ingredientPrice.service';
import {
  ingredientNamesMatch,
  isRecipeIngredientAvailable,
} from '../src/services/recipes/pantryMatcher.service';
import { prepareIngredientName } from '../src/utils/ingredientIdentity';
import type { Ingredient } from '../src/schemas/ingredient.schema';

function pantryItem(name: string): Ingredient {
  return { name, quantity: 1000, unit: 'g', needsReview: false };
}

describe('Fase 28C-B1 — Identidad distinta de salsa, pasta y puré de tomate', () => {
  describe('Positivos: equivalencias seguras se conservan', () => {
    it('salsa de tomate / tomato sauce comparten identidad y precio del catálogo', () => {
      expect(prepareIngredientName('tomato sauce')).toBe('salsa de tomate');
      expect(prepareIngredientName('salsa de tomate')).toBe('salsa de tomate');

      const ruleEs = findPriceRule('salsa de tomate');
      const ruleEn = findPriceRule('tomato sauce');
      expect(ruleEs?.id).toBe('salsa_tomate');
      expect(ruleEn?.id).toBe('salsa_tomate');
      expect(ruleEn?.estimatedPurchasePrice).toBe(3500);
      expect(ruleEn?.estimatedConsumptionPrice).toBe(800);
    });

    it('pasta de tomate / tomato paste comparten identidad propia', () => {
      expect(prepareIngredientName('tomato paste')).toBe('pasta de tomate');
      expect(prepareIngredientName('pasta de tomate')).toBe('pasta de tomate');
      expect(ingredientNamesMatch('tomato paste', 'pasta de tomate')).toBe(true);
    });

    it('puré de tomate / tomato puree comparten identidad propia', () => {
      expect(prepareIngredientName('puré de tomate')).toBe('pure de tomate');
      expect(prepareIngredientName('tomato purée')).toBe('pure de tomate');
      expect(ingredientNamesMatch('tomato puree', 'puré de tomate')).toBe(true);
    });

    it('variantes descriptivas del mismo producto siguen coincidiendo en despensa', () => {
      expect(ingredientNamesMatch('pasta de tomate', 'pasta de tomate concentrada')).toBe(true);
      expect(ingredientNamesMatch('pure de tomate', 'pure de tomate natural')).toBe(true);
    });

    it('comportamiento existente de tomate fresco y ketchup se conserva', () => {
      expect(findPriceRule('tomate')?.id).toBe('tomate');
      expect(findPriceRule('tomate chonto')?.id).toBe('tomate');
      expect(findPriceRule('ketchup')?.id).toBe('salsa_tomate');
      expect(ingredientNamesMatch('tomate', 'tomate rojo')).toBe(true);
    });
  });

  describe('Negativos: equivalencias inseguras se bloquean en despensa', () => {
    it('pasta de tomate no equivale a salsa de tomate', () => {
      expect(prepareIngredientName('tomato paste')).not.toBe('salsa de tomate');
      expect(ingredientNamesMatch('pasta de tomate', 'salsa de tomate')).toBe(false);
      expect(ingredientNamesMatch('tomato paste', 'tomato sauce')).toBe(false);
      expect(ingredientNamesMatch('tomato paste', 'salsa de tomate')).toBe(false);
    });

    it('puré de tomate no equivale a pasta de tomate, salsa de tomate ni ketchup', () => {
      expect(ingredientNamesMatch('pure de tomate', 'pasta de tomate')).toBe(false);
      expect(ingredientNamesMatch('tomato puree', 'tomato paste')).toBe(false);
      expect(ingredientNamesMatch('pure de tomate', 'salsa de tomate')).toBe(false);
      expect(ingredientNamesMatch('pure de tomate', 'ketchup')).toBe(false);
    });

    it('pasta y puré de tomate no equivalen a tomate fresco', () => {
      expect(ingredientNamesMatch('pasta de tomate', 'tomate')).toBe(false);
      expect(ingredientNamesMatch('tomato paste', 'tomate')).toBe(false);
      expect(ingredientNamesMatch('pure de tomate', 'tomate')).toBe(false);
      expect(ingredientNamesMatch('pasta de tomate concentrada', 'tomate')).toBe(false);
    });

    it('pasta de tomate no equivale a pasta alimenticia ni puré a un puré genérico', () => {
      expect(ingredientNamesMatch('pasta de tomate', 'pasta')).toBe(false);
      expect(ingredientNamesMatch('pasta', 'pasta de tomate')).toBe(false);
      expect(ingredientNamesMatch('pure de tomate', 'pure')).toBe(false);
    });

    it('la despensa con salsa de tomate no satisface una receta con pasta de tomate', () => {
      const pantry = [pantryItem('salsa de tomate'), pantryItem('tomate'), pantryItem('pasta')];
      expect(
        isRecipeIngredientAvailable({ name: 'tomato paste', quantity: 50, unit: 'g' }, pantry),
      ).toBe(false);
      expect(
        isRecipeIngredientAvailable({ name: 'pure de tomate', quantity: 50, unit: 'g' }, pantry),
      ).toBe(false);
    });
  });

  describe('Negativos: sin precio dedicado se usa el fallback conservador', () => {
    const processedTomatoNames = [
      'pasta de tomate',
      'tomato paste',
      'pasta de tomate concentrada',
      'pure de tomate',
      'puré de tomate',
      'tomato puree',
    ];

    it.each(processedTomatoNames)('"%s" no se cotiza como salsa, tomate ni pasta', (name) => {
      expect(findPriceRule(name)).toBeUndefined();
      expect(
        estimateIngredientCost({ name, quantity: 100, unit: 'g' }, { mode: 'purchase' }),
      ).toBe(UNKNOWN_INGREDIENT_ESTIMATED_COST);
      expect(
        estimateIngredientCost({ name, quantity: 100, unit: 'g' }, { mode: 'consumption' }),
      ).toBe(UNKNOWN_INGREDIENT_CONSUMPTION_COST);
    });

    it('pasta alimenticia conserva su regla de precio', () => {
      expect(findPriceRule('pasta')?.id).toBe('pasta');
    });
  });
});
