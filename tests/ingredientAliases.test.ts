import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  canonicalizeIngredientName,
} from '../src/utils/ingredientAliases';

describe('ingredientAliases utility - canonicalizeIngredientName', () => {
  it('1. papa → papa', () => {
    expect(canonicalizeIngredientName('papa')).toBe('papa');
  });

  it('2. patata → papa', () => {
    expect(canonicalizeIngredientName('patata')).toBe('papa');
  });

  it('3. cebolla larga → cebolla larga', () => {
    expect(
      canonicalizeIngredientName('cebolla larga'),
    ).toBe('cebolla larga');
  });

  it('4. cebolla de rama → cebolla larga', () => {
    expect(
      canonicalizeIngredientName('cebolla de rama'),
    ).toBe('cebolla larga');
  });

  it('5. espagueti → espagueti', () => {
    expect(canonicalizeIngredientName('espagueti')).toBe(
      'espagueti',
    );
  });

  it('6. spaghetti → espagueti', () => {
    expect(canonicalizeIngredientName('spaghetti')).toBe(
      'espagueti',
    );
  });

  it('7. aguacate → aguacate', () => {
    expect(canonicalizeIngredientName('aguacate')).toBe(
      'aguacate',
    );
  });

  it('8. palta → aguacate', () => {
    expect(canonicalizeIngredientName('palta')).toBe(
      'aguacate',
    );
  });

  it('9. maíz → maiz', () => {
    expect(canonicalizeIngredientName('maíz')).toBe('maiz');
  });

  it('10. choclo → maiz', () => {
    expect(canonicalizeIngredientName('choclo')).toBe('maiz');
  });

  it('11. mayúsculas y tildes se normalizan y canonicalizan correctamente', () => {
    expect(canonicalizeIngredientName('PATATA')).toBe('papa');
    expect(canonicalizeIngredientName('Chóclo')).toBe('maiz');
    expect(canonicalizeIngredientName('  Pálta! ')).toBe(
      'aguacate',
    );
    expect(canonicalizeIngredientName('Spaghetti')).toBe(
      'espagueti',
    );
    expect(
      canonicalizeIngredientName('Cebolla De Rama'),
    ).toBe('cebolla larga');
  });

  it('12. ingrediente sin alias conserva su nombre normalizado', () => {
    expect(canonicalizeIngredientName('zanahoria')).toBe(
      'zanahoria',
    );
    expect(
      canonicalizeIngredientName('  Zanahoria   roja! '),
    ).toBe('zanahoria roja');
    expect(canonicalizeIngredientName('Peperoni')).toBe(
      'peperoni',
    );
  });

  it('13. string vacío permanece vacío', () => {
    expect(canonicalizeIngredientName('')).toBe('');
    expect(canonicalizeIngredientName('   ')).toBe('');
  });

  it('14. no muta ningún dato externo ni su argumento', () => {
    const input = '  Patata Fresca! ';
    const originalInput = input;

    const result = canonicalizeIngredientName(input);

    expect(input).toBe(originalInput);
    expect(result).toBe('patata fresca');
  });
});
