import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  normalizeIngredientName,
} from '../src/utils/ingredientName';

describe('ingredientName utility - normalizeIngredientName', () => {
  it('1. convierte mayúsculas a minúsculas', () => {
    expect(normalizeIngredientName('TOMATE')).toBe('tomate');
  });

  it('2. elimina tildes y diacríticos', () => {
    expect(
      normalizeIngredientName('plátano orégano limón'),
    ).toBe('platano oregano limon');
  });

  it('3. elimina signos de puntuación', () => {
    expect(
      normalizeIngredientName('tomate, cebolla; ajo.'),
    ).toBe('tomate cebolla ajo');
  });

  it('4. elimina símbolos especiales', () => {
    expect(
      normalizeIngredientName('aceite & vinagre (extra) *virgen*'),
    ).toBe('aceite vinagre extra virgen');
  });

  it('5. elimina espacios iniciales y finales', () => {
    expect(normalizeIngredientName('   arroz   ')).toBe('arroz');
  });

  it('6. colapsa espacios múltiples intermedios', () => {
    expect(
      normalizeIngredientName('pechuga    de     pollo'),
    ).toBe('pechuga de pollo');
  });

  it('7. conserva números', () => {
    expect(normalizeIngredientName('harina 000')).toBe('harina 000');
  });

  it('8. conserva palabras separadas correctamente', () => {
    expect(
      normalizeIngredientName('aceite de oliva'),
    ).toBe('aceite de oliva');
  });

  it('9. procesa un string ya normalizado sin alterarlo', () => {
    expect(normalizeIngredientName('tomate rojo')).toBe('tomate rojo');
  });

  it('10. maneja string vacío devolviendo string vacío', () => {
    expect(normalizeIngredientName('')).toBe('');
  });

  it('11. caso compuesto: "  Tomáte,   Rojo! " → "tomate rojo"', () => {
    expect(
      normalizeIngredientName('  Tomáte,   Rojo! '),
    ).toBe('tomate rojo');
  });

  it('12. otro caso con acentos y puntuación combinados', () => {
    expect(
      normalizeIngredientName('  ¡¿Pechúga... (de)   Póllo?!  '),
    ).toBe('pechuga de pollo');
  });
});
