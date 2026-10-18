import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('../src/services/gemini/recipe.service', () => ({
  generateRecipeRecommendations: vi.fn(),
}));

import {
  generateRecipeRecommendations,
} from '../src/services/gemini/recipe.service';

import {
  buildRecipeRecommendations,
} from '../src/services/recipes/recommendation.service';

import type {
  GeneratedRecipe,
  RecipeRecommendationRequest,
} from '../src/schemas/recipe.schema';

import type {
  Ingredient,
} from '../src/schemas/ingredient.schema';

const mockedGenerateRecipeRecommendations = vi.mocked(
  generateRecipeRecommendations,
);

function buildPantryIngredient(
  name: string,
  overrides?: Partial<Ingredient>,
): Ingredient {
  return {
    name,
    quantity: 10,
    unit: 'unidad',
    needsReview: false,
    ...overrides,
  };
}

function buildGeneratedRecipe(
  name: string,
  ingredients: GeneratedRecipe['ingredients'],
  overrides?: Partial<GeneratedRecipe>,
): GeneratedRecipe {
  return {
    name,
    description: `Descripción para ${name}`,
    totalMinutes: 30,
    steps: [
      'Paso 1: Preparar ingredientes',
      'Paso 2: Cocinar',
    ],
    ingredients,
    ...overrides,
  };
}

function buildRequest(
  pantry: Ingredient[],
  overrides?: Partial<RecipeRecommendationRequest>,
): RecipeRecommendationRequest {
  return {
    pantry,
    budget: 20000,
    servings: 2,
    maxMinutes: 60,
    ...overrides,
  };
}

