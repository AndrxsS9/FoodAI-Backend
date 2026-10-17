import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  estimateIngredientCost,
  estimateMissingIngredientsCost,
} from '../src/services/pricing/ingredientPrice.service';

import type {
  RecipeIngredient,
} from '../src/schemas/recipe.schema';

function buildIngredient(
  name: string,
  quantity: number | null = 1,
  unit: RecipeIngredient['unit'] = 'unidad',
): RecipeIngredient {
  return {
    name,
    quantity,
    unit,
  };
}

describe('ingredientPrice.service', () => {
  describe('estimateIngredientCost', () => {
    it('1. Precio de ingrediente conocido por nombre principal: tomate → 1500', () => {
      const ingredient = buildIngredient('tomate');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(1500);
    });

    it('2. Precio de otro ingrediente conocido con costo diferente: pollo → 9000', () => {
      const ingredient = buildIngredient('pollo');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(9000);
    });

    it('3. Alias de ingrediente: pechuga de pollo → 9000', () => {
      const ingredient = buildIngredient('pechuga de pollo');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(9000);
    });

    it('4. Otro alias del catálogo: espagueti y spaghetti → 3500', () => {
      const espagueti = buildIngredient('espagueti');
      const spaghetti = buildIngredient('spaghetti');

      expect(estimateIngredientCost(espagueti)).toBe(3500);
      expect(estimateIngredientCost(spaghetti)).toBe(3500);
    });

    it('5. Mayúsculas y minúsculas: Tomate → 1500', () => {
      const ingredient = buildIngredient('Tomate');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(1500);
    });

    it('6. Normalización de tildes: azúcar y azucar producen el mismo precio (3500)', () => {
      const conTilde = buildIngredient('azúcar');
      const sinTilde = buildIngredient('azucar');

      expect(estimateIngredientCost(conTilde)).toBe(3500);
      expect(estimateIngredientCost(sinTilde)).toBe(3500);
    });

    it('7. Espacios iniciales, finales o múltiples: normaliza correctamente a su precio', () => {
      const ingredient = buildIngredient('   tomate    rojo   ');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(1500);
    });

    it('8. Puntuación y signos eliminados por normalización: encuentra alias correspondiente', () => {
      const conSignos = buildIngredient('cebolla (blanca)!');

      const cost = estimateIngredientCost(conSignos);

      expect(cost).toBe(1500);
    });

    it('9. Ingrediente desconocido: utiliza fallback actual de 5000', () => {
      const ingredient = buildIngredient('trufa negra');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(5000);
    });

    it('14. Quantity y unit no alteran el precio actual (MVP por ingrediente de compra)', () => {
      const ing1 = buildIngredient('tomate', 1, 'unidad');
      const ing2 = buildIngredient('tomate', 100, 'kg');
      const ing3 = buildIngredient('tomate', null, 'desconocida');

      expect(estimateIngredientCost(ing1)).toBe(1500);
      expect(estimateIngredientCost(ing2)).toBe(1500);
      expect(estimateIngredientCost(ing3)).toBe(1500);
    });

    it('15a. Inmutabilidad en estimateIngredientCost: no modifica el objeto recibido', () => {
      const ingredient = buildIngredient('tomate', 2, 'unidad');
      const copy = structuredClone(ingredient);

      estimateIngredientCost(ingredient);

      expect(ingredient).toEqual(copy);
    });
  });

  describe('estimateMissingIngredientsCost', () => {
    it('10. Varios ingredientes conocidos: calcula la suma exacta (tomate + huevo + arroz = 5800)', () => {
      const ingredients = [
        buildIngredient('tomate'),
        buildIngredient('huevo'),
        buildIngredient('arroz'),
      ];

      const total = estimateMissingIngredientsCost(ingredients);

      // 1500 + 800 + 3500 = 5800
      expect(total).toBe(5800);
    });

    it('11. Mezcla de conocidos y desconocidos: desconocido aporta el fallback de 5000', () => {
      const ingredients = [
        buildIngredient('pollo'),
        buildIngredient('trufa negra'),
      ];

      const total = estimateMissingIngredientsCost(ingredients);

      // 9000 + 5000 = 14000
      expect(total).toBe(14000);
    });

    it('12. Lista vacía de ingredientes: retorna 0', () => {
      const total = estimateMissingIngredientsCost([]);

      expect(total).toBe(0);
    });

    it('13. Ingredientes repetidos: suma cada elemento recibido según el comportamiento actual', () => {
      const ingredients = [
        buildIngredient('tomate'),
        buildIngredient('tomate'),
      ];

      const total = estimateMissingIngredientsCost(ingredients);

      // 1500 + 1500 = 3000
      expect(total).toBe(3000);
    });

    it('15b. Inmutabilidad en estimateMissingIngredientsCost: no modifica el arreglo ni los objetos', () => {
      const ingredients = [
        buildIngredient('tomate', 2, 'unidad'),
        buildIngredient('pollo', 500, 'g'),
      ];
      const copy = structuredClone(ingredients);

      estimateMissingIngredientsCost(ingredients);

      expect(ingredients).toEqual(copy);
    });
  });
});
