import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  singularizeIngredientName,
} from '../src/utils/ingredientPlural';

describe('ingredientPlural utility - singularizeIngredientName', () => {
  it('1. tomates → tomate', () => {
    expect(singularizeIngredientName('tomates')).toBe('tomate');
  });

  it('2. papas → papa', () => {
    expect(singularizeIngredientName('papas')).toBe('papa');
  });

  it('3. patatas → patata', () => {
    expect(singularizeIngredientName('patatas')).toBe('patata');
  });

  it('4. huevos → huevo', () => {
    expect(singularizeIngredientName('huevos')).toBe('huevo');
  });

  it('5. zanahorias → zanahoria', () => {
    expect(singularizeIngredientName('zanahorias')).toBe(
      'zanahoria',
    );
  });

  it('6. cebollas → cebolla', () => {
    expect(singularizeIngredientName('cebollas')).toBe(
      'cebolla',
    );
  });

  it('7. aguacates → aguacate', () => {
    expect(singularizeIngredientName('aguacates')).toBe(
      'aguacate',
    );
  });

  it('8. paltas → palta', () => {
    expect(singularizeIngredientName('paltas')).toBe('palta');
  });

  it('9. plátanos → platano', () => {
    expect(singularizeIngredientName('plátanos')).toBe(
      'platano',
    );
  });

  it('10. limones → limon', () => {
    expect(singularizeIngredientName('limones')).toBe('limon');
  });

  it('11. dientes de ajo → diente de ajo', () => {
    expect(
      singularizeIngredientName('dientes de ajo'),
    ).toBe('diente de ajo');
  });

  it('12. cebollas de rama → cebolla de rama', () => {
    expect(
      singularizeIngredientName('cebollas de rama'),
    ).toBe('cebolla de rama');
  });

  it('13. cebollas largas → cebolla larga', () => {
    expect(
      singularizeIngredientName('cebollas largas'),
    ).toBe('cebolla larga');
  });

  it('14. singular conocido permanece igual', () => {
    expect(singularizeIngredientName('tomate')).toBe('tomate');
    expect(singularizeIngredientName('huevo')).toBe('huevo');
    expect(singularizeIngredientName('cebolla larga')).toBe(
      'cebolla larga',
    );
  });

  it('15. nombre desconocido permanece normalizado sin modificación morfológica', () => {
    expect(singularizeIngredientName('panes')).toBe('panes');
    expect(singularizeIngredientName('arroces')).toBe('arroces');
    expect(singularizeIngredientName('trufas')).toBe('trufas');
  });

  it('16. mayúsculas, tildes y espacios se normalizan correctamente', () => {
    expect(singularizeIngredientName('  TOMATES  ')).toBe(
      'tomate',
    );
    expect(singularizeIngredientName('Plátanos')).toBe(
      'platano',
    );
    expect(singularizeIngredientName('LIMONES')).toBe('limon');
    expect(
      singularizeIngredientName('  Dientes (de) Ajo! '),
    ).toBe('diente de ajo');
  });

  it('17. string vacío permanece vacío', () => {
    expect(singularizeIngredientName('')).toBe('');
    expect(singularizeIngredientName('   ')).toBe('');
  });

  it('18. no genera pluralizaciones inventadas ni muta datos', () => {
    const input = '  Tomates Rojos ';
    const originalInput = input;

    const result = singularizeIngredientName(input);

    expect(input).toBe(originalInput);
    expect(result).toBe('tomates rojos');
  });
});
