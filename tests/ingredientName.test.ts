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

  describe('separación de palabras mediante signos y puntuación', () => {
    it('13. guion como separador de palabras: "tomate-rojo" → "tomate rojo"', () => {
      expect(normalizeIngredientName('tomate-rojo')).toBe('tomate rojo');
    });

    it('14. barra como separador de palabras: "cebolla/ajo" → "cebolla ajo"', () => {
      expect(normalizeIngredientName('cebolla/ajo')).toBe('cebolla ajo');
    });

    it('15. coma sin espacio como separador: "sal,pimienta" → "sal pimienta"', () => {
      expect(normalizeIngredientName('sal,pimienta')).toBe('sal pimienta');
    });

    it('16. múltiples guiones en frase: "carne-de-res" → "carne de res"', () => {
      expect(normalizeIngredientName('carne-de-res')).toBe('carne de res');
    });

    it('17. combinación de signos, tildes y mayúsculas: "  Tomáte---Rojo!! " → "tomate rojo"', () => {
      expect(normalizeIngredientName('  Tomáte---Rojo!! ')).toBe('tomate rojo');
    });

    it('18. múltiples signos diferentes consecutivos no generan múltiples espacios', () => {
      expect(
        normalizeIngredientName('pollo_/*-&%arroz'),
      ).toBe('pollo arroz');
      expect(
        normalizeIngredientName('...---sal,,,pimienta!?!?'),
      ).toBe('sal pimienta');
    });

    it('19. los números siguen conservándose entre signos o palabras', () => {
      expect(normalizeIngredientName('harina-000')).toBe('harina 000');
      expect(normalizeIngredientName('leche 2%')).toBe('leche 2');
      expect(normalizeIngredientName('arroz-1/2-taza')).toBe('arroz 1 2 taza');
    });

    it('20. string vacío o compuesto únicamente de signos devuelve string vacío', () => {
      expect(normalizeIngredientName('')).toBe('');
      expect(normalizeIngredientName('   ')).toBe('');
      expect(normalizeIngredientName('---/,,;!!??')).toBe('');
    });
  });
});
