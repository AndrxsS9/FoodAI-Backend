import { describe, expect, it } from 'vitest';

import {
  canonicalizeIngredientName,
  isCanonicalIngredient,
} from '../src/utils/ingredientAliases';
import { prepareIngredientName } from '../src/utils/ingredientIdentity';
import { singularizeIngredientName } from '../src/utils/ingredientPlural';
import {
  ingredientNamesMatch,
  matchRecipeWithPantry,
} from '../src/services/recipes/pantryMatcher.service';
import type { GeneratedRecipe } from '../src/schemas/recipe.schema';
import type { Ingredient } from '../src/schemas/ingredient.schema';

function buildRecipe(
  ingredients: GeneratedRecipe['ingredients'],
): GeneratedRecipe {
  return {
    name: 'Receta de prueba bilingüe',
    description: 'Descripción de prueba',
    totalMinutes: 30,
    steps: ['Paso 1'],
    ingredients,
  };
}

function buildPantryIngredient(
  name: string,
  quantity = 1000,
  unit: Ingredient['unit'] = 'g',
): Ingredient {
  return {
    name,
    quantity,
    unit,
    needsReview: false,
  };
}

describe('Fase 28C-B1.2 — Identidad de Ingredientes Bilingüe Segura', () => {
  describe('1. Normalización, plurales y canonicalización de equivalencias en inglés', () => {
    it('leche / milk', () => {
      expect(prepareIngredientName('milk')).toBe('leche');
      expect(prepareIngredientName('MILK')).toBe('leche');
      expect(prepareIngredientName('whole milk')).toBe('leche');
      expect(prepareIngredientName('leche')).toBe('leche');
    });

    it('leche de almendras / almond milk', () => {
      expect(prepareIngredientName('almond milk')).toBe('leche de almendras');
      expect(prepareIngredientName('leche de almendras')).toBe('leche de almendras');
      expect(prepareIngredientName('leche de almendra')).toBe('leche de almendras');
    });

    it('arroz / rice', () => {
      expect(prepareIngredientName('rice')).toBe('arroz');
      expect(prepareIngredientName('white rice')).toBe('arroz');
      expect(prepareIngredientName('arroz blanco')).toBe('arroz');
      expect(prepareIngredientName('arroz')).toBe('arroz');
    });

    it('pollo / chicken', () => {
      expect(prepareIngredientName('chicken')).toBe('pollo');
      expect(prepareIngredientName('chickens')).toBe('pollo');
      expect(prepareIngredientName('chicken breast')).toBe('pollo');
      expect(prepareIngredientName('chicken thigh')).toBe('pollo');
      expect(prepareIngredientName('pechuga de pollo')).toBe('pollo');
    });

    it('papa / potato', () => {
      expect(prepareIngredientName('potato')).toBe('papa');
      expect(prepareIngredientName('potatoes')).toBe('papa');
      expect(prepareIngredientName('patata')).toBe('papa');
      expect(prepareIngredientName('patatas')).toBe('papa');
      expect(prepareIngredientName('papas')).toBe('papa');
    });

    it('batata / sweet potato', () => {
      expect(prepareIngredientName('sweet potato')).toBe('batata');
      expect(prepareIngredientName('sweet potatoes')).toBe('batata');
      expect(prepareIngredientName('batatas')).toBe('batata');
      expect(prepareIngredientName('camote')).toBe('batata');
      expect(prepareIngredientName('papa dulce')).toBe('batata');
    });

    it('manzana / apple', () => {
      expect(prepareIngredientName('apple')).toBe('manzana');
      expect(prepareIngredientName('apples')).toBe('manzana');
      expect(prepareIngredientName('manzanas')).toBe('manzana');
    });

    it('piña / pineapple', () => {
      expect(prepareIngredientName('pineapple')).toBe('pina');
      expect(prepareIngredientName('pineapples')).toBe('pina');
      expect(prepareIngredientName('piña')).toBe('pina');
      expect(prepareIngredientName('piñas')).toBe('pina');
      expect(prepareIngredientName('pina')).toBe('pina');
    });

    it('salsa de soya / soy sauce', () => {
      expect(prepareIngredientName('soy sauce')).toBe('salsa de soya');
      expect(prepareIngredientName('soya sauce')).toBe('salsa de soya');
      expect(prepareIngredientName('salsa de soja')).toBe('salsa de soya');
      expect(prepareIngredientName('salsa de soya')).toBe('salsa de soya');
    });

    it('salsa de tomate / tomato sauce', () => {
      expect(prepareIngredientName('tomato sauce')).toBe('salsa de tomate');
      expect(prepareIngredientName('salsa de tomate')).toBe('salsa de tomate');
    });
  });

  describe('2. Coincidencia positiva bilingüe en despensa (ambas direcciones)', () => {
    const pairs: [string, string][] = [
      ['leche', 'milk'],
      ['leche de almendras', 'almond milk'],
      ['arroz', 'rice'],
      ['pollo', 'chicken'],
      ['papa', 'potato'],
      ['batata', 'sweet potato'],
      ['manzana', 'apple'],
      ['piña', 'pineapple'],
      ['salsa de soya', 'soy sauce'],
    ];

    for (const [es, en] of pairs) {
      it(`coincide en ambas direcciones: ${es} ↔ ${en}`, () => {
        expect(ingredientNamesMatch(es, en)).toBe(true);
        expect(ingredientNamesMatch(en, es)).toBe(true);
      });
    }

    it('coincide receta en inglés con despensa en español usando matchRecipeWithPantry', () => {
      const recipe = buildRecipe([
        { name: 'rice', quantity: 200, unit: 'g' },
        { name: 'chicken', quantity: 300, unit: 'g' },
        { name: 'milk', quantity: 250, unit: 'ml' },
      ]);
      const pantry = [
        buildPantryIngredient('arroz', 500, 'g'),
        buildPantryIngredient('pollo', 1000, 'g'),
        buildPantryIngredient('leche', 1, 'l'),
      ];

      const result = matchRecipeWithPantry(recipe, pantry);
      expect(result.availableIngredients).toHaveLength(3);
      expect(result.missingIngredients).toHaveLength(0);
      // Preserva los nombres originales de la receta en inglés
      expect(result.availableIngredients.map((i) => i.name)).toEqual([
        'rice',
        'chicken',
        'milk',
      ]);
    });

    it('coincide receta en español con despensa en inglés usando matchRecipeWithPantry', () => {
      const recipe = buildRecipe([
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'papa', quantity: 2, unit: 'unidad' },
        { name: 'manzana', quantity: 1, unit: 'unidad' },
      ]);
      const pantry = [
        buildPantryIngredient('rice', 500, 'g'),
        buildPantryIngredient('potatoes', 5, 'unidad'),
        buildPantryIngredient('apples', 3, 'unidad'),
      ];

      const result = matchRecipeWithPantry(recipe, pantry);
      expect(result.availableIngredients).toHaveLength(3);
      expect(result.missingIngredients).toHaveLength(0);
      expect(result.availableIngredients.map((i) => i.name)).toEqual([
        'arroz',
        'papa',
        'manzana',
      ]);
    });
  });

  describe('3. Prevención estricta de colisiones entre alimentos distintos (Negative Matching)', () => {
    describe('A. milk != almond milk (leche != leche de almendras)', () => {
      it('milk NO coincide con almond milk', () => {
        expect(ingredientNamesMatch('milk', 'almond milk')).toBe(false);
        expect(ingredientNamesMatch('almond milk', 'milk')).toBe(false);
      });

      it('leche NO coincide con leche de almendras', () => {
        expect(ingredientNamesMatch('leche', 'leche de almendras')).toBe(false);
        expect(ingredientNamesMatch('leche de almendras', 'leche')).toBe(false);
      });

      it('milk NO coincide con leche de almendras fresca', () => {
        expect(ingredientNamesMatch('milk', 'leche de almendras fresca')).toBe(false);
        expect(ingredientNamesMatch('leche de almendras fresca', 'milk')).toBe(false);
      });

      it('en matchRecipeWithPantry: receta con milk y despensa con almond milk queda faltante', () => {
        const recipe = buildRecipe([
          { name: 'milk', quantity: 500, unit: 'ml' },
        ]);
        const pantry = [
          buildPantryIngredient('almond milk', 1000, 'ml'),
        ];
        const result = matchRecipeWithPantry(recipe, pantry);
        expect(result.availableIngredients).toHaveLength(0);
        expect(result.missingIngredients).toHaveLength(1);
        expect(result.missingIngredients[0].name).toBe('milk');
      });
    });

    describe('B. potato != sweet potato (papa != batata)', () => {
      it('potato NO coincide con sweet potato', () => {
        expect(ingredientNamesMatch('potato', 'sweet potato')).toBe(false);
        expect(ingredientNamesMatch('sweet potato', 'potato')).toBe(false);
      });

      it('papa NO coincide con sweet potato / batata / camote', () => {
        expect(ingredientNamesMatch('papa', 'sweet potato')).toBe(false);
        expect(ingredientNamesMatch('papa', 'batata')).toBe(false);
        expect(ingredientNamesMatch('papa', 'camote')).toBe(false);
        expect(ingredientNamesMatch('sweet potato', 'papa')).toBe(false);
      });

      it('en matchRecipeWithPantry: receta con potato y despensa con sweet potato queda faltante', () => {
        const recipe = buildRecipe([
          { name: 'potato', quantity: 2, unit: 'unidad' },
        ]);
        const pantry = [
          buildPantryIngredient('sweet potato', 4, 'unidad'),
        ];
        const result = matchRecipeWithPantry(recipe, pantry);
        expect(result.availableIngredients).toHaveLength(0);
        expect(result.missingIngredients).toHaveLength(1);
        expect(result.missingIngredients[0].name).toBe('potato');
      });
    });

    describe('C. apple != pineapple (manzana != piña)', () => {
      it('apple NO coincide con pineapple', () => {
        expect(ingredientNamesMatch('apple', 'pineapple')).toBe(false);
        expect(ingredientNamesMatch('pineapple', 'apple')).toBe(false);
      });

      it('manzana NO coincide con piña / pineapple', () => {
        expect(ingredientNamesMatch('manzana', 'piña')).toBe(false);
        expect(ingredientNamesMatch('manzana', 'pineapple')).toBe(false);
        expect(ingredientNamesMatch('pineapple', 'manzana')).toBe(false);
      });

      it('no realiza coincidencias inseguras por substring (apple dentro de pineapple)', () => {
        expect('pineapple'.includes('apple')).toBe(true); // prueba de substring inseguro
        expect(ingredientNamesMatch('apple', 'pineapple')).toBe(false); // FoodAI lo rechaza de forma segura
      });

      it('en matchRecipeWithPantry: receta con apple y despensa con pineapple queda faltante', () => {
        const recipe = buildRecipe([
          { name: 'apple', quantity: 2, unit: 'unidad' },
        ]);
        const pantry = [
          buildPantryIngredient('pineapple', 2, 'unidad'),
        ];
        const result = matchRecipeWithPantry(recipe, pantry);
        expect(result.availableIngredients).toHaveLength(0);
        expect(result.missingIngredients).toHaveLength(1);
        expect(result.missingIngredients[0].name).toBe('apple');
      });
    });

    describe('D. soy sauce != tomato sauce (salsa de soya != salsa de tomate)', () => {
      it('soy sauce NO coincide con tomato sauce', () => {
        expect(ingredientNamesMatch('soy sauce', 'tomato sauce')).toBe(false);
        expect(ingredientNamesMatch('tomato sauce', 'soy sauce')).toBe(false);
      });

      it('salsa de soya NO coincide con salsa de tomate', () => {
        expect(ingredientNamesMatch('salsa de soya', 'salsa de tomate')).toBe(false);
        expect(ingredientNamesMatch('salsa de tomate', 'salsa de soya')).toBe(false);
        expect(ingredientNamesMatch('salsa de soja', 'tomato sauce')).toBe(false);
      });

      it('en matchRecipeWithPantry: receta con soy sauce y despensa con tomato sauce queda faltante', () => {
        const recipe = buildRecipe([
          { name: 'soy sauce', quantity: 20, unit: 'ml' },
        ]);
        const pantry = [
          buildPantryIngredient('tomato sauce', 200, 'g'),
        ];
        const result = matchRecipeWithPantry(recipe, pantry);
        expect(result.availableIngredients).toHaveLength(0);
        expect(result.missingIngredients).toHaveLength(1);
        expect(result.missingIngredients[0].name).toBe('soy sauce');
      });
    });

    describe('E. Otras distinciones canónicas críticas', () => {
      it('papa común NO coincide con papa criolla', () => {
        expect(ingredientNamesMatch('papa', 'papa criolla')).toBe(false);
        expect(ingredientNamesMatch('potato', 'papa criolla')).toBe(false);
        expect(ingredientNamesMatch('papa criolla', 'potato')).toBe(false);
      });

      it('cebolla común NO coincide con cebolla larga', () => {
        expect(ingredientNamesMatch('cebolla', 'cebolla larga')).toBe(false);
        expect(ingredientNamesMatch('cebolla larga', 'cebolla')).toBe(false);
      });
    });
  });

  describe('4. Inmutabilidad y preservación de nombres originales y contratos', () => {
    it('no muta las cadenas ni objetos originales de receta y despensa', () => {
      const originalRecipeName = '  Fresh Sweet Potato! ';
      const originalPantryName = '  Almond Milk (Unsweetened) ';
      const recipe = buildRecipe([
        { name: originalRecipeName, quantity: 1, unit: 'unidad' },
      ]);
      const pantry = [
        buildPantryIngredient(originalPantryName, 500, 'ml'),
      ];

      const recipeClone = JSON.parse(JSON.stringify(recipe));
      const pantryClone = JSON.parse(JSON.stringify(pantry));

      matchRecipeWithPantry(recipe, pantry);

      expect(recipe).toEqual(recipeClone);
      expect(pantry).toEqual(pantryClone);
    });

    it('alimentos desconocidos permanecen conservadores (sin matches forzados)', () => {
      expect(ingredientNamesMatch('dragonfruit', 'apple')).toBe(false);
      expect(ingredientNamesMatch('tofu', 'queso')).toBe(false);
      expect(ingredientNamesMatch('almond flour', 'harina')).toBe(false);
    });
  });
});
