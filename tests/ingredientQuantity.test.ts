import {
  describe,
  expect,
  it,
} from 'vitest';

import {
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
