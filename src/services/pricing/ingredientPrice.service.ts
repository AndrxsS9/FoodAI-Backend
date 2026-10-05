import type {
  RecipeIngredient,
} from '../../schemas/recipe.schema';

interface PriceRule {
  aliases: string[];
  estimatedPurchasePrice: number;
}

const ingredientPriceCatalog: PriceRule[] = [
  {
    aliases: ['tomate', 'tomates', 'tomate rojo'],
    estimatedPurchasePrice: 1500,
  },
  {
    aliases: [
      'cebolla',
      'cebolla cabezona',
      'cebolla blanca',
      'cebolla roja',
    ],
    estimatedPurchasePrice: 1500,
  },
  {
    aliases: ['cebolla larga', 'cebolla de rama'],
    estimatedPurchasePrice: 2000,
  },
  {
    aliases: ['papa', 'papas', 'patata'],
    estimatedPurchasePrice: 2500,
  },
  {
    aliases: ['zanahoria', 'zanahorias'],
    estimatedPurchasePrice: 1500,
  },
  {
    aliases: ['huevo', 'huevos'],
    estimatedPurchasePrice: 800,
  },
  {
    aliases: ['arroz'],
    estimatedPurchasePrice: 3500,
  },
  {
    aliases: [
      'pasta',
      'espagueti',
      'spaghetti',
      'macarrones',
    ],
    estimatedPurchasePrice: 3500,
  },
  {
    aliases: [
      'pollo',
      'pechuga de pollo',
      'muslo de pollo',
    ],
    estimatedPurchasePrice: 9000,
  },
  {
    aliases: [
      'carne',
      'carne de res',
      'carne molida',
    ],
    estimatedPurchasePrice: 12000,
  },
  {
    aliases: ['leche'],
    estimatedPurchasePrice: 4500,
  },
  {
    aliases: [
      'queso',
      'queso campesino',
      'queso mozzarella',
    ],
    estimatedPurchasePrice: 6500,
  },
  {
    aliases: ['ajo', 'diente de ajo'],
    estimatedPurchasePrice: 1000,
  },
  {
    aliases: [
      'aceite',
      'aceite vegetal',
      'aceite de cocina',
    ],
    estimatedPurchasePrice: 7000,
  },
  {
    aliases: ['harina', 'harina de trigo'],
    estimatedPurchasePrice: 3500,
  },
  {
    aliases: ['sal'],
    estimatedPurchasePrice: 1500,
  },
  {
    aliases: ['azucar', 'azúcar'],
    estimatedPurchasePrice: 3500,
  },
];

const UNKNOWN_INGREDIENT_ESTIMATED_COST = 5000;

function normalizeIngredientName(
  name: string,
): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPriceRule(
  ingredientName: string,
): PriceRule | undefined {
  const normalizedName =
    normalizeIngredientName(ingredientName);

  return ingredientPriceCatalog.find((rule) =>
    rule.aliases.some(
      (alias) =>
        normalizeIngredientName(alias) ===
        normalizedName,
    ),
  );
}

export function estimateIngredientCost(
  ingredient: RecipeIngredient,
): number {
  const rule = findPriceRule(
    ingredient.name,
  );

  if (!rule) {
    return UNKNOWN_INGREDIENT_ESTIMATED_COST;
  }

  return rule.estimatedPurchasePrice;
}

export function estimateMissingIngredientsCost(
  ingredients: RecipeIngredient[],
): number {
  return ingredients.reduce(
    (total, ingredient) =>
      total +
      estimateIngredientCost(ingredient),
    0,
  );
}