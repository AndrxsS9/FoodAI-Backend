import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  compareIngredientQuantities,
  normalizeIngredientQuantity,
} from '../src/utils/ingredientQuantity';

describe('ingredientQuantity utility - normalizeIngredientQuantity', () => {
  // Masa
  it('1. 500 g → 500 g', () => {
    expect(normalizeIngredientQuantity(500, 'g')).toEqual({
      quantity: 500,
      unit: 'g',
    });
  });

  it('2. 0.5 kg → 500 g', () => {
    expect(normalizeIngredientQuantity(0.5, 'kg')).toEqual({
      quantity: 500,
      unit: 'g',
    });
  });

  it('3. 1 kg → 1000 g', () => {
    expect(normalizeIngredientQuantity(1, 'kg')).toEqual({
      quantity: 1000,
      unit: 'g',
    });
  });

  it('4. 1.25 kg → 1250 g', () => {
    expect(normalizeIngredientQuantity(1.25, 'kg')).toEqual({
      quantity: 1250,
      unit: 'g',
    });
  });

  // Volumen
  it('5. 250 ml → 250 ml', () => {
    expect(normalizeIngredientQuantity(250, 'ml')).toEqual({
      quantity: 250,
      unit: 'ml',
    });
  });

  it('6. 0.5 l → 500 ml', () => {
    expect(normalizeIngredientQuantity(0.5, 'l')).toEqual({
      quantity: 500,
      unit: 'ml',
    });
  });

  it('7. 1 l → 1000 ml', () => {
    expect(normalizeIngredientQuantity(1, 'l')).toEqual({
      quantity: 1000,
      unit: 'ml',
    });
  });

  it('8. 1.5 l → 1500 ml', () => {
    expect(normalizeIngredientQuantity(1.5, 'l')).toEqual({
      quantity: 1500,
      unit: 'ml',
    });
  });

  // Unidades
  it('9. 3 unidad → 3 unidad', () => {
    expect(normalizeIngredientQuantity(3, 'unidad')).toEqual({
      quantity: 3,
      unit: 'unidad',
    });
  });

  // Robustez de cantidades inválidas
  it('10. quantity null → null', () => {
    expect(normalizeIngredientQuantity(null, 'g')).toBeNull();
  });

  // Unidades no convertibles deliberadamente
  it('11. desconocida → null', () => {
    expect(normalizeIngredientQuantity(1, 'desconocida')).toBeNull();
  });

  it('12. cucharada → null', () => {
    expect(normalizeIngredientQuantity(1, 'cucharada')).toBeNull();
  });

  it('13. cucharadita → null', () => {
    expect(normalizeIngredientQuantity(1, 'cucharadita')).toBeNull();
  });

  it('14. taza → null', () => {
    expect(normalizeIngredientQuantity(2, 'taza')).toBeNull();
  });

  // Más casos de robustez numérica
  it('15. quantity 0 → null', () => {
    expect(normalizeIngredientQuantity(0, 'g')).toBeNull();
    expect(normalizeIngredientQuantity(0, 'ml')).toBeNull();
    expect(normalizeIngredientQuantity(0, 'unidad')).toBeNull();
  });

  it('16. quantity negativa → null', () => {
    expect(normalizeIngredientQuantity(-1, 'g')).toBeNull();
    expect(normalizeIngredientQuantity(-0.5, 'kg')).toBeNull();
  });

  it('17. NaN → null', () => {
    expect(normalizeIngredientQuantity(NaN, 'g')).toBeNull();
  });

  it('18. Infinity → null', () => {
    expect(normalizeIngredientQuantity(Infinity, 'g')).toBeNull();
  });

  it('19. -Infinity → null', () => {
    expect(normalizeIngredientQuantity(-Infinity, 'g')).toBeNull();
  });

  // Inmutabilidad
  it('20. no mutar argumentos/objetos externos usados en las pruebas', () => {
    const input = { quantity: 500, unit: 'g' as const };
    const frozenInput = Object.freeze({ quantity: 500, unit: 'g' as const });

    const result = normalizeIngredientQuantity(input.quantity, input.unit);
    const frozenResult = normalizeIngredientQuantity(frozenInput.quantity, frozenInput.unit);

    expect(input.quantity).toBe(500);
    expect(input.unit).toBe('g');
    expect(result).toEqual({ quantity: 500, unit: 'g' });
    expect(frozenResult).toEqual({ quantity: 500, unit: 'g' });
  });

  // Precisión decimal sin redondeos arbitrarios
  it('21. decimales en masa: 0.125 kg → 125 g', () => {
    expect(normalizeIngredientQuantity(0.125, 'kg')).toEqual({
      quantity: 125,
      unit: 'g',
    });
  });

  it('22. decimales en volumen: 0.333 l → 333 ml', () => {
    expect(normalizeIngredientQuantity(0.333, 'l')).toEqual({
      quantity: 333,
      unit: 'ml',
    });
  });

  // Casos adicionales de seguridad
  it('23. quantity undefined → null', () => {
    expect(normalizeIngredientQuantity(undefined, 'g')).toBeNull();
  });

  it('24. unit no soportada, vacía, null o undefined → null', () => {
    expect(normalizeIngredientQuantity(100, null)).toBeNull();
    expect(normalizeIngredientQuantity(100, undefined)).toBeNull();
    expect(normalizeIngredientQuantity(100, '')).toBeNull();
    expect(normalizeIngredientQuantity(100, 'gramos')).toBeNull();
    expect(normalizeIngredientQuantity(100, 'piezas')).toBeNull();
  });
});

