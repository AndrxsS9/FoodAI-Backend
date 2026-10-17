import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  matchRecipeWithPantry,
} from '../src/services/recipes/pantryMatcher.service';

import type {
  GeneratedRecipe,
} from '../src/schemas/recipe.schema';

import type {
  Ingredient,
} from '../src/schemas/ingredient.schema';

function buildRecipe(
  ingredients: GeneratedRecipe['ingredients'],
  overrides?: Partial<GeneratedRecipe>,
): GeneratedRecipe {
  return {
    name: 'Receta de prueba',
    description: 'Descripción para pruebas unitarias',
    totalMinutes: 30,
    steps: [
      'Paso 1: Preparar ingredientes',
      'Paso 2: Cocinar',
    ],
    ingredients,
    ...overrides,
  };
}

function buildPantryIngredient(
  name: string,
  overrides?: Partial<Ingredient>,
): Ingredient {
  return {
    name,
    quantity: 1,
    unit: 'unidad',
    needsReview: false,
    ...overrides,
  };
}

describe('pantryMatcher.service - matchRecipeWithPantry', () => {
  it('1. Coincidencia exacta: debe detectar ingrediente disponible cuando el nombre es idéntico', () => {
    const recipe = buildRecipe([
      { name: 'arroz', quantity: 200, unit: 'g' },
    ]);
    const pantry = [
      buildPantryIngredient('arroz', { quantity: 500, unit: 'g' }),
    ];

    const result = matchRecipeWithPantry(recipe, pantry);

    expect(result.availableIngredients).toHaveLength(1);
    expect(result.availableIngredients[0].name).toBe('arroz');
    expect(result.missingIngredients).toHaveLength(0);
  });

  it('2. Mayúsculas y minúsculas: debe coincidir independientemente del uso de mayúsculas', () => {
    const recipe = buildRecipe([
      { name: 'Tomate', quantity: 2, unit: 'unidad' },
    ]);
    const pantry = [
      buildPantryIngredient('tomate', { quantity: 4, unit: 'unidad' }),
    ];

    const result = matchRecipeWithPantry(recipe, pantry);

    expect(result.availableIngredients).toHaveLength(1);
    expect(result.availableIngredients[0].name).toBe('Tomate');
    expect(result.missingIngredients).toHaveLength(0);
  });

  it('3. Normalización de tildes: debe coincidir ignorando acentos y tildes en los nombres', () => {
    const recipe = buildRecipe([
      { name: 'plátano', quantity: 2, unit: 'unidad' },
      { name: 'oregano', quantity: 5, unit: 'g' },
      { name: 'limón', quantity: 1, unit: 'unidad' },
    ]);
    const pantry = [
      buildPantryIngredient('platano'),
      buildPantryIngredient('orégano'),
      buildPantryIngredient('limon'),
    ];

    const result = matchRecipeWithPantry(recipe, pantry);

    expect(result.availableIngredients).toHaveLength(3);
    expect(
      result.availableIngredients.map((i) => i.name),
    ).toEqual(['plátano', 'oregano', 'limón']);
    expect(result.missingIngredients).toHaveLength(0);
  });

  it('4. Espacios adicionales: debe coincidir ignorando espacios iniciales, finales y múltiples', () => {
    const recipe = buildRecipe([
      { name: '  tomate   rojo ', quantity: 3, unit: 'unidad' },
    ]);
    const pantry = [
      buildPantryIngredient('tomate rojo'),
    ];

    const result = matchRecipeWithPantry(recipe, pantry);

    expect(result.availableIngredients).toHaveLength(1);
    expect(result.availableIngredients[0].name).toBe('  tomate   rojo ');
    expect(result.missingIngredients).toHaveLength(0);
  });

  it('5. Signos o puntuación: debe coincidir ignorando signos de puntuación y símbolos', () => {
    const recipe = buildRecipe([
      { name: 'cebolla (blanca)!', quantity: 1, unit: 'unidad' },
      { name: 'pimienta, negra', quantity: 2, unit: 'g' },
    ]);
    const pantry = [
      buildPantryIngredient('cebolla blanca'),
      buildPantryIngredient('pimienta negra'),
    ];

    const result = matchRecipeWithPantry(recipe, pantry);

    expect(result.availableIngredients).toHaveLength(2);
    expect(result.missingIngredients).toHaveLength(0);
  });

  it('6. Coincidencia parcial (despensa en receta): receta "pechuga de pollo" con despensa "pollo"', () => {
    const recipe = buildRecipe([
      { name: 'pechuga de pollo', quantity: 500, unit: 'g' },
    ]);
    const pantry = [
      buildPantryIngredient('pollo'),
    ];

    const result = matchRecipeWithPantry(recipe, pantry);

    expect(result.availableIngredients).toHaveLength(1);
    expect(result.availableIngredients[0].name).toBe('pechuga de pollo');
    expect(result.missingIngredients).toHaveLength(0);
  });

  it('7. Coincidencia parcial inversa (receta en despensa): receta "tomate" con despensa "tomate rojo"', () => {
    const recipe = buildRecipe([
      { name: 'tomate', quantity: 2, unit: 'unidad' },
    ]);
    const pantry = [
      buildPantryIngredient('tomate rojo'),
    ];

    const result = matchRecipeWithPantry(recipe, pantry);

    expect(result.availableIngredients).toHaveLength(1);
    expect(result.availableIngredients[0].name).toBe('tomate');
    expect(result.missingIngredients).toHaveLength(0);
  });

  it('8. Ingrediente inexistente: debe clasificar en missingIngredients cuando no existe en despensa', () => {
    const recipe = buildRecipe([
      { name: 'trufa negra', quantity: 10, unit: 'g' },
    ]);
    const pantry = [
      buildPantryIngredient('arroz'),
      buildPantryIngredient('pollo'),
    ];

    const result = matchRecipeWithPantry(recipe, pantry);

    expect(result.availableIngredients).toHaveLength(0);
    expect(result.missingIngredients).toHaveLength(1);
    expect(result.missingIngredients[0].name).toBe('trufa negra');
  });

  it('9. Mezcla de ingredientes: clasificar correctamente ingredientes disponibles y faltantes', () => {
    const recipe = buildRecipe([
      { name: 'arroz', quantity: 200, unit: 'g' },
      { name: 'pollo', quantity: 300, unit: 'g' },
      { name: 'zanahoria', quantity: 2, unit: 'unidad' },
      { name: 'sal', quantity: null, unit: 'desconocida' },
    ]);
    const pantry = [
      buildPantryIngredient('arroz'),
      buildPantryIngredient('zanahoria'),
    ];

    const result = matchRecipeWithPantry(recipe, pantry);

    expect(result.availableIngredients).toHaveLength(2);
    expect(
      result.availableIngredients.map((i) => i.name),
    ).toEqual(['arroz', 'zanahoria']);
    expect(result.missingIngredients).toHaveLength(2);
    expect(
      result.missingIngredients.map((i) => i.name),
    ).toEqual(['pollo', 'sal']);
  });

  it('10. Despensa vacía: todos los ingredientes de la receta deben quedar como faltantes', () => {
    const recipe = buildRecipe([
      { name: 'huevo', quantity: 2, unit: 'unidad' },
      { name: 'leche', quantity: 250, unit: 'ml' },
    ]);
    const pantry: Ingredient[] = [];

    const result = matchRecipeWithPantry(recipe, pantry);

    expect(result.availableIngredients).toHaveLength(0);
    expect(result.missingIngredients).toHaveLength(2);
    expect(
      result.missingIngredients.map((i) => i.name),
    ).toEqual(['huevo', 'leche']);
  });

  it('11. Conservar objetos completos: conservar quantity y unit de los ingredientes de receta', () => {
    const recipeIngredients: GeneratedRecipe['ingredients'] = [
      { name: 'harina de trigo', quantity: 500, unit: 'g' },
      { name: 'levadura fresca', quantity: 25, unit: 'g' },
      { name: 'aceite de oliva', quantity: 30, unit: 'ml' },
      { name: 'sal marina', quantity: null, unit: 'desconocida' },
    ];
    const recipe = buildRecipe(recipeIngredients);
    const pantry = [
      buildPantryIngredient('harina'),
      buildPantryIngredient('aceite de oliva'),
    ];

    const result = matchRecipeWithPantry(recipe, pantry);

    expect(result.availableIngredients).toEqual([
      { name: 'harina de trigo', quantity: 500, unit: 'g' },
      { name: 'aceite de oliva', quantity: 30, unit: 'ml' },
    ]);
    expect(result.missingIngredients).toEqual([
      { name: 'levadura fresca', quantity: 25, unit: 'g' },
      { name: 'sal marina', quantity: null, unit: 'desconocida' },
    ]);
  });

  it('12. Inmutabilidad: no debe modificar los datos originales de recipe ni pantry', () => {
    const recipe: GeneratedRecipe = buildRecipe([
      { name: 'tomate', quantity: 2, unit: 'unidad' },
      { name: 'cebolla', quantity: 1, unit: 'unidad' },
    ]);
    const pantry: Ingredient[] = [
      buildPantryIngredient('tomate', { quantity: 5, unit: 'unidad' }),
    ];

    const recipeClone = structuredClone(recipe);
    const pantryClone = structuredClone(pantry);

    matchRecipeWithPantry(recipe, pantry);

    expect(recipe).toEqual(recipeClone);
    expect(pantry).toEqual(pantryClone);
  });

  describe('Prevención de falsos positivos y coincidencia por secuencias contiguas de palabras', () => {
    it('1. "sal" NO debe coincidir con "salsa"', () => {
      const recipe = buildRecipe([
        { name: 'sal', quantity: null, unit: 'desconocida' },
      ]);
      const pantry = [buildPantryIngredient('salsa')];

      const result = matchRecipeWithPantry(recipe, pantry);

      expect(result.availableIngredients).toHaveLength(0);
      expect(result.missingIngredients).toHaveLength(1);
      expect(result.missingIngredients[0].name).toBe('sal');
    });

    it('2. "pan" NO debe coincidir con "panela"', () => {
      const recipe = buildRecipe([
        { name: 'pan', quantity: 2, unit: 'unidad' },
      ]);
      const pantry = [buildPantryIngredient('panela')];

      const result = matchRecipeWithPantry(recipe, pantry);

      expect(result.availableIngredients).toHaveLength(0);
      expect(result.missingIngredients).toHaveLength(1);
      expect(result.missingIngredients[0].name).toBe('pan');
    });

    it('3. "ajo" NO debe coincidir con "bajo"', () => {
      const recipe = buildRecipe([
        { name: 'ajo', quantity: 1, unit: 'unidad' },
      ]);
      const pantry = [buildPantryIngredient('bajo')];

      const result = matchRecipeWithPantry(recipe, pantry);

      expect(result.availableIngredients).toHaveLength(0);
      expect(result.missingIngredients).toHaveLength(1);
      expect(result.missingIngredients[0].name).toBe('ajo');
    });

    it('4. "arroz" NO debe coincidir con "arrozado"', () => {
      const recipe = buildRecipe([
        { name: 'arroz', quantity: 200, unit: 'g' },
      ]);
      const pantry = [buildPantryIngredient('arrozado')];

      const result = matchRecipeWithPantry(recipe, pantry);

      expect(result.availableIngredients).toHaveLength(0);
      expect(result.missingIngredients).toHaveLength(1);
      expect(result.missingIngredients[0].name).toBe('arroz');
    });

    it('5. "pollo" SÍ debe coincidir con "pechuga de pollo"', () => {
      const recipe = buildRecipe([
        { name: 'pollo', quantity: 300, unit: 'g' },
      ]);
      const pantry = [buildPantryIngredient('pechuga de pollo')];

      const result = matchRecipeWithPantry(recipe, pantry);

      expect(result.availableIngredients).toHaveLength(1);
      expect(result.availableIngredients[0].name).toBe('pollo');
      expect(result.missingIngredients).toHaveLength(0);
    });

    it('6. "tomate" SÍ debe coincidir con "tomate rojo"', () => {
      const recipe = buildRecipe([
        { name: 'tomate', quantity: 2, unit: 'unidad' },
      ]);
      const pantry = [buildPantryIngredient('tomate rojo')];

      const result = matchRecipeWithPantry(recipe, pantry);

      expect(result.availableIngredients).toHaveLength(1);
      expect(result.availableIngredients[0].name).toBe('tomate');
      expect(result.missingIngredients).toHaveLength(0);
    });

    it('7. "ajo" SÍ debe coincidir con "ajo en polvo"', () => {
      const recipe = buildRecipe([
        { name: 'ajo', quantity: 1, unit: 'cucharadita' },
      ]);
      const pantry = [buildPantryIngredient('ajo en polvo')];

      const result = matchRecipeWithPantry(recipe, pantry);

      expect(result.availableIngredients).toHaveLength(1);
      expect(result.availableIngredients[0].name).toBe('ajo');
      expect(result.missingIngredients).toHaveLength(0);
    });

    it('8. "carne de res" SÍ debe coincidir con "carne de res magra"', () => {
      const recipe = buildRecipe([
        { name: 'carne de res', quantity: 400, unit: 'g' },
      ]);
      const pantry = [buildPantryIngredient('carne de res magra')];

      const result = matchRecipeWithPantry(recipe, pantry);

      expect(result.availableIngredients).toHaveLength(1);
      expect(result.availableIngredients[0].name).toBe('carne de res');
      expect(result.missingIngredients).toHaveLength(0);
    });

    it('9. Dirección inversa: receta "tomate rojo" con despensa "tomate" debe coincidir', () => {
      const recipe = buildRecipe([
        { name: 'tomate rojo', quantity: 3, unit: 'unidad' },
      ]);
      const pantry = [buildPantryIngredient('tomate')];

      const result = matchRecipeWithPantry(recipe, pantry);

      expect(result.availableIngredients).toHaveLength(1);
      expect(result.availableIngredients[0].name).toBe('tomate rojo');
      expect(result.missingIngredients).toHaveLength(0);
    });

    it('10. Dos nombres completamente distintos se clasifican como faltantes', () => {
      const recipe = buildRecipe([
        { name: 'zanahoria', quantity: 2, unit: 'unidad' },
      ]);
      const pantry = [
        buildPantryIngredient('arroz'),
        buildPantryIngredient('pollo'),
      ];

      const result = matchRecipeWithPantry(recipe, pantry);

      expect(result.availableIngredients).toHaveLength(0);
      expect(result.missingIngredients).toHaveLength(1);
      expect(result.missingIngredients[0].name).toBe('zanahoria');
    });

    it('11. Receta con mezcla de coincidencia exacta, frase contigua y faltante', () => {
      const recipe = buildRecipe([
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'pechuga de pollo', quantity: 300, unit: 'g' },
        { name: 'salsa de soja', quantity: 15, unit: 'ml' },
      ]);
      const pantry = [
        buildPantryIngredient('arroz'),
        buildPantryIngredient('pollo'),
        buildPantryIngredient('sal'), // 'sal' no debe hacer match con 'salsa de soja'
      ];

      const result = matchRecipeWithPantry(recipe, pantry);

      expect(result.availableIngredients).toHaveLength(2);
      expect(result.availableIngredients.map((i) => i.name)).toEqual([
        'arroz',
        'pechuga de pollo',
      ]);
      expect(result.missingIngredients).toHaveLength(1);
      expect(result.missingIngredients[0].name).toBe('salsa de soja');
    });

    it('12. Mantener inmutabilidad de recipe y pantry con comparación de frases', () => {
      const recipe = buildRecipe([
        { name: 'carne de res magra', quantity: 500, unit: 'g' },
        { name: 'salsa', quantity: 30, unit: 'ml' },
      ]);
      const pantry = [
        buildPantryIngredient('carne de res'),
        buildPantryIngredient('sal'),
      ];

      const recipeClone = structuredClone(recipe);
      const pantryClone = structuredClone(pantry);

      matchRecipeWithPantry(recipe, pantry);

      expect(recipe).toEqual(recipeClone);
      expect(pantry).toEqual(pantryClone);
    });
  });
});