describe('recommendation.service - buildRecipeRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Construir recomendación con todos los ingredientes disponibles', async () => {
    const pantry = [
      buildPantryIngredient('arroz', { quantity: 500, unit: 'g' }),
      buildPantryIngredient('huevo', { quantity: 6, unit: 'unidad' }),
    ];
    const request = buildRequest(pantry, { budget: 20000 });

    const candidateRecipe = buildGeneratedRecipe(
      'Arroz con huevo',
      [
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'huevo', quantity: 2, unit: 'unidad' },
      ],
    );

    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [candidateRecipe],
    });

    const response = await buildRecipeRecommendations(request);

    expect(response.recipes).toHaveLength(1);
    const [rec] = response.recipes;
    expect(rec.availableIngredients).toHaveLength(2);
    expect(rec.missingIngredients).toHaveLength(0);
    expect(rec.estimatedMissingCost).toBe(0);
    expect(rec.withinBudget).toBe(true);
    expect(rec.budgetRemaining).toBe(20000);
    expect(rec.convenience).toBe(95);
    expect(rec.reason).toBe(
      'Aprovecha casi por completo los ingredientes disponibles y no requiere compras estimadas.',
    );
  });

  it('2. Receta con mezcla de ingredientes disponibles y faltantes', async () => {
    const pantry = [
      buildPantryIngredient('arroz', { quantity: 500, unit: 'g' }),
    ];
    const request = buildRequest(pantry, { budget: 10000 });

    const candidateRecipe = buildGeneratedRecipe(
      'Arroz con tomate',
      [
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'tomate', quantity: 2, unit: 'unidad' },
      ],
    );

    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [candidateRecipe],
    });

    const response = await buildRecipeRecommendations(request);

    expect(response.recipes).toHaveLength(1);
    const [rec] = response.recipes;
    expect(rec.availableIngredients.map((i) => i.name)).toEqual(['arroz']);
    expect(rec.missingIngredients.map((i) => i.name)).toEqual(['tomate']);
    // Tomate en catálogo cuesta 1500
    expect(rec.estimatedMissingCost).toBe(1500);
    expect(rec.budgetRemaining).toBe(8500);
    expect(rec.withinBudget).toBe(true);
    // pantryScore: 0.5 (0.35), budgetScore: 1 - 1500/10000 = 0.85 (0.255) -> 0.605 -> 61
    expect(rec.convenience).toBe(61);
  });

  it('3. Receta cuyo costo faltante supera el presupuesto', async () => {
    const pantry = [
      buildPantryIngredient('arroz', { quantity: 500, unit: 'g' }),
    ];
    const request = buildRequest(pantry, { budget: 5000 });

    const candidateRecipe = buildGeneratedRecipe(
      'Arroz con carne',
      [
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'carne', quantity: 250, unit: 'g' },
      ],
    );

    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [candidateRecipe],
    });

    const response = await buildRecipeRecommendations(request);

    const [rec] = response.recipes;
    // Carne en catálogo cuesta 12000
    expect(rec.estimatedMissingCost).toBe(12000);
    expect(rec.withinBudget).toBe(false);
    expect(rec.budgetRemaining).toBe(-7000);
    expect(rec.reason).toBe(
      'Requiere compras adicionales que superan el presupuesto estimado.',
    );
  });

  it('4. Ordenamiento por mayor conveniencia', async () => {
    const pantry = [
      buildPantryIngredient('arroz'),
      buildPantryIngredient('huevo'),
    ];
    const request = buildRequest(pantry, { budget: 20000 });

    const altaConveniencia = buildGeneratedRecipe(
      'Alta Conveniencia',
      [
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'huevo', quantity: 2, unit: 'unidad' },
      ],
    );

    const bajaConveniencia = buildGeneratedRecipe(
      'Baja Conveniencia',
      [
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'carne', quantity: 250, unit: 'g' },
      ],
    );

    // Mockeamos en orden inverso para comprobar el ordenamiento
    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [bajaConveniencia, altaConveniencia],
    });

    const response = await buildRecipeRecommendations(request);

    expect(response.recipes[0].name).toBe('Alta Conveniencia');
    expect(response.recipes[1].name).toBe('Baja Conveniencia');
    expect(response.recipes[0].convenience).toBeGreaterThan(
      response.recipes[1].convenience,
    );
  });

  it('5. Desempate por menor costo faltante con igual conveniencia', async () => {
    const pantry = [
      buildPantryIngredient('huevo'),
    ];
    // Presupuesto 1000: ambas recetas superan el presupuesto y tienen budgetScore = 0
    const request = buildRequest(pantry, { budget: 1000 });

    // Receta A: falta arroz (costo 3500 > 1000). Total 2, disponible 1 -> score 0.5 -> conv 35
    const recetaEconomica = buildGeneratedRecipe(
      'Receta Económica',
      [
        { name: 'huevo', quantity: 2, unit: 'unidad' },
        { name: 'arroz', quantity: 200, unit: 'g' },
      ],
      { totalMinutes: 30 },
    );

    // Receta B: falta pollo (costo 9000 > 1000). Total 2, disponible 1 -> score 0.5 -> conv 35
    const recetaCostosa = buildGeneratedRecipe(
      'Receta Costosa',
      [
        { name: 'huevo', quantity: 2, unit: 'unidad' },
        { name: 'pollo', quantity: 300, unit: 'g' },
      ],
      { totalMinutes: 30 },
    );

    // Entregamos la costosa primero para verificar desempate
    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [recetaCostosa, recetaEconomica],
    });

    const response = await buildRecipeRecommendations(request);

    expect(response.recipes[0].convenience).toBe(35);
    expect(response.recipes[1].convenience).toBe(35);
    expect(response.recipes[0].name).toBe('Receta Económica');
    expect(response.recipes[1].name).toBe('Receta Costosa');
    expect(response.recipes[0].estimatedMissingCost).toBe(3500);
    expect(response.recipes[1].estimatedMissingCost).toBe(9000);
  });

  it('6. Desempate por menor tiempo de preparación ante igual conveniencia y costo faltante', async () => {
    const pantry = [
      buildPantryIngredient('arroz'),
      buildPantryIngredient('huevo'),
    ];
    const request = buildRequest(pantry, { budget: 20000 });

    const recetaRapida = buildGeneratedRecipe(
      'Receta Rápida',
      [
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'huevo', quantity: 2, unit: 'unidad' },
      ],
      { totalMinutes: 15 },
    );

    const recetaLenta = buildGeneratedRecipe(
      'Receta Lenta',
      [
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'huevo', quantity: 2, unit: 'unidad' },
      ],
      { totalMinutes: 45 },
    );

    // Mockeamos la lenta primero
    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [recetaLenta, recetaRapida],
    });

    const response = await buildRecipeRecommendations(request);

    expect(response.recipes[0].convenience).toBe(response.recipes[1].convenience);
    expect(response.recipes[0].estimatedMissingCost).toBe(
      response.recipes[1].estimatedMissingCost,
    );
    expect(response.recipes[0].name).toBe('Receta Rápida');
    expect(response.recipes[1].name).toBe('Receta Lenta');
  });

  it('7. Conservar los datos originales generados por Gemini', async () => {
    const pantry = [
      buildPantryIngredient('arroz'),
    ];
    const request = buildRequest(pantry);

    const candidateRecipe: GeneratedRecipe = {
      name: 'Arroz Salteado Especial',
      description: 'Plato tradicional con vegetales y arroz',
      totalMinutes: 25,
      ingredients: [
        { name: 'arroz', quantity: 250, unit: 'g' },
      ],
      steps: [
        'Lavar el arroz',
        'Cocinar a fuego medio durante 20 minutos',
      ],
    };

    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [candidateRecipe],
    });

    const response = await buildRecipeRecommendations(request);

    const [rec] = response.recipes;
    expect(rec.name).toBe(candidateRecipe.name);
    expect(rec.description).toBe(candidateRecipe.description);
    expect(rec.totalMinutes).toBe(candidateRecipe.totalMinutes);
    expect(rec.ingredients).toEqual(candidateRecipe.ingredients);
    expect(rec.steps).toEqual(candidateRecipe.steps);
  });

  it('8. Procesar varias recetas candidatas sin perder ninguna', async () => {
    const pantry = [
      buildPantryIngredient('arroz'),
      buildPantryIngredient('huevo'),
    ];
    const request = buildRequest(pantry);

    const recipes: GeneratedRecipe[] = [
      buildGeneratedRecipe('Receta 1', [{ name: 'arroz', quantity: 100, unit: 'g' }]),
      buildGeneratedRecipe('Receta 2', [{ name: 'huevo', quantity: 2, unit: 'unidad' }]),
      buildGeneratedRecipe('Receta 3', [{ name: 'arroz', quantity: 150, unit: 'g' }]),
    ];

    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes,
    });

    const response = await buildRecipeRecommendations(request);

    expect(response.recipes).toHaveLength(3);
    const names = response.recipes.map((r) => r.name);
    expect(names).toContain('Receta 1');
    expect(names).toContain('Receta 2');
    expect(names).toContain('Receta 3');
  });

  it('9. Respetar alias y normalización del matcher (ej. pollo ↔ pechuga de pollo)', async () => {
    const pantry = [
      buildPantryIngredient('pollo'),
    ];
    const request = buildRequest(pantry);

    const recipeWithAlias = buildGeneratedRecipe(
      'Pechuga a la plancha',
      [
        { name: 'pechuga de pollo', quantity: 300, unit: 'g' },
      ],
    );

    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [recipeWithAlias],
    });

    const response = await buildRecipeRecommendations(request);

    const [rec] = response.recipes;
    expect(rec.availableIngredients).toHaveLength(1);
    expect(rec.availableIngredients[0].name).toBe('pechuga de pollo');
    expect(rec.missingIngredients).toHaveLength(0);
  });

  it('10. Aplicar fallback de precio para ingrediente desconocido faltante (trufa negra → 5000)', async () => {
    const pantry = [
      buildPantryIngredient('arroz'),
    ];
    const request = buildRequest(pantry);

    const recipeWithUnknown = buildGeneratedRecipe(
      'Arroz con trufa',
      [
        { name: 'arroz', quantity: 200, unit: 'g' },
        { name: 'trufa negra', quantity: 20, unit: 'g' },
      ],
    );

    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [recipeWithUnknown],
    });

    const response = await buildRecipeRecommendations(request);

    const [rec] = response.recipes;
    expect(rec.missingIngredients.map((i) => i.name)).toEqual(['trufa negra']);
    expect(rec.estimatedMissingCost).toBe(5000);
  });

  it('11. No mutar el input recibido', async () => {
    const pantry = [
      buildPantryIngredient('arroz', { quantity: 200, unit: 'g' }),
    ];
    const request = buildRequest(pantry, {
      budget: 15000,
      servings: 3,
      maxMinutes: 45,
    });
    const copy = structuredClone(request);

    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [
        buildGeneratedRecipe('Receta', [{ name: 'arroz', quantity: 100, unit: 'g' }]),
      ],
    });

    await buildRecipeRecommendations(request);

    expect(request).toEqual(copy);
  });

  it('12. Verificar que generateRecipeRecommendations sea llamado exactamente una vez con el input esperado', async () => {
    const pantry = [
      buildPantryIngredient('arroz'),
    ];
    const request = buildRequest(pantry, { budget: 12000, servings: 4 });

    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [
        buildGeneratedRecipe('Receta', [{ name: 'arroz', quantity: 100, unit: 'g' }]),
      ],
    });

    await buildRecipeRecommendations(request);

    expect(mockedGenerateRecipeRecommendations).toHaveBeenCalledTimes(1);
    expect(mockedGenerateRecipeRecommendations).toHaveBeenCalledWith(request);
  });

  it('13. Procesar el máximo de 5 recetas candidatas y devolverlas ordenadas', async () => {
    const pantry = [
      buildPantryIngredient('arroz'),
      buildPantryIngredient('huevo'),
    ];
    const request = buildRequest(pantry);

    const recipes: GeneratedRecipe[] = [
      buildGeneratedRecipe('R1', [{ name: 'arroz', quantity: 100, unit: 'g' }], { totalMinutes: 10 }),
      buildGeneratedRecipe('R2', [{ name: 'huevo', quantity: 2, unit: 'unidad' }], { totalMinutes: 20 }),
      buildGeneratedRecipe('R3', [{ name: 'tomate', quantity: 2, unit: 'unidad' }], { totalMinutes: 15 }),
      buildGeneratedRecipe('R4', [{ name: 'carne', quantity: 300, unit: 'g' }], { totalMinutes: 25 }),
      buildGeneratedRecipe('R5', [{ name: 'pollo', quantity: 400, unit: 'g' }], { totalMinutes: 30 }),
    ];

    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes,
    });

    const response = await buildRecipeRecommendations(request);

    expect(response.recipes).toHaveLength(5);
    // Verificar orden descendente por conveniencia o desempates
    for (let i = 0; i < response.recipes.length - 1; i++) {
      const current = response.recipes[i];
      const next = response.recipes[i + 1];
      expect(current.convenience).toBeGreaterThanOrEqual(next.convenience);
    }
  });

  it('14. Comprobar que el resultado cumple la estructura esperada y sus campos calculados', async () => {
    const pantry = [
      buildPantryIngredient('arroz'),
    ];
    const request = buildRequest(pantry);

    mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
      recipes: [
        buildGeneratedRecipe('Receta Estructura', [
          { name: 'arroz', quantity: 200, unit: 'g' },
          { name: 'huevo', quantity: 2, unit: 'unidad' },
        ]),
      ],
    });

    const response = await buildRecipeRecommendations(request);

    expect(Array.isArray(response.recipes)).toBe(true);
    expect(response.recipes).toHaveLength(1);

    const recipe = response.recipes[0];
    expect(Array.isArray(recipe.availableIngredients)).toBe(true);
    expect(Array.isArray(recipe.missingIngredients)).toBe(true);
    expect(typeof recipe.estimatedMissingCost).toBe('number');
    expect(typeof recipe.budgetRemaining).toBe('number');
    expect(typeof recipe.withinBudget).toBe('boolean');
    expect(typeof recipe.convenience).toBe('number');
    expect(typeof recipe.reason).toBe('string');
  });

  describe('Integración con matcher mejorado (aliases, plurales y prevención de falsos positivos)', () => {
    it('15. Alias simple integrado en recomendaciones (despensa papa / receta patata)', async () => {
      const pantry = [buildPantryIngredient('papa')];
      const request = buildRequest(pantry);

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Puré de patatas', [
            { name: 'patata', quantity: 3, unit: 'unidad' },
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      expect(response.recipes).toHaveLength(1);
      const [rec] = response.recipes;
      expect(rec.availableIngredients).toHaveLength(1);
      expect(rec.availableIngredients[0].name).toBe('patata');
      expect(rec.missingIngredients).toHaveLength(0);
      expect(rec.estimatedMissingCost).toBe(0);
    });

    it('16. Alias en dirección inversa (despensa palta / receta aguacate)', async () => {
      const pantry = [buildPantryIngredient('palta')];
      const request = buildRequest(pantry);

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Guacamole', [
            { name: 'aguacate', quantity: 2, unit: 'unidad' },
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      const [rec] = response.recipes;
      expect(rec.availableIngredients).toHaveLength(1);
      expect(rec.availableIngredients[0].name).toBe('aguacate');
      expect(rec.missingIngredients).toHaveLength(0);
      expect(rec.estimatedMissingCost).toBe(0);
    });

    it('17. Singular/plural simple (despensa tomates / receta tomate)', async () => {
      const pantry = [buildPantryIngredient('tomates')];
      const request = buildRequest(pantry);

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Ensalada', [
            { name: 'tomate', quantity: 2, unit: 'unidad' },
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      const [rec] = response.recipes;
      expect(rec.availableIngredients).toHaveLength(1);
      expect(rec.availableIngredients[0].name).toBe('tomate');
      expect(rec.missingIngredients).toHaveLength(0);
      expect(rec.estimatedMissingCost).toBe(0);
    });

    it('18. Plural en la receta y singular en despensa (despensa huevo / receta huevos)', async () => {
      const pantry = [buildPantryIngredient('huevo')];
      const request = buildRequest(pantry);

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Tortilla', [
            { name: 'huevos', quantity: 3, unit: 'unidad' },
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      const [rec] = response.recipes;
      expect(rec.availableIngredients).toHaveLength(1);
      expect(rec.availableIngredients[0].name).toBe('huevos');
      expect(rec.missingIngredients).toHaveLength(0);
      expect(rec.estimatedMissingCost).toBe(0);
    });

    it('19. Singularización + alias (despensa patatas / receta papa)', async () => {
      const pantry = [buildPantryIngredient('patatas')];
      const request = buildRequest(pantry);

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Papas al horno', [
            { name: 'papa', quantity: 4, unit: 'unidad' },
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      const [rec] = response.recipes;
      expect(rec.availableIngredients).toHaveLength(1);
      expect(rec.availableIngredients[0].name).toBe('papa');
      expect(rec.missingIngredients).toHaveLength(0);
      expect(rec.estimatedMissingCost).toBe(0);
    });

    it('20. Frase plural + alias (despensa cebollas de rama / receta cebolla larga)', async () => {
      const pantry = [buildPantryIngredient('cebollas de rama')];
      const request = buildRequest(pantry);

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Guiso casero', [
            { name: 'cebolla larga', quantity: 1, unit: 'unidad' },
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      const [rec] = response.recipes;
      expect(rec.availableIngredients).toHaveLength(1);
      expect(rec.availableIngredients[0].name).toBe('cebolla larga');
      expect(rec.missingIngredients).toHaveLength(0);
      expect(rec.estimatedMissingCost).toBe(0);
    });

    it('21. Ingrediente faltante realmente distinto (despensa papa / receta aguacate)', async () => {
      const pantry = [buildPantryIngredient('papa')];
      const request = buildRequest(pantry);

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Ensalada verde', [
            { name: 'aguacate', quantity: 1, unit: 'unidad' },
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      const [rec] = response.recipes;
      expect(rec.availableIngredients).toHaveLength(0);
      expect(rec.missingIngredients).toHaveLength(1);
      expect(rec.missingIngredients[0].name).toBe('aguacate');
    });

    it('22. Protección contra falso positivo (despensa salsa / receta sal)', async () => {
      const pantry = [buildPantryIngredient('salsa')];
      const request = buildRequest(pantry);

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Receta simple', [
            { name: 'sal', quantity: null, unit: 'desconocida' },
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      const [rec] = response.recipes;
      expect(rec.availableIngredients).toHaveLength(0);
      expect(rec.missingIngredients).toHaveLength(1);
      expect(rec.missingIngredients[0].name).toBe('sal');
    });

    it('23. Otra protección contra falso positivo (despensa panela / receta pan)', async () => {
      const pantry = [buildPantryIngredient('panela')];
      const request = buildRequest(pantry);

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Tostadas', [
            { name: 'pan', quantity: 2, unit: 'unidad' },
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      const [rec] = response.recipes;
      expect(rec.availableIngredients).toHaveLength(0);
      expect(rec.missingIngredients).toHaveLength(1);
      expect(rec.missingIngredients[0].name).toBe('pan');
    });

    it('24. Recomendación con mezcla completa: exacto, alias, plural, plural + alias y faltante', async () => {
      const pantry = [
        buildPantryIngredient('arroz'),
        buildPantryIngredient('tomates'),
        buildPantryIngredient('maíz'),
        buildPantryIngredient('patatas'),
      ];
      const request = buildRequest(pantry, { budget: 20000 });

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Plato Mixto Completo', [
            { name: 'arroz', quantity: 200, unit: 'g' }, // exacto
            { name: 'tomate', quantity: 2, unit: 'unidad' }, // singular/plural
            { name: 'choclo', quantity: 1, unit: 'unidad' }, // alias (maíz)
            { name: 'papa', quantity: 2, unit: 'unidad' }, // plural + alias (patatas)
            { name: 'carne', quantity: 300, unit: 'g' }, // faltante (costo 12000)
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      const [rec] = response.recipes;
      expect(rec.availableIngredients.map((i) => i.name)).toEqual([
        'arroz',
        'tomate',
        'choclo',
        'papa',
      ]);
      expect(rec.missingIngredients.map((i) => i.name)).toEqual(['carne']);
      expect(rec.estimatedMissingCost).toBe(12000);
      expect(rec.withinBudget).toBe(true);
      expect(rec.budgetRemaining).toBe(8000);
      // pantryScore = 4/5 = 0.8, budgetScore = 1 - 12000/20000 = 0.4 -> raw = 0.8*0.7 + 0.4*0.3 = 0.68 -> 68
      expect(rec.convenience).toBe(68);
    });

    it('25. Equivalencia reconocida como disponible no genera costo faltante (papa / patata)', async () => {
      const pantry = [buildPantryIngredient('patata')];
      const request = buildRequest(pantry, { budget: 10000 });

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Papas cocidas', [
            { name: 'papa', quantity: 3, unit: 'unidad' },
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      const [rec] = response.recipes;
      expect(rec.estimatedMissingCost).toBe(0);
      expect(rec.budgetRemaining).toBe(10000);
      expect(rec.withinBudget).toBe(true);
    });

    it('26. Falsos positivos rechazados generan costo faltante de compra (salsa vs sal)', async () => {
      const pantry = [buildPantryIngredient('salsa')];
      const request = buildRequest(pantry, { budget: 10000 });

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Receta con sal', [
            { name: 'sal', quantity: 10, unit: 'g' },
          ]),
        ],
      });

      const response = await buildRecipeRecommendations(request);

      const [rec] = response.recipes;
      expect(rec.missingIngredients).toHaveLength(1);
      expect(rec.missingIngredients[0].name).toBe('sal');
      // Sal en catálogo de precios cuesta 1500
      expect(rec.estimatedMissingCost).toBe(1500);
      expect(rec.budgetRemaining).toBe(8500);
    });

    it('27. Confirmar que el input no se muta en escenarios con aliases y plurales', async () => {
      const pantry = [
        buildPantryIngredient('patatas', { quantity: 2, unit: 'unidad' }),
        buildPantryIngredient('tomates', { quantity: 4, unit: 'unidad' }),
      ];
      const request = buildRequest(pantry, {
        budget: 15000,
        servings: 3,
        maxMinutes: 45,
      });
      const copy = structuredClone(request);

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Sopa', [
            { name: 'papa', quantity: 2, unit: 'unidad' },
            { name: 'tomate', quantity: 2, unit: 'unidad' },
          ]),
        ],
      });

      await buildRecipeRecommendations(request);

      expect(request).toEqual(copy);
    });

    it('28. Confirmar que generateRecipeRecommendations sigue siendo llamado exactamente una vez', async () => {
      const pantry = [buildPantryIngredient('paltas')];
      const request = buildRequest(pantry);

      mockedGenerateRecipeRecommendations.mockResolvedValueOnce({
        recipes: [
          buildGeneratedRecipe('Ensalada', [
            { name: 'aguacate', quantity: 1, unit: 'unidad' },
          ]),
        ],
      });

      await buildRecipeRecommendations(request);

      expect(mockedGenerateRecipeRecommendations).toHaveBeenCalledTimes(1);
      expect(mockedGenerateRecipeRecommendations).toHaveBeenCalledWith(request);
    });
  });
});