describe('ingredientQuantity utility - compareIngredientQuantities', () => {
  // Masa
  it('1. 500 g vs 300 g → sufficient', () => {
    expect(compareIngredientQuantities(500, 'g', 300, 'g')).toBe('sufficient');
  });

  it('2. 500 g vs 500 g → sufficient', () => {
    expect(compareIngredientQuantities(500, 'g', 500, 'g')).toBe('sufficient');
  });

  it('3. 300 g vs 500 g → insufficient', () => {
    expect(compareIngredientQuantities(300, 'g', 500, 'g')).toBe('insufficient');
  });

  it('4. 1 kg vs 500 g → sufficient', () => {
    expect(compareIngredientQuantities(1, 'kg', 500, 'g')).toBe('sufficient');
  });

  it('5. 0.25 kg vs 500 g → insufficient', () => {
    expect(compareIngredientQuantities(0.25, 'kg', 500, 'g')).toBe('insufficient');
  });

  it('6. 500 g vs 0.5 kg → sufficient', () => {
    expect(compareIngredientQuantities(500, 'g', 0.5, 'kg')).toBe('sufficient');
  });

  // Volumen
  it('7. 1500 ml vs 1 l → sufficient', () => {
    expect(compareIngredientQuantities(1500, 'ml', 1, 'l')).toBe('sufficient');
  });

  it('8. 500 ml vs 1 l → insufficient', () => {
    expect(compareIngredientQuantities(500, 'ml', 1, 'l')).toBe('insufficient');
  });

  it('9. 2 l vs 1500 ml → sufficient', () => {
    expect(compareIngredientQuantities(2, 'l', 1500, 'ml')).toBe('sufficient');
  });

  // Conteo
  it('10. 3 unidad vs 2 unidad → sufficient', () => {
    expect(compareIngredientQuantities(3, 'unidad', 2, 'unidad')).toBe('sufficient');
  });

  it('11. 1 unidad vs 2 unidad → insufficient', () => {
    expect(compareIngredientQuantities(1, 'unidad', 2, 'unidad')).toBe('insufficient');
  });

  // Casos unknown por valores nulos / inválidos
  it('12. available quantity null → unknown', () => {
    expect(compareIngredientQuantities(null, 'g', 500, 'g')).toBe('unknown');
  });

  it('13. required quantity null → unknown', () => {
    expect(compareIngredientQuantities(500, 'g', null, 'g')).toBe('unknown');
  });

  it('14. available desconocida → unknown', () => {
    expect(compareIngredientQuantities(500, 'desconocida', 500, 'g')).toBe('unknown');
  });

  it('15. required desconocida → unknown', () => {
    expect(compareIngredientQuantities(500, 'g', 500, 'desconocida')).toBe('unknown');
  });

  // Unidades de cocina
  it('16. taza → unknown', () => {
    expect(compareIngredientQuantities(2, 'taza', 500, 'g')).toBe('unknown');
    expect(compareIngredientQuantities(500, 'g', 2, 'taza')).toBe('unknown');
  });

  it('17. cucharada → unknown', () => {
    expect(compareIngredientQuantities(1, 'cucharada', 15, 'ml')).toBe('unknown');
    expect(compareIngredientQuantities(15, 'ml', 1, 'cucharada')).toBe('unknown');
  });

  it('18. cucharadita → unknown', () => {
    expect(compareIngredientQuantities(1, 'cucharadita', 5, 'ml')).toBe('unknown');
    expect(compareIngredientQuantities(5, 'ml', 1, 'cucharadita')).toBe('unknown');
  });

  // Familias incompatibles (sin asunción de densidades)
  it('19. g vs ml → unknown', () => {
    expect(compareIngredientQuantities(500, 'g', 250, 'ml')).toBe('unknown');
    expect(compareIngredientQuantities(250, 'ml', 500, 'g')).toBe('unknown');
  });

  it('20. kg vs l → unknown', () => {
    expect(compareIngredientQuantities(1, 'kg', 1, 'l')).toBe('unknown');
    expect(compareIngredientQuantities(1, 'l', 1, 'kg')).toBe('unknown');
  });

  it('21. unidad vs g → unknown', () => {
    expect(compareIngredientQuantities(3, 'unidad', 500, 'g')).toBe('unknown');
    expect(compareIngredientQuantities(500, 'g', 3, 'unidad')).toBe('unknown');
  });

  it('22. unidad vs ml → unknown', () => {
    expect(compareIngredientQuantities(3, 'unidad', 250, 'ml')).toBe('unknown');
    expect(compareIngredientQuantities(250, 'ml', 3, 'unidad')).toBe('unknown');
  });

  // NaN / Infinity
  it('23. NaN/Infinity en cualquiera de los lados → unknown', () => {
    expect(compareIngredientQuantities(NaN, 'g', 500, 'g')).toBe('unknown');
    expect(compareIngredientQuantities(500, 'g', NaN, 'g')).toBe('unknown');
    expect(compareIngredientQuantities(Infinity, 'g', 500, 'g')).toBe('unknown');
    expect(compareIngredientQuantities(500, 'g', Infinity, 'g')).toBe('unknown');
    expect(compareIngredientQuantities(-Infinity, 'g', 500, 'g')).toBe('unknown');
    expect(compareIngredientQuantities(500, 'g', -Infinity, 'g')).toBe('unknown');
  });

  // Precisión decimal sin redondeo artificial
  it('24. precisión decimal sin redondeo artificial', () => {
    expect(compareIngredientQuantities(499.999, 'g', 500, 'g')).toBe('insufficient');
    expect(compareIngredientQuantities(500.001, 'g', 500, 'g')).toBe('sufficient');
    expect(compareIngredientQuantities(0.4999, 'kg', 500, 'g')).toBe('insufficient');
    expect(compareIngredientQuantities(0.5001, 'kg', 500, 'g')).toBe('sufficient');
  });

  // No mutar datos externos
  it('25. no mutar datos externos', () => {
    const available = { quantity: 1, unit: 'kg' as const };
    const required = { quantity: 500, unit: 'g' as const };
    const frozenAvailable = Object.freeze({ quantity: 1, unit: 'kg' as const });
    const frozenRequired = Object.freeze({ quantity: 500, unit: 'g' as const });

    const result = compareIngredientQuantities(
      available.quantity,
      available.unit,
      required.quantity,
      required.unit,
    );
    const frozenResult = compareIngredientQuantities(
      frozenAvailable.quantity,
      frozenAvailable.unit,
      frozenRequired.quantity,
      frozenRequired.unit,
    );

    expect(available.quantity).toBe(1);
    expect(available.unit).toBe('kg');
    expect(required.quantity).toBe(500);
    expect(required.unit).toBe('g');
    expect(result).toBe('sufficient');
    expect(frozenResult).toBe('sufficient');
  });
});
