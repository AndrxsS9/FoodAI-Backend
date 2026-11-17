import type { Ingredient } from '../schemas/ingredient.schema';
import type { RecipeIngredient } from '../schemas/recipe.schema';

export type NormalizedIngredientUnit = 'unidad' | 'g' | 'ml';

export interface NormalizedIngredientQuantity {
  quantity: number;
  unit: NormalizedIngredientUnit;
}

export type IngredientUnit =
  | Ingredient['unit']
  | RecipeIngredient['unit'];

export function normalizeIngredientQuantity(
  quantity: number | null | undefined,
  unit: IngredientUnit | string | null | undefined,
): NormalizedIngredientQuantity | null {
  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  if (typeof unit !== 'string') {
    return null;
  }

  switch (unit) {
    case 'g':
      return {
        quantity,
        unit: 'g',
      };

    case 'kg':
      return {
        quantity: quantity * 1000,
        unit: 'g',
      };

    case 'ml':
      return {
        quantity,
        unit: 'ml',
      };

    case 'l':
      return {
        quantity: quantity * 1000,
        unit: 'ml',
      };

    case 'unidad':
      return {
        quantity,
        unit: 'unidad',
      };

    default:
      return null;
  }
}

export type IngredientQuantityComparison =
  | 'sufficient'
  | 'insufficient'
  | 'unknown';

export function compareIngredientQuantities(
  availableQuantity: number | null | undefined,
  availableUnit: IngredientUnit | string | null | undefined,
  requiredQuantity: number | null | undefined,
  requiredUnit: IngredientUnit | string | null | undefined,
): IngredientQuantityComparison {
  const normalizedAvailable = normalizeIngredientQuantity(
    availableQuantity,
    availableUnit,
  );

  const normalizedRequired = normalizeIngredientQuantity(
    requiredQuantity,
    requiredUnit,
  );

  if (!normalizedAvailable || !normalizedRequired) {
    return 'unknown';
  }

  if (normalizedAvailable.unit !== normalizedRequired.unit) {
    return 'unknown';
  }

  return normalizedAvailable.quantity >= normalizedRequired.quantity
    ? 'sufficient'
    : 'insufficient';
}

export interface IngredientQuantityItem {
  quantity: number | null | undefined;
  unit: IngredientUnit | string | null | undefined;
}

export function sumCompatibleIngredientQuantities(
  items: IngredientQuantityItem[],
): NormalizedIngredientQuantity | null {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return null;
  }

  const normalizedItems: NormalizedIngredientQuantity[] = [];

  for (const item of items) {
    if (!item) {
      return null;
    }

    const normalized = normalizeIngredientQuantity(
      item.quantity,
      item.unit,
    );

    if (!normalized) {
      return null;
    }

    normalizedItems.push(normalized);
  }

  const baseUnit = normalizedItems[0].unit;

  const allSameUnit = normalizedItems.every(
    (normalized) => normalized.unit === baseUnit,
  );

  if (!allSameUnit) {
    return null;
  }

  const totalQuantity = normalizedItems.reduce(
    (sum, normalized) => sum + normalized.quantity,
    0,
  );

  return {
    quantity: totalQuantity,
    unit: baseUnit,
  };
}
