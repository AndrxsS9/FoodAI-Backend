import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  prepareIngredientName,
} from '../src/utils/ingredientIdentity';

describe('ingredientIdentity utility - prepareIngredientName', () => {
  it('1. normalización y singularización de plural conocido: tomates → tomate', () => {
    expect(prepareIngredientName('  Tomates! ')).toBe(
      'tomate',
    );
  });

  it('2. normalización y canonicalización de alias conocido: patata → papa', () => {
    expect(prepareIngredientName('Patata')).toBe('papa');
  });

  it('3. composición completa: singularización + alias (patatas → papa)', () => {
    expect(prepareIngredientName('patatas')).toBe('papa');
  });

  it('4. frase plural + alias: cebollas de rama → cebolla larga', () => {
    expect(
      prepareIngredientName('Cebollas De Rama'),
    ).toBe('cebolla larga');
  });

  it('5. plural + alias: paltas → aguacate', () => {
    expect(prepareIngredientName('paltas')).toBe('aguacate');
  });

  it('6. ingrediente regular sin alias ni plural conserva nombre normalizado: zanahoria', () => {
    expect(prepareIngredientName('  Zanahoria  ')).toBe(
      'zanahoria',
    );
  });

  it('7. plural no catalogado permanece sin cambios morfológicos: panes', () => {
    expect(prepareIngredientName('panes')).toBe('panes');
  });

  it('8. string vacío devuelve string vacío', () => {
    expect(prepareIngredientName('')).toBe('');
    expect(prepareIngredientName('   ')).toBe('');
  });

  it('9. no muta datos de entrada', () => {
    const input = '  Patatas ';
    const originalInput = input;

    const result = prepareIngredientName(input);

    expect(input).toBe(originalInput);
    expect(result).toBe('papa');
  });
});
